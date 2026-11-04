/**
 * All calls to the Home Konnect backend (Supabase). Screens go through the store, which calls these.
 * Every function throws an Error with a message that is safe to show in a toast.
 */
import { FunctionsHttpError } from '@supabase/supabase-js';
import type { Extraction } from '@shared/extraction';

import { supabase } from '@/lib/supabase';

const db = () => {
  if (!supabase) throw new Error('The backend is not configured.');
  return supabase;
};
function must<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

/* ---------------- auth ---------------- */

/** Accepts "98765 43210", "+91 98765 43210", etc. and returns "+919876543210". */
export function toIndianE164(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  return /^[6-9]\d{9}$/.test(local) ? `+91${local}` : null;
}

export async function sendOtp(phone: string) {
  must(await db().auth.signInWithOtp({ phone }));
}
export async function verifyOtp(phone: string, token: string) {
  const data = must(await db().auth.verifyOtp({ phone, token, type: 'sms' }));
  if (!data.session) throw new Error('That code did not work. Please try again.');
  return data.session;
}
export async function currentUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}
export async function signOut() {
  if (supabase) await supabase.auth.signOut();
}

export type ProfileRow = { id: string; kind: 'family' | 'provider'; provider_role: string | null; provider_org_id: string | null };
export async function getProfile(): Promise<ProfileRow | null> {
  const uid = await currentUserId();
  if (!uid) return null;
  return must(await db().from('profiles').select('id, kind, provider_role, provider_org_id').eq('id', uid).maybeSingle()) as ProfileRow | null;
}

/* ---------------- family ---------------- */

export type PatientRow = {
  id: string; full_name: string | null; age: number | null; condition: string | null; hospital: string | null;
  discharged_on: string | null; treating_doctor: string | null; address: string | null; bp_limit_sys: number; bp_limit_dia: number;
};
export type PlanRow = {
  follow_ups: Extraction['follow_ups']; limits: Extraction['limits']; warning_signs: Extraction['warning_signs'];
  allergies: Extraction['allergies']; diet_activity: Extraction['diet_activity'];
};
export type MedRow = { id: string; name: string; strength: string | null; timing: string | null; frequency: string | null };
export type BpRow = { sys: number; dia: number; recorded_at: string };
export type VisitRow = {
  id: string; patient_id: string; provider_org_id: string; service: string; scheduled_at: string;
  patient_name: string | null; address: string | null; stage: 0 | 1 | 2 | 3 | 4;
  tasks: { t: string; d: boolean }[]; vitals: { sys: number; dia: number; pul: number; spo: number } | null;
  note: string | null; escalated: boolean; share_records: boolean; price_inr: number | null;
};
const VISIT_COLS = 'id, patient_id, provider_org_id, service, scheduled_at, patient_name, address, stage, tasks, vitals, note, escalated, share_records, price_inr';

/** Returns the patient this user manages, creating an empty one on first sign-in. */
export async function ensurePatient(): Promise<string> {
  const uid = await currentUserId();
  if (!uid) throw new Error('Sign in first.');
  const rows = must(await db().from('patient_members').select('patient_id').eq('user_id', uid).limit(1)) as { patient_id: string }[];
  if (rows[0]) return rows[0].patient_id;
  return must(await db().rpc('create_patient', {})) as string;
}

export async function loadFamily(pid: string) {
  const c = db();
  const [patient, plan, meds, bp, visits] = await Promise.all([
    c.from('patients').select('id, full_name, age, condition, hospital, discharged_on, treating_doctor, address, bp_limit_sys, bp_limit_dia').eq('id', pid).single(),
    c.from('care_plans').select('follow_ups, limits, warning_signs, allergies, diet_activity').eq('patient_id', pid).maybeSingle(),
    c.from('medicines').select('id, name, strength, timing, frequency').eq('patient_id', pid).eq('active', true).order('created_at'),
    c.from('bp_readings').select('sys, dia, recorded_at').eq('patient_id', pid).order('recorded_at', { ascending: false }).limit(7),
    c.from('visits').select(VISIT_COLS).eq('patient_id', pid).order('scheduled_at', { ascending: false }).limit(20),
  ]);
  return {
    patient: must(patient) as PatientRow,
    plan: must(plan) as PlanRow | null,
    meds: must(meds) as MedRow[],
    bp: (must(bp) as BpRow[]).reverse(),
    visits: must(visits) as VisitRow[],
  };
}

export async function visitCode(visitId: string): Promise<string | null> {
  const row = must(await db().from('visit_codes').select('code').eq('visit_id', visitId).maybeSingle()) as { code: string } | null;
  return row?.code ?? null;
}

