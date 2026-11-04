/**
 * Demo data. Everything here is placeholder content from the prototype.
 * Replace with API calls when the backend exists; screens read through the store.
 */
import type { Tone } from '@/theme';

export const TODAY_DAY = 21;
export const TODAY_LABEL = '21 Oct';
export const DISCHARGE_DAY = 19;

export const PATIENT = {
  name: 'Rameshbhai Patel',
  first: 'Rameshbhai',
  age: 62,
  condition: 'Heart attack (NSTEMI), stent placed',
  short: 'Heart attack',
  hospital: 'City Care Hospital',
  discharged: '19 Oct',
  address: 'B-204, Shantigram, Ahmedabad',
  allergy: 'Penicillin',
  doctor: 'Dr. S. Rao',
  followUp: { dept: 'Cardiology', when: '28 Oct, 11:30 AM', where: 'City Care Hospital OPD' },
  bpLimit: { sys: 140, dia: 90 },
};

export type Med = { id: string; name: string; time: string; ok: boolean; why?: string; taken: boolean };

/** What the (simulated) document reader extracted. One item is low-confidence on purpose. */
export const EXTRACTED_MEDS: Med[] = [
  { id: 'm1', name: 'Aspirin 75 mg', time: 'Morning, after breakfast', ok: true, taken: false },
  { id: 'm2', name: 'Atorvastatin 40 mg', time: 'Night, after dinner', ok: true, taken: false },
  { id: 'm3', name: 'Metoprolol 25 mg', time: 'Morning and evening', ok: false, why: 'We read the dose as 25 mg but the print is faint.', taken: false },
  { id: 'm4', name: 'Pantoprazole 40 mg', time: 'Morning, before breakfast', ok: true, taken: false },
];

export const DOCTOR_LIMITS = [
  { t: 'Keep BP below 140/90', src: 'Page 2, "Advice on discharge"' },
  { t: 'Chest pain, breathlessness, fainting: go to the ER', src: 'Page 2' },
  { t: 'Low-salt diet, no heavy lifting, no driving for 2 weeks', src: 'Page 2' },
  { t: 'Allergy: penicillin', src: 'Page 1' },
];

export const PLAN_STEPS = [
  { t: 'Days 1 to 3 · Rest and watch', s: 'Short indoor walks. BP and pulse twice daily.' },
  { t: 'Days 4 to 7 · Build up', s: 'Walk 15 minutes twice a day. Physiotherapy starts.' },
  { t: 'Day 9 · Cardiology follow-up', s: '28 Oct, 11:30 AM at City Care Hospital. Show the readings from this app.' },
  { t: 'Days 10 to 14 · Normal routine', s: 'Light household activity. No heavy lifting.' },
];

export const PLAN_POINTS = [
  'Heart attack, discharged 19 Oct from City Care Hospital. Follow-up: Cardiology, 28 Oct, 11:30 AM, Dr. S. Rao.',
  'Blood pressure limit 140/90. Pulse below 50 or above 110 is flagged to the nurse.',
  'Under 5 g salt a day. No fried or packaged food. Two litres of fluids unless told otherwise.',
  'Short indoor walks, building up. No heavy lifting. No driving for two weeks.',
  'Allergy: penicillin. Avoid NSAIDs.',
];

export const WARN_SIGNS = [
  'Chest pain or pressure lasting more than 10 minutes',
  'Breathless at rest or cannot lie flat',
  'Fainting, confusion or a very slow pulse',
  'Top BP number above 160',
];

export const DOCS_ON_FILE = [
  'Discharge summary, City Care Hospital',
  'ECG and Echo reports (Echo EF 58%)',
  'Lab reports: lipid profile, kidney function',
];

export type Service = { key: string; name: string; abbr: string; tone: Tone; sub: string; kw: string };
export const SERVICES: Service[] = [
  { key: 'nursing', name: 'Home nursing', abbr: 'HN', tone: 'amber', sub: 'Injections, dressings, vitals', kw: 'nurse injection dressing vitals' },
  { key: 'physio', name: 'Physiotherapy', abbr: 'PT', tone: 'teal', sub: 'Post-surgery and stroke', kw: 'physio stroke surgery' },
  { key: 'icu', name: 'ICU at home', abbr: 'IC', tone: 'red', sub: 'Ventilator, monitor, doctor', kw: 'icu ventilator monitor doctor' },
  { key: 'attendant', name: 'Attendant', abbr: 'AT', tone: 'blue', sub: 'Day or night caregiver', kw: 'attendant caregiver day night' },
  { key: 'lab', name: 'Lab at home', abbr: 'LB', tone: 'violet', sub: 'Sample collection', kw: 'lab blood test sample' },
  { key: 'equipment', name: 'Equipment', abbr: 'EQ', tone: 'amber', sub: 'Rent or buy · fixed rates', kw: 'equipment oxygen bed wheelchair walker bp oximeter nebuliser mattress rent buy' },
  { key: 'diet', name: 'Dietitian', abbr: 'DT', tone: 'teal', sub: 'Diet by video or home', kw: 'dietitian diet food nutrition' },
  { key: 'doctor', name: 'Doctor visit', abbr: 'DR', tone: 'blue', sub: 'At home or video', kw: 'doctor video visit' },
];
export const SUGGESTED_SERVICES = ['nursing', 'physio', 'diet'];

