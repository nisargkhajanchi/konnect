/**
 * Reads a discharge summary with Claude, exactly as the app's read-summary function does,
 * and prints what was found. For checking accuracy on real documents before going live.
 *
 *   export ANTHROPIC_API_KEY=sk-ant-...
 *   npm run read-summary -- path/to/summary.pdf          (or .jpg / .png)
 *   npm run read-summary -- path/to/summary.pdf --json   (raw result)
 *
 * Runs directly with Node 22.18+ or 24 (TypeScript is stripped by Node itself).
 */
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, statSync } from 'node:fs';
import { basename } from 'node:path';

import { buildReadRequest, needsReview, normalizeExtraction, READ_MODEL, type Extraction } from '../supabase/functions/_shared/extraction.ts';
import { sniffMediaType } from '../supabase/functions/_shared/media.ts';

const MAX_BYTES = 20 * 1024 * 1024;
// Claude Opus 5.5 list prices, USD per million tokens. Used only for the cost estimate printed below.
const PRICE_IN = 4, PRICE_OUT = 20;

function fail(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(1);
}

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const file = args.find((a) => !a.startsWith('--'));
if (!file) fail('Usage: npm run read-summary -- path/to/discharge-summary.pdf [--json]');
if (!process.env.ANTHROPIC_API_KEY) {
  fail('Set your Anthropic API key first (from https://console.anthropic.com):\n\n  export ANTHROPIC_API_KEY=sk-ant-...\n\nThen run this command again.');
}

let bytes: Buffer;
try {
  if (statSync(file).size > MAX_BYTES) fail('This file is larger than 20 MB. Try a smaller PDF or a photo of each page.');
  bytes = readFileSync(file);
} catch {
  fail(`Could not open "${file}". Check the path. Tip: drag the file into Terminal to paste its exact path.`);
}
const media = sniffMediaType(new Uint8Array(bytes));
if (!media) fail('Please use a PDF, JPG or PNG. iPhone HEIC photos are not supported: export them as JPG first.');

const client = new Anthropic({ timeout: 180_000, maxRetries: 1 });
if (!asJson) console.log(`\nReading ${basename(file)} with ${READ_MODEL}. This can take up to a minute…`);
const started = Date.now();

let response: Anthropic.Beta.BetaMessage;
try {
  response = await client.beta.messages.create(buildReadRequest(media, bytes.toString('base64')));
} catch (e) {
  if (e instanceof Anthropic.AuthenticationError) fail('Your API key was not accepted. Check ANTHROPIC_API_KEY.');
  if (e instanceof Anthropic.PermissionDeniedError) fail(`Your API key cannot use this model or feature: ${e.message}`);
  if (e instanceof Anthropic.RateLimitError) fail('Rate limited by the API. Wait a minute and try again.');
  if (e instanceof Anthropic.BadRequestError) fail(`The API rejected the request: ${e.message}`);
  if (e instanceof Anthropic.APIConnectionError) fail('Could not reach the Anthropic API. Check your internet connection.');
  throw e;
}

if (response.stop_reason === 'refusal') fail('The model declined to read this document. In the app, the family would enter the details by hand.');
if (response.stop_reason === 'max_tokens') fail('The document was too long to read in one go. Try only the discharge pages.');

const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
let e: Extraction;
try {
  e = normalizeExtraction(JSON.parse(text));
} catch {
  fail('The result could not be understood. Please try again.');
}

if (asJson) {
  console.log(JSON.stringify({ extraction: e, needs_review: needsReview(e) }, null, 2));
  process.exit(0);
}

/* ---------------- readable report ---------------- */
const line = (label: string, value: string | number | null | undefined) => console.log(`  ${label.padEnd(14)}${value ?? '—'}`);
const list = (title: string, items: { text: string; source_page: number | null }[]) => {
  if (!items.length) return;
  console.log(`\n${title}`);
  items.forEach((x) => console.log(`  • ${x.text}${x.source_page ? `  (p${x.source_page})` : ''}`));
};

console.log(`\n=== WHAT THE APP WOULD SHOW ON THE REVIEW SCREEN ===`);
if (!e.is_discharge_summary) console.log('\n!! This does not look like a discharge summary.');
console.log(`\nDocument: ${e.legibility === 'clear' ? 'read clearly' : e.legibility === 'unreadable' ? 'mostly unreadable' : 'partly unclear'}`);
line('Patient', [e.patient.name, e.patient.age, e.patient.sex].filter(Boolean).join(', ') || null);
line('Hospital', e.hospital.name);
line('Discharged', e.hospital.discharge_date);
line('Doctor', e.treating_doctor);
line('Diagnosis', e.diagnosis.text ? `${e.diagnosis.text}${e.diagnosis.confidence === 'low' ? '   [CHECK: unclear]' : ''}` : null);
if (e.bp_limit.sys) line('BP limit', `${e.bp_limit.sys}/${e.bp_limit.dia}`);

console.log(`\nMedicines (${e.medicines.length})`);
if (!e.medicines.length) console.log('  none found');
e.medicines.forEach((m) => {
  const name = [m.name, m.strength].filter(Boolean).join(' ');
  const how = [m.dose, m.frequency, m.timing, m.duration].filter(Boolean).join(' · ');
  console.log(`  ${m.confidence === 'low' ? '?' : '✓'} ${name}${m.source_page ? `  (p${m.source_page})` : ''}`);
  console.log(`      ${how}${m.instructions ? ` · ${m.instructions}` : ''}`);
  if (m.confidence === 'low') console.log(`      CHECK: ${m.uncertainty_reason}`);
});

if (e.follow_ups.length) {
  console.log('\nFollow-up');
  e.follow_ups.forEach((f) => console.log(`  • ${[f.department, f.doctor, f.date, f.time, f.place].filter(Boolean).join(' · ')}${f.confidence === 'low' ? '   [CHECK]' : ''}`));
}
list("Doctor's limits", e.limits);
list('Warning signs (go to hospital)', e.warning_signs);
list('Allergies', e.allergies);
list('Diet and activity', e.diet_activity);

const review = needsReview(e);
console.log(review.length ? `\nThe family must confirm ${review.length} item(s) before the plan is built:` : '\nNothing flagged: the family could build the plan straight away.');
review.forEach((r) => console.log(`  - ${r}`));

const u = response.usage;
const cost = (u.input_tokens * PRICE_IN + u.output_tokens * PRICE_OUT) / 1e6;
console.log(`\n${((Date.now() - started) / 1000).toFixed(0)} s · ${u.input_tokens} input + ${u.output_tokens} output tokens · about $${cost.toFixed(3)} (served by ${response.model})\n`);
