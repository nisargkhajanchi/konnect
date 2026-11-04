import { Spark } from '@/components/charts';
import { MonStatus } from '@/components/mon-status';
import { VGrid, VTile } from '@/components/vitals';
import { Btn, Card, Screen, Sub, T } from '@/components/ui';
import { PATIENT } from '@/data/demo';
import { monFlags } from '@/logic/rules';
import { ALERT_STEPS, useMonState, useStore } from '@/state/store';
import { C } from '@/theme';

/** Desk view of one monitored patient, with the response actions. */
export default function DeskPatient() {
  const mon = useStore((s) => s.mon);
  const setStep = useStore((s) => s.setAlertStep);
  const toast = useStore((s) => s.showToast);
  const st = useMonState();
  const f = monFlags(mon.v, mon.thr);

  const act = (n: number) => { if (!mon.alert) { toast('No open alert for this patient.'); return; } setStep(n); };

  return (
    <Screen>
      <T v="h2">{PATIENT.name}</T>
      <Sub>{PATIENT.age} · {PATIENT.short}, {PATIENT.discharged} · Home, Shantigram</Sub>
      <MonStatus st={st} extra={mon.alert ? (mon.step === 3 ? 'resolved' : ALERT_STEPS[mon.step].toLowerCase()) : undefined} />
      <VGrid>
        <VTile label="Heart rate" value={mon.v.hr} unit="bpm" alert={f.hr} />
        <VTile label="Oxygen" value={mon.v.spo2} unit="%" alert={f.sp} />
        <VTile label="Breathing" value={mon.v.rr} unit="/min" alert={f.rr} />
        <VTile label="Temperature" value={mon.v.temp.toFixed(1)} unit="°F" alert={f.tm} />
      </VGrid>
      <Card>
        <Spark data={mon.hHr} min={40} max={140} lo={mon.thr.hrLo} hi={mon.thr.hrHi} color={C.amber} label="Heart rate, last 24 hours" />
        <T v="small">Heart rate, last 24 hours. Dashed lines are this patient's limits.</T>
      </Card>
      <T v="sect">Respond</T>
      <Card tone={mon.alert && mon.step < 3 ? 'red' : undefined}>
        {mon.alert ? (
          <>
            <T v="label" style={{ color: C.red }}>Open alert · {mon.alert.time}</T>
            <T v="bodyB">{mon.alert.title}</T>
            <T v="small">{mon.alert.detail} Status: {ALERT_STEPS[mon.step]}.</T>
          </>
        ) : <T v="small">No open alert. Use the demo events on the family's live monitor to raise one.</T>}
      </Card>
      <Btn small title="Acknowledge and review" onPress={() => act(1)} style={{ marginBottom: 8 }} />
      <Btn small title="Call the family through the app" onPress={() => act(2)} style={{ marginBottom: 8 }} />
      <Btn v="ghost" small title="Request a nurse visit now" onPress={() => toast('Nurse visit requested. Sunrise Home Nursing notified (demo).')} style={{ marginBottom: 8 }} />
      <Btn v="red" small title="Escalate: send to the ER" onPress={() => toast('Family told to call 108. ER sent the summary (demo).')} style={{ marginBottom: 8 }} />
      <Btn v="teal" small title="Mark resolved" onPress={() => act(3)} />
    </Screen>
  );
}
