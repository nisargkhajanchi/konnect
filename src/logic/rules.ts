/**
 * Pure rules shared by screens. Clinical thresholds here are DEMO values and must be
 * approved by a clinical lead before real use.
 */
import type { CarePlan, Equip, Med, Patient } from '@/data/demo';
import { PATIENT } from '@/data/demo';
import { inr } from '@/theme';

/* ---------- blood pressure ---------- */
export type BpStatus = 'ok' | 'amber' | 'red';
export function bpStatus(sys: number, limitSys = PATIENT.bpLimit.sys): BpStatus {
  if (sys >= 160) return 'red';
  if (sys > limitSys) return 'amber';
  return 'ok';
}

/** Day number since discharge (discharge day is day 1). Demo mode counts from the demo "today". */
export function dayAtHome(dischargedOn: string | null, today: Date): number | null {
  if (!dischargedOn) return null;
  const d = new Date(dischargedOn + 'T00:00:00');
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const n = Math.round((t.getTime() - d.getTime()) / 86400000) + 1;
  return n >= 1 && n <= 365 ? n : null;
}

/* ---------- SOS triage ---------- */
export type TriageLevel = 'none' | 'red' | 'amber' | 'green';
export function triage(weights: number[]): TriageLevel {
  if (!weights.length) return 'none';
  const max = Math.max(...weights);
  if (max === 3) return 'red';
  if (max === 2 || weights.length >= 3) return 'amber';
  return 'green';
}

/* ---------- today's plan, built from the patient's own summary ---------- */
export type DayTask = { id: string; title: string; sub: string };

/** Which times of day a medicine is taken. "Only when needed" medicines are not daily tasks. */
export function medSlots(time: string): ('morning' | 'afternoon' | 'night')[] {
  const t = time.toLowerCase();
  if (/only when needed|when needed|as needed|sos/.test(t)) return [];
  const slots = new Set<'morning' | 'afternoon' | 'night'>();
  if (/morning|breakfast/.test(t)) slots.add('morning');
  if (/afternoon|lunch/.test(t)) slots.add('afternoon');
  if (/night|evening|bed ?time|dinner/.test(t)) slots.add('night');
  if (/twice a day/.test(t)) { slots.add('morning'); slots.add('night'); }
  if (/three times|four times|every \d+ hours/.test(t)) { slots.add('morning'); slots.add('afternoon'); slots.add('night'); }
  if (!slots.size) slots.add('morning'); // once a day, as directed: remind in the morning
  return [...slots];
}

const WATCH_BP = /\b(bp|blood pressure|hypertension|heart|cardiac|nstemi|stemi|myocardial|angina|stroke|kidney|ckd|renal)\b/i;

export function buildTodayTasks(meds: Med[], plan: CarePlan, patient: Patient): DayTask[] {
  const tasks: DayTask[] = [];
  const advice = [...plan.limits, ...plan.dietActivity].filter((a) => !/\b(bp|blood pressure)\b/i.test(a));
  if (WATCH_BP.test(`${patient.condition} ${plan.limits.join(' ')}`)) {
    tasks.push({ id: 'bp', title: 'BP and pulse before breakfast', sub: `Log it in Health. Keep it below ${patient.bpLimit.sys}/${patient.bpLimit.dia}` });
  }
  const at = (slot: 'morning' | 'afternoon' | 'night') => meds.filter((m) => medSlots(m.time).includes(slot)).map((m) => m.name);
  const add = (id: string, title: string, names: string[]) => { if (names.length) tasks.push({ id, title, sub: names.join(', ') }); };
  add('medAm', 'Morning medicines', at('morning'));
  advice.slice(0, 2).forEach((a, i) => tasks.push({ id: `adv${i}`, title: a.length > 70 ? a.slice(0, 67).replace(/[ ,;]+\S*$/, '') + '…' : a, sub: 'From your discharge summary' }));
  add('medNoon', 'Afternoon medicines', at('afternoon'));
  add('medPm', 'Night medicines', at('night'));
  if (!tasks.length) tasks.push({ id: 'rest', title: 'Rest and follow your discharge advice', sub: 'Add your discharge summary to fill in your plan' });
  return tasks;
}

