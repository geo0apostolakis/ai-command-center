import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const ACTIVITY_PATH = join(__dir, '../data/activity.json');
const EMAILS_PATH   = join(__dir, '../data/emails.json');

function load(path, def) {
  try { return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : def; }
  catch { return def; }
}
function save(path, data) {
  try { writeFileSync(path, JSON.stringify(data, null, 2)); } catch {}
}

const activity = load(ACTIVITY_PATH, []);
const emails   = load(EMAILS_PATH, []);

export function addActivity(msg, agent = '') {
  const entry = { msg, agent, ts: new Date().toISOString() };
  activity.unshift(entry);
  if (activity.length > 100) activity.pop();
  save(ACTIVITY_PATH, activity.slice(0, 100));
  return entry;
}

export function getActivity(limit = 20) {
  return activity.slice(0, limit);
}

export function addEmail({ to, subject, agent, html }) {
  const entry = { to, subject, agent, html, ts: new Date().toISOString() };
  emails.unshift(entry);
  if (emails.length > 200) emails.pop();
  save(EMAILS_PATH, emails.slice(0, 200));
  return entry;
}

export function getEmails(limit = 50) {
  return emails.slice(0, limit);
}
