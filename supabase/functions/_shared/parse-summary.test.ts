// Run with the other tests: see supabase/README.md
import { assert, assertEquals } from 'jsr:@std/assert@1';
import * as pdfjs from 'npm:pdfjs-dist@6.5.438/legacy/build/pdf.mjs';

import { needsReview } from './extraction.ts';
import { findDate, parseMedicineLine, parseSummary } from './parse-summary.ts';
import { pdfToLines, type PdfJs, type PageLine } from './pdf-text.ts';

const lines = (text: string, page = 1): PageLine[] => text.split('\n').map((t) => ({ text: t, page }));
const med = (line: string, inSection = true) => parseMedicineLine(line, 1, inSection);

Deno.test('medicine lines in common Indian formats', () => {
  const a = med('1. Tab. Metoprolol 25 mg    1-0-1    After food    x 30 days')!;
  assertEquals([a.name, a.strength, a.frequency, a.timing, a.duration, a.confidence], ['Metoprolol', '25 mg', '1-0-1', 'Morning and night, after food', '30 days', 'high']);

  const b = med('Cap. Omez 20mg OD before breakfast')!;
  assertEquals([b.name, b.strength, b.timing], ['Omez', '20mg', 'Once a day, before breakfast']);

  const c = med('Tab Dolo 650 mg 1-1-1 x 5 days')!;
  assertEquals([c.name, c.timing, c.duration], ['Dolo', 'Morning, afternoon and night', '5 days']);

  const d = med('Inj. Insulin Glargine 10 units HS')!;
  assertEquals([d.name, d.strength, d.timing], ['Insulin Glargine', '10 units', 'At bedtime']);

  const e = med('Tab. Telma-AM 40/5 mg BD')!;
  assertEquals([e.name, e.strength, e.timing], ['Telma-AM', '40/5 mg', 'Twice a day']);

  const f = med('Syp. Cremaffin 15 ml HS')!;
  assertEquals([f.name, f.strength, f.timing], ['Cremaffin', '15 ml', 'At bedtime']);

  const g = med('Tab. Sorbitrate 5 mg    SOS for chest pain')!;
  assertEquals(g.timing, 'Only when needed, for chest pain');
});

Deno.test('medicine lines in plain-English formats', () => {
  const a = med('- Propranolol 20 mg tablet twice daily for 3 months')!;
  assertEquals([a.name, a.strength, a.timing, a.duration], ['Propranolol', '20 mg', 'Twice a day', '3 months']);
  const b = med('Naproxen 500 mg tablet, one tablet when needed for headache, max 2 per day')!;
  assertEquals([b.dose, b.timing, b.instructions], ['one tablet', 'Only when needed, for headache', 'max 2 per day']);
  const c = med('Amoxicillin 500 mg every 8 hours for 5 days')!;
  assertEquals(c.timing, 'Every 8 hours');
});

Deno.test('missing details are flagged for the family, never guessed', () => {
  const a = med('Tab. Ecosprin    1-0-0')!;
  assertEquals(a.confidence, 'low');
  assert(a.uncertainty_reason!.includes('strength'));
  const b = med('Tab. Clopilet 75 mg')!;
  assertEquals(b.confidence, 'low');
  assert(b.uncertainty_reason!.includes('how often'));
  assertEquals(b.timing, 'As directed');
});

Deno.test('sentences in a medicines section are not medicines', () => {
  assertEquals(med('Continue other medicines as before'), null);
  assertEquals(med('All medicines to be taken after food'), null);
  assertEquals(med('Patient was stable at discharge', false), null);
});

Deno.test('dates are read day-first, as written in India', () => {
  assertEquals(findDate('Date of Discharge: 19/10/2026'), '2026-10-19');
  assertEquals(findDate('on 05-11-26'), '2026-11-05');
  assertEquals(findDate('20 Nov 2026'), '2026-11-20');
  assertEquals(findDate('2nd December, 2026'), '2026-12-02');
  assertEquals(findDate('Nov 20, 2026'), '2026-11-20');
  assertEquals(findDate('2026-10-19'), '2026-10-19');
  assertEquals(findDate('31/02/2026'), null);
});

