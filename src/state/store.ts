/**
 * Single app store. Both roles read the same state, so a visit the nurse completes
 * shows up on the family side immediately, as in the prototype.
 * Demo only: nothing is persisted. Swap actions for API calls when the backend exists.
 */
import { create } from 'zustand';

import {
  DESK_ADD_DEFAULT, EQUIPMENT, EXTRACTED_MEDS, PROVIDERS, TODAY_LABEL, VISIT_TASKS,
  type Equip, type Med, type Provider,
} from '@/data/demo';
import {
  calcLine, clock, monScore, monState, type Line, type Mode, type Thresholds, type Unit, type Vitals,
} from '@/logic/rules';

export const PRO_ROLES = ['Nurse', 'Physiotherapist', 'Coordinator', 'Equipment supplier'] as const;
export type ProRole = (typeof PRO_ROLES)[number];

export type VisitStage = 0 | 1 | 2 | 3 | 4;
export const STAGE_LABEL = ['Scheduled', 'On the way', 'Arrived', 'In progress', 'Complete'] as const;

export type Booking = { ref: string; svc: string; provider: string; when: string; total: number };
export type CartItem = { id: string; mode: Mode; unit: Unit; n: number };
export type OrderLine = Line & { id: string; name: string; mode: Mode };
export type Order = { ref: string; slot: string; pay: string; status: 0 | 1 | 2; lines: OrderLine[] };
export type MonAlert = { title: string; detail: string; time: string; resolved: string | null };
export type SavedSummary = { when: string; sub: string; html: string; text: string };

export const ALERT_STEPS = [
  'Alert raised. Family and clinical desk notified',
  'Clinical desk is reviewing',
  'A nurse is calling you',
  'Resolved',
];

const seedHistory = () => {
  const hr: number[] = [], sp: number[] = [];
  for (let i = 0; i < 48; i++) {
    hr.push(Math.round(66 + 6 * Math.sin(i / 5) + (i % 7 === 0 ? 3 : 0) + (i >= 14 && i <= 26 ? -5 : 0)));
    sp.push(Math.round(97 + (i % 11 === 0 ? -1 : 0) + (i >= 18 && i <= 22 ? -2 : 0)));
  }
  return { hr, sp };
};
const NORMAL: Vitals = { hr: 72, spo2: 97, rr: 16, temp: 98.2 };

type Monitor = {
  paired: boolean; plan: 'A' | 'B'; v: Vitals; tgt: Vitals; thr: Thresholds;
  online: boolean; onBed: boolean; hHr: number[]; hSp: number[];
  alert: MonAlert | null; step: number; log: { t: string; m: string }[];
  alerts: MonAlert[]; since: string; ticks: number;
};

type State = {
  toast: string | null;
  showToast: (m: string) => void;

  /* onboarding */
  signedIn: boolean;
  setSignedIn: (v: boolean) => void;
  proRole: ProRole;
  setProRole: (r: ProRole) => void;
  reviewMeds: Med[];
  meds: Med[];
  hasSummary: boolean;
  startReview: () => void;
  confirmMed: (id: string) => void;
  renameMed: (id: string, name: string) => void;
  removeMed: (id: string) => void;
  buildPlan: () => void;
  skipSummary: () => void;
  toggleMedTaken: (id: string) => void;

  /* today */
  tasksDone: Record<string, boolean>;
  toggleTask: (id: string) => void;

  /* vitals */
  bp: [number, number][];
  addReading: (sys: number, dia: number) => void;

  /* records */
  share: 'active' | 'off' | 'revoked';
  setShare: (s: State['share']) => void;
  reorderSent: boolean;
  setReorderSent: () => void;
  claimReady: boolean;
  setClaimReady: () => void;

  /* booking */
  providers: Provider[];
  bookings: Booking[];
  addBooking: (b: Omit<Booking, 'ref'>) => Booking;

  /* shared visit */
  visit: { stage: VisitStage; tasks: { t: string; d: boolean }[]; vitals: { sys: number; dia: number; pul: number; spo: number } | null; note: string; escalated: boolean };
  setStage: (s: VisitStage) => void;
  toggleVisitTask: (i: number) => void;
  saveVisitVitals: (v: { sys: number; dia: number; pul: number; spo: number }) => void;
  escalateVisit: () => void;
  completeVisit: (note: string) => void;
  resetVisit: () => void;

  /* equipment */
  equipment: Equip[];
  deskAdd: number;
  rateStamp: string;
  cart: CartItem[];
  orders: Order[];
  addToCart: (c: CartItem) => void;
  removeFromCart: (i: number) => void;
  placeOrder: (slot: string, pay: string) => Order | null;
  advanceOrder: (ref: string) => void;
  saveEquip: (e: Equip) => void;
  addEquip: (e: Equip) => void;
  removeEquip: (id: string) => void;
  toggleEquip: (id: string) => void;
  setDeskAdd: (n: number) => void;

  /* monitor */
  mon: Monitor;
  setPlan: (p: 'A' | 'B') => void;
  setThreshold: (k: keyof Thresholds, v: number) => void;
  startMonitoring: () => void;
  monEvent: (k: 'lowO2' | 'fastHr' | 'fever' | 'offBed' | 'offline' | 'normal') => void;
  setAlertStep: (n: number) => void;
  clearAlert: () => void;
  tick: () => void;

  /* doctor summary */
  summaries: SavedSummary[];
  saveSummary: (s: Omit<SavedSummary, 'when'>) => void;
};

