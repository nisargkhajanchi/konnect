/**
 * Rule-based discharge-summary reader. No AI, no API key, no cost.
 *
 * Works on the text layer of digital PDFs (most hospital systems produce these). It finds sections
 * by their headings ("Medications on Discharge", "Advice", "Return to hospital if" …) and reads
 * common formats: "Tab. Metoprolol 25 mg 1-0-1 after food x 30 days", "twice daily", "SOS",
 * day-first dates (19/10/2026, 20 Nov 2026), "Age/Sex: 62 Y / M".
 *
 * It is deliberately cautious: any medicine missing a strength or how often to take it is marked
 * low confidence, so the family must confirm it on the review screen before the plan is built.
 */
import { type Extraction, type ExtractedFollowUp, type ExtractedMedicine, normalizeExtraction, type Sourced } from './extraction.ts';
import type { PageLine } from './pdf-text.ts';

/* ---------------- sections ---------------- */

type Section = 'meds' | 'advice' | 'lifestyle' | 'warnings' | 'diagnosis' | 'followup' | 'other';

const HEADINGS: [Section, RegExp][] = [
  // "Diet: …", "Activity: …" always start their own short section.
  ['lifestyle', /^(diet|activity|exercise|lifestyle|physical activity|sleep)\s*([:\-–]|$)/i],
  ['warnings', /^((return|report|come back|rush|go)( back)? (immediately )?to (the )?(nearest )?(hospital|emergency|er|casualty|a&e)|come back (immediately )?(to (the )?hospital )?if|seek (urgent|immediate|emergency|medical)|red[\s-]?flags?|warning signs?|danger signs?|emergency signs?|when to (seek|return|call|come back)|call (108|102|the ambulance|an ambulance|your doctor)|contact (your |the )?(doctor|hospital) (immediately )?if|visit (the )?(hospital|emergency|er) (immediately )?if)\b/i],
  ['meds', /^((discharge|home)\s+)?(medications?|medicines?|drugs?|prescriptions?|treatment|rx)(\s+(on|at|after)\s+discharge|\s+advised|\s+prescribed|\s+to continue)?\s*[:\-]?\s*$/i],
  ['meds', /^(medications?|medicines?|treatment)\s+(on|at)\s+discharge\b/i],
  ['advice', /^((discharge|general|special)\s+)?(advice|instructions?|advise|precautions)(\s+(on|at)\s+discharge)?\b/i],
  ['diagnosis', /^(final|provisional|primary|principal|discharge|working)?\s*diagnos[ie]s\b/i],
  ['followup', /^(follow[\s-]?up|review|next visit|revisit)\b/i],
  ['other', /^(history|chief complaints?|presenting complaints?|complaints|clinical (findings|summary)|examination|on examination|investigations?|lab(oratory)? (results|investigations)|course in (the )?hospital|hospital course|procedures?( done)?|operation|condition (at|on) discharge|summary|vitals|past history|family history|personal history|signature|consultant|treating doctor|allergies)\b/i],
];

const BULLET = /^\s*(?:[-•*·▪◦–]|\d{1,2}[.)]|[a-z][.)])\s*/i;
const clean = (s: string) => s.replace(BULLET, '').replace(/\s+/g, ' ').trim();

/* ---------------- dates and times ---------------- */

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => {
  if (y < 100) y += 2000;
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? `${y}-${pad(m)}-${pad(d)}` : null;
};
const DATE_RE = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b|\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})\b|\b(\d{1,2})(?:st|nd|rd|th)?[\s\-]+([A-Za-z]{3,9})\.?,?[\s\-]+(\d{2,4})\b|\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/;

