import { useEffect, useRef } from 'react';
import { Text, View } from 'react-native';

import { Between, Btn, Card, Chip, ChipRow, Row, Screen, T, TaskRow, Track } from '@/components/ui';
import { NURSE, VISIT_CODE } from '@/data/demo';
import { useStore } from '@/state/store';
import { C, F } from '@/theme';

const STEPS = [
  { name: 'Nurse on the way', time: 'Tracked until arrival' },
  { name: 'Arrived and verified', time: 'Code check at the door' },
  { name: 'Visit in progress', time: 'Checklist updates here' },
  { name: 'Visit complete', time: 'Summary sent to you and saved in Records' },
];

/** Family view of today's visit. Updates live from the provider side (same store). */
export default function LiveVisit() {
  const visit = useStore((s) => s.visit);
  const toast = useStore((s) => s.showToast);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const play = () => {
    const st = useStore.getState();
    st.resetVisit();
    timers.current.forEach(clearTimeout);
    const seq: (() => void)[] = [
      () => st.setStage(1),
      () => { st.setStage(2); toast('Nurse has arrived. Share the code at the door.'); },
      () => { st.toggleVisitTask(0); st.saveVisitVitals({ sys: 128, dia: 82, pul: 72, spo: 97 }); st.setStage(3); },
      () => { st.toggleVisitTask(1); st.toggleVisitTask(2); },
      () => st.completeVisit('Readings steady. Walks with light support. Medicines taken on time. Advised to keep salt low and log BP each morning.'),
    ];
    timers.current = seq.map((fn, i) => setTimeout(fn, 1000 * (i + 1)));
  };

  const done = visit.stage === 4;
  return (
    <Screen>
      <T v="label">Live visit</T>
      <T v="h2">Home nurse · {done ? 'Done' : '4:30 PM'}</T>
      <T v="small" style={{ marginBottom: 14 }}>Nurse {NURSE.name} · Sunrise Home Nursing</T>
      <Card>
        <Track steps={STEPS} current={visit.stage - 1} allDone={done} />
      </Card>
      {visit.stage === 1 || visit.stage === 2 ? (
        <Card tone="teal" style={{ alignItems: 'center' }}>
          <T v="label" style={{ color: C.tealDeep }}>Share this code with the nurse</T>
          <Row gap={8} style={{ marginVertical: 8 }}>
            {VISIT_CODE.split('').map((d, i) => (
              <View key={i} style={{ width: 46, height: 54, borderRadius: 12, backgroundColor: '#fff', borderWidth: 2, borderColor: C.teal, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: F.monoBold, fontSize: 24, color: C.tealDeep }}>{d}</Text>
              </View>
            ))}
          </Row>
          <T v="small">Confirms the right person is at your door.</T>
        </Card>
      ) : null}
      {visit.escalated ? (
        <Card tone="red">
          <T v="label" style={{ color: C.red }}>Care team alerted</T>
          <T v="small" style={{ color: C.ink }}>
            The nurse has flagged a concern to Home Konnect's clinical desk. A partner doctor will call you through the app shortly, and you may also wish to contact your treating doctor.
          </T>
        </Card>
      ) : null}
      <T v="sect">Today's checklist</T>
      <Card>
        {visit.tasks.map((t, i) => <TaskRow key={t.t} title={t.t} done={t.d} last={i === visit.tasks.length - 1} />)}
      </Card>
      <T v="sect">Readings taken by the nurse</T>
      <Card>
        {visit.vitals ? (
          <Between>
            {[['Blood pressure', `${visit.vitals.sys}/${visit.vitals.dia}`], ['Pulse', visit.vitals.pul], ['SpO₂', `${visit.vitals.spo}%`]].map(([l, v]) => (
              <View key={l}><T v="small">{l}</T><T v="bodyB">{v}</T></View>
            ))}
          </Between>
        ) : <T v="small">Nothing recorded yet.</T>}
      </Card>
      <T v="sect">Visit note</T>
      <Card><T style={{ fontSize: 13 }}>{visit.note || 'The note appears here when the nurse completes the visit.'}</T></Card>
      <Row gap={8}>
        <Btn v="ghost" small title="Call via app" onPress={() => toast('Calling through the app. The nurse never sees your number.')} style={{ flex: 1 }} />
        <Btn v="ghost" small title="Chat" onPress={() => toast('Chat with the nurse is coming soon.')} style={{ flex: 1 }} />
        <Btn v="teal" small title={done ? 'Replay demo' : 'Play demo'} onPress={play} style={{ flex: 1 }} />
      </Row>
      <T v="small" style={{ marginTop: 10 }}>Demo tip: sign in as a care provider to run the same visit from the nurse's side.</T>
      {done ? (
        <View>
          <T v="sect">Rate this visit</T>
          <ChipRow>
            <Chip label="★ 5" onPress={() => toast('Thanks, your rating helps other families.')} />
            <Chip label="★ 4" onPress={() => toast('Thanks, your rating helps other families.')} />
            <Chip label="★ 3 or less" onPress={() => toast('Sorry to hear that. The provider and Home Konnect will follow up.')} />
          </ChipRow>
        </View>
      ) : null}
    </Screen>
  );
}
