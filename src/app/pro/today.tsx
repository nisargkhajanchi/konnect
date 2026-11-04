import { router, Stack } from 'expo-router';

import { Between, Card, Grow, LinkText, Pill, Screen, Sub, T } from '@/components/ui';
import { NURSE, OTHER_DESK_PATIENTS, PATIENT } from '@/data/demo';
import { STAGE_LABEL, useMonState, useStore } from '@/state/store';
import { C } from '@/theme';

const ROLE_TITLE = { Nurse: 'Staff nurse', Physiotherapist: 'Physiotherapist', Coordinator: 'Care coordinator', 'Equipment supplier': 'Supplier' } as const;

export default function ProToday() {
  const role = useStore((s) => s.proRole);
  const visit = useStore((s) => s.visit);
  const paired = useStore((s) => s.mon.paired);
  const st = useMonState();
  const physio = role === 'Physiotherapist';
  const anyWatch = OTHER_DESK_PATIENTS.some((o) => o.s === 'watch');
  const deskSub = paired && st === 'alert' ? '1 alert needs you now' : (paired && st === 'watch') || anyWatch ? `Watching ${(paired && st === 'watch' ? 1 : 0) + (anyWatch ? 1 : 0)} patient(s)` : 'All stable';

  return (
    <Screen>
      <Stack.Screen options={{ headerRight: () => <LinkText title="Sign out" onPress={() => router.dismissTo('/')} /> }} />
      <Card style={{ backgroundColor: C.navy, borderWidth: 0 }}>
        <Between>
          <Grow>
            <T v="bodyB" style={{ color: '#fff' }}>{physio ? 'Ravi Joshi' : NURSE.name}</T>
            <T v="mono" style={{ color: 'rgba(255,255,255,0.7)' }}>{ROLE_TITLE[role]} · Sunrise Home Nursing</T>
          </Grow>
          <Pill label="On duty" tone="teal" />
        </Between>
      </Card>
      <T v="label">Today</T>
      <T v="h2">{physio ? '2 sessions' : '3 visits'}</T>
      <Sub>You see only what each family has agreed to share.</Sub>

      <Card onPress={() => router.push('/pro/visit')}>
        <T v="label">4:30 PM · {physio ? 'Cardiac rehab session' : 'Heart attack follow-up'}</T>
        <Between>
          <Grow>
            <T v="bodyB">{PATIENT.name}, {PATIENT.age}</T>
            <T v="small">Shantigram · 2.1 km</T>
          </Grow>
          <Pill label={STAGE_LABEL[visit.stage]} tone={visit.stage === 0 ? 'amber' : visit.stage === 4 ? 'teal' : 'blue'} />
        </Between>
      </Card>
      {role !== 'Physiotherapist' ? (
        <Card onPress={() => router.push('/pro/desk')}>
          <T v="label" style={{ color: C.violet }}>Monitoring desk</T>
          <Between>
            <Grow>
              <T v="bodyB">5 patients on live monitors</T>
              <T v="small">{deskSub}</T>
            </Grow>
            <Pill label={paired && st === 'alert' ? 'Alert' : 'Open'} tone={paired && st === 'alert' ? 'red' : 'violet'} />
          </Between>
        </Card>
      ) : null}
      <Card>
        <T v="label">6:00 PM · {physio ? 'Stroke recovery' : 'Post-op dressing'}</T>
        <T v="bodyB">{physio ? 'M. Shah, 71' : 'S. Desai, 54'}</T>
        <T v="small">{physio ? 'Bodakdev · 3.2 km' : 'Satellite · 4.8 km'}</T>
      </Card>
      {!physio ? (
        <Card>
          <T v="label">7:30 PM · Injection</T>
          <T v="bodyB">M. Shah, 71</T>
          <T v="small">Bodakdev · 3.2 km</T>
        </Card>
      ) : null}
      <T v="small">Families never see your personal number. Calls and chats run through the app.</T>
    </Screen>
  );
}