/** Finds the first date in the text. Numeric dates are read day-first, as written in India. */
export function findDate(text: string): string | null {
  const m = DATE_RE.exec(text);
  if (!m) return null;
  if (m[1]) return iso(+m[1], +m[2], +m[3]);
  if (m[4]) return iso(+m[6], +m[5], +m[4]);
  if (m[7]) { const mo = MONTHS[m[8].slice(0, 4).toLowerCase()] ?? MONTHS[m[8].slice(0, 3).toLowerCase()]; return mo ? iso(+m[9], mo, +m[7]) : null; }
  if (m[10]) { const mo = MONTHS[m[10].slice(0, 3).toLowerCase()]; return mo ? iso(+m[12], mo, +m[11]) : null; }
  return null;
}
const TIME_RE = /\b(\d{1,2})(?:[:.](\d{2}))?\s*([ap])\.?\s?m\b\.?|\b(\d{1,2}):(\d{2})\b/i;
function findTime(text: string): string | null {
  const m = TIME_RE.exec(text);
  if (!m) return null;
  if (m[3]) return `${+m[1]}:${m[2] ?? '00'} ${m[3].toUpperCase()}M`;
  const h = +m[4];
  return h > 23 ? null : `${h % 12 || 12}:${m[5]} ${h < 12 ? 'AM' : 'PM'}`;
}

/* ---------------- medicines ---------------- */

const FORM = /^(tab(?:let)?s?|caps?(?:ule)?s?|inj(?:ection)?|syp|syr(?:up)?|susp(?:ension)?|inh(?:aler)?|rotacaps?|neb(?:ulisation|ulization)?|drops?|e\/d|oint(?:ment)?|gel|cream|sachet|powder|spray|patch)\.?\s+/i;
// Includes combinations such as "40/5 mg" and "500 mg/5 ml".
const STRENGTH = /(\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)*\s*(?:mg|mcg|µg|g|gm|ml|iu|units?|%)(?:\s*\/\s*\d+(?:\.\d+)?\s*(?:mg|mcg|ml|g))?)(?![a-z])/i;
const DOSE_GRID = /(?<![\d/])([0-9½]{1,3}(?:\.\d)?)\s*-\s*([0-9½]{1,3}(?:\.\d)?)\s*-\s*([0-9½]{1,3}(?:\.\d)?)(?:\s*-\s*([0-9½]{1,3}))?(?![\d/])/;
const FREQ_WORDS: [RegExp, string][] = [
  [/\b(sos|prn|as needed|when needed|if needed|as required|when required)\b/i, 'Only when needed'],
  [/\b(od|once (a|per) day|once daily|daily once|qd)\b/i, 'Once a day'],
  [/\b(bd|bid|twice (a|per) day|twice daily|two times (a|per) day)\b/i, 'Twice a day'],
  [/\b(tds|tid|thrice daily|three times (a|per) day)\b/i, 'Three times a day'],
  [/\b(qid|qds|four times (a|per) day)\b/i, 'Four times a day'],
  [/\b(hs|at bed ?time|at night|before sleep|night only)\b/i, 'At bedtime'],
  [/\b(once (a|per) week|weekly)\b/i, 'Once a week'],
  [/\b(stat)\b/i, 'Once, straight away'],
  [/\bevery\s+(\d+)\s*(hours?|hrs?)\b/i, 'Every $1 hours'],
];
const FOOD: [RegExp, string][] = [
  [/\b(after (food|meals?)|pc|post[- ]?prandial)\b/i, 'after food'],
  [/\b(before (food|meals?)|ac|pre[- ]?prandial)\b/i, 'before food'],
  [/\b(empty stomach)\b/i, 'on an empty stomach'],
  [/\bbefore breakfast\b/i, 'before breakfast'],
  [/\bafter breakfast\b/i, 'after breakfast'],
  [/\bafter (dinner|supper)\b/i, 'after dinner'],
  [/\bwith (food|meals?|milk)\b/i, 'with food'],
];
const DURATION = /\b(?:x|×|for)\s*(\d+\s*(?:days?|weeks?|wks?|months?|mths?|years?))\b|\b(lifelong|life long|to continue|continue|long term|till next review|until review)\b/i;

function gridTiming(m: RegExpExecArray): string {
  const slots = [m[1], m[2], m[3]].map((x) => x !== '0');
  const names = ['Morning', 'Afternoon', 'Night'];
  const on = names.filter((_, i) => slots[i]);
  if (!on.length) return 'As directed';
  if (on.length === 3) return 'Morning, afternoon and night';
  return on.length === 2 ? `${on[0]} and ${on[1].toLowerCase()}` : on[0];
}