export type Provider = {
  id: string; short: string; name: string; dist: number; rate: number; reviews: number;
  price: number; slot: string; slotRank: number; about: string; verified: string[];
};
export const PROVIDERS: Provider[] = [
  { id: 'sunrise', short: 'SH', name: 'Sunrise Home Nursing', dist: 2.1, rate: 4.7, reviews: 212, price: 650, slot: 'Today 4:30 PM', slotRank: 0, about: 'Registered nurses for post-cardiac, post-surgical and elderly care. Supervised by a clinical lead. Visits are logged with vitals and notes in Home Konnect.', verified: ['Licence verified', 'Police check done', 'Hospital-vetted'] },
  { id: 'carepoint', short: 'CP', name: 'CarePoint Homecare', dist: 3.4, rate: 4.5, reviews: 148, price: 550, slot: 'Today 6:00 PM', slotRank: 1, about: 'Home nursing and attendants across west Ahmedabad. Flexible day and night shifts, including 12-hour attendants.', verified: ['Licence verified', 'Police check done'] },
  { id: 'nightingale', short: 'NN', name: 'Nightingale Nurses Co-op', dist: 5.0, rate: 4.8, reviews: 96, price: 720, slot: 'Tomorrow 8:00 AM', slotRank: 2, about: 'A cooperative of experienced nurses, many from cardiac wards. Smaller team, higher continuity with the same nurse.', verified: ['Licence verified', 'Police check done', 'Hospital-vetted'] },
  { id: 'vitality', short: 'VH', name: 'Vitality Home Health', dist: 6.2, rate: 4.4, reviews: 301, price: 480, slot: 'Tomorrow 10:00 AM', slotRank: 3, about: 'Affordable daily nursing and physiotherapy packages. Larger team, so the nurse may change between visits.', verified: ['Licence verified'] },
];

export const PACKS = [
  { label: 'Single visit', n: 1, disc: 1 },
  { label: '7-day pack', n: 7, disc: 0.92 },
  { label: '14-day pack', n: 14, disc: 0.88 },
];
export const BOOK_DAYS = ['Tomorrow', 'Thu 23 Oct', 'Fri 24 Oct'];
export const BOOK_TIMES = ['8:00 AM', '10:00 AM', '4:30 PM', '7:00 PM'];

