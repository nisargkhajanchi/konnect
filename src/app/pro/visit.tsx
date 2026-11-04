import { useState } from 'react';
import { View } from 'react-native';

import { Banner, Btn, Card, Field, Row, Screen, Stepper, Sub, T, TaskRow } from '@/components/ui';
import { PATIENT, VISIT_CODE } from '@/data/demo';
import { useStore } from '@/state/store';
import { C, F } from '@/theme';

/** Nurse's side of the same visit the family is watching. */
export default function ProVisit() {
  const visit = useStore((s) => s.visit);
  const share = useStore((s) => s.share);
  const mon = useStore((s) => s.mon);
  const setStage = useStore((s) => s.setStage);
  const toggleTask = useStore((s) => s.toggleVisitTask);
  const saveVitals = useStore((s) => s.saveVisitVitals);
  const escalate = useStore((s) => s.escalateVisit);
  const complete = useStore((s) => s.completeVisit);
  const toast = useStore((s) => s.showToast);

  const [code, setCode] = useState('');
  const [v, setV] = useState({ sys: 128, dia: 82, pul: 72, spo: 97 });
  const [saved, setSaved] = useState<null | boolean>(null);
  const [note, setNote] = useState('');
  const st = visit.stage;
  const bump = (k: keyof typeof v, d: number) => setV((x) => ({ ...x, [k]: x[k] + d }));

  const banner = ['Scheduled for 4:30 PM', 'On the way. The family can see you on their app.', "Arrived. Waiting for the family's code.", 'Visit in progress', 'Visit complete. Summary sent to the family.'][st];

  return (
    <Screen>
      <T v="label">Visit</T>
      <T v="h2">{PATIENT.name}</T>
      <Sub>{PATIENT.age} · {PATIENT.short}, {PATIENT.discharged} · {PATIENT.hospital} · {share === 'active' ? 'Shared by family' : 'Family has not shared records'}</Sub>

      {share === 'active' ? (
        <Card tone="violet">
          <T v="label" style={{ color: C.violet }}>From the family's discharge summary · read only</T>
          <T v="small" style={{ color: C.ink }}>BP limit 140/90. Pulse below 50 or above 110: flag. Aspirin, atorvastatin, metoprolol, pantoprazole. Allergy: penicillin. No NSAIDs.</T>
        </Card>
      ) : (
        <Card tone="grey">
          <T v="small" style={{ color: C.ink }}>The family has not shared records for this visit. Ask them in person about medicines and allergies.</T>
        </Card>
      )}
      <Card>
        <T v="label">Since the last visit · from the monitor</T>
        <T v="small" style={{ color: C.ink }}>
          {mon.paired ? `Slept 6 h 40 min. Restless twice. Lowest oxygen ${Math.min(...mon.hSp)}%. ${mon.alerts.length ? `${mon.alerts.length} alert(s) today.` : 'No alerts since your last visit.'}` : 'No monitor at this home.'}
        </T>
      </Card>

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
          <Btn small title="Verify and check in" onPress={() => (code === VISIT_CODE ? setStage(3) : toast('Code does not match. Ask the family to read it from their app.'))} />
          <T v="small" style={{ marginTop: 6 }}>Demo code: {VISIT_CODE}</T>
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
            <Btn small title="Save readings" onPress={() => { saveVitals(v); setSaved(v.sys > 140 || v.pul < 50 || v.pul > 110 || v.spo < 94); }} style={{ marginTop: 4 }} />
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
            <Btn v="teal" small title="Complete visit" onPress={() => { if (!visit.vitals) saveVitals(v); complete(note.trim()); }} style={{ flex: 1 }} />
          </Row>
        </View>
      ) : null}
    </Screen>
  );
}