/** Reads one medicine line. Returns null if it doesn't look like a medicine. */
export function parseMedicineLine(raw: string, page: number | null, inMedSection: boolean): ExtractedMedicine | null {
  const line = clean(raw).replace(/\s{2,}/g, '  ');
  const form = FORM.exec(line);
  const strength = STRENGTH.exec(line);
  if (!form && !strength && !inMedSection) return null;
  let rest = form ? line.slice(form[0].length) : line;

  // Name: the words before the strength, dose grid or a frequency word.
  const cut = [STRENGTH, DOSE_GRID, /\s{2,}/, /\b(od|bd|bid|tds|tid|qid|hs|sos|prn|once|twice|thrice|daily|when|as needed|every|after|before|x\s*\d|for\s+\d|tablet|capsule)\b/i, /,/]
    .map((re) => re.exec(rest)?.index ?? -1).filter((i) => i > 0);
  const nameEnd = cut.length ? Math.min(...cut) : rest.length;
  const name = rest.slice(0, nameEnd).replace(/[(\-:,]+$/, '').trim();
  if (!name || name.length < 2 || !/[a-z]{2}/i.test(name)) return null;
  // Lines in a medicines section that are really sentences (advice) have no strength, form or dosing.
  rest = rest.slice(nameEnd);
  const grid = DOSE_GRID.exec(rest);
  const freqWord = FREQ_WORDS.find(([re]) => re.test(rest));
  if (!form && !strength && !grid && !freqWord) return null;

  const frequency = grid ? grid[0].replace(/\s+/g, '') : freqWord ? (freqWord[0].exec(rest)?.[0] ?? null) : null;
  let timing = grid ? gridTiming(grid) : freqWord ? freqWord[1].replace('$1', freqWord[0].exec(rest)?.[1] ?? '') : '';
  const food = FOOD.find(([re]) => re.test(rest));
  if (food) timing = timing ? `${timing}, ${food[1]}` : food[1].charAt(0).toUpperCase() + food[1].slice(1);
  // "SOS for chest pain" / "when needed for headache" → keep the reason.
  const reason = /\b(?:sos|prn|needed|required)\s+(?:for|if)\s+([a-z][a-z ]{2,40}?)(?=,|\.|\s*\(|\s{2,}|$|\s+max|\s+not more)/i.exec(rest);
  if (reason && timing.startsWith('Only when needed')) timing = `Only when needed, for ${reason[1].trim()}`;

  const dur = DURATION.exec(rest);
  const maxDose = /\b(max(?:imum)?\.?\s*\d+[^,.;)]*|not more than\s+\d+[^,.;)]*)/i.exec(rest);
  const doseWord = /\b(one|two|half|1|2|½)\s+(tablets?|tabs?|capsules?|caps?|puffs?|drops?|ml|teaspoons?|tsp)\b/i.exec(rest);

  const missing: string[] = [];
  if (!strength) missing.push('strength');
  if (!frequency && !food) missing.push('how often to take it');
  return {
    name: name.replace(/\b(tablets?|capsules?)\b/gi, '').trim(),
    strength: strength ? strength[1].replace(/\s+/g, ' ') : null,
    dose: doseWord ? doseWord[0] : null,
    frequency,
    timing: timing || 'As directed',
    duration: dur ? (dur[1] ?? dur[2]).replace(/\s+/g, ' ') : null,
    instructions: maxDose ? maxDose[1].trim() : null,
    confidence: missing.length ? 'low' : 'high',
    uncertainty_reason: missing.length ? `Could not find the ${missing.join(' or ')} in the document.` : null,
    source_page: page,
  };
}

/* ---------------- the whole document ---------------- */

