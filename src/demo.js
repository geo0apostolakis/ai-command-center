// Demo mode — realistic pre-written responses with simulated AI delay.
// Activated by DEMO_MODE=true in .env.
// Zero API keys needed. Safe for live demos.

export const DEMO_MODE = process.env.DEMO_MODE === 'true';

const delay = ms => new Promise(r => setTimeout(r, ms));
const jitter = (base, range) => base + Math.random() * range;

// ── Librarian ──────────────────────────────────────────────────────────────────
const LIB = {
  rd: `## R&D Tax Credit — IRC §41

Under **IRC Section 41**, the credit rewards companies for increasing qualified research expenses (QREs).

**What qualifies as QREs:**
- Employee wages for qualified research services
- Supplies consumed or destroyed during research
- 65% of contract research payments to third parties

**Two calculation methods:**
1. **Regular Credit** — 20% of QREs exceeding the base amount
2. **Alternative Simplified Credit (ASC)** — 14% of QREs exceeding 50% of prior 3-year average (recommended for most startups)

**Startup payroll offset (IRC §41(h)):** Companies with < $5M gross receipts and ≤ 5 tax years can apply up to **$500,000 per year against payroll taxes** — no income tax liability required.

**4-Part Qualification Test:** (1) permitted purpose, (2) technological in nature, (3) elimination of uncertainty, (4) process of experimentation.

*Clients with significant qualifying spend: Aurora Robotics, Nexus AI Corp, Cobalt Security, and Stackflow Labs — all should file Form 6765 with their 1120.*`,

  deadline: `## 2026 Key Filing Deadlines — C-Corps & Pass-Throughs

| Form | Entity | Original Due | Extended Due |
|---|---|---|---|
| **1120** | C-Corp | Apr 15 | **Oct 15** |
| **1120-S** | S-Corp | Mar 15 | Sep 15 |
| **1065** | Partnership / LLC | Mar 15 | Sep 15 |
| **1040** | Personal | Apr 15 | Oct 15 |
| **Q2 Estimated (1040-ES)** | All | **Jun 15** ⚠️ PAST DUE | — |
| **Q3 Estimated (1040-ES)** | All | **Sep 15** | — |

**Current urgency:** Q2 estimated taxes were due June 15 — any clients who haven't paid should address immediately to avoid underpayment penalties (IRC §6654).

**Next hard deadline: September 15** — Q3 estimated taxes AND extended 1120-S / 1065 returns.

*Next step: run Deadline Watcher to see client-by-client breakdown.*`,

  rsu: `## RSU Taxation for Startup Employees

**At vest:** RSUs are taxed as **ordinary income** in the year they vest (not at grant).
- FMV at vest date × number of shares = W-2 income
- Subject to federal + state income tax + FICA
- Company must withhold (typically sells shares to cover — "sell-to-cover")

**At sale (capital gains):**
- Held < 12 months after vest → **short-term capital gain** (ordinary rates)
- Held ≥ 12 months after vest → **long-term capital gain** (0%, 15%, or 20%)

**83(b) election:** Only applies to restricted stock (not RSUs). Common mistake — employees cannot file 83(b) on RSUs.

**QSBS (§1202):** If company is a Qualified Small Business, gains on stock held > 5 years may be **100% tax-free** up to $10M. Verify eligibility early — timing and structure matter.

*Clients with active equity events: CloudPeak Systems (Series D, large equity pool), Prism Data Analytics (RSU vesting this year).*`,

  onboard: `## New C-Corp Client Onboarding — Document Checklist

**Entity & Corporate:**
- [ ] Articles of Incorporation + EIN confirmation letter (CP575)
- [ ] Cap table (current, fully diluted)
- [ ] Board minutes authorizing tax elections
- [ ] S-Corp election (Form 2553) if applicable

**Prior Tax History:**
- [ ] Prior 3 years of federal + state returns (if existing)
- [ ] Any open IRS notices or exam correspondence
- [ ] NOL carryforward schedule

**Financial:**
- [ ] Prior year audited/reviewed financial statements
- [ ] QuickBooks / accounting system access or export
- [ ] Bank account information for estimated tax payments

**Equity:**
- [ ] 409A valuation (most recent)
- [ ] All issued stock / option / warrant agreements
- [ ] Investor agreements (SAFE, convertible notes)

**R&D (if applicable):**
- [ ] Technical description of qualifying research activities
- [ ] Employee allocation percentages by project
- [ ] Contractor/vendor agreements for contract research

*Typical onboarding timeline: documents received → first meeting → 2 weeks to initial review.*`,

  default: `## US Tax Overview for Funded Tech Startups

Here are the most common tax topics for the firm's client base:

**Entity structure:** Most VC-backed startups incorporate as C-Corps in Delaware. This allows preferred stock, simplifies investor agreements, and positions the company for QSBS (§1202) treatment.

**Key annual obligations:**
- Form 1120 (C-Corp) — April 15, extended to October 15
- Quarterly estimated taxes — April 15, June 15, September 15, January 15
- Payroll taxes — deposited semi-weekly or monthly depending on liability
- State filings — varies by state; California has minimum $800 franchise tax

**R&D credits** under IRC §41 are the highest-impact credit for most tech companies. Startups can offset payroll taxes by up to $500K/year.

**QSBS §1202** allows founders and early investors to exclude up to $10M in capital gains if stock is held for 5+ years from original issuance in a qualifying C-Corp.

Is there a specific topic you'd like to dig deeper on?`,
};

