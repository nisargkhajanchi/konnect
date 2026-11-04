import { router, type Href } from 'expo-router';
import { View } from 'react-native';

import { openMonitor } from '@/components/monitor-card';
import { Avatar, Card, Grow, Ic, LinkText, Row, Screen, T } from '@/components/ui';

import { initials, useStore, usePatient } from '@/state/store';
import type { Tone } from '@/theme';

type Item = { ic: string; tone: Tone; t: string; s: string; go: () => void };
const to = (h: Href) => () => router.push(h);

export default function More() {
  const patient = usePatient();
  const toast = useStore((s) => s.showToast);
  const signOut = useStore((s) => s.signOut);
  const me = useStore((s) => s.me);
  const groups: [string, Item[]][] = [
    [`${patient.first}'s care`, [
      { ic: 'CP', tone: 'teal', t: 'Care plan', s: 'From your discharge summary', go: to('/care-plan') },
      { ic: 'RX', tone: 'amber', t: 'Medicines and reorder', s: 'Your list, running low, partner pharmacy', go: to({ pathname: '/(tabs)/health', params: { tab: 'med' } }) },
      { ic: 'PDF', tone: 'blue', t: 'Records', s: 'Reports, prescriptions, who can see them', go: to({ pathname: '/(tabs)/health', params: { tab: 'rec' } }) },
      { ic: 'SUM', tone: 'amber', t: 'Summary for your doctor', s: 'Services and health updates to download', go: to('/summary') },
    ]],
    ['Services at home', [
      { ic: 'EQ', tone: 'amber', t: 'Equipment', s: 'Rent or buy at fixed rates', go: to('/equipment') },
      { ic: '24', tone: 'teal', t: '24-hour monitor', s: 'Live view, alerts and plans', go: openMonitor },
    ]],
    ['Family and money', [
      { ic: 'CC', tone: 'blue', t: 'Care circle', s: 'Family who can see updates', go: to('/care-circle') },
      { ic: '₹', tone: 'amber', t: 'Bills and claims', s: 'Invoices and insurance pack', go: to('/bills') },
    ]],
    ['Account', [
      { ic: 'WB', tone: 'violet', t: 'Wellbeing and programmes', s: 'Diet, yoga, BP and sugar programmes', go: () => toast('Wellbeing programmes are coming soon.') },
      { ic: '↩', tone: 'red', t: 'Sign out', s: 'Back to the start screen', go: () => { signOut().finally(() => router.dismissTo('/')); } },
    ]],
  ];

  return (
    <Screen tabs>
      <T v="label">More</T>
      <T v="h2">{patient.first}'s account</T>
      <Card>
        <Row>
          <Avatar label={initials(me.name) || '👤'} size={40} />
          <Grow>
            <T v="bodyB">{me.name ?? 'Your name is not set'}</T>
            <T v="small">{me.name ? `Signed in${me.relation ? ` · ${me.relation === 'Myself' ? 'Patient' : `${me.relation} of ${patient.first}`}` : ''}` : 'Add it so the care team knows who is updating the plan'}</T>
          </Grow>
          <LinkText title={me.name ? 'Edit' : 'Add'} onPress={() => router.push({ pathname: '/onboarding/about-you', params: { edit: '1' } })} />
        </Row>
      </Card>
      {groups.map(([title, items], gi) => (
        <View key={title}>
          <T v="sect" style={gi === 0 ? { marginTop: 4 } : undefined}>{title}</T>
          {items.map((it) => (
            <Card key={it.t} onPress={it.go}>
              <Row>
                <Ic label={it.ic} tone={it.tone} />
                <Grow>
                  <T v="bodyB">{it.t}</T>
                  <T v="small">{it.s}</T>
                </Grow>
              </Row>
            </Card>
          ))}
        </View>
      ))}
    </Screen>
  );
}
