// Writes the fictional sample documents the Sorter demo reads.
//
// Every company, person and number here is made up. Each PDF is one page of
// real text, so pdf-parse can extract it and the classifier works from the
// content, not only from the file name.
//
//   node scripts/make-sample-pdfs.mjs
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { writeFileSync, mkdirSync, copyFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const DOCS = {
  "Nexus_AI_Corp_W2_2025.pdf": [
    "Form W-2  Wage and Tax Statement  2025",
    "Employer: Nexus AI Corp   EIN 88-1234567   Delaware",
    "Employee: Sample Employee   SSN XXX-XX-0000 (masked)",
    "Box 1 Wages, tips, other compensation: 184,500.00",
    "Box 2 Federal income tax withheld: 38,214.00",
    "Box 3 Social security wages: 176,100.00",
    "Box 5 Medicare wages and tips: 184,500.00",
    "Copy B. To be filed with employee's federal tax return."
  ],
  "Stackflow_Labs_1099NEC_2025.pdf": [
    "Form 1099-NEC  Nonemployee Compensation  Tax year 2025",
    "Payer: Stackflow Labs Inc.   EIN 88-2345678",
    "Recipient: Sample Contractor LLC   TIN XX-XXX0000 (masked)",
    "Box 1 Nonemployee compensation: 42,000.00",
    "Box 4 Federal income tax withheld: 0.00",
    "State: CA   State income: 42,000.00"
  ],
  "Vantage_Capital_K1_2025.pdf": [
    "Schedule K-1 (Form 1065)  Partner's Share of Income  2025",
    "Partnership: Vantage Capital Group LLC   EIN 88-7890123   New York",
    "Partner: Sample Partner   Ending capital share: 12.5%",
    "Line 1 Ordinary business income: 96,400",
    "Line 9a Net long-term capital gain: 31,250",
    "Line 19 Distributions: 40,000"
  ],
  "CloudPeak_BankStatement_Q4_2025.pdf": [
    "Business Checking Statement   October 1 to December 31, 2025",
    "Account holder: CloudPeak Systems Inc.   Account ending 0000",
    "Opening balance: 4,812,330.18",
    "Deposits and credits: 2,104,900.00",
    "Withdrawals and debits: 3,077,415.62",
    "Closing balance: 3,839,814.56"
  ],
  "Aurora_Robotics_RD_Documentation_2025.pdf": [
    "Research and Development Activity Report   Tax year 2025",
    "Company: Aurora Robotics Corp   EIN 88-8901234",
    "Project: grasp-planning model for warehouse picking arms",
    "Technical uncertainty: grip success on deformable packaging",
    "Process of experimentation: 14 model iterations, 3 hardware revisions",
    "Qualified research wages: 1,240,000   Supplies: 186,000",
    "Prepared to support a Form 6765 credit claim (IRC Section 41)."
  ]
};

mkdirSync(join(root, 'data/inbox'), { recursive: true });
for (const [name, lines] of Object.entries(DOCS)) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([612, 792]);
  page.drawText(lines[0], { x: 56, y: 740, size: 16, font: bold });
  lines.slice(1).forEach((line, i) => page.drawText(line, { x: 56, y: 704 - i * 26, size: 11, font }));
  const out = join(root, 'demo-files', name);
  writeFileSync(out, await doc.save({ useObjectStreams: false }));
  copyFileSync(out, join(root, 'data/inbox', name));
  console.log('wrote', name);
}