export const EQ_CATS = ['Breathing', 'Bed and mobility', 'Daily checks', 'Monitoring'] as const;
export type Equip = {
  id: string; name: string; abbr: string; cat: string; desc: string;
  canRent: boolean; canBuy: boolean; rentDay: number; rentMonth: number; buy: number;
  deposit: number; delivery: number; on: boolean; sug?: boolean;
};
export const EQUIPMENT: Equip[] = [
  { id: 'o2', name: 'Oxygen concentrator (5 L)', abbr: 'O₂', cat: 'Breathing', desc: "Delivers oxygen-enriched air at home. Needs a doctor's prescription. Includes mask and tubing.", canRent: true, canBuy: true, rentDay: 500, rentMonth: 10000, buy: 55000, deposit: 5000, delivery: 300, on: true },
  { id: 'neb', name: 'Nebuliser', abbr: 'NB', cat: 'Breathing', desc: 'Turns liquid medicine into a mist for breathing treatments. Includes mask and tubing.', canRent: true, canBuy: true, rentDay: 50, rentMonth: 800, buy: 1800, deposit: 500, delivery: 100, on: true },
  { id: 'bed', name: 'Hospital bed (manual, 3-function)', abbr: 'BD', cat: 'Bed and mobility', desc: 'Raises the back and knees, with side rails and wheels. Mattress is separate.', canRent: true, canBuy: true, rentDay: 250, rentMonth: 3500, buy: 18000, deposit: 2000, delivery: 500, on: true },
  { id: 'airmat', name: 'Anti-bedsore air mattress', abbr: 'AM', cat: 'Bed and mobility', desc: 'Alternating-pressure mattress with pump. For patients who stay in bed most of the day.', canRent: true, canBuy: true, rentDay: 60, rentMonth: 1200, buy: 3500, deposit: 500, delivery: 150, on: true },
  { id: 'wheel', name: 'Wheelchair (foldable)', abbr: 'WC', cat: 'Bed and mobility', desc: 'Foldable, with footrests. Suitable for indoor and short outdoor use.', canRent: true, canBuy: true, rentDay: 60, rentMonth: 900, buy: 4500, deposit: 1000, delivery: 200, on: true },
  { id: 'walker', name: 'Walker (adjustable)', abbr: 'WK', cat: 'Bed and mobility', desc: 'Height-adjustable frame for walking with support during recovery.', canRent: true, canBuy: true, rentDay: 30, rentMonth: 500, buy: 1600, deposit: 300, delivery: 100, on: true },
  { id: 'bp', name: 'Digital BP monitor (upper arm)', abbr: 'BP', cat: 'Daily checks', desc: 'For the morning blood pressure and pulse log your plan asks for. Large display.', canRent: false, canBuy: true, rentDay: 0, rentMonth: 0, buy: 1800, deposit: 0, delivery: 0, on: true, sug: true },
  { id: 'oxi', name: 'Pulse oximeter (fingertip)', abbr: 'OX', cat: 'Daily checks', desc: 'Reads oxygen level and pulse in seconds. Useful for the nurse and for your own log.', canRent: false, canBuy: true, rentDay: 0, rentMonth: 0, buy: 1200, deposit: 0, delivery: 0, on: true, sug: true },
  { id: 'mon', name: '24-hour monitor (sensor and app)', abbr: '24', cat: 'Monitoring', desc: 'Under-mattress sensor with the app. Watches heart rate, breathing, oxygen and temperature through the night.', canRent: true, canBuy: false, rentDay: 0, rentMonth: 4500, buy: 0, deposit: 0, delivery: 0, on: true },
];
export const DESK_ADD_DEFAULT = 3000;

export type PastService = { d: number; date: string; svc: string; by: string; note: string; amount: number; abbr: string; tone: Tone };
export const PAST_SERVICES: PastService[] = [
  { d: 19, date: '19 Oct', svc: 'Home nurse, first visit', by: 'Sunrise Home Nursing', note: 'BP 130/84, pulse 72, dressing clean. Medicines reviewed with the family.', amount: 650, abbr: 'HN', tone: 'amber' },
  { d: 19, date: '19 Oct', svc: 'Lab sample collection at home', by: 'Partner lab', note: 'Lipid profile and kidney function. Reports are with the family.', amount: 650, abbr: 'LB', tone: 'violet' },
  { d: 20, date: '20 Oct', svc: 'Home nurse', by: 'Sunrise Home Nursing', note: 'BP 128/82, SpO₂ 97%. Walking in the room with support.', amount: 650, abbr: 'HN', tone: 'amber' },
];

export const CARE_CIRCLE = [
  { init: 'KP', name: 'Kiran Patel', role: 'Son · Primary contact', access: 'Full access' },
  { init: 'AP', name: 'Anita Patel', role: 'Daughter · Backup contact', access: 'Full access' },
  { init: 'NP', name: 'Neha Patel', role: 'Granddaughter · Viewer', access: 'View only' },
];

export const SYMPTOMS = [
  { s: 'Chest pain', w: 3 }, { s: 'Breathless at rest', w: 3 }, { s: 'Fainted', w: 3 }, { s: 'Confused', w: 3 },
  { s: 'Fever above 101°F', w: 2 }, { s: 'Swollen legs', w: 2 }, { s: 'BP above limit', w: 2 },
  { s: 'Dizzy', w: 1 }, { s: 'Missed medicine', w: 1 }, { s: 'Poor sleep', w: 1 },
];

export const VISIT_TASKS = [
  'Check BP, pulse and oxygen',
  'Review medicines with family',
  'Assess walking and mobility',
  'Reinforce low-salt diet',
];
export const VISIT_CODE = '4827';

export const OTHER_DESK_PATIENTS = [
  { n: 'S. Desai, 54', s: 'ok' as const, sub: 'Post-op day 6 · HR 78 · SpO₂ 98%' },
  { n: 'M. Shah, 71', s: 'watch' as const, sub: 'Stroke recovery · Temp 99.8 · HR 88' },
  { n: 'A. Kumar, 66', s: 'ok' as const, sub: 'Heart failure · HR 70 · SpO₂ 96%' },
  { n: 'J. Mehta, 80', s: 'ok' as const, sub: 'Elderly, lives alone · HR 64 · SpO₂ 95%' },
];

export const NURSE = { name: "Meera D'Souza", short: 'MD', title: 'Staff nurse · Sunrise Home Nursing', bio: 'GNM · 8 years · cardiac and post-op care · speaks Gujarati, Hindi, English' };