Deno.test('a summary with a different layout', () => {
  const e = parseSummary(lines(`SHREE HEALTHCARE NURSING HOME
DISCHARGE CARD
Name of Patient : Smt. Kamala Devi      Age : 71 yrs      Sex : F
DOD : 02.11.2026
Under the care of Dr. R. K. Iyer, General Medicine
Diagnosis :
Type 2 Diabetes Mellitus with UTI
Hypertension
Drug Allergy : Sulpha drugs, Aspirin
Treatment advised:
Tab. Glycomet 500 mg 1-0-1 after food
Tab. Amlong 5 mg 1-0-0
Cap. Nitrofurantoin 100 mg BD x 5 days
Continue other medicines as before
Instructions:
Diabetic diet. Avoid sweets.
Check sugar daily
Review after 7 days in Medicine OPD
Come back immediately if:
High fever, vomiting, or drowsiness`));
  assertEquals(e.patient, { name: 'Kamala Devi', age: 71, sex: 'Female' });
  assertEquals(e.hospital, { name: 'Shree Healthcare Nursing Home', discharge_date: '2026-11-02' });
  assertEquals(e.treating_doctor, 'Dr. R. K. Iyer');
  assertEquals(e.diagnosis.text, 'Type 2 Diabetes Mellitus with UTI; Hypertension');
  assertEquals(e.allergies.map((a) => a.text), ['Sulpha drugs', 'Aspirin']);
  assertEquals(e.medicines.map((m) => m.name), ['Glycomet', 'Amlong', 'Nitrofurantoin']);
  assertEquals(e.medicines[2].duration, '5 days');
  assertEquals(e.follow_ups[0].department, 'Medicine');
  assertEquals(e.follow_ups[0].date, '2026-11-09');
  assertEquals(e.follow_ups[0].confidence, 'low', 'a date worked out from "after 7 days" must be checked');
  assertEquals(e.warning_signs.map((w) => w.text), ['High fever, vomiting, or drowsiness']);
  assertEquals(e.limits.map((l) => l.text), ['Diabetic diet. Avoid sweets']);
  assertEquals(e.diet_activity.map((l) => l.text), ['Check sugar daily']);
});

Deno.test('no known allergies means none', () => {
  for (const a of ['Allergies: NKDA', 'Known allergies: Nil', 'Allergy: No known drug allergies', 'Allergies - None']) {
    assertEquals(parseSummary(lines(`Discharge summary\n${a}\nDiagnosis: Fever`)).allergies, [], a);
  }
});

Deno.test('something that is not a discharge summary is flagged', () => {
  const e = parseSummary(lines('Invoice No. 4411\nRoom charges 4500\nTotal 12,000'));
  assertEquals(e.is_discharge_summary, false);
  assertEquals(needsReview(e)[0], 'This does not look like a discharge summary.');
});

const fixture = (name: string) => Deno.readFile(new URL(`./fixtures/${name}`, import.meta.url));

Deno.test('PDF end to end: hospital style with columns and two pages', async () => {
  const e = parseSummary(await pdfToLines(pdfjs as unknown as PdfJs, await fixture('fictional_cardiac.pdf')));
  assertEquals(e.patient.name, 'Rameshbhai Patel');
  assertEquals(e.hospital.discharge_date, '2026-10-19');
  assertEquals(e.medicines.length, 5);
  assertEquals(e.medicines.every((m) => m.confidence === 'high'), true);
  assertEquals(e.bp_limit, { sys: 140, dia: 90 });
  assertEquals(e.follow_ups[0], { department: 'Cardiology', doctor: 'Dr. S. Rao', date: '2026-10-28', time: '11:30 AM', place: 'OPD', confidence: 'high', source_page: 2 });
  assertEquals(e.warning_signs.length, 3);
  assertEquals(needsReview(e), []);
});

