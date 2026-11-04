/**
 * Reads a discharge-summary PDF with the built-in rule-based parser (no AI, no API key, free)
 * and prints what the app's review screen would show. Uses exactly the same code as the server.
 *
 *   npm run read-summary -- path/to/summary.pdf
 *   npm run read-summary -- path/to/summary.pdf --json    (raw result)
 *   npm run read-summary -- path/to/summary.pdf --text    (the text found in the PDF)
 *
 * Works on digital PDFs (text you can select). Scans and photos have no text to read.
 */
import { readFileSync, statSync } from 'node:fs';
import { basename } from 'node:path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

import { needsReview } from '../supabase/functions/_shared/extraction.ts';
import { sniffMediaType } from '../supabase/functions/_shared/media.ts';
import { parseSummary } from '../supabase/functions/_shared/parse-summary.ts';
import { linesToText, pdfToLines, type PdfJs } from '../supabase/functions/_shared/pdf-text.ts';

function fail(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(1);
}

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
if (!file) fail('Usage: npm run read-summary -- path/to/discharge-summary.pdf [--json | --text]');

let bytes: Uint8Array;
try {
  if (statSync(file).size > 20 * 1024 * 1024) fail('This file is larger than 20 MB.');
  bytes = new Uint8Array(readFileSync(file));
} catch {
  fail(`Could not open "${file}". Check the path. Tip: drag the file into Terminal to paste its exact path.`);
}
const media = sniffMediaType(bytes);
if (media !== 'application/pdf') {
  fail(media
    ? 'This is a photo. Photos have no text layer to read, so in the app the family types the details in. Try the PDF from the hospital instead.'
    : 'Please use a PDF.');
}

const lines = await pdfToLines(pdfjs as unknown as PdfJs, bytes);
if (!lines.length) fail('This PDF has no text in it (it is probably a scan). In the app the family would type the details in.');
if (args.includes('--text')) { console.log(linesToText(lines)); process.exit(0); }

const e = parseSummary(lines);
if (args.includes('--json')) { console.log(JSON.stringify({ extraction: e, needs_review: needsReview(e) }, null, 2)); process.exit(0); }

/* ---------------- readable report ---------------- */
const line = (label: string, value: string | number | null | undefined) => console.log(`  ${label.padEnd(14)}${value ?? '—'}`);
const list = (title: string, items: { text: string; source_page: number | null }[]) => {
  if (!items.length) return;
  console.log(`\n${title}`);
  items.forEach((x) => console.log(`  • ${x.text}${x.source_page ? `  (p${x.source_page})` : ''}`));
};

console.log(`\n=== ${basename(file)}: WHAT THE APP WOULD SHOW ON THE REVIEW SCREEN ===\n`);
if (!e.is_discharge_summary) console.log('!! This does not look like a discharge summary.\n');
line('Patient', [e.patient.name, e.patient.age, e.patient.sex].filter(Boolean).join(', ') || null);
line('Hospital', e.hospital.name);
line('Discharged', e.hospital.discharge_date);
line('Doctor', e.treating_doctor);
line('Diagnosis', e.diagnosis.text);
if (e.bp_limit.sys) line('BP limit', `${e.bp_limit.sys}/${e.bp_limit.dia}`);

console.log(`\nMedicines (${e.medicines.length})`);
if (!e.medicines.length) console.log('  none found');
e.medicines.forEach((m) => {
  const how = [m.dose, m.frequency, m.timing, m.duration].filter(Boolean).join(' · ');
  console.log(`  ${m.confidence === 'low' ? '?' : '✓'} ${[m.name, m.strength].filter(Boolean).join(' ')}${m.source_page ? `  (p${m.source_page})` : ''}`);
  console.log(`      ${how}${m.instructions ? ` · ${m.instructions}` : ''}`);
  if (m.confidence === 'low') console.log(`      CHECK: ${m.uncertainty_reason}`);
});
if (e.follow_ups.length) {
  console.log('\nFollow-up');
  e.follow_ups.forEach((f) => console.log(`  • ${[f.department, f.doctor, f.date, f.time, f.place].filter(Boolean).join(' · ')}${f.confidence === 'low' ? '   [CHECK: worked out from "after N days"]' : ''}`));
}
list("Doctor's limits", e.limits);
list('Warning signs (go to hospital)', e.warning_signs);
list('Allergies', e.allergies);
list('Diet and activity', e.diet_activity);

const review = needsReview(e);
console.log(review.length ? `\nThe family must confirm ${review.length} item(s) before the plan is built:` : '\nNothing flagged: the family could build the plan straight away.');
review.forEach((r) => console.log(`  - ${r}`));
console.log('\nIf something was missed, run again with --text and send me what it prints, so I can teach the parser that layout.\n');