export async function demoLibrarian(question) {
  await delay(jitter(1100, 900));
  const q = question.toLowerCase();
  if (q.includes('r&d') || q.includes('research') || q.includes('section 41') || q.includes('qualified')) return LIB.rd;
  if (q.includes('deadline') || q.includes('due') || q.includes('1120') || q.includes('estimated')) return LIB.deadline;
  if (q.includes('rsu') || q.includes('equity') || q.includes('vest') || q.includes('stock option') || q.includes('qsbs')) return LIB.rsu;
  if (q.includes('onboard') || q.includes('document') || q.includes('new client') || q.includes('checklist')) return LIB.onboard;
  return LIB.default;
}

// ── Sorter ─────────────────────────────────────────────────────────────────────
const CLIENTS = {
  nexus:     { name: 'Nexus AI Corp',              ein: '88-1234567' },
  stackflow: { name: 'Stackflow Labs Inc.',         ein: '88-2345678' },
  harbor:    { name: 'Harbor Protocol LLC',         ein: '88-3456789' },
  cloudpeak: { name: 'CloudPeak Systems Inc.',      ein: '88-6789012' },
  vantage:   { name: 'Vantage Capital Group LLC',   ein: '88-7890123' },
  cobalt:    { name: 'Cobalt Security Inc.',        ein: '88-9012345' },
};

function guessClient(filename) {
  const f = filename.toLowerCase();
  if (f.includes('nexus'))     return CLIENTS.nexus;
  if (f.includes('stackflow')) return CLIENTS.stackflow;
  if (f.includes('harbor'))    return CLIENTS.harbor;
  if (f.includes('cloudpeak')) return CLIENTS.cloudpeak;
  if (f.includes('vantage'))   return CLIENTS.vantage;
  if (f.includes('cobalt'))    return CLIENTS.cobalt;
  return { name: 'Nexus AI Corp', ein: '88-1234567' }; // default for demo
}

