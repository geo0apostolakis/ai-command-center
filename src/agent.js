import { DEMO_MODE } from './demo.js';

const BASE = 'https://openrouter.ai/api/v1';

export async function chat(messages, opts = {}) {
  if (DEMO_MODE) return '{}'; // caller-level demo overrides handle responses
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY not set');
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/geo0apostolakis/ai-command-center',
      'X-Title': 'AI Command Center',
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'openai/gpt-4.1-mini',
      messages,
      temperature: opts.temperature ?? 0.3,
      ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content;
}
