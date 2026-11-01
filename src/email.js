const { OUTLOOK_CLIENT_ID, OUTLOOK_CLIENT_SECRET, OUTLOOK_TENANT_ID, OUTLOOK_FROM_EMAIL } = process.env;

let _token = null, _expiry = 0;

async function getToken() {
  if (_token && Date.now() < _expiry) return _token;
  const res = await fetch(
    `https://login.microsoftonline.com/${OUTLOOK_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: OUTLOOK_CLIENT_ID,
        client_secret: OUTLOOK_CLIENT_SECRET,
        scope: 'https://graph.microsoft.com/.default',
      }),
    }
  );
  if (!res.ok) throw new Error(`Outlook token error: ${await res.text()}`);
  const data = await res.json();
  _token = data.access_token;
  _expiry = Date.now() + (data.expires_in - 60) * 1000;
  return _token;
}

// Creates a draft in Outlook Drafts folder (does NOT send)
export async function createDraft({ to, subject, html, fromEmail }) {
  const sender = fromEmail || OUTLOOK_FROM_EMAIL;
  if (!OUTLOOK_CLIENT_ID || !sender) {
    console.log(`[DRAFT STUB] To: ${to} | Subject: ${subject}`);
    return { draftId: 'stub-' + Date.now(), webLink: null };
  }
  const token = await getToken();
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/messages`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject,
        body: { contentType: 'HTML', content: html },
        toRecipients: [{ emailAddress: { address: to } }],
      }),
    }
  );
  if (!res.ok) throw new Error(`Graph API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return { draftId: data.id, webLink: data.webLink || null };
}

// Legacy send (kept for deadline reminders etc.)
export async function sendEmail({ to, subject, html }) {
  if (!OUTLOOK_CLIENT_ID) {
    console.log(`[EMAIL STUB] To: ${to} | Subject: ${subject}`);
    return;
  }
  const token = await getToken();
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(OUTLOOK_FROM_EMAIL)}/sendMail`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: 'HTML', content: html },
          toRecipients: [{ emailAddress: { address: to } }],
        },
      }),
    }
  );
  if (!res.ok && res.status !== 202)
    throw new Error(`Graph API ${res.status}: ${await res.text()}`);
}

export async function testConnection(fromEmail) {
  const sender = fromEmail || OUTLOOK_FROM_EMAIL;
  if (!OUTLOOK_CLIENT_ID || !sender) return { ok: false, error: 'Credentials not configured' };
  try {
    const token = await getToken();
    // Use messages endpoint (requires Mail.ReadWrite) — mailboxSettings needs a different scope
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/messages?$top=1&$select=id`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body.error?.message || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