export async function demoSorter(filename) {
  await delay(jitter(700, 600));
  const f = filename.toLowerCase();
  const client = guessClient(filename);

  if (f.includes('w2') || f.includes('w-2')) {
    return { docType: 'W-2', client: client.name, taxYear: 2025, destination: `${client.name}/2025/W-2/`, confidence: 'high', notes: `Employee wage statement — route to ${client.name} 2025 payroll folder.` };
  }
  if (f.includes('1099-nec') || f.includes('1099nec')) {
    return { docType: '1099-NEC', client: client.name, taxYear: 2025, destination: `${client.name}/2025/1099-NEC/`, confidence: 'high', notes: 'Non-employee compensation — check against contractor payment records.' };
  }
  if (f.includes('1099-k') || f.includes('1099k')) {
    return { docType: '1099-K', client: client.name, taxYear: 2025, destination: `${client.name}/2025/1099-K/`, confidence: 'high', notes: 'Payment card / third-party network transactions.' };
  }
  if (f.includes('1099')) {
    return { docType: '1099-NEC', client: client.name, taxYear: 2025, destination: `${client.name}/2025/1099s/`, confidence: 'medium', notes: '1099 series — verify exact type and recipient.' };
  }
  if (f.includes('k1') || f.includes('k-1')) {
    return { docType: 'K-1', client: client.name, taxYear: 2025, destination: `${client.name}/2025/K-1s/`, confidence: 'high', notes: 'Partnership / S-Corp distributive share — required for 1040 filing.' };
  }
  if (f.includes('bank') || f.includes('statement')) {
    return { docType: 'Bank Statement', client: client.name, taxYear: 2025, destination: `${client.name}/2025/Bank Statements/`, confidence: 'high', notes: 'Bank statement — reconcile against books before close.' };
  }
  if (f.includes('equity') || f.includes('grant') || f.includes('rsu') || f.includes('option')) {
    return { docType: 'Equity Grant', client: client.name, taxYear: 2025, destination: `${client.name}/2025/Equity/`, confidence: 'high', notes: 'Equity documentation — cross-reference with 409A valuation and cap table.' };
  }
  if (f.includes('receipt') || f.includes('invoice')) {
    return { docType: 'Receipt', client: client.name, taxYear: 2025, destination: `${client.name}/2025/Receipts/`, confidence: 'medium', notes: 'Business expense — verify deductibility category.' };
  }
  if (f.includes('r&d') || f.includes('research') || f.includes('lab')) {
    return { docType: 'R&D Documentation', client: client.name, taxYear: 2025, destination: `${client.name}/2025/R&D Credits/`, confidence: 'high', notes: 'Qualified research documentation — retain for Form 6765 support.' };
  }
  return { docType: 'Other', client: client.name, taxYear: 2025, destination: `Review/2025/Unclassified/`, confidence: 'low', notes: 'Could not determine document type from filename — manual review required.' };
}