/* ---------- equipment pricing ---------- */
export type Mode = 'rent' | 'buy';
export type Unit = 'day' | 'month';
export const rentUnits = (it: Equip): Unit[] => {
  const u: Unit[] = [];
  if (it.canRent && it.rentDay > 0) u.push('day');
  if (it.canRent && it.rentMonth > 0) u.push('month');
  return u;
};
export const buyOk = (it: Equip) => it.canBuy && it.buy > 0;
export const modesOf = (it: Equip): Mode[] => {
  const m: Mode[] = [];
  if (rentUnits(it).length) m.push('rent');
  if (buyOk(it)) m.push('buy');
  return m;
};
export type Line = { price: number; rate: number; per: '' | Unit; desc: string; deposit: number; delivery: number };
export function calcLine(it: Equip, mode: Mode, unit: Unit, n: number): Line {
  if (mode === 'buy') return { price: it.buy, rate: it.buy, per: '', desc: 'Buy', deposit: 0, delivery: it.delivery };
  const rate = unit === 'month' ? it.rentMonth : it.rentDay;
  return {
    price: rate * n, rate, per: unit,
    desc: `Rent ${n} ${unit}${n > 1 ? 's' : ''}`,
    deposit: it.deposit, delivery: it.delivery,
  };
}
/** "Rent ₹500/day · ₹10,000/month\nBuy ₹55,000" */
export function rateText(it: Equip) {
  const out: string[] = [], r: string[] = [];
  if (it.canRent) {
    if (it.rentDay > 0) r.push(`${inr(it.rentDay)}/day`);
    if (it.rentMonth > 0) r.push(`${inr(it.rentMonth)}/month`);
  }
  if (r.length) out.push('Rent ' + r.join(' · '));
  if (it.canBuy && it.buy > 0) out.push('Buy ' + inr(it.buy));
  return out.join('\n');
}
/** Day from which the monthly rate is cheaper than paying daily, or null. */
export function monthlyBreakEven(it: Equip): number | null {
  if (!(it.rentDay > 0 && it.rentMonth > 0)) return null;
  const n = Math.ceil(it.rentMonth / it.rentDay);
  return n <= 30 ? n : null;
}

/* ---------- 24-hour monitor (demo scoring) ---------- */
export type Thresholds = { spo2: number; hrHi: number; hrLo: number; temp: number; rrHi: number };
export type Vitals = { hr: number; spo2: number; rr: number; temp: number };
export type MonState = 'ok' | 'watch' | 'alert';
export function monScore(v: Vitals, t: Thresholds, online: boolean, onBed: boolean) {
  let s = 0;
  if (v.spo2 < t.spo2) s += v.spo2 < 92 ? 3 : 2;
  if (v.hr > t.hrHi || v.hr < t.hrLo) s += v.hr > 130 || v.hr < 40 ? 3 : 2;
  if (v.rr > t.rrHi) s += 2;
  if (v.temp > t.temp) s += v.temp > 102 ? 2 : 1;
  if (!online || !onBed) s += 1;
  return s;
}
export function monState(score: number): MonState {
  return score >= 3 ? 'alert' : score >= 1 ? 'watch' : 'ok';
}
export function monFlags(v: Vitals, t: Thresholds) {
  return { hr: v.hr > t.hrHi || v.hr < t.hrLo, sp: v.spo2 < t.spo2, rr: v.rr > t.rrHi, tm: v.temp > t.temp };
}
export const MON_TEXT: Record<MonState, string> = { ok: 'Stable', watch: 'Watch closely', alert: 'Needs attention now' };

export function clock(d = new Date()) {
  return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
}
