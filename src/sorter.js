import { chat } from './agent.js';
import { DEMO_MODE, demoSorter } from './demo.js';
import { mkdirSync, writeFileSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const SORTED_ROOT = join(__dir, '../data/sorted');

const SYS = `You are a tax document classifier for Acme Tax, a CPA firm serving US tech startups.
Given text extracted from a document (or just the filename if no text was extracted), classify it.
Return ONLY valid JSON — no explanation, no markdown:
{
  "docType": "W-2|1099-NEC|1099-K|1099-INT|1099-DIV|K-1|Bank Statement|Receipt|Equity Grant|Cap Table|Payroll Summary|Loan Document|R&D Documentation|Other",
  "client": "<company name or Unknown>",
  "taxYear": <year as number or null>,
  "destination": "<ClientName>/<Year>/<DocType>/",
  "confidence": "high|medium|low",
  "notes": "<one sentence summary>"
}`;

function saveFile(buffer, classification, originalName) {
  try {
    const client  = (classification.client  || 'Unknown').replace(/[/\\?%*:|"<>]/g, '-');
    const year    = String(classification.taxYear || new Date().getFullYear());
    const docType = (classification.docType || 'Other').replace(/[/\\?%*:|"<>]/g, '-');
    const dir = join(SORTED_ROOT, client, year, docType);
    mkdirSync(dir, { recursive: true });
    const ext  = extname(originalName) || '.pdf';
    const base = originalName.replace(ext, '').replace(/[/\\?%*:|"<>]/g, '-').slice(0, 80);
    const dest = join(dir, base + ext);
    writeFileSync(dest, buffer);
    return dest.replace(SORTED_ROOT + '/', '');
  } catch {
    return classification.destination || 'Unknown/';
  }
}

export async function classify(buffer, filename, mimetype) {
  if (DEMO_MODE) {
    const result = await demoSorter(filename);
    result.savedTo = `data/sorted/${result.destination}${filename}`;
    return result;
  }

  let text = '';
  if (mimetype === 'application/pdf' || filename.toLowerCase().endsWith('.pdf')) {
    try {
      const { default: pdfParse } = await import('pdf-parse');
      const parsed = await pdfParse(buffer);
      text = parsed.text.slice(0, 3000);
    } catch {}
  }

  const input = text
    ? `Filename: ${filename}\n\nExtracted text (first 3000 chars):\n${text}`
    : `Filename: ${filename}\n(Binary or non-text file — classify by filename only)`;

  const raw = await chat(
    [{ role: 'system', content: SYS }, { role: 'user', content: input }],
    { json: true }
  );

  let result;
  try {
    result = JSON.parse(raw);
  } catch {
    result = { docType: 'Other', client: 'Unknown', taxYear: null, destination: 'Review/Unknown/', confidence: 'low', notes: 'Classification failed — manual review required' };
  }

  // Actually save the file into the organized local folder
  result.savedTo = saveFile(buffer, result, filename);
  return result;
}
