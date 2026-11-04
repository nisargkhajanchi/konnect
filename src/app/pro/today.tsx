import { router, Stack } from 'expo-router';
import { RefreshControl, ScrollView } from 'react-native';

import { Between, Card, Grow, LinkText, Pill, Sub, T } from '@/components/ui';
import { NURSE, OTHER_DESK_PATIENTS } from '@/data/demo';
import { STAGE_LABEL, useMonState, useStore, type Visit } from '@/state/store';
import { C } from '@/theme';

const ROLE_TITLE = { Nurse: 'Staff nurse', Physiotherapist: 'Physiotherapist', Coordinator: 'Care coordinator', 'Equipment supplier': 'Supplier' } as const;
const stageTone = (s: number) => (s === 0 ? 'amber' : s === 4 ? 'teal' : 'blue');

export default function ProToday() {
  const live = useStore((s) => s.live);
  const role = useStore((s) => s.proRole);
  const visit = useStore((s) => s.visit);
  const orgVisits = useStore((s) => s.orgVisits);
  const select = useStore((s) => s.selectOrgVisit);
  const reload = useStore((s) => s.loadProvider);
  const signOut = useStore((s) => s.signOut);
  const paired = useStore((s) => s.mon.paired);
  const st = useMonState();
  const physio = role === 'Physiotherapist';
  const anyWatch = OTHER_DESK_PATIENTS.some((o) => o.s === 'watch');
  const deskSub = paired && st === 'alert' ? '1 alert needs you now' : (paired && st === 'watch') || anyWatch ? `Watching ${(paired && st === 'watch' ? 1 : 0) + (anyWatch ? 1 : 0)} patient(s)` : 'All stable';

  const open = (v: Visit) => { if (v.id) select(v.id); router.push('/pro/visit'); };
  const list: Visit[] = live ? orgVisits.filter((v) => v.stage < 4) : visit.id ? [visit] : [];
  const doneToday = live ? orgVisits.filter((v) => v.stage === 4) : [];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 18, paddingBottom: 40 }}
      refreshControl={live ? <RefreshControl refreshing={false} onRefresh={reload} /> : undefined}>
      <Stack.Screen options={{ headerRight: () => <LinkText title="Sign out" onPress={() => { signOut().finally(() => router.dismissTo('/')); }} /> }} />
      <Card style={{ backgroundColor: C.navy, borderWidth: 0 }}>
        <Between>
          <Grow>
            <T v="bodyB" style={{ color: '#fff' }}>{live ? ROLE_TITLE[role] : physio ? 'Ravi Joshi' : NURSE.name}</T>
            <T v="mono" style={{ color: 'rgba(255,255,255,0.7)' }}>{live ? 'Signed in' : `${ROLE_TITLE[role]} · Sunrise Home Nursing`}</T>
          </Grow>
          <Pill label="On duty" tone="teal" />
        </Between>
      </Card>
      <T v="label">Today</T>
      <T v="h2">{live ? `${list.length} open visit${list.length === 1 ? '' : 's'}` : physio ? '2 sessions' : '3 visits'}</T>
      <Sub>You see only what each family has agreed to share.{live ? ' Pull down to refresh.' : ''}</Sub>

      {list.map((v) => (
        <Card key={v.id} onPress={() => open(v)}>
          <T v="label">{v.when} · {v.service}</T>
          <Between>
            <Grow>
              <T v="bodyB">{v.patientName}</T>
              <T v="small">{v.address || 'Address not given'}{v.share ? '' : ' · records not shared'}</T>
            </Grow>
            <Pill label={STAGE_LABEL[v.stage]} tone={stageTone(v.stage)} />
          </Between>
        </Card>
      ))}
      {live && !list.length ? <Card><T v="small">No open visits. New bookings for your organisation appear here automatically.</T></Card> : null}

      {!live && role !== 'Physiotherapist' ? (
        <Card onPress={() => router.push('/pro/desk')}>
          <T v="label" style={{ color: C.violet }}>Monitoring desk (demo)</T>
          <Between>
            <Grow>
              <T v="bodyB">5 patients on live monitors</T>
              <T v="small">{deskSub}</T>
            </Grow>
            <Pill label={paired && st === 'alert' ? 'Alert' : 'Open'} tone={paired && st === 'alert' ? 'red' : 'violet'} />
          </Between>
        </Card>
      ) : null}
      {!live ? (
        <>
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
        </>
      ) : null}
      {doneToday.length ? (
        <>
          <T v="sect">Completed</T>
          {doneToday.map((v) => (
            <Card key={v.id} onPress={() => open(v)}>
              <T v="label">{v.when}</T>
              <T v="bodyB">{v.patientName}</T>
            </Card>
          ))}
        </>
      ) : null}
      <T v="small">Families never see your personal number. Calls and chats run through the app.</T>
    </ScrollView>
  );
}
