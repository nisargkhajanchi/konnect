// Run: deno test supabase/functions/_shared/
import { assert, assertEquals, assertThrows } from 'jsr:@std/assert@1';

import { EXTRACTION_SCHEMA, ExtractionError, needsReview, normalizeExtraction } from './extraction.ts';
import { sniffMediaType } from './media.ts';

const good = {
  is_discharge_summary: true,
  legibility: 'clear',
  patient: { name: 'Rameshbhai Patel', age: 62, sex: 'M' },
  hospital: { name: 'City Care Hospital', discharge_date: '2026-10-19' },
  diagnosis: { text: 'NSTEMI, PCI to LAD', confidence: 'high', source_page: 1 },
  treating_doctor: 'Dr. S. Rao',
  medicines: [
    { name: 'Ecosprin', strength: '75 mg', dose: '1 tab', frequency: '1-0-0', timing: 'Morning, after breakfast', duration: null, instructions: null, confidence: 'high', uncertainty_reason: null, source_page: 2 },
    { name: 'Metoprolol', strength: '25 mg', dose: null, frequency: '1-0-1', timing: 'Morning and night', duration: '30 days', instructions: null, confidence: 'low', uncertainty_reason: 'Strength is faint.', source_page: 2 },
  ],
  follow_ups: [{ department: 'Cardiology', doctor: 'Dr. S. Rao', date: '2026-10-28', time: '11:30 AM', place: 'OPD', confidence: 'high', source_page: 2 }],
  bp_limit: { sys: 140, dia: 90 },
  limits: [{ text: 'No driving for 2 weeks', source_page: 2 }],
  warning_signs: [{ text: 'Chest pain at rest', source_page: 2 }],
  allergies: [{ text: 'Penicillin', source_page: 1 }],
  diet_activity: [],
};

Deno.test('a well-formed result passes through unchanged', () => {
  const e = normalizeExtraction(structuredClone(good));
  assertEquals(e.medicines.length, 2);
  assertEquals(e.medicines[1].confidence, 'low');
  assertEquals(e.bp_limit, { sys: 140, dia: 90 });
  assertEquals(e.follow_ups[0].date, '2026-10-28');
  assertEquals(needsReview(e), ['Metoprolol: Strength is faint.']);
});

Deno.test('bad values are cleaned rather than shown to the family', () => {
  const raw = structuredClone(good) as Record<string, any>;
  raw.hospital.discharge_date = '19/10/2026';                       // wrong format
  raw.follow_ups[0].date = '2026-02-30';                            // impossible date
  raw.bp_limit = { sys: 80, dia: 90 };                              // nonsense limit
  raw.medicines.push({ name: '  ', timing: 'x' });                 // empty name
  raw.medicines[0].confidence = 'medium';                           // unknown confidence
  raw.patient.age = 250;
  const e = normalizeExtraction(raw);
  assertEquals(e.hospital.discharge_date, null);
  assertEquals(e.follow_ups[0].date, null);
  assertEquals(e.bp_limit, { sys: null, dia: null });
  assertEquals(e.medicines.length, 2);
  assertEquals(e.medicines[0].confidence, 'low', 'unknown confidence must be treated as low');
  assert(e.medicines[0].uncertainty_reason, 'low confidence always carries a reason');
  assertEquals(e.patient.age, null);
});

Deno.test('a non-summary is flagged for review', () => {
  const e = normalizeExtraction({ ...structuredClone(good), is_discharge_summary: false, medicines: [] });
  assertEquals(needsReview(e)[0], 'This does not look like a discharge summary.');
});

Deno.test('unusable output throws', () => {
  assertThrows(() => normalizeExtraction('nope'), ExtractionError);
  assertThrows(() => normalizeExtraction(null), ExtractionError);
});

Deno.test('schema is valid for strict structured outputs', () => {
  // Every object must list all its properties as required and forbid extras.
  const walk = (node: any, path: string) => {
    if (node?.type === 'object') {
      assertEquals(node.additionalProperties, false, path);
      assertEquals([...node.required].sort(), Object.keys(node.properties).sort(), path);
      for (const [k, v] of Object.entries(node.properties)) walk(v, `${path}.${k}`);
    }
    if (node?.type === 'array') walk(node.items, `${path}[]`);
  };
  walk(EXTRACTION_SCHEMA, '$');
});

Deno.test('file type comes from the bytes', () => {
  const b = (...x: number[]) => new Uint8Array([...x, ...new Array(16).fill(0)]);
  assertEquals(sniffMediaType(b(0x25, 0x50, 0x44, 0x46, 0x2d)), 'application/pdf');
  assertEquals(sniffMediaType(b(0xff, 0xd8, 0xff, 0xe0)), 'image/jpeg');
  assertEquals(sniffMediaType(b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), 'image/png');
  // iPhone HEIC: "....ftypheic" is not supported by the API, so it must be rejected
  assertEquals(sniffMediaType(b(0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63)), null);
});
