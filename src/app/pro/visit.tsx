import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Banner, Btn, Card, Field, Row, Screen, Stepper, Sub, T, TaskRow } from '@/components/ui';
import { VISIT_CODE } from '@/data/demo';
import * as api from '@/lib/api';
import { medLabel } from '@/logic/plan';
import { useStore } from '@/state/store';
import { C, F } from '@/theme';

/** Nurse's side of the same visit the family is watching. */
export default function ProVisit() {
  const live = useStore((s) => s.live);
  const visit = useStore((s) => s.visit);
  const demoPatient = useStore((s) => s.patient);
  const demoMeds = useStore((s) => s.meds);
  const mon = useStore((s) => s.mon);
  const setStage = useStore((s) => s.setStage);
  const checkIn = useStore((s) => s.checkIn);
  const toggleTask = useStore((s) => s.toggleVisitTask);
  const saveVitals = useStore((s) => s.saveVisitVitals);
  const escalate = useStore((s) => s.escalateVisit);
  const complete = useStore((s) => s.completeVisit);
  const toast = useStore((s) => s.showToast);

  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [v, setV] = useState({ sys: 128, dia: 82, pul: 72, spo: 97 });
  const [saved, setSaved] = useState<null | boolean>(null);
  const [note, setNote] = useState('');
  const [shared, setShared] = useState<{ records: string; limit: { sys: number; dia: number } } | null>(null);
  const st = visit.stage;
  const bump = (k: keyof typeof v, d: number) => setV((x) => ({ ...x, [k]: x[k] + d }));

  // Live: records the family shared for this visit (the server returns nothing when sharing is off).
  useEffect(() => {
    if (!live || !visit.patientId || !visit.share) return;
    let cancelled = false;
    api.loadSharedRecords(visit.patientId).then((r) => {
      if (cancelled || !r.patient) return;
      const allergies = r.plan?.allergies.map((a) => a.text).join(', ') || 'none recorded';
      setShared({
        limit: { sys: r.patient.bp_limit_sys, dia: r.patient.bp_limit_dia },
        records: `${r.patient.condition ?? 'Condition not recorded'}${r.patient.hospital ? `, ${r.patient.hospital}` : ''}. BP limit ${r.patient.bp_limit_sys}/${r.patient.bp_limit_dia}. Medicines: ${r.meds.map(medLabel).join(', ') || 'none recorded'}. Allergies: ${allergies}.`,
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [live, visit.patientId, visit.share]);
  const records = !live
    ? `BP limit ${demoPatient.bpLimit.sys}/${demoPatient.bpLimit.dia}. Pulse below 50 or above 110: flag. ${demoMeds.map((m) => m.name).join(', ')}. Allergy: ${demoPatient.allergy}.`
    : visit.share ? shared?.records ?? null : null;
  const limit = !live ? demoPatient.bpLimit : shared?.limit ?? { sys: 140, dia: 90 };

  if (!visit.id) {
    return (
      <Screen>
        <T v="h2">No visit selected</T>
        <Sub>Visits booked with your organisation appear on Today.</Sub>
      </Screen>
    );
  }

  const banner = [`Scheduled for ${visit.when}`, 'On the way. The family can see you on their app.', "Arrived. Waiting for the family's code.", 'Visit in progress', 'Visit complete. Summary sent to the family.'][st];
  const outOfRange = (x: typeof v) => x.sys > limit.sys || x.dia > limit.dia || x.pul < 50 || x.pul > 110 || x.spo < 94;

  const verify = async () => {
    setChecking(true);
    const ok = await checkIn(code.trim());
    setChecking(false);
    if (!ok) toast('Code does not match. Ask the family to read it from their app.');
  };

  return (
    <Screen>
      <T v="label">Visit · {visit.service}</T>
      <T v="h2">{visit.patientName}</T>
      <Sub>{visit.address || 'Address not given'} · {visit.when}</Sub>

      {visit.share && records ? (
        <Card tone="violet">
          <T v="label" style={{ color: C.violet }}>Shared by the family · read only</T>
          <T v="small" style={{ color: C.ink }}>{records}</T>
        </Card>
      ) : (
        <Card tone="grey">
          <T v="small" style={{ color: C.ink }}>The family has not shared records for this visit. Ask them in person about medicines and allergies.</T>
        </Card>
      )}
      {!live ? (
        <Card>
          <T v="label">Since the last visit · from the monitor</T>
          <T v="small" style={{ color: C.ink }}>
            {mon.paired ? `Slept 6 h 40 min. Restless twice. Lowest oxygen ${Math.min(...mon.hSp)}%. ${mon.alerts.length ? `${mon.alerts.length} alert(s) today.` : 'No alerts since your last visit.'}` : 'No monitor at this home.'}
          </T>
        </Card>
      ) : null}

      <Banner tone={st === 2 ? 'amber' : 'teal'} text={banner} />

      {st === 0 ? <Btn small title="Start travel" onPress={() => setStage(1)} style={{ marginBottom: 12 }} /> : null}
      {st === 1 ? <Btn small title="I have arrived" onPress={() => setStage(2)} style={{ marginBottom: 12 }} /> : null}
      {st === 2 ? (
        <Card>
          <T v="label">Enter the family's code</T>
          <Field
            value={code} onChangeText={setCode} maxLength={4} keyboardType="number-pad" placeholder="4 digits"
            style={{ textAlign: 'center', fontFamily: F.monoBold, fontSize: 20, letterSpacing: 8 }}
          />
          <Btn small title={checking ? 'Checking…' : 'Verify and check in'} disabled={checking || code.trim().length !== 4} onPress={verify} />
          {!live ? <T v="small" style={{ marginTop: 6 }}>Demo code: {VISIT_CODE}</T> : <T v="small" style={{ marginTop: 6 }}>After 5 wrong codes the visit locks for safety.</T>}
        </Card>
      ) : null}

      {st === 3 ? (
        <View>
          <T v="sect" style={{ marginTop: 4 }}>Checklist</T>
          <Card>
            {visit.tasks.map((t, i) => <TaskRow key={t.t} title={t.t} done={t.d} onPress={() => toggleTask(i)} last={i === visit.tasks.length - 1} />)}
          </Card>
          <T v="sect">Record readings</T>
          <Card>
            <Stepper label="BP top" value={v.sys} onMinus={() => bump('sys', -2)} onPlus={() => bump('sys', 2)} />
            <Stepper label="BP bottom" value={v.dia} onMinus={() => bump('dia', -2)} onPlus={() => bump('dia', 2)} />
            <Stepper label="Pulse" value={v.pul} onMinus={() => bump('pul', -2)} onPlus={() => bump('pul', 2)} />
            <Stepper label="SpO₂" value={v.spo} onMinus={() => bump('spo', -1)} onPlus={() => bump('spo', 1)} />
            <Btn small title="Save readings" onPress={() => { saveVitals(v); setSaved(outOfRange(v)); }} style={{ marginTop: 4 }} />
            {saved !== null ? (
              <View style={{ marginTop: 10 }}>
                <Banner tone={saved ? 'red' : 'teal'} text={saved ? "Outside the limits in the family's summary. Consider flagging to the clinical desk." : 'Saved. The family sees these readings now.'} />
              </View>
            ) : null}
          </Card>
          <T v="sect">Visit note</T>
          <Field value={note} onChangeText={setNote} multiline placeholder="One or two lines. The family sees this in plain language." />
          <Row gap={8}>
            <Btn v="red" small title="Flag to clinical desk" onPress={() => { escalate(); toast('Flagged. The clinical desk and the family have been alerted.'); }} style={{ flex: 1 }} />
            <Btn v="teal" small title="Complete visit" onPress={() => complete(note.trim(), v)} style={{ flex: 1 }} />
          </Row>
        </View>
      ) : null}
    </Screen>
  );
}