Deno.test('PDF end to end: clinic style', async () => {
  const e = parseSummary(await pdfToLines(pdfjs as unknown as PdfJs, await fixture('fictional_headache.pdf')));
  assertEquals(e.medicines.map((m) => `${m.name} ${m.strength}: ${m.timing}`), [
    'Naproxen 500 mg: Only when needed, for headache',
    'Propranolol 20 mg: Twice a day',
    'Ondansetron 4 mg: Only when needed, for nausea',
  ]);
  assertEquals(e.allergies, []);
  assertEquals(e.diet_activity.map((d) => d.text), ['Activity: Regular sleep, avoid skipping meals']);
});

Deno.test('PDF end to end: a scanned page has no text to read', async () => {
  assertEquals(await pdfToLines(pdfjs as unknown as PdfJs, await fixture('fictional_scanned.pdf')), []);
});

Deno.test('doctor names stop at the next column', () => {
  const e = parseSummary(lines('Shree Multispeciality Hospital\nDischarge Summary\nConsultant: Dr. Amit Shah    Department: General Medicine\nDiagnosis: Migraine'));
  assertEquals(e.treating_doctor, 'Dr. Amit Shah');
});

Deno.test('sentences and medicines that wrap onto the next line are joined', () => {
  const e = parseSummary(lines(`Discharge Summary
Diagnosis: Acute migraine headache without aura.
Discharge medications:
1. Tab. Paracetamol 500 mg as required for headache
2. Tab. Domperidone 10 mg
   three times a day before food if vomiting x 3 days
3. Tab. Pantoprazole 40 mg once daily before breakfast x 5 days
Advice:
Maintain adequate hydration; take regular meals; avoid
excessive screen exposure and known headache triggers.
Avoid self-medication.
Return to hospital if:
- Sudden severe headache, weakness of limbs or
  slurred speech
- Repeated vomiting`));
  assertEquals(e.medicines.map((m) => `${m.name}: ${m.timing}`), [
    'Paracetamol: Only when needed, for headache',
    'Domperidone: Three times a day, before food',
    'Pantoprazole: Once a day, before breakfast',
  ]);
  assertEquals(e.medicines[1].duration, '3 days');
  assertEquals(e.medicines[1].confidence, 'high');
  assertEquals(e.limits.map((x) => x.text), [
    'Maintain adequate hydration; take regular meals; avoid excessive screen exposure and known headache triggers',
    'Avoid self-medication',
  ]);
  assertEquals(e.warning_signs.map((x) => x.text), ['Sudden severe headache, weakness of limbs or slurred speech', 'Repeated vomiting']);
});

Deno.test('PDF end to end: columns, wrapped medicine, "Return to emergency if"', async () => {
  const e = parseSummary(await pdfToLines(pdfjs as unknown as PdfJs, await fixture('fictional_migraine_columns.pdf')));
  assertEquals(e.patient, { name: 'Rahul Patel', age: 32, sex: 'Male' });
  assertEquals(e.treating_doctor, 'Dr. Amit Shah');
  assertEquals(e.medicines.map((m) => [m.name, m.timing, m.duration, m.instructions]), [
    ['Paracetamol', 'Only when needed, for headache', null, 'not more than 3 tablets a day'],
    ['Pantoprazole', 'Once a day, before breakfast', '5 days', null],
    ['Domperidone', 'Three times a day, before food', '3 days', null],
  ]);
  assertEquals(e.warning_signs.map((w) => w.text), ['Sudden worst headache of life, weakness, confusion or slurred speech', 'Fever with neck stiffness']);
  assertEquals(e.diet_activity, []);
  assertEquals(e.follow_ups[0].place, 'OPD');
  assertEquals(e.follow_ups[0].date, '2026-11-09');
});