const SPECIALTIES = 'cardiology|neurology|medicine|general medicine|surgery|general surgery|orthop(a)?edics?|nephrology|endocrinology|diabetology|pulmonology|chest medicine|gastroenterology|oncology|neurosurgery|urology|gyn(a)?ecology|obstetrics|p(a)?ediatrics|ent|ophthalmology|physiotherapy|psychiatry|dermatology|cardiothoracic|rheumatology|haematology|hematology';
// Single spaces only between name parts: a wide gap in the PDF means the next column has started.
const DOCTOR = /\bDr\.?\s*([A-Z][A-Za-z.]*(?: [A-Z][A-Za-z.]*){0,3})/;
const NOT_NAME = /\s+(Department|Dept|Unit|Ward|Consultant|Physician|Signature|Designation|Mbbs|Md|Ms|Dm|Dnb|Frcp)\b.*$/i;
const STOP_AFTER_NAME = /\s{2,}|\s+(?:age|sex|gender|uhid|ip\s*no|mrn|reg(?:istration)?|ward|bed|dob)\b|[,;|]|$/i;

function after(text: string, label: RegExp): string | null {
  const m = label.exec(text);
  return m ? text.slice(m.index + m[0].length).replace(/^\s*[:\-–]\s*/, '').trim() : null;
}