let alertTimers: ReturnType<typeof setTimeout>[] = [];
const clearAlertTimers = () => { alertTimers.forEach(clearTimeout); alertTimers = []; };
let orderSeq = 0;
let bookSeq = 0;

const EVENTS = {
  lowO2: { tgt: { hr: 98, spo2: 89, rr: 27, temp: 98.4 }, title: 'Low oxygen with fast breathing', detail: 'Oxygen 89%, breathing 27 a minute.' },
  fastHr: { tgt: { hr: 132, spo2: 96, rr: 20, temp: 98.4 }, title: 'Very fast heartbeat', detail: 'Heart rate 132 a minute.' },
  fever: { tgt: { hr: 92, spo2: 96, rr: 18, temp: 101.6 }, title: 'High temperature', detail: 'Temperature 101.6 °F.' },
};

export const useStore = create<State>()((set, get) => {
  const log = (m: string) =>
    set((s) => ({ mon: { ...s.mon, log: [{ t: clock(), m }, ...s.mon.log].slice(0, 8) } }));

  return {
    toast: null,
    showToast: (m) => {
      set({ toast: m });
      setTimeout(() => { if (get().toast === m) set({ toast: null }); }, 2800);
    },

    signedIn: false,
    setSignedIn: (v) => set({ signedIn: v }),
    proRole: 'Nurse',
    setProRole: (proRole) => set({ proRole }),
    reviewMeds: EXTRACTED_MEDS.map((m) => ({ ...m })),
    meds: EXTRACTED_MEDS.map((m) => ({ ...m, ok: true })),
    hasSummary: false,
    startReview: () => set({ reviewMeds: EXTRACTED_MEDS.map((m) => ({ ...m })) }),
    confirmMed: (id) => set((s) => ({ reviewMeds: s.reviewMeds.map((m) => (m.id === id ? { ...m, ok: true } : m)) })),
    renameMed: (id, name) => set((s) => ({ reviewMeds: s.reviewMeds.map((m) => (m.id === id ? { ...m, name, ok: true } : m)) })),
    removeMed: (id) => set((s) => ({ reviewMeds: s.reviewMeds.filter((m) => m.id !== id) })),
    buildPlan: () => set((s) => ({ meds: s.reviewMeds.map((m) => ({ ...m, taken: false })), hasSummary: true, tasksDone: {} })),
    skipSummary: () => set({ hasSummary: false }),
    toggleMedTaken: (id) => set((s) => ({ meds: s.meds.map((m) => (m.id === id ? { ...m, taken: !m.taken } : m)) })),

    tasksDone: {},
    toggleTask: (id) => set((s) => ({ tasksDone: { ...s.tasksDone, [id]: !s.tasksDone[id] } })),

    bp: [[132, 84], [130, 84], [134, 86], [128, 82], [130, 82], [126, 80], [128, 82]],
    addReading: (sys, dia) => set((s) => ({ bp: [...s.bp, [sys, dia] as [number, number]].slice(-7) })),

    share: 'active',
    setShare: (share) => set({ share }),
    reorderSent: false,
    setReorderSent: () => set({ reorderSent: true }),
    claimReady: false,
    setClaimReady: () => set({ claimReady: true }),

    providers: PROVIDERS,
    bookings: [],
    addBooking: (b) => {
      bookSeq++;
      const booking = { ...b, ref: 'HK-26-04' + (11 + bookSeq) };
      set((s) => ({ bookings: [...s.bookings, booking] }));
      return booking;
    },

    visit: { stage: 0, tasks: VISIT_TASKS.map((t) => ({ t, d: false })), vitals: null, note: '', escalated: false },
    setStage: (stage) => set((s) => ({ visit: { ...s.visit, stage } })),
    toggleVisitTask: (i) => set((s) => ({ visit: { ...s.visit, tasks: s.visit.tasks.map((t, j) => (j === i ? { ...t, d: !t.d } : t)) } })),
    saveVisitVitals: (vitals) => set((s) => ({ visit: { ...s.visit, vitals } })),
    escalateVisit: () => set((s) => ({ visit: { ...s.visit, escalated: true } })),
    completeVisit: (note) => set((s) => {
      const vitals = s.visit.vitals;
      return {
        visit: {
          ...s.visit, stage: 4, note: note || 'Readings recorded. Medicines reviewed. Family advised to continue the plan and log BP each morning.',
          tasks: s.visit.tasks.map((t) => ({ ...t, d: true })),
        },
        bp: vitals ? [...s.bp, [vitals.sys, vitals.dia] as [number, number]].slice(-7) : s.bp,
      };
    }),
    resetVisit: () => set({ visit: { stage: 0, tasks: VISIT_TASKS.map((t) => ({ t, d: false })), vitals: null, note: '', escalated: false } }),

    equipment: EQUIPMENT.map((e) => ({ ...e })),
    deskAdd: DESK_ADD_DEFAULT,
    rateStamp: 'Demo rates loaded. Replace every number with your own.',
    cart: [],
    orders: [],
    addToCart: (c) => set((s) => ({ cart: [...s.cart.filter((x) => x.id !== c.id), c] })),
    removeFromCart: (i) => set((s) => ({ cart: s.cart.filter((_, j) => j !== i) })),
    placeOrder: (slot, pay) => {
      const s = get();
      if (!s.cart.length) return null;
      orderSeq++;
      const lines: OrderLine[] = s.cart.flatMap((c) => {
        const it = s.equipment.find((e) => e.id === c.id);
        return it ? [{ ...calcLine(it, c.mode, c.unit, c.n), id: it.id, name: it.name, mode: c.mode }] : [];
      });
      const order: Order = { ref: 'HK-EQ-' + (2100 + orderSeq), slot, pay, status: 0, lines };
      set({ orders: [...s.orders, order], cart: [] });
      return order;
    },
    advanceOrder: (ref) => set((s) => ({
      orders: s.orders.map((o) => (o.ref === ref && o.status < 2 ? { ...o, status: (o.status + 1) as Order['status'] } : o)),
    })),
    saveEquip: (e) => set((s) => ({ equipment: s.equipment.map((x) => (x.id === e.id ? e : x)), rateStamp: `Last changed today at ${clock()} by you. Families see these rates now.` })),
    addEquip: (e) => set((s) => ({ equipment: [...s.equipment, e], rateStamp: `Last changed today at ${clock()} by you. Families see these rates now.` })),
    removeEquip: (id) => set((s) => ({ equipment: s.equipment.filter((x) => x.id !== id) })),
    toggleEquip: (id) => set((s) => ({ equipment: s.equipment.map((x) => (x.id === id ? { ...x, on: !x.on } : x)), rateStamp: `Last changed today at ${clock()} by you. Families see these rates now.` })),
    setDeskAdd: (deskAdd) => set({ deskAdd, rateStamp: `Last changed today at ${clock()} by you. Families see these rates now.` }),

    mon: (() => {
      const h = seedHistory();
      return {
        paired: false, plan: 'A', v: { ...NORMAL }, tgt: { ...NORMAL },
        thr: { spo2: 94, hrHi: 110, hrLo: 50, temp: 100.4, rrHi: 24 },
        online: true, onBed: true, hHr: h.hr, hSp: h.sp, alert: null, step: -1,
        log: [{ t: '06:10', m: 'Night summary ready. No alerts.' }], alerts: [], since: '', ticks: 0,
      } as Monitor;
    })(),
    setPlan: (plan) => set((s) => ({ mon: { ...s.mon, plan } })),
    setThreshold: (k, v) => set((s) => ({ mon: { ...s.mon, thr: { ...s.mon.thr, [k]: Math.round(v * 10) / 10 } } })),
    startMonitoring: () => {
      set((s) => ({ mon: { ...s.mon, paired: true, since: `${TODAY_LABEL}, ${clock()}` } }));
      log('Monitoring started. Limits saved.');
    },
    monEvent: (k) => {
      const s = get();
      if (k === 'normal') {
        set({ mon: { ...s.mon, online: true, onBed: true, tgt: { ...NORMAL } } });
        log('Back to normal.');
        if (s.mon.alert && s.mon.step < 3) get().setAlertStep(3);
        return;
      }
      if (k === 'offBed') { set({ mon: { ...s.mon, onBed: false } }); log('Out of bed. Sensor reads no movement on the mattress.'); return; }
      if (k === 'offline') { set({ mon: { ...s.mon, online: false } }); log('No data for 5 minutes. Check Wi-Fi or power.'); return; }
      const e = EVENTS[k];
      set({ mon: { ...s.mon, tgt: { ...e.tgt }, v: { ...e.tgt } } });
      if (k === 'fever') log('Temperature 101.6 °F. Watching.');
      const m = get().mon;
      if (monState(monScore(m.v, m.thr, m.online, m.onBed)) === 'alert' && !m.alert) {
        const a: MonAlert = { title: e.title, detail: e.detail, time: clock(), resolved: null };
        set({ mon: { ...m, alert: a, step: 0, alerts: [...m.alerts, a] } });
        log(`Alert: ${e.title}. Family and clinical desk notified.`);
        clearAlertTimers();
        alertTimers.push(setTimeout(() => { if (get().mon.step === 0) get().setAlertStep(1); }, 3500));
        alertTimers.push(setTimeout(() => { if (get().mon.step === 1) get().setAlertStep(2); }, 7000));
      }
    },
    setAlertStep: (n) => {
      const m = get().mon;
      if (!m.alert) return;
      if (n !== m.step) clearAlertTimers();
      let alerts = m.alerts, alert = m.alert;
      if (n === 3) {
        const t = clock();
        alert = { ...m.alert, resolved: t };
        alerts = m.alerts.map((a, i) => (i === m.alerts.length - 1 && !a.resolved ? { ...a, resolved: t } : a));
      }
      set({ mon: { ...m, step: n, alert, alerts } });
      log(ALERT_STEPS[n] + '.');
    },
    clearAlert: () => set((s) => ({ mon: { ...s.mon, alert: null, step: -1 } })),
    tick: () => {
      const m = get().mon;
      if (!m.paired) return;
      const walk = (cur: number, tgt: number, step: number, dec: number) => {
        const v = cur + (tgt - cur) * 0.3 + (Math.random() - 0.5) * step;
        const p = Math.pow(10, dec);
        return Math.round(v * p) / p;
      };
      const v: Vitals = {
        hr: Math.round(walk(m.v.hr, m.tgt.hr, 2.4, 0)),
        spo2: Math.min(100, Math.round(walk(m.v.spo2, m.tgt.spo2, 0.8, 0))),
        rr: Math.round(walk(m.v.rr, m.tgt.rr, 1.2, 0)),
        temp: walk(m.v.temp, m.tgt.temp, 0.08, 1),
      };
      // Every 15 ticks (~30 s) the chart advances one point, so the history scrolls.
      const ticks = m.ticks + 1;
      const advance = ticks % 15 === 0;
      const hHr = advance ? [...m.hHr.slice(1), v.hr] : [...m.hHr.slice(0, -1), v.hr];
      const hSp = advance ? [...m.hSp.slice(1), v.spo2] : [...m.hSp.slice(0, -1), v.spo2];
      set({ mon: { ...m, v, hHr, hSp, ticks } });
    },

    summaries: [],
    saveSummary: (sm) => set((s) => {
      if (s.summaries[0]?.html === sm.html) return {};
      return { summaries: [{ ...sm, when: `${TODAY_LABEL}, ${clock()}` }, ...s.summaries] };
    }),
  };
});

/* ---------- selectors ---------- */
export const useMonState = () =>
  useStore((s) => (s.mon.paired ? monState(monScore(s.mon.v, s.mon.thr, s.mon.online, s.mon.onBed)) : 'ok'));
