import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { Btn, Card, PriceLine, Screen, StepDot, T, TaskRow } from '@/components/ui';

import { usePatient } from '@/state/store';
import { C, F } from '@/theme';

export default function Booked() {
  const patient = usePatient();
  const b = useLocalSearchParams<{ ref: string; svc: string; provider: string; when: string }>();
  const ref = b.ref;

  return (
    <Screen>
      <View style={{ alignItems: 'center', marginTop: 14, marginBottom: 6 }}>
        <View style={{ width: 74, height: 74, borderRadius: 37, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <Text style={{ color: '#fff', fontSize: 36, fontFamily: F.bold }}>✓</Text>
        </View>
        <T v="h2">Visit booked</T>
        <T v="small" style={{ marginBottom: 16 }}>{b ? `${b.svc} · ${b.provider}` : ''}</T>
      </View>
      <Card>
        <PriceLine l="When" r={b?.when ?? ''} />
        <PriceLine l="Where" r={patient.address.split(',').slice(0, 2).join(',')} />
        <PriceLine l="Booking" r={ref ?? ''} />
      </Card>
      <T v="sect">What happens next</T>
      <Card>
        <TaskRow left={<StepDot n={1} />} title="Provider confirms the caregiver" sub="You'll see their name and photo" />
        <TaskRow left={<StepDot n={2} />} title="Care plan shared with them" sub="Only what you allowed" />
        <TaskRow left={<StepDot n={3} />} title="Track the visit live" sub="En route, arrived, visit notes, readings" last />
      </Card>
      <Btn title="See my visits" onPress={() => router.dismissTo('/(tabs)/visits')} />
      <Btn v="ghost" title="Back to Today" onPress={() => router.dismissTo('/(tabs)/today')} style={{ marginTop: 10 }} />
    </Screen>
  );
}
