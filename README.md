# AI Command Center

Three AI agents for a US tax firm, run from one dashboard. The Librarian answers tax questions from the firm's own documents and cites where each answer came from. The Sorter reads an incoming document and files it under client, year and form type. The Newsletter turns one instruction in plain English into a personal email for each matching client and leaves them as drafts in Outlook.

I built it in June 2026 for a live sales demo with the head of operations of a US CPA firm. The firm in this repository is a placeholder ("Acme Tax"), and every client, person and number in `data/` and `demo-files/` is made up.

Node.js · Express · OpenRouter · OpenAI embeddings · Pinecone · Microsoft Graph

```bash
npm install
./start.sh          # first run creates .env with DEMO_MODE=true, then starts it
# open http://localhost:8800
```

Demo mode needs no API keys. Each agent returns a prepared answer after a short delay, which is how the sales demo ran without depending on the network.

## How each agent works

### Librarian

- A dropped PDF or text file is split into paragraphs and then into chunks of up to 150 words. The chunks are embedded with `text-embedding-3-small` and stored in Pinecone, 100 vectors per request.
- A question is embedded once and searched across three namespaces (`tax-laws`, `irs-guidance`, `client-memory`), three hits from each. The best four go into the prompt as numbered sources, and the model is told to cite them as `[1]`, `[2]` and to say it is not certain instead of guessing.
- The panel shows each source with its file, page and match score. Hits under 0.25 are hidden.
- The last ten messages of the conversation go with every question, so follow-ups work.
- "Teach" stores a single note in client memory, with no document needed.

### Sorter

- The first 3,000 characters of the PDF are extracted and sent with the file name to the model. It must answer with JSON only, giving one of 14 document types (W-2, 1099-NEC, K-1, bank statement and so on), the client, the tax year and a confidence.
- The file is then written to `data/sorted/<client>/<year>/<type>/`, with path characters cleaned first. If the model's answer is not valid JSON, the document goes to review with low confidence instead of a guessed folder.
- The inbox has five sample documents. "Reset" puts them back.

### Newsletter

- The instruction ("remind every C-Corp with R&D credits about Q3 estimates") goes to the model at temperature 0.1, which returns targeting rules as JSON (entity types, services and states).
- Those rules filter the client list in code, so the model never picks recipients directly. Each recipient shows the reason they matched.
- Each matching client gets its own email, written from that client's profile (entity type, state, services, funding, notes).
- Emails are created as Outlook drafts through Microsoft Graph and are never sent by the app. A person reads them and presses send. Without Outlook credentials the drafts are logged to the console.

### Also in the dashboard

- Deadline watcher. A rule table of 2026 federal deadlines matched to each client's entity type, sorted by days left. A reminder is written by the model and, unlike the newsletter, sent directly.
- Client onboarding. A new client is refused if the EIN already exists, and its folder is created for the Sorter.

## Known limits

- No login. It is a single-user demo, so the server listens on `127.0.0.1` unless you set `HOST`. Do not expose it to a network as it is.
- Page numbers in citations are estimated from where a chunk sits in the extracted text, because `pdf-parse` returns one block of text per document. Treat them as approximate.
- If the newsletter's rules match no client, it falls back to every client. They are still only drafts, but check the recipient list before sending.
- The deadline dates are written for 2026 and need updating each year.
- Clients, activity and the email log are JSON files in `data/`. Fine for a demo, not for a firm.

## Layout

```
server.js               routes for all agents, deadlines, onboarding, demo reset
src/agent.js            one chat call through OpenRouter
src/pinecone.js         chunking, embeddings, upserts, search across namespaces
src/sorter.js           classify a document and file it
src/newsletter.js       instruction to targeting rules, then one email per client
src/email.js            Microsoft Graph token, drafts, send
src/demo.js             canned answers for DEMO_MODE
src/store.js            activity and email log
public/index.html       the dashboard
scripts/make-sample-pdfs.mjs   writes the fictional sample documents
```

## License

MIT
