import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, copyFileSync, unlinkSync, existsSync } from 'fs';
import { basename } from 'path';

import { chat } from './src/agent.js';
import { DEMO_MODE, demoLibrarian } from './src/demo.js';
import { query as pineconeQuery, upsert as pineconeUpsert, ingestDocument } from './src/pinecone.js';
import { sendEmail, createDraft, testConnection } from './src/email.js';
import { classify } from './src/sorter.js';
import { analyze as nlAnalyze } from './src/newsletter.js';
import { addActivity, getActivity, addEmail, getEmails } from './src/store.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const PORT  = process.env.PORT || 8800;

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(join(__dir, 'public')));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

function loadClients() {
  return JSON.parse(readFileSync(join(__dir, 'data/clients.json'), 'utf8'));
}

// ── Librarian: Ask ────────────────────────────────────────────────────────────
app.post('/api/librarian/ask', async (req, res) => {
  const { question, history = [] } = req.body;
  if (!question) return res.status(400).json({ error: 'question required' });
  try {
    if (DEMO_MODE) {
      const answer = await demoLibrarian(question);
      addActivity(`Librarian answered: "${question.slice(0, 60)}"`, 'librarian');
      return res.json({ answer, sources: [] });
    }
    const matches = await pineconeQuery(question);
    const top = matches.slice(0, 4);
    const contextBlock = top.length
      ? top.map((m, i) => `[${i + 1}] (${m.source}, page ${m.page || '?'}): ${m.text}`).join('\n\n')
      : '';
    const sys = `You are a US tax expert assistant for Acme Tax, a premium CPA firm serving funded tech startups.
${contextBlock ? `\nRelevant context from knowledge base:\n${contextBlock}\n\nWhen citing facts from context, reference the source as [1], [2], [3].` : ''}
Answer precisely. Cite IRS code sections when relevant. Say "I'm not certain" if unsure — never fabricate.`;
    // last 5 exchanges (10 messages) passed from the client
    const priorMessages = (Array.isArray(history) ? history : []).slice(-10);
    const answer = await chat([
      { role: 'system', content: sys },
      ...priorMessages,
      { role: 'user', content: question },
    ]);
    const sources = top.filter(m => m.score > 0.25).map(m => ({
      text: m.text.slice(0, 220),
      source: m.source,
      page: m.page,
      score: m.score,
    }));
    addActivity(`Librarian answered: "${question.slice(0, 60)}"`, 'librarian');
    res.json({ answer, sources });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ── Librarian: Teach ──────────────────────────────────────────────────────────
app.post('/api/librarian/teach', async (req, res) => {
  const { text, client, category, namespace } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });
  try {
    const result = await pineconeUpsert(text, { client, category }, namespace || 'client-memory');
    addActivity(`Librarian taught: ${category || 'note'}${client ? ` — ${client}` : ''}`, 'librarian');
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Librarian: Ingest Document ────────────────────────────────────────────────
app.post('/api/librarian/ingest', upload.single('document'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file received' });
  const namespace = req.body.namespace || 'client-memory';
  try {
    const result = await ingestDocument(req.file.buffer, req.file.originalname, namespace);
    addActivity(`Librarian: ingested "${req.file.originalname}" — ${result.chunks} chunks`, 'librarian');
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ── Sorter: Upload ────────────────────────────────────────────────────────────
app.post('/api/sorter/upload', upload.single('data'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file received' });
  try {
    const result = await classify(req.file.buffer, req.file.originalname, req.file.mimetype);
    addActivity(`Sorter: "${req.file.originalname}" → ${result.destination}`, 'sorter');
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ── Newsletter: Analyze ───────────────────────────────────────────────────────
app.post('/api/newsletter/analyze', async (req, res) => {
  const { subject, message, filters } = req.body;
  if (!subject || !message) return res.status(400).json({ error: 'subject and message required' });
  try {
    const result = await nlAnalyze({ subject, message, filters });
    addActivity(`Newsletter: ${result.clients.length} recipients matched`, 'newsletter');
    res.json({ clients: result.clients, draftHtml: result.previewHtml });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ── Newsletter: Create Drafts ─────────────────────────────────────────────────
app.post('/api/newsletter/draft', async (req, res) => {
  const { subject, recipients, fromEmail } = req.body;
  if (!recipients?.length) return res.status(400).json({ error: 'no recipients' });
  const results = [];
  for (const r of recipients) {
    try {
      const draft = await createDraft({ to: r.email, subject, html: r.html || '', fromEmail });
      addEmail({ to: r.email, subject, agent: 'newsletter', html: r.html });
      results.push({ email: r.email, name: r.name, ok: true, draftId: draft.draftId, webLink: draft.webLink });
    } catch (e) {
      console.error(`Draft failed → ${r.email}:`, e.message);
      results.push({ email: r.email, name: r.name, ok: false, error: e.message });
    }
  }
  const ok = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  addActivity(`Newsletter: ${ok} drafts created, ${failed} failed`, 'newsletter');
  res.json({ ok, failed, results });
});

// ── Newsletter: Test Outlook Connection ───────────────────────────────────────
app.post('/api/newsletter/test-connection', async (req, res) => {
  const { fromEmail } = req.body;
  const result = await testConnection(fromEmail);
  res.json(result);
});

// ── Newsletter: Save From-Email to .env ───────────────────────────────────────
app.post('/api/newsletter/set-from', (req, res) => {
  const { fromEmail } = req.body;
  if (!fromEmail) return res.status(400).json({ error: 'fromEmail required' });
  // Written into .env, so anything but a plain address could add lines to it.
  if (!/^[^\s@=]+@[^\s@=]+\.[^\s@=]+$/.test(fromEmail)) return res.status(400).json({ error: 'invalid email' });
  try {
    const envPath = join(__dir, '.env');
    let env = readFileSync(envPath, 'utf8');
    if (env.includes('OUTLOOK_FROM_EMAIL=')) {
      env = env.replace(/OUTLOOK_FROM_EMAIL=.*/, `OUTLOOK_FROM_EMAIL=${fromEmail}`);
    } else {
      env += `\nOUTLOOK_FROM_EMAIL=${fromEmail}`;
    }
    writeFileSync(envPath, env);
    process.env.OUTLOOK_FROM_EMAIL = fromEmail;
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Clients ───────────────────────────────────────────────────────────────────
app.get('/api/clients', (req, res) => {
  try { res.json(loadClients()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Deadlines: Scan ───────────────────────────────────────────────────────────
const DEADLINE_RULES = [
  { type: 'Q2 Estimated Tax — PAST DUE (Jun 15)',  due: '2026-06-15', days: -3,  forTypes: ['C-Corp','S-Corp','LLC','Partnership'], severity: 'high' },
  { type: 'Q3 Estimated Tax (Sep 15)',              due: '2026-09-15', days: 89,  forTypes: ['C-Corp','S-Corp','LLC','Partnership'], severity: 'medium' },
  { type: '1120-S / 1065 Extended Return (Sep 15)', due: '2026-09-15', days: 89,  forTypes: ['S-Corp','Partnership'],               severity: 'medium' },
  { type: '1120 Extended Return (Oct 15)',          due: '2026-10-15', days: 119, forTypes: ['C-Corp'],                             severity: 'low' },
  { type: '1040 Extended Return (Oct 15)',          due: '2026-10-15', days: 119, forTypes: ['C-Corp','S-Corp','LLC'],             severity: 'low' },
];

app.post('/api/deadlines/scan', (req, res) => {
  try {
    const clients = loadClients();
    const items = [];
    for (const c of clients) {
      for (const rule of DEADLINE_RULES) {
        if (rule.forTypes.includes(c.type)) {
          items.push({ client: c.name, type: rule.type, dueDate: rule.due, severity: rule.severity, days: rule.days });
        }
      }
    }
    items.sort((a, b) => a.days - b.days);
    addActivity(`Deadline scan: ${items.length} obligations across ${clients.length} clients`, 'deadlines');
    res.json({ items: items.slice(0, 25) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Deadlines: Remind ─────────────────────────────────────────────────────────
app.post('/api/deadlines/remind', async (req, res) => {
  const { client, type, dueDate } = req.body;
  try {
    const clients = loadClients();
    const c = clients.find(cl => cl.name === client);
    const html = await chat([
      { role: 'system', content: 'Write a brief, professional tax deadline reminder (HTML body only, max 100 words). From: Acme Tax. No markdown, no backticks.' },
      { role: 'user', content: `Client: ${client}\nDeadline: ${type}\nDue: ${dueDate}` },
    ]);
    if (c?.email) {
      await sendEmail({ to: c.email, subject: `Acme Tax: Upcoming Deadline — ${type}`, html });
      addEmail({ to: c.email, subject: `Acme Tax: Upcoming Deadline — ${type}`, agent: 'deadlines', html });
    }
    addActivity(`Deadline reminder → ${client}`, 'deadlines');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Clients: Add (Onboarding) ─────────────────────────────────────────────────
app.post('/api/clients/add', async (req, res) => {
  const { name, ein, type, state, contactName, email, services } = req.body;
  if (!name || !ein) return res.status(400).json({ error: 'Company name and EIN are required' });
  try {
    const clients = loadClients();
    if (clients.find(c => c.ein === ein)) {
      return res.status(409).json({ error: `A client with EIN ${ein} already exists` });
    }
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();
    const newClient = {
      id, name,
      type:        type        || 'C-Corp',
      state:       state       || 'DE',
      ein,
      contactName: contactName || '',
      email:       email       || '',
      services:    Array.isArray(services) ? services : ['corporate-tax'],
      founded:     new Date().getFullYear(),
      preparer:    'Acme Tax',
      raised:      '',
      notes:       `Onboarded ${new Date().toISOString().slice(0, 10)}`,
    };
    clients.push(newClient);
    const clientsPath = join(__dir, 'data/clients.json');
    writeFileSync(clientsPath, JSON.stringify(clients, null, 2));
    mkdirSync(join(__dir, 'data/sorted', name), { recursive: true });
    addActivity(`Onboarding: "${name}" (EIN: ${ein}) added`, 'onboarding');
    res.json({ ok: true, client: newClient });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ── Demo Files ────────────────────────────────────────────────────────────────
app.get('/api/demo-files', (req, res) => {
  const dir = join(__dir, 'data/inbox');
  try {
    const files = readdirSync(dir)
      .filter(f => !f.startsWith('.') && (f.endsWith('.pdf') || f.endsWith('.txt')))
      .map(f => {
        const s = statSync(join(dir, f));
        return { name: f, size: s.size, inboxPath: `data/inbox/${f}` };
      });
    res.json(files);
  } catch { res.json([]); }
});

// ── Sorter: Sort Demo File (moves file from inbox → sorted) ──────────────────
app.post('/api/sorter/sort-demo', async (req, res) => {
  const { filename } = req.body;
  if (!filename) return res.status(400).json({ error: 'filename required' });
  const safe = basename(filename);
  const inboxPath = join(__dir, 'data/inbox', safe);
  if (!existsSync(inboxPath)) return res.status(404).json({ error: 'File not in inbox — already sorted or reset needed' });
  try {
    const buffer = readFileSync(inboxPath);
    const result = await classify(buffer, safe, 'application/pdf');
    // classify() already wrote to data/sorted/ — remove from inbox
    const destFull = join(__dir, 'data/sorted', result.savedTo);
    if (existsSync(destFull)) unlinkSync(inboxPath);
    result.fromPath = `data/inbox/${safe}`;
    addActivity(`Sorter: "${safe}" → ${result.destination}`, 'sorter');
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ── Demo: Reset Inbox ─────────────────────────────────────────────────────────
app.post('/api/demo/reset', (req, res) => {
  const src = join(__dir, 'demo-files');
  const dst = join(__dir, 'data/inbox');
  try {
    mkdirSync(dst, { recursive: true });
    const files = readdirSync(src).filter(f => f.endsWith('.pdf'));
    for (const f of files) copyFileSync(join(src, f), join(dst, f));
    res.json({ ok: true, restored: files.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Email Log ─────────────────────────────────────────────────────────────────
app.get('/api/emails', (req, res) => res.json({ rows: getEmails(50) }));

// ── Activity ──────────────────────────────────────────────────────────────────
app.get('/api/activity', (req, res) => res.json({ rows: getActivity(20) }));

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({
  ok: true,
  services: {
    openrouter: !!process.env.OPENROUTER_API_KEY,
    pinecone:   !!process.env.PINECONE_API_KEY,
    openai:     !!process.env.OPENAI_API_KEY,
    outlook:    !!(process.env.OUTLOOK_CLIENT_ID && process.env.OUTLOOK_FROM_EMAIL),
  },
}));

// No auth: this is a single-user demo, so it listens on this machine only.
const HOST = process.env.HOST || '127.0.0.1';
app.listen(PORT, HOST, () => {
  console.log(`\n🎯  AI Command Center → http://localhost:${PORT}`);
  console.log(`    OpenRouter: ${process.env.OPENROUTER_API_KEY ? '✓' : '✗ missing'}`);
  console.log(`    Pinecone:   ${process.env.PINECONE_API_KEY   ? '✓' : '✗ missing (Librarian skips RAG)'}`);
  console.log(`    OpenAI:     ${process.env.OPENAI_API_KEY     ? '✓' : '✗ missing (required for Pinecone)'}`);
  console.log(`    Outlook:    ${process.env.OUTLOOK_CLIENT_ID  ? '✓' : '✗ not set (emails stubbed to console)'}\n`);
});
