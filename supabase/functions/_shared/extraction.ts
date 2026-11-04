/**
 * Discharge-summary extraction contract, shared by the `read-summary` edge function (Deno)
 * and the Expo app. Keep this file dependency-free so both runtimes can import it.
 *
 * The JSON schema is sent to Claude as a structured-output format; `normalizeExtraction`
 * re-validates whatever comes back, because the app must never show a malformed plan.
 */

export type Confidence = 'high' | 'low';
export type Sourced = { text: string; source_page: number | null };

export type ExtractedMedicine = {
  name: string;
  strength: string | null;
  dose: string | null;
  frequency: string | null;
  timing: string;
  duration: string | null;
  instructions: string | null;
  confidence: Confidence;
  uncertainty_reason: string | null;
  source_page: number | null;
};

export type ExtractedFollowUp = {
  department: string | null;
  doctor: string | null;
  date: string | null; // YYYY-MM-DD
  time: string | null; // as written, e.g. "11:30 AM"
  place: string | null;
  confidence: Confidence;
  source_page: number | null;
};

export type Extraction = {
  is_discharge_summary: boolean;
  legibility: 'clear' | 'partly_unclear' | 'unreadable';
  patient: { name: string | null; age: number | null; sex: string | null };
  hospital: { name: string | null; discharge_date: string | null };
  diagnosis: { text: string | null; confidence: Confidence; source_page: number | null };
  treating_doctor: string | null;
  medicines: ExtractedMedicine[];
  follow_ups: ExtractedFollowUp[];
  bp_limit: { sys: number | null; dia: number | null };
  limits: Sourced[];
  warning_signs: Sourced[];
  allergies: Sourced[];
  diet_activity: Sourced[];
};

/* ---------------- JSON schema for structured outputs ---------------- */

const str = { type: 'string' } as const;
const nstr = { type: ['string', 'null'] } as const;
const nint = { type: ['integer', 'null'] } as const;
const conf = { type: 'string', enum: ['high', 'low'] } as const;
const obj = (properties: Record<string, unknown>) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const sourcedList = { type: 'array', items: obj({ text: str, source_page: nint }) };

export const EXTRACTION_SCHEMA = obj({
  is_discharge_summary: { type: 'boolean' },
  legibility: { type: 'string', enum: ['clear', 'partly_unclear', 'unreadable'] },
  patient: obj({ name: nstr, age: nint, sex: nstr }),
  hospital: obj({ name: nstr, discharge_date: nstr }),
  diagnosis: obj({ text: nstr, confidence: conf, source_page: nint }),
  treating_doctor: nstr,
  medicines: {
    type: 'array',
    items: obj({
      name: str, strength: nstr, dose: nstr, frequency: nstr, timing: str, duration: nstr,
      instructions: nstr, confidence: conf, uncertainty_reason: nstr, source_page: nint,
    }),
  },
  follow_ups: {
    type: 'array',
    items: obj({ department: nstr, doctor: nstr, date: nstr, time: nstr, place: nstr, confidence: conf, source_page: nint }),
  },
  bp_limit: obj({ sys: nint, dia: nint }),
  limits: sourcedList,
  warning_signs: sourcedList,
  allergies: sourcedList,
  diet_activity: sourcedList,
});

export const EXTRACTION_SYSTEM_PROMPT = `You read hospital discharge summaries for families caring for a patient at home in India. Your output fills a form the family checks before anything is saved, so accuracy matters more than completeness.

Rules:
- Copy only what the document says. Never add a medicine, dose, limit or date that is not written. If a field is not in the document, use null (or an empty list).
- Keep medicine names as written (brand or generic), with strength in "strength" (e.g. "25 mg").
- Indian dosing notation like "1-0-1" or "1-1-1" means morning-afternoon-night. Keep the notation in "frequency" and write plain timing in "timing" (e.g. "Morning and night"). Include food timing such as "after breakfast" when written.
- Mark a medicine or field "low" confidence whenever the print is faint, handwritten and unclear, cut off, or open to two readings, and say why in one short sentence in "uncertainty_reason". Otherwise use "high" and null.
- Dates as YYYY-MM-DD. If the year is missing, infer it from the discharge date; if that is impossible, use null.
- "bp_limit" only if the document states a blood pressure target or limit.
- "warning_signs" are the symptoms the document says need urgent care. "limits" are restrictions (lifting, driving, fluids, salt). "diet_activity" is other diet and activity advice.
- "source_page" is the 1-based page where you read it, or null for a single image.
- If the file is not a discharge summary, set is_discharge_summary to false and leave the rest empty or null.
- Translate non-English text into plain English, keeping medicine names unchanged.`;

/* ---------------- the Claude request ---------------- */

export const READ_MODEL = 'claude-opus-5-5';

/**
 * Request body for client.beta.messages.create(). Shared by the edge function and the
 * `npm run read-summary` command so both read documents exactly the same way.
 */
