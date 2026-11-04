import { router } from 'expo-router';

import { Btn, Card, Screen, StepDot, Sub, T, TaskRow } from '@/components/ui';
import { PATIENT, PLAN_STEPS, WARN_SIGNS } from '@/data/demo';
import { useStore } from '@/state/store';

export default function CarePlan() {
  const hasSummary = useStore((s) => s.hasSummary);
  return (
    <Screen>
      <T v="label">Care plan</T>
      <T v="h2">Your recovery plan</T>
      <Sub>
        {hasSummary
          ? `Built from your discharge summary by ${PATIENT.doctor}, ${PATIENT.hospital}, and checked by you. Home Konnect does not change it.`
          : 'Sample plan. Add your discharge summary and this fills in from your own document.'}
      </Sub>
      <T v="sect" style={{ marginTop: 0 }}>First two weeks</T>
      <Card>
        {PLAN_STEPS.map((p, i) => <TaskRow key={p.t} left={<StepDot n={i + 1} />} title={p.t} sub={p.s} last={i === PLAN_STEPS.length - 1} />)}
      </Card>
      <T v="sect">Diet and activity</T>
      <Card>
        <T style={{ fontSize: 13 }}>Under 5 g salt a day. No fried or packaged food. Fruit, dal, vegetables, curd. Two litres of fluids unless told otherwise. No driving for two weeks.</T>
      </Card>
      <T v="sect">Call for help straight away if</T>
      <Card tone="red">
        {WARN_SIGNS.map((w, i) => <TaskRow key={w} title={w} last={i === WARN_SIGNS.length - 1} />)}
      </Card>
      <Btn v="red" title="Open SOS" onPress={() => router.push('/sos')} style={{ marginTop: 6 }} />
    </Screen>
  );
}
