import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

let _pc = null, _openai = null;

function pc() {
  if (!_pc && process.env.PINECONE_API_KEY)
    _pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  return _pc;
}

function oai() {
  if (!_openai && process.env.OPENAI_API_KEY)
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

async function embed(text) {
  const client = oai();
  if (!client) throw new Error('OPENAI_API_KEY not set — required for Pinecone embeddings');
  const res = await client.embeddings.create({ model: 'text-embedding-3-small', input: text });
  return res.data[0].embedding;
}

// Returns [{text, source, page, namespace, score}] sorted by relevance
export async function query(question, namespaces = ['tax-laws', 'irs-guidance', 'client-memory']) {
  const client = pc();
  if (!client) return [];
  const vector = await embed(question);
  const index = client.index(process.env.PINECONE_INDEX || 'command-center');
  const allMatches = [];
  for (const ns of namespaces) {
    try {
      const res = await index.namespace(ns).query({ vector, topK: 3, includeMetadata: true });
      for (const m of res.matches || []) {
        if (m.metadata?.text) {
          allMatches.push({
            text: m.metadata.text,
            source: m.metadata.source || 'knowledge base',
            page: m.metadata.page || null,
            namespace: ns,
            score: Math.round((m.score || 0) * 100) / 100,
          });
        }
      }
    } catch {}
  }
  allMatches.sort((a, b) => b.score - a.score);
  return allMatches;
}

export async function upsert(text, metadata = {}, namespace = 'client-memory') {
  const client = pc();
  if (!client) throw new Error('PINECONE_API_KEY not set');
  const vector = await embed(text);
  const id = `mem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await client.index(process.env.PINECONE_INDEX || 'command-center')
    .namespace(namespace)
    .upsert([{ id, values: vector, metadata: { text, ...metadata } }]);
  return { id };
}

// Chunks a document, batch-embeds, upserts to Pinecone with page metadata
export async function ingestDocument(buffer, filename, namespace = 'client-memory') {
  const client = pc();
  if (!client) throw new Error('PINECONE_API_KEY not set');
  const openaiClient = oai();
  if (!openaiClient) throw new Error('OPENAI_API_KEY not set');

  const isPdf = filename.toLowerCase().endsWith('.pdf');
  let fullText = '';
  let totalPages = 1;

  if (isPdf) {
    const { default: pdfParse } = await import('pdf-parse');
    const result = await pdfParse(buffer);
    fullText = result.text;
    totalPages = result.numpages || 1;
  } else {
    fullText = buffer.toString('utf8');
    totalPages = Math.max(1, Math.ceil(fullText.length / 3000));
  }

  if (!fullText.trim()) throw new Error('No text could be extracted from document');

  const avgCharsPerPage = fullText.length / totalPages;
  const paragraphs = fullText
    .split(/\n\n+/)
    .map(p => p.replace(/\s+/g, ' ').trim())
    .filter(p => p.length > 30);

  const chunks = [];
  let charOffset = 0;

  for (const para of paragraphs) {
    const estimatedPage = Math.min(totalPages, Math.max(1, Math.ceil((charOffset + para.length / 2) / avgCharsPerPage)));
    const words = para.split(/\s+/);
    for (let i = 0; i < words.length; i += 150) {
      const chunkText = words.slice(i, i + 150).join(' ').trim();
      if (chunkText.length >= 30) chunks.push({ text: chunkText, page: estimatedPage, chunkIndex: chunks.length });
    }
    charOffset += para.length + 2;
  }

  if (!chunks.length) throw new Error('Document produced no indexable chunks');

  const embedRes = await openaiClient.embeddings.create({
    model: 'text-embedding-3-small',
    input: chunks.map(c => c.text),
  });

  const safeId = filename.replace(/[^a-z0-9]/gi, '-').slice(0, 40);
  const ts = Date.now();
  const vectors = chunks.map((chunk, i) => ({
    id: `${safeId}-${i}-${ts}`,
    values: embedRes.data[i].embedding,
    metadata: { text: chunk.text, source: filename, page: chunk.page, chunkIndex: chunk.chunkIndex },
  }));

  const ns = client.index(process.env.PINECONE_INDEX || 'command-center').namespace(namespace);
  for (let i = 0; i < vectors.length; i += 100) await ns.upsert(vectors.slice(i, i + 100));

  return { chunks: vectors.length, source: filename, pages: totalPages };
}