export function parseSummary(lines: PageLine[]): Extraction {
  const text = lines.map((l) => l.text).join('\n');
  const flat = lines.map((l) => l.text).join('  ');

  /* patient, hospital, dates, doctor */
  let patientName: string | null = null;
  for (const l of lines) {
    const v = after(l.text, /\b(?:patient(?:'s)?\s+name|name\s+of\s+(?:the\s+)?patient|^name)\b\s*(?=[:\-–])/i);
    if (v) {
      const n = v.replace(/^(mr|mrs|ms|miss|master|smt|shri|sri|baby)\.?\s+/i, '');
      patientName = n.slice(0, STOP_AFTER_NAME.exec(n)?.index ?? n.length).trim() || null;
      if (patientName) break;
    }
  }
  const ageM = /\bage(?:\s*\/\s*(?:sex|gender))?\s*[:\-]?\s*(\d{1,3})\s*(?:y(?:ea)?rs?|y)?\b/i.exec(flat);
  const sexM = /\b(?:sex|gender)\s*[:\-]?\s*(male|female|m|f|other)\b/i.exec(flat) ?? /\bage\s*\/\s*sex\s*[:\-]?\s*\d{1,3}\s*(?:y(?:ea)?rs?|y)?\s*\/\s*(m|f|male|female)\b/i.exec(flat);
  const sex = sexM ? ({ m: 'Male', f: 'Female' } as Record<string, string>)[sexM[1].toLowerCase()] ?? sexM[1][0].toUpperCase() + sexM[1].slice(1).toLowerCase() : null;
  const hospitalLine = lines.slice(0, 6).find((l) => /\b(hospital|clinic|medical|institute|nursing home|health ?care|centre|center|infirmary|sanatorium)\b/i.test(l.text) && !/summary/i.test(l.text));
  const hospital = hospitalLine ? hospitalLine.text.split(/\s{2,}/)[0].trim() : null;
  const dischargeLine = lines.find((l) => /(date\s+of\s+discharge|discharge\s+date|discharged\s+on|\bd\.?o\.?d\b)/i.test(l.text));
  const dischargeDate = dischargeLine ? findDate(after(dischargeLine.text, /(date\s+of\s+discharge|discharge\s+date|discharged\s+on|\bd\.?o\.?d\b\.?)/i) ?? '') : null;
  const doctorLine = lines.find((l) => /\b(consultant|treating\s+(doctor|physician)|attending\s+(doctor|physician)|under\s+(the\s+care\s+of)?|doctor\s+in\s+charge|physician)\b/i.test(l.text) && DOCTOR.test(l.text));
  const doctorM = DOCTOR.exec(doctorLine?.text ?? flat);
  const doctor = doctorM ? `Dr. ${doctorM[1].replace(/\s*\(.*$/, '').replace(NOT_NAME, '').trim()}` : null;

  /* walk the lines section by section */
  let section: Section = 'other';
  const diagnosis: string[] = [];
  let diagnosisPage: number | null = null;
  const medicines: ExtractedMedicine[] = [];
  const advice: Sourced[] = [];
  const warnings: Sourced[] = [];
  const followLines: PageLine[] = [];
  const allergies: Sourced[] = [];
  let lastMed: { raw: string; index: number } | null = null;

  /**
   * PDFs wrap long sentences onto the next line. A line continues the previous item when it isn't a
   * new bullet and either starts in lower case or the previous item stops mid-sentence.
   */
  const continues = (raw: string, prev: string | undefined) =>
    !!prev && !BULLET.test(raw) && !/[.!?:]$/.test(prev) &&
    (/^[a-z(]/.test(raw.trim()) || /(,|;|\b(and|or|avoid|with|of|to|the|a|an|for|in|on|if|not|no|than))$/i.test(prev));
  const pushOrJoin = (list: Sourced[], raw: string, page: number) => {
    const last = list[list.length - 1];
    if (last && continues(raw, last.text)) last.text = `${last.text} ${clean(raw).replace(/[.;]+$/, '')}`;
    else list.push({ text: cap(clean(raw)), source_page: page });
  };

  for (const l of lines) {
    const t = l.text.trim();
    if (!t) continue;
    const bare = clean(t);

    // Allergies can sit anywhere: "Known Allergies: Penicillin"
    const allergy = after(bare, /^(known\s+)?(drug\s+)?allerg(y|ies)\b[^:\-–]*/i);
    if (allergy !== null && /^[:\-–]?/.test(bare.slice(bare.search(/allerg/i)))) {
      if (allergy && !/^(nkda|nkfa|nil|none|no( known)?( drug)?( allerg\w*)?|not known|n\/?a|-)\.?$/i.test(allergy)) {
        allergy.split(/,|;|\band\b/).map((x) => x.trim()).filter(Boolean).forEach((x) => allergies.push({ text: x, source_page: l.page }));
      }
      section = 'other';
      continue;
    }

    const heading = HEADINGS.find(([, re]) => re.test(bare));
    if (heading) {
      section = heading[0];
      lastMed = null;
      // Inline content after the heading: "Final Diagnosis: Acute NSTEMI", "Follow up: … on 28/10".
      const inline = bare.replace(heading[1], '').replace(/^[\s:\-–]+/, '').replace(/^(if|when)\b[\s:]*/i, '').trim();
      const looksLikeHeadingOnly = /:\s*$/.test(bare) || !inline;
      if (section === 'diagnosis' && inline) { diagnosis.push(inline); diagnosisPage = l.page; }
      if (section === 'followup' && (inline || !looksLikeHeadingOnly)) followLines.push({ text: inline || bare, page: l.page });
      if (section === 'warnings' && inline && !looksLikeHeadingOnly && inline.split(' ').length > 1) warnings.push({ text: cap(inline), source_page: l.page });
      if (section === 'advice' && inline && !looksLikeHeadingOnly) advice.push({ text: cap(inline), source_page: l.page });
      if (section === 'lifestyle' && inline) advice.push({ text: cap(bare), source_page: l.page });
      continue;
    }

    // A medicine line can appear outside the section when it starts with "Tab." etc.
    const startsNewMed = BULLET.test(t) || FORM.test(bare);
    if (section === 'meds' && lastMed && !startsNewMed) {
      // A medicine wrapped onto the next line: "Tab. Domperidone 10 mg" / "1-1-1 before food if vomiting".
      const joined = parseMedicineLine(`${lastMed.raw} ${t}`, medicines[lastMed.index].source_page, true);
      if (joined && joined.name === medicines[lastMed.index].name) {
        medicines[lastMed.index] = joined;
        lastMed = { raw: `${lastMed.raw} ${t}`, index: lastMed.index };
        continue;
      }
    }
    const med = parseMedicineLine(t, l.page, section === 'meds');
    if (med && (section === 'meds' || FORM.test(bare))) { medicines.push(med); lastMed = { raw: t, index: medicines.length - 1 }; continue; }

    switch (section) {
      case 'diagnosis': if (diagnosis.length < 4) {
        if (diagnosis.length && continues(t, diagnosis[diagnosis.length - 1])) diagnosis[diagnosis.length - 1] += ` ${bare}`;
        else { diagnosis.push(bare); diagnosisPage ??= l.page; }
      } break;
      case 'warnings': pushOrJoin(warnings, t, l.page); break;
      case 'advice': case 'lifestyle': pushOrJoin(advice, t, l.page); break;
      case 'followup': followLines.push({ text: bare, page: l.page }); break;
      default:
        if (/^follow[\s-]?up\b/i.test(bare)) followLines.push({ text: bare, page: l.page });
    }
  }

  /* follow-ups */
  const follow_ups: ExtractedFollowUp[] = [];
  for (const f of followLines.slice(0, 3)) {
    const dept = new RegExp(`\\b(${SPECIALTIES})\\b`, 'i').exec(f.text);
    const doc = DOCTOR.exec(f.text);
    let date = findDate(f.text);
    let confidence: 'high' | 'low' = 'high';
    // "Review after 7 days" → count from the discharge date, but ask the family to check.
    const rel = /\bafter\s+(\d+|one|two|three|four)\s*(days?|weeks?|months?)\b/i.exec(f.text);
    if (!date && rel && dischargeDate) {
      const n = ({ one: 1, two: 2, three: 3, four: 4 } as Record<string, number>)[rel[1].toLowerCase()] ?? +rel[1];
      const days = /week/i.test(rel[2]) ? n * 7 : /month/i.test(rel[2]) ? n * 30 : n;
      const d = new Date(dischargeDate + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + days);
      date = d.toISOString().slice(0, 10);
      confidence = 'low';
    }
    if (!dept && !doc && !date) continue;
    const place = /\b(OPD(?:\s*(?:no\.?\s*)?\d+)?|clinic|room\s*(?:no\.?\s*)?\d+\w*)\b/i.exec(f.text);
    follow_ups.push({
      department: dept ? cap(dept[1].toLowerCase()) : null,
      doctor: doc ? `Dr. ${doc[1].replace(NOT_NAME, '').trim()}` : null,
      date, time: findTime(f.text),
      place: place ? place[1].trim() : null,
      confidence, source_page: f.page,
    });
  }

  /* blood pressure limit, e.g. "Keep BP below 140/90" */
  const bpM = /\b(?:bp|blood pressure)\b[^\n0-9]{0,30}?\b(?:below|under|less than|<|not more than|target|keep|maintain|upto|up to)\b[^\n0-9]{0,15}(\d{2,3})\s*\/\s*(\d{2,3})/i.exec(text);

  /* advice split into limits and diet/activity */
  const isLimit = (s: string) => /\b(no|avoid|don'?t|do not|restrict|limit|less than|not more than|keep|maximum|max|only|stop)\b/i.test(s) && !/^(diet|activity|exercise|lifestyle|sleep)\s*[:\-–]/i.test(s);
  const limits = advice.filter((a) => isLimit(a.text));
  const dietActivity = advice.filter((a) => !isLimit(a.text));

  const isSummary = /discharge/i.test(text) && (medicines.length > 0 || diagnosis.length > 0);
  return normalizeExtraction({
    is_discharge_summary: isSummary,
    legibility: text.length > 200 ? 'clear' : 'partly_unclear',
    patient: { name: patientName, age: ageM ? +ageM[1] : null, sex },
    hospital: { name: hospital ? titleCase(hospital) : null, discharge_date: dischargeDate },
    diagnosis: { text: diagnosis.length ? diagnosis.join('; ') : null, confidence: 'high', source_page: diagnosisPage },
    treating_doctor: doctor,
    medicines,
    follow_ups,
    bp_limit: { sys: bpM ? +bpM[1] : null, dia: bpM ? +bpM[2] : null },
    limits,
    warning_signs: warnings,
    allergies,
    diet_activity: dietActivity,
  });
}

function cap(s: string) {
  const t = s.trim().replace(/[.;]+$/, '');
  return t.charAt(0).toUpperCase() + t.slice(1);
}
function titleCase(s: string) {
  // Only change ALL-CAPS headers; keep names like "City Care Hospital" as written.
  return s === s.toUpperCase() ? s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()) : s;
}