// ── Newsletter ─────────────────────────────────────────────────────────────────
const NL_EMAILS = {
  'nexus-ai': `<p>Hi Sarah,</p>
<p>Q3 estimated taxes are due <strong>September 15, 2026</strong>.</p>
<p>Based on your Q1 R&D credit calculation ($340K in qualified research expenses), your Q3 payment should be approximately <strong>$42,000</strong> — reduced from the gross estimate to account for the IRC §41 credit.</p>
<p>We'll send your payment voucher (Form 1120-W) by September 8. Please confirm your preferred payment method (EFTPS or check).</p>
<p>Best,<br><strong>The Acme Tax Team</strong></p>`,

  'stackflow-labs': `<p>Hi Raj,</p>
<p>Reminder: <strong>Q3 estimated taxes due September 15</strong>.</p>
<p>Given Stackflow's multi-state presence (CA, NY, TX) and your R&D credit activity, we've calculated a blended estimated liability of <strong>$61,500</strong> federal + state combined.</p>
<p>Note: California's September 15 estimated tax is 30% of annual liability — we'll coordinate timing with your CA franchise tax payment.</p>
<p>Best,<br><strong>The Acme Tax Team</strong></p>`,

  'harbor-protocol': `<p>Hi Leo,</p>
<p><strong>Q3 estimated taxes are due September 15, 2026.</strong></p>
<p>For Harbor Protocol, we've accounted for your crypto trading activity through Q2. The estimated federal liability for Q3 is <strong>$18,200</strong>. This factors in the net realized gains on protocol fee distributions.</p>
<p>As always, we recommend keeping detailed trade logs current — IRS scrutiny on DeFi protocols is increasing in 2026.</p>
<p>Best,<br><strong>The Acme Tax Team</strong></p>`,

  'meridian-health': `<p>Hi Dr. Ross,</p>
<p>Q3 estimated taxes are due <strong>September 15, 2026</strong>.</p>
<p>As an S-Corp with operations across 8 states, your Q3 estimated liability is <strong>$29,800</strong> federal plus state allocations. We're tracking your state-by-state nexus — Texas remains your largest apportionment.</p>
<p>We'll have your state payment breakdown ready by September 1.</p>
<p>Best,<br><strong>The Acme Tax Team</strong></p>`,

  'prism-data': `<p>Hi Marcus,</p>
<p>Q3 estimated taxes due <strong>September 15</strong>. Quick note on Prism's situation:</p>
<p>With RSU vesting accelerated this quarter, your estimated liability is higher than Q2 — approximately <strong>$54,000</strong>. The vest events create supplemental wage income that needs to be captured in quarterly estimates to avoid underpayment penalties.</p>
<p>We recommend increasing your Q3 payment to cover the equity-related income.</p>
<p>Best,<br><strong>The Acme Tax Team</strong></p>`,

  'cloudpeak-systems': `<p>Hi Nina,</p>
<p>Heads up on <strong>Q3 estimated taxes — September 15, 2026</strong>.</p>
<p>CloudPeak's Q3 estimate is <strong>$112,000</strong> — California's 3.5% LLC fee is included in this calculation. Given your Series D activity earlier this year, we want to confirm no additional CA capital raise filings are triggered.</p>
<p>Let's connect before September 1 to finalize the state breakdown.</p>
<p>Best,<br><strong>The Acme Tax Team</strong></p>`,

  'vantage-capital': `<p>Hi James,</p>
<p><strong>Q3 estimated taxes due September 15.</strong></p>
<p>Vantage's LLC structure means partners receive K-1s that flow to their personal returns. Your Q3 estimated payment at the entity level is <strong>$33,500</strong>. We also recommend each individual partner make personal quarterly estimates based on their K-1 allocation.</p>
<p>We'll coordinate with your partners directly if you'd like.</p>
<p>Best,<br><strong>The Acme Tax Team</strong></p>`,

  'aurora-robotics': `<p>Hi Dr. Liu,</p>
<p>Q3 estimated taxes due <strong>September 15, 2026</strong>.</p>
<p>Aurora's early-stage status and significant R&D spend means your federal estimate is relatively low — approximately <strong>$8,400</strong>. More importantly, your Q3 R&D activity documentation needs to be current to support the payroll tax offset filing (Form 941 adjustment).</p>
<p>We'll need your Q3 contractor agreements by October 1.</p>
<p>Best,<br><strong>The Acme Tax Team</strong></p>`,

  'cobalt-security': `<p>Hi Priya,</p>
<p>Reminder: <strong>Q3 estimated taxes due September 15.</strong></p>
<p>Cobalt's federal estimate for Q3 is <strong>$47,200</strong>. Your R&D credit is offsetting a meaningful portion of the liability — without it, the Q3 payment would be approximately $71K. Good outcome from the credit documentation work we completed in Q1.</p>
<p>Best,<br><strong>The Acme Tax Team</strong></p>`,

  'waymark-studio': `<p>Hi Elena,</p>
<p>Q3 estimated taxes are due <strong>September 15, 2026</strong>.</p>
<p>Waymark's California LLC has a Q3 federal estimate of <strong>$11,800</strong> plus the CA franchise tax installment. With your distributed remote workforce, we're also monitoring potential nexus exposure in states where team members are located — we'll discuss in our September review.</p>
<p>Best,<br><strong>The Acme Tax Team</strong></p>`,
};

export async function demoNewsletter(clients) {
  await delay(jitter(2000, 1500));
  return clients.map(c => ({
    ...c,
    html: NL_EMAILS[c.id] || `<p>Hi ${c.contactName || 'Team'},</p><p>Q3 estimated taxes are due <strong>September 15, 2026</strong>. Please contact us to confirm your payment amount.</p><p>Best,<br><strong>The Acme Tax Team</strong></p>`,
  }));
}
