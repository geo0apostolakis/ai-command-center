import { chat } from './agent.js';
import { DEMO_MODE, demoNewsletter } from './demo.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));

function loadClients() {
  return JSON.parse(readFileSync(join(__dir, '../data/clients.json'), 'utf8'));
}

const FILTER_SYS = `Extract targeting criteria from a tax advisory email instruction.
Return ONLY valid JSON:
{
  "types": ["C-Corp","S-Corp","LLC","Partnership"],
  "services": ["r-and-d","equity","crypto","multi-state","corporate-tax"],
  "states": ["CA","NY","DE","TX","WY"],
  "all": false
}
Use empty arrays [] to mean "no filter on this field" (match all). Set all:true if instruction targets every client.`;

const EMAIL_SYS = `You write concise, professional tax advisory emails for Acme Tax,
a premium CPA firm whose clients are funded US tech startups.
Write in clean HTML (body content only — no <html>/<body> tags, no markdown, no backticks).
Max 180 words. Address the client by company name. Be specific, professional, action-oriented.
Sign off as: The Acme Tax Team`;

export async function analyze({ subject, message, filters = {} }) {
  const clients = loadClients();
  if (DEMO_MODE) {
    const withEmails = await demoNewsletter(clients);
    return { clients: withEmails, previewHtml: withEmails[0]?.html || '' };
  }

  const filterRaw = await chat(
    [
      { role: 'system', content: FILTER_SYS },
      { role: 'user', content: `Instruction: ${message}\nUI filters: ${JSON.stringify(filters)}` },
    ],
    { json: true, temperature: 0.1 }
  );

  let criteria = { types: [], services: [], states: [], all: false };
  try { criteria = JSON.parse(filterRaw); } catch {}

  function buildReason(c, criteria) {
    const reasons = [];
    if (criteria.services?.length) {
      const hit = criteria.services.filter(s => c.services.includes(s));
      if (hit.length) reasons.push(`has ${hit.join(', ')} service`);
    }
    if (criteria.types?.length && criteria.types.includes(c.type)) reasons.push(`entity type: ${c.type}`);
    if (criteria.states?.length && criteria.states.includes(c.state)) reasons.push(`state: ${c.state}`);
    if (criteria.all) reasons.push('all clients targeted');
    return reasons.length ? reasons.join(' · ') : 'matched by AI';
  }

  let matched = criteria.all
    ? clients
    : clients.filter(c => {
        if (criteria.types?.length && !criteria.types.includes(c.type)) return false;
        if (criteria.services?.length && !criteria.services.some(s => c.services.includes(s))) return false;
        if (criteria.states?.length && !criteria.states.includes(c.state)) return false;
        return true;
      });

  if (!matched.length) matched = clients;

  const withEmails = await Promise.all(
    matched.map(async c => {
      const reason = buildReason(c, criteria);
      const html = await chat([
        { role: 'system', content: EMAIL_SYS },
        {
          role: 'user',
          content: `Client: ${c.name} (${c.type}, incorporated in ${c.state})
Contact: ${c.contactName}
Services: ${c.services.join(', ')}
Raised: ${c.raised || 'n/a'}
Notes: ${c.notes || ''}

Email subject: ${subject}
Instruction: ${message}

Write the email body HTML.`,
        },
      ], { temperature: 0.5 });
      return { ...c, html, matchReason: reason };
    })
  );

  return {
    clients: withEmails,
    previewHtml: withEmails[0]?.html || '',
  };
}
