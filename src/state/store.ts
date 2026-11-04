/**
 * Single app store. Both roles read the same state.
 *
 * Demo mode (no Supabase keys): everything is in memory, as in the prototype.
 * Live mode: patient, plan, medicines, BP readings and visits load from Supabase, writes go to the
 * backend, and visits stream in real time so the family sees the nurse's progress on another phone.
 * Equipment, monitoring, bills and the care circle are still demo-only in both modes.
 */
import type { Extraction } from '@shared/extraction';
import { create } from 'zustand';

import {
  DESK_ADD_DEFAULT, EQUIPMENT, PAST_SERVICES, PATIENT, PROVIDERS, SAMPLE_EXTRACTION, TODAY_LABEL, VISIT_CODE, VISIT_TASKS,
  type CarePlan, type Equip, type Med, type Patient, type PastService, type Provider,
} from '@/data/demo';
import * as api from '@/lib/api';
import { isLive } from '@/lib/supabase';
import { applyExtraction, confirmPayload, followUpFrom, medLabel, shortCondition, shortDate } from '@/logic/plan';
import {
  calcLine, clock, monScore, monState, type Line, type Mode, type Thresholds, type Unit, type Vitals,
} from '@/logic/rules';

export const PRO_ROLES = ['Nurse', 'Physiotherapist', 'Coordinator', 'Equipment supplier'] as const;
export type ProRole = (typeof PRO_ROLES)[number];
export const PRO_ROLE_KEY: Record<ProRole, string> = { Nurse: 'nurse', Physiotherapist: 'physio', Coordinator: 'coordinator', 'Equipment supplier': 'supplier' };

export type VisitStage = 0 | 1 | 2 | 3 | 4;
export const STAGE_LABEL = ['Scheduled', 'On the way', 'Arrived', 'In progress', 'Complete'] as const;

export type VisitVitals = { sys: number; dia: number; pul: number; spo: number };
export type Visit = {
  /** null when there is no visit to show (live mode before the first booking). */
  id: string | null;
  patientId: string | null;
  stage: VisitStage;
  tasks: { t: string; d: boolean }[];
  vitals: VisitVitals | null;
  note: string;
  escalated: boolean;
  service: string;
  when: string;
  provider: string;
  patientName: string;
  address: string;
  share: boolean;
  /** Door code. Families only; never loaded on the provider side. */
  code: string | null;
};

export type Booking = { ref: string; svc: string; provider: string; when: string; total: number };
export type CartItem = { id: string; mode: Mode; unit: Unit; n: number };
export type OrderLine = Line & { id: string; name: string; mode: Mode };
export type Order = { ref: string; slot: string; pay: string; status: 0 | 1 | 2; lines: OrderLine[] };
export type MonAlert = { title: string; detail: string; time: string; resolved: string | null };
export type SavedSummary = { when: string; sub: string; html: string; text: string };
export type Review = { documentId: string | null; fileName: string; extraction: Extraction; notes: string[] };

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

const freshTasks = () => VISIT_TASKS.map((t) => ({ t, d: false }));
const DEMO_VISIT: Visit = {
  id: 'demo', patientId: null, stage: 0, tasks: freshTasks(), vitals: null, note: '', escalated: false,
  service: 'Home nurse', when: 'Today, 4:30 PM', provider: 'Sunrise Home Nursing',
  patientName: PATIENT.name, address: PATIENT.address, share: true, code: VISIT_CODE,
};
const NO_VISIT: Visit = { ...DEMO_VISIT, id: null, code: null, when: '', patientName: '', address: '' };
const demoApplied = applyExtraction(SAMPLE_EXTRACTION, PATIENT);
const EMPTY_PATIENT: Patient = {
  id: null, name: 'Your family member', first: 'Your family member', age: null, condition: '', short: 'Recovering at home',
  hospital: '', discharged: '', dischargedOn: null, address: '', allergy: 'None recorded', doctor: '', followUp: null, bpLimit: { sys: 140, dia: 90 },
};
const EMPTY_PLAN: CarePlan = { warningSigns: [], limits: [], dietActivity: [], allergies: [] };

