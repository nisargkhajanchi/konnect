/**
 * Turns a confirmed extraction into what the app shows (patient, medicines, care plan),
 * and into the payload saved by the confirm_extraction() database function.
 */
import type { Extraction } from '@shared/extraction';

import type { CarePlan, FollowUp, Med, Patient } from '@/data/demo';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-10-19" -> "19 Oct". Returns null for anything else. */
export function shortDate(iso: string | null | undefined): string | null {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  if (!m) return null;
  const mon = MONTHS[Number(m[2]) - 1];
  return mon ? `${Number(m[3])} ${mon}` : null;
}

/** "Heart attack (NSTEMI), stent placed" -> "Heart attack" */
export function shortCondition(text: string | null): string {
  if (!text) return 'Recovering at home';
  return text.split(/[(,;]/)[0].trim().slice(0, 40) || text.slice(0, 40);
}

export function medLabel(m: { name: string; strength: string | null }) {
  return m.strength && !m.name.includes(m.strength) ? `${m.name} ${m.strength}` : m.name;
}

export function followUpFrom(f: { department: string | null; doctor: string | null; date: string | null; time: string | null; place: string | null } | undefined): FollowUp | null {
  if (!f) return null;
  const when = [shortDate(f.date), f.time].filter(Boolean).join(', ');
  return { dept: f.department ?? 'Follow-up', when: when || 'Date not written', where: f.place ?? '' };
}

export function applyExtraction(e: Extraction, prev: Patient): { patient: Patient; meds: Med[]; plan: CarePlan } {
  const name = e.patient.name ?? prev.name;
  const allergies = e.allergies.map((a) => a.text);
  return {
    patient: {
      ...prev,
      name,
      first: name.split(/\s+/)[0] || name,
      age: e.patient.age ?? prev.age,
      condition: e.diagnosis.text ?? prev.condition,
      short: shortCondition(e.diagnosis.text ?? prev.condition),
      hospital: e.hospital.name ?? prev.hospital,
      discharged: shortDate(e.hospital.discharge_date) ?? prev.discharged,
      dischargedOn: e.hospital.discharge_date ?? prev.dischargedOn,
      doctor: e.treating_doctor ?? prev.doctor,
      allergy: allergies.length ? allergies.join(', ') : 'None recorded',
      followUp: followUpFrom(e.follow_ups[0]) ?? prev.followUp,
      bpLimit: e.bp_limit.sys && e.bp_limit.dia ? { sys: e.bp_limit.sys, dia: e.bp_limit.dia } : prev.bpLimit,
    },
    meds: e.medicines.map((m, i) => ({ id: `m${i}`, name: medLabel(m), time: m.timing, ok: true, taken: false })),
    plan: {
      warningSigns: e.warning_signs.map((w) => w.text),
      limits: e.limits.map((l) => l.text),
      dietActivity: e.diet_activity.map((d) => d.text),
      allergies,
    },
  };
}

/** Payload for public.confirm_extraction(document_id, payload). */
export function confirmPayload(e: Extraction) {
  return {
    patient_name: e.patient.name,
    age: e.patient.age,
    condition: e.diagnosis.text,
    hospital: e.hospital.name,
    discharged_on: e.hospital.discharge_date,
    treating_doctor: e.treating_doctor,
    bp_limit_sys: e.bp_limit.sys,
    bp_limit_dia: e.bp_limit.dia,
    medicines: e.medicines.map((m) => ({
      name: m.name, strength: m.strength, frequency: m.frequency, timing: m.timing, duration: m.duration, instructions: m.instructions,
    })),
    follow_ups: e.follow_ups,
    limits: e.limits,
    warning_signs: e.warning_signs,
    allergies: e.allergies,
    diet_activity: e.diet_activity,
  };
}