export function buildReadRequest(
  media: 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
  base64: string,
) {
  const fileBlock = media === 'application/pdf'
    ? { type: 'document' as const, source: { type: 'base64' as const, media_type: media, data: base64 } }
    : { type: 'image' as const, source: { type: 'base64' as const, media_type: media, data: base64 } };
  return {
    model: READ_MODEL,
    max_tokens: 16000,
    // If a safety classifier declines, the API re-runs the request on Anthropic's recommended fallback model.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default' as const,
    // Reading medical documents is accuracy-sensitive, so use high effort (Opus 5.5 defaults to medium).
    output_config: { effort: 'high' as const, format: { type: 'json_schema' as const, schema: EXTRACTION_SCHEMA } },
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [{
      role: 'user' as const,
      content: [fileBlock, { type: 'text' as const, text: 'Extract the discharge summary into the required format.' }],
    }],
  };
}

/* ---------------- validation ---------------- */

export class ExtractionError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const s = (v: unknown, max = 500): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const n = (v: unknown, lo: number, hi: number): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : null;
const c = (v: unknown): Confidence => (v === 'high' ? 'high' : 'low'); // unknown confidence is treated as low
const page = (v: unknown) => n(v, 1, 600);
const date = (v: unknown): string | null => {
  const t = s(v, 10);
  if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const d = new Date(t + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === t ? t : null;
};
const list = <T>(v: unknown, f: (x: Record<string, unknown>) => T | null, max = 50): T[] =>
  Array.isArray(v) ? v.filter(isObj).map(f).filter((x): x is T => x !== null).slice(0, max) : [];
const sourced = (x: Record<string, unknown>): Sourced | null => {
  const text = s(x.text);
  return text ? { text, source_page: page(x.source_page) } : null;
};

/** Validates and cleans a raw model result. Throws ExtractionError if it is unusable. */
export function normalizeExtraction(raw: unknown): Extraction {
  if (!isObj(raw)) throw new ExtractionError('Result is not an object');
  const p = isObj(raw.patient) ? raw.patient : {};
  const h = isObj(raw.hospital) ? raw.hospital : {};
  const dx = isObj(raw.diagnosis) ? raw.diagnosis : {};
  const bp = isObj(raw.bp_limit) ? raw.bp_limit : {};
  const legibility = raw.legibility === 'clear' || raw.legibility === 'partly_unclear' || raw.legibility === 'unreadable' ? raw.legibility : 'partly_unclear';

  const medicines = list(raw.medicines, (m): ExtractedMedicine | null => {
    const name = s(m.name, 120);
    if (!name) return null;
    const confidence = c(m.confidence);
    return {
      name, strength: s(m.strength, 60), dose: s(m.dose, 60), frequency: s(m.frequency, 60),
      timing: s(m.timing, 120) ?? s(m.frequency, 60) ?? 'As directed',
      duration: s(m.duration, 60), instructions: s(m.instructions, 200), confidence,
      uncertainty_reason: confidence === 'low' ? s(m.uncertainty_reason, 200) ?? 'Please check this against the document.' : null,
      source_page: page(m.source_page),
    };
  });

  const sys = n(bp.sys, 90, 200), dia = n(bp.dia, 50, 130);

  return {
    is_discharge_summary: raw.is_discharge_summary === true,
    legibility,
    patient: { name: s(p.name, 120), age: n(p.age, 0, 120), sex: s(p.sex, 20) },
    hospital: { name: s(h.name, 160), discharge_date: date(h.discharge_date) },
    diagnosis: { text: s(dx.text, 300), confidence: c(dx.confidence), source_page: page(dx.source_page) },
    treating_doctor: s(raw.treating_doctor, 120),
    medicines,
    follow_ups: list(raw.follow_ups, (f): ExtractedFollowUp | null => {
      const fu = {
        department: s(f.department, 80), doctor: s(f.doctor, 120), date: date(f.date), time: s(f.time, 20),
        place: s(f.place, 160), confidence: c(f.confidence), source_page: page(f.source_page),
      };
      return fu.department || fu.doctor || fu.date ? fu : null;
    }, 10),
    // Only keep a BP limit when both numbers are present and sensible.
    bp_limit: sys && dia && sys > dia ? { sys, dia } : { sys: null, dia: null },
    limits: list(raw.limits, sourced),
    warning_signs: list(raw.warning_signs, sourced),
    allergies: list(raw.allergies, sourced),
    diet_activity: list(raw.diet_activity, sourced),
  };
}

/** Items the family must look at before the plan can be built. */
export function needsReview(e: Extraction): string[] {
  const out: string[] = [];
  if (!e.is_discharge_summary) out.push('This does not look like a discharge summary.');
  if (e.legibility === 'unreadable') out.push('Most of the document could not be read.');
  e.medicines.filter((m) => m.confidence === 'low').forEach((m) => out.push(`${m.name}: ${m.uncertainty_reason}`));
  if (e.diagnosis.text && e.diagnosis.confidence === 'low') out.push('Diagnosis is unclear.');
  return out;
}