/** "Today, 4:30 PM" / "Tomorrow, 10:00 AM" / "Thu 23 Oct, 8:00 AM" */
export function fmtWhen(iso: string, now = new Date()) {
  const d = new Date(iso);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(now)) / 86400000);
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase();
  const label = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
  return `${label}, ${time}`;
}

type State = {
  live: boolean;
  toast: string | null;
  showToast: (m: string) => void;
  busy: string | null;

  /* session */
  signedIn: boolean;
  setSignedIn: (v: boolean) => void;
  proRole: ProRole;
  setProRole: (r: ProRole) => void;
  providerOrgId: string | null;
  signOut: () => Promise<void>;

  /* patient and plan */
  patient: Patient;
  plan: CarePlan;
  meds: Med[];
  hasSummary: boolean;
  pastServices: PastService[];
  loadFamily: () => Promise<boolean>;

  /* document review */
  review: Review | null;
  setReview: (r: Review) => void;
  confirmReviewMed: (i: number) => void;
  renameReviewMed: (i: number, name: string) => void;
  removeReviewMed: (i: number) => void;
  buildPlan: () => Promise<boolean>;
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
  addBooking: (b: Omit<Booking, 'ref'> & { providerId: string; at: Date; share: boolean }) => Promise<Booking | null>;

  /* shared visit */
  visit: Visit;
  orgVisits: Visit[];
  loadProvider: () => Promise<void>;
  selectOrgVisit: (id: string) => void;
  setStage: (s: 1 | 2) => void;
  checkIn: (code: string) => Promise<boolean>;
  toggleVisitTask: (i: number) => void;
  saveVisitVitals: (v: VisitVitals) => void;
  escalateVisit: () => void;
  /** Saves any unsaved readings first, then completes. */
  completeVisit: (note: string, vitals?: VisitVitals) => void;
  /** Demo only: replays a whole visit on the family side. */
  playDemoVisit: () => void;

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
let demoVisitTimers: ReturnType<typeof setTimeout>[] = [];
let unwatch: () => void = () => {};
let orderSeq = 0;
let bookSeq = 0;

const EVENTS = {
  lowO2: { tgt: { hr: 98, spo2: 89, rr: 27, temp: 98.4 }, title: 'Low oxygen with fast breathing', detail: 'Oxygen 89%, breathing 27 a minute.' },
  fastHr: { tgt: { hr: 132, spo2: 96, rr: 20, temp: 98.4 }, title: 'Very fast heartbeat', detail: 'Heart rate 132 a minute.' },
  fever: { tgt: { hr: 92, spo2: 96, rr: 18, temp: 101.6 }, title: 'High temperature', detail: 'Temperature 101.6 °F.' },
};

function rowToVisit(r: api.VisitRow, orgName: string, code: string | null): Visit {
  return {
    id: r.id, patientId: r.patient_id, stage: r.stage, tasks: Array.isArray(r.tasks) ? r.tasks : freshTasks(), vitals: r.vitals, note: r.note ?? '',
    escalated: r.escalated, service: r.service, when: fmtWhen(r.scheduled_at), provider: orgName,
    patientName: r.patient_name ?? 'Patient', address: r.address ?? '', share: r.share_records, code,
  };
}
/** The visit to show on Today: the next open one, otherwise the most recent. */
function pickVisit(rows: api.VisitRow[]): api.VisitRow | undefined {
  const open = rows.filter((r) => r.stage < 4).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  return open[0] ?? rows[0];
}

export const useStore = create<State>()((set, get) => {
  const log = (m: string) =>
    set((s) => ({ mon: { ...s.mon, log: [{ t: clock(), m }, ...s.mon.log].slice(0, 8) } }));

  /** Runs a backend write; on failure shows the reason and reloads the server's view. */
  const remote = (fn: () => Promise<unknown>, reload?: () => Promise<unknown>) => {
    if (!isLive) return;
    fn().catch((e: unknown) => {
      get().showToast(e instanceof Error ? e.message : 'Could not save. Please try again.');
      reload?.().catch(() => {});
    });
  };
  const patchVisit = (p: Partial<Visit>) => set((s) => {
    const visit = { ...s.visit, ...p };
    return { visit, orgVisits: s.orgVisits.map((v) => (v.id === visit.id ? visit : v)) };
  });
  const reloadProvider = () => get().loadProvider();

  return {
    live: isLive,
    toast: null,
    showToast: (m) => {
      set({ toast: m });
      setTimeout(() => { if (get().toast === m) set({ toast: null }); }, 3200);
    },
    busy: null,

    signedIn: false,
    setSignedIn: (v) => set({ signedIn: v }),
    proRole: 'Nurse',
    setProRole: (proRole) => set({ proRole }),
    providerOrgId: null,
    signOut: async () => {
      unwatch();
      await api.signOut().catch(() => {});
      set({
        signedIn: false, providerOrgId: null, review: null, bookings: [], orgVisits: [], tasksDone: {},
        ...(isLive ? { patient: EMPTY_PATIENT, plan: EMPTY_PLAN, meds: [], bp: [], visit: NO_VISIT, hasSummary: false, pastServices: [] } : {}),
      });
    },

    patient: isLive ? EMPTY_PATIENT : demoApplied.patient,
    plan: isLive ? EMPTY_PLAN : demoApplied.plan,
    meds: isLive ? [] : demoApplied.meds,
    hasSummary: false,
    pastServices: isLive ? [] : PAST_SERVICES,

    loadFamily: async () => {
      if (!isLive) return true;
      try {
        set({ busy: 'Loading…' });
        const pid = await api.ensurePatient();
        const [d, orgs] = await Promise.all([api.loadFamily(pid), api.orgNames()]);
        const p = d.patient;
        const name = p.full_name ?? EMPTY_PATIENT.name;
        const current = pickVisit(d.visits);
        const code = current && current.stage < 4 ? await api.visitCode(current.id) : null;
        set({
          patient: {
            id: p.id, name, first: name.split(/\s+/)[0], age: p.age, condition: p.condition ?? '', short: shortCondition(p.condition),
            hospital: p.hospital ?? '', discharged: shortDate(p.discharged_on) ?? '', dischargedOn: p.discharged_on, address: p.address ?? '',
            allergy: d.plan?.allergies.map((a) => a.text).join(', ') || 'None recorded', doctor: p.treating_doctor ?? '',
            followUp: followUpFrom(d.plan?.follow_ups[0]), bpLimit: { sys: p.bp_limit_sys, dia: p.bp_limit_dia },
          },
          plan: d.plan ? {
            warningSigns: d.plan.warning_signs.map((x) => x.text), limits: d.plan.limits.map((x) => x.text),
            dietActivity: d.plan.diet_activity.map((x) => x.text), allergies: d.plan.allergies.map((x) => x.text),
          } : EMPTY_PLAN,
          hasSummary: !!d.plan,
          meds: d.meds.map((m) => ({ id: m.id, name: medLabel(m), time: m.timing ?? m.frequency ?? 'As directed', ok: true, taken: false })),
          bp: d.bp.map((r) => [r.sys, r.dia] as [number, number]),
          visit: current ? rowToVisit(current, orgs[current.provider_org_id] ?? 'Home care provider', code) : NO_VISIT,
          share: current?.share_records === false ? 'off' : 'active',
          bookings: d.visits.filter((v) => v.id !== current?.id && v.stage < 4).map((v) => ({
            ref: v.id.slice(0, 8).toUpperCase(), svc: v.service, provider: orgs[v.provider_org_id] ?? '', when: fmtWhen(v.scheduled_at), total: v.price_inr ?? 0,
          })),
          pastServices: d.visits.filter((v) => v.stage === 4 && v.id !== current?.id).map((v) => ({
            d: new Date(v.scheduled_at).getDate(), date: shortDate(v.scheduled_at.slice(0, 10)) ?? '', svc: v.service,
            by: orgs[v.provider_org_id] ?? '', note: v.note ?? '', amount: v.price_inr ?? 0, abbr: 'HN', tone: 'amber',
          })),
          busy: null,
        });
        // Live updates while the nurse works the visit.
        unwatch();
        unwatch = api.watchVisits({ patientId: pid }, (row) => {
          const s = get();
          if (row.id === s.visit.id) {
            set({ visit: { ...rowToVisit(row, s.visit.provider, s.visit.code) } });
            if (row.stage === 4 && s.visit.stage < 4) get().loadFamily();
          } else if (row.stage < 4) get().loadFamily();
        });
        return true;
      } catch (e) {
        set({ busy: null });
        get().showToast(e instanceof Error ? e.message : 'Could not load your data.');
        return false;
      }
    },

    review: null,
    setReview: (review) => set({ review }),
    confirmReviewMed: (i) => set((s) => s.review ? {
      review: { ...s.review, extraction: { ...s.review.extraction, medicines: s.review.extraction.medicines.map((m, j) => (j === i ? { ...m, confidence: 'high', uncertainty_reason: null } : m)) } },
    } : {}),
    renameReviewMed: (i, name) => set((s) => s.review ? {
      review: { ...s.review, extraction: { ...s.review.extraction, medicines: s.review.extraction.medicines.map((m, j) => (j === i ? { ...m, name, strength: null, confidence: 'high', uncertainty_reason: null } : m)) } },
    } : {}),
    removeReviewMed: (i) => set((s) => s.review ? {
      review: { ...s.review, extraction: { ...s.review.extraction, medicines: s.review.extraction.medicines.filter((_, j) => j !== i) } },
    } : {}),
    buildPlan: async () => {
      const r = get().review;
      if (!r) return false;
      if (isLive && r.documentId) {
        try {
          set({ busy: 'Saving your plan…' });
          await api.confirmExtraction(r.documentId, confirmPayload(r.extraction));
          set({ busy: null, review: null, tasksDone: {} });
          return await get().loadFamily();
        } catch (e) {
          set({ busy: null });
          get().showToast(e instanceof Error ? e.message : 'Could not save your plan.');
          return false;
        }
      }
      const applied = applyExtraction(r.extraction, get().patient);
      set({ ...applied, hasSummary: true, tasksDone: {}, review: null });
      return true;
    },
    skipSummary: () => set({ hasSummary: false }),
    toggleMedTaken: (id) => set((s) => ({ meds: s.meds.map((m) => (m.id === id ? { ...m, taken: !m.taken } : m)) })),

    tasksDone: {},
    toggleTask: (id) => set((s) => ({ tasksDone: { ...s.tasksDone, [id]: !s.tasksDone[id] } })),

    bp: isLive ? [] : [[132, 84], [130, 84], [134, 86], [128, 82], [130, 82], [126, 80], [128, 82]],
    addReading: (sys, dia) => {
      set((s) => ({ bp: [...s.bp, [sys, dia] as [number, number]].slice(-7) }));
      const pid = get().patient.id;
      if (pid) remote(() => api.addBp(pid, sys, dia));
    },

    share: 'active',
    setShare: (share) => {
      set({ share });
      const id = get().visit.id;
      if (id && id !== 'demo') remote(() => api.setSharing(id, share === 'active'), get().loadFamily);
    },
    reorderSent: false,
    setReorderSent: () => set({ reorderSent: true }),
    claimReady: false,
    setClaimReady: () => set({ claimReady: true }),

    providers: PROVIDERS,
    bookings: [],
    addBooking: async ({ providerId, at, share, ...b }) => {
      if (isLive) {
        const pid = get().patient.id;
        if (!pid) { get().showToast('Add the discharge summary first so we know who the visit is for.'); return null; }
        try {
          const id = await api.bookVisit(pid, providerId, b.svc, at, share, b.total);
          await get().loadFamily();
          return { ...b, ref: id.slice(0, 8).toUpperCase() };
        } catch (e) {
          get().showToast(e instanceof Error ? e.message : 'Could not book the visit.');
          return null;
        }
      }
      bookSeq++;
      const booking = { ...b, ref: 'HK-26-04' + (11 + bookSeq) };
      set((s) => ({ bookings: [...s.bookings, booking], share: share ? 'active' : 'off' }));
      return booking;
    },

    visit: isLive ? NO_VISIT : DEMO_VISIT,
    orgVisits: [],
    loadProvider: async () => {
      if (!isLive) return;
      try {
        const [profile, rows, orgs] = await Promise.all([api.getProfile(), api.loadOrgVisits(), api.orgNames()]);
        const orgId = profile?.provider_org_id ?? null;
        const visits = rows.map((r) => rowToVisit(r, orgs[r.provider_org_id] ?? '', null));
        const current = pickVisit(rows);
        set((s) => ({
          providerOrgId: orgId,
          orgVisits: visits,
          visit: visits.find((v) => v.id === (s.visit.id && visits.some((x) => x.id === s.visit.id) ? s.visit.id : current?.id)) ?? NO_VISIT,
        }));
        if (orgId) {
          unwatch();
          unwatch = api.watchVisits({ orgId }, (row) => {
            const v = rowToVisit(row, orgs[row.provider_org_id] ?? '', null);
            set((s) => ({
              orgVisits: s.orgVisits.some((x) => x.id === v.id) ? s.orgVisits.map((x) => (x.id === v.id ? v : x)) : [...s.orgVisits, v],
              visit: s.visit.id === v.id ? v : s.visit,
            }));
          });
        }
      } catch (e) {
        get().showToast(e instanceof Error ? e.message : 'Could not load visits.');
      }
    },
    selectOrgVisit: (id) => set((s) => ({ visit: s.orgVisits.find((v) => v.id === id) ?? s.visit })),
    setStage: (stage) => {
      const id = get().visit.id;
      patchVisit({ stage });
      if (id) remote(() => api.visitAdvance(id, stage), reloadProvider);
    },
    checkIn: async (code) => {
      const v = get().visit;
      if (!isLive) {
        if (code !== VISIT_CODE) return false;
        patchVisit({ stage: 3 });
        return true;
      }
      if (!v.id) return false;
      try {
        const ok = await api.visitCheckIn(v.id, code);
        if (ok) patchVisit({ stage: 3 });
        return ok;
      } catch (e) {
        get().showToast(e instanceof Error ? e.message : 'Could not check in.');
        return false;
      }
    },
    toggleVisitTask: (i) => {
      const v = get().visit;
      const tasks = v.tasks.map((t, j) => (j === i ? { ...t, d: !t.d } : t));
      patchVisit({ tasks });
      if (v.id) remote(() => api.visitRecord(v.id!, tasks, null), reloadProvider);
    },
    saveVisitVitals: (vitals) => {
      const v = get().visit;
      patchVisit({ vitals });
      if (v.id) remote(() => api.visitRecord(v.id!, null, vitals), reloadProvider);
    },
    escalateVisit: () => {
      const v = get().visit;
      patchVisit({ escalated: true });
      if (v.id) remote(() => api.visitEscalate(v.id!), reloadProvider);
    },
    completeVisit: (note, vitals) => {
      const v = get().visit;
      const finalVitals = v.vitals ?? vitals ?? null;
      const finalNote = note || 'Readings recorded. Medicines reviewed. Family advised to continue the plan and log BP each morning.';
      patchVisit({ stage: 4, note: finalNote, vitals: finalVitals, tasks: v.tasks.map((t) => ({ ...t, d: true })) });
      if (!isLive && finalVitals) set((s) => ({ bp: [...s.bp, [finalVitals.sys, finalVitals.dia] as [number, number]].slice(-7) }));
      // In order: the server only accepts readings while the visit is in progress.
      if (v.id) remote(async () => {
        if (!v.vitals && finalVitals) await api.visitRecord(v.id!, null, finalVitals);
        await api.visitComplete(v.id!, note);
      }, reloadProvider);
    },
    playDemoVisit: () => {
      if (isLive) return;
      demoVisitTimers.forEach(clearTimeout);
      set({ visit: { ...DEMO_VISIT, tasks: freshTasks() } });
      const t = (i: number) => (fn: () => void) => demoVisitTimers.push(setTimeout(fn, 1000 * i));
      t(1)(() => patchVisit({ stage: 1 }));
      t(2)(() => { patchVisit({ stage: 2 }); get().showToast('Nurse has arrived. Share the code at the door.'); });
      t(3)(() => patchVisit({ stage: 3, vitals: { sys: 128, dia: 82, pul: 72, spo: 97 }, tasks: get().visit.tasks.map((x, i) => (i === 0 ? { ...x, d: true } : x)) }));
      t(4)(() => patchVisit({ tasks: get().visit.tasks.map((x, i) => (i < 3 ? { ...x, d: true } : x)) }));
      t(5)(() => get().completeVisit('Readings steady. Walks with light support. Medicines taken on time. Advised to keep salt low and log BP each morning.'));
    },

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
export const usePatient = () => useStore((s) => s.patient);
