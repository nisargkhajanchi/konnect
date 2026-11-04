import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Between, Btn, Card, Screen, Sub, T } from '@/components/ui';
import { useStore } from '@/state/store';
import { C, F, inr } from '@/theme';

const CMP = [
  ['Checked', '2 times a day', 'Every few seconds'],
  ['Overnight', 'Nobody watching', 'Watched, with alerts'],
  ['A change is noticed by', 'The family, maybe late', 'Desk, nurse and family'],
  ['For the doctor', 'Visit notes', 'Full trend report'],
];

export default function MonitorIntro() {
  const plan = useStore((s) => s.mon.plan);
  const setPlan = useStore((s) => s.setPlan);
  const monRent = useStore((s) => s.equipment.find((e) => e.id === 'mon')?.rentMonth ?? 4500);
  const deskAdd = useStore((s) => s.deskAdd);

  const plans = [
    { k: 'A' as const, t: 'Monitor and app', s: 'You watch, alerts go to your family', p: monRent },
    { k: 'B' as const, t: 'Monitor and clinical desk', s: 'Trained staff review every alert and call you', p: monRent + deskAdd },
  ];

  return (
    <Screen dock={<Btn title="Set up monitoring" onPress={() => router.push('/monitor/setup')} />}>
      <T v="h2">Know how he is, every hour of the day</T>
      <Sub>A sensor under the mattress reads heart rate, breathing, oxygen and temperature without touching him. Changes reach the nurse and clinical desk within minutes, including at 3 AM.</Sub>
      <T v="sect" style={{ marginTop: 0 }}>What changes compared with visits alone</T>
      <View style={s.cmp}>
        <View style={s.row}>
          <Text style={[s.cell, s.h, { flex: 1.1 }]} />
          <Text style={[s.cell, s.h]}>Visits only</Text>
          <Text style={[s.cell, s.h]}>With monitor</Text>
        </View>
        {CMP.map(([l, a, b]) => (
          <View key={l} style={s.row}>
            <Text style={[s.cell, { flex: 1.1, fontFamily: F.semibold }]}>{l}</Text>
            <Text style={s.cell}>{a}</Text>
            <Text style={[s.cell, { color: C.tealDeep, fontFamily: F.semibold }]}>{b}</Text>
          </View>
        ))}
      </View>
      <T v="sect">Choose a plan</T>
      {plans.map((p) => (
        <Pressable key={p.k} accessibilityRole="radio" accessibilityState={{ checked: plan === p.k }} onPress={() => setPlan(p.k)} style={[s.plan, plan === p.k && { borderColor: C.amber, backgroundColor: C.amberTint }]}>
          <Between>
            <View style={{ flex: 1 }}>
              <T v="bodyB">{p.t}</T>
              <T v="small">{p.s}</T>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <T v="bodyB" style={{ fontFamily: F.bold, fontSize: 15 }}>{inr(p.p)}</T>
              <T v="small">per month</T>
            </View>
          </Between>
        </Pressable>
      ))}
      <Card style={{ marginTop: 4 }}>
        <T v="small">Demo prices. Final prices and device claims come from the manufacturer's approved documents. This does not replace emergency care: in an emergency call 108.</T>
      </Card>
    </Screen>
  );
}

const s = StyleSheet.create({
  cmp: { borderWidth: 1, borderColor: C.stroke, borderRadius: 14, overflow: 'hidden', backgroundColor: '#fff', marginBottom: 11 },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.rowLine },
  cell: { flex: 1, paddingVertical: 9, paddingHorizontal: 10, fontFamily: F.regular, fontSize: 12, color: C.ink },
  h: { fontFamily: F.bold, fontSize: 10.5, letterSpacing: 0.5, textTransform: 'uppercase', color: C.amberDeep, backgroundColor: '#FBF3E4' },
  plan: { borderWidth: 1.5, borderColor: C.stroke, backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10 },
});