/** Uploads a picked file into the patient's private folder and registers it. Returns the document id. */
export async function uploadDocument(pid: string, uri: string, mimeType: string | undefined, name: string): Promise<string> {
  const ext = (/\.([a-z0-9]{2,5})$/i.exec(name)?.[1] ?? (mimeType === 'application/pdf' ? 'pdf' : 'jpg')).toLowerCase();
  const path = `${pid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const body = await (await fetch(uri)).arrayBuffer();
  must(await db().storage.from('documents').upload(path, body, { contentType: mimeType ?? 'application/octet-stream', upsert: false }));
  const row = must(await db().from('documents').insert({ patient_id: pid, storage_path: path, mime_type: mimeType ?? null }).select('id').single()) as { id: string };
  return row.id;
}

/** Runs the reader: built-in parser for digital PDFs; scans and photos need typing in. */
export async function readSummary(documentId: string): Promise<{ extraction: Extraction; needs_review: string[] }> {
  const { data, error } = await db().functions.invoke('read-summary', { body: { document_id: documentId } });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null) as { error?: string } | null;
      throw new Error(body?.error ?? 'We could not read this document.');
    }
    throw new Error('Could not reach the document reader. Check your connection and try again.');
  }
  return data as { extraction: Extraction; needs_review: string[] };
}

/** Saves the plan the family confirmed. documentId is null when they typed it in. */
export async function confirmPlan(patientId: string, documentId: string | null, payload: object) {
  must(await db().rpc('confirm_plan', { p_patient_id: patientId, p_document_id: documentId, p: payload }));
}
export async function addBp(pid: string, sys: number, dia: number) {
  must(await db().from('bp_readings').insert({ patient_id: pid, sys, dia }));
}
export async function bookVisit(pid: string, orgSlug: string, service: string, when: Date, share: boolean, priceInr: number): Promise<string> {
  return must(await db().rpc('book_visit', {
    p_patient_id: pid, p_org_slug: orgSlug, p_service: service, p_scheduled_at: when.toISOString(), p_share: share, p_price_inr: priceInr,
  })) as string;
}
export async function setSharing(visitId: string, share: boolean) {
  must(await db().rpc('set_visit_sharing', { p_visit_id: visitId, p_share: share }));
}

/** Provider organisation names keyed by id. */
export async function orgNames(): Promise<Record<string, string>> {
  const rows = must(await db().from('provider_orgs').select('id, name')) as { id: string; name: string }[];
  return Object.fromEntries(rows.map((r) => [r.id, r.name]));
}

/* ---------------- provider ---------------- */

export async function joinOrg(code: string, role: string) {
  return must(await db().rpc('join_provider_org', { p_join_code: code.trim().toUpperCase(), p_role: role })) as string;
}
export async function loadOrgVisits(): Promise<VisitRow[]> {
  return must(await db().from('visits').select(VISIT_COLS).order('scheduled_at').limit(50)) as VisitRow[];
}
export async function visitAdvance(id: string, stage: 1 | 2) {
  must(await db().rpc('visit_advance', { p_visit_id: id, p_stage: stage }));
}
export async function visitCheckIn(id: string, code: string): Promise<boolean> {
  return must(await db().rpc('visit_check_in', { p_visit_id: id, p_code: code })) as boolean;
}
export async function visitRecord(id: string, tasks: VisitRow['tasks'] | null, vitals: VisitRow['vitals']) {
  must(await db().rpc('visit_record', { p_visit_id: id, p_tasks: tasks, p_vitals: vitals }));
}
export async function visitEscalate(id: string) {
  must(await db().rpc('visit_escalate', { p_visit_id: id }));
}
export async function visitComplete(id: string, note: string) {
  must(await db().rpc('visit_complete', { p_visit_id: id, p_note: note }));
}

/* ---------------- realtime ---------------- */

/** Calls onChange with each inserted or updated visit row the user may see. Returns an unsubscribe function. */
export function watchVisits(filter: { patientId?: string; orgId?: string }, onChange: (row: VisitRow) => void) {
  if (!supabase) return () => {};
  const f = filter.patientId ? `patient_id=eq.${filter.patientId}` : `provider_org_id=eq.${filter.orgId}`;
  const channel = supabase
    .channel(`visits:${f}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'visits', filter: f }, (payload) => {
      if (payload.new && 'id' in payload.new) onChange(payload.new as VisitRow);
    })
    .subscribe();
  return () => { supabase?.removeChannel(channel); };
}

/** What a provider may see about a patient while the family shares records for an open visit. */
export async function loadSharedRecords(pid: string) {
  const c = db();
  const [patient, plan, meds] = await Promise.all([
    c.from('patients').select('age, condition, hospital, discharged_on, bp_limit_sys, bp_limit_dia').eq('id', pid).maybeSingle(),
    c.from('care_plans').select('allergies, warning_signs').eq('patient_id', pid).maybeSingle(),
    c.from('medicines').select('name, strength').eq('patient_id', pid).eq('active', true),
  ]);
  return {
    patient: must(patient) as Pick<PatientRow, 'age' | 'condition' | 'hospital' | 'discharged_on' | 'bp_limit_sys' | 'bp_limit_dia'> | null,
    plan: must(plan) as Pick<PlanRow, 'allergies' | 'warning_signs'> | null,
    meds: must(meds) as { name: string; strength: string | null }[],
  };
}
