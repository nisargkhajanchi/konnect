import { router } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LinearGradientFallback } from '@/components/hero';
import { Brand, Btn, Card, Ic, Row, T } from '@/components/ui';
import { C } from '@/theme';

/** Role switch: the same app serves families and care providers. */
export default function Welcome() {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <LinearGradientFallback>
        <SafeAreaView edges={['top']} style={{ paddingHorizontal: 22, paddingBottom: 28, paddingTop: 22 }}>
          <Brand light />
          <T v="h1" style={{ color: '#fff', marginTop: 22, marginBottom: 8 }}>Recovery doesn't end at discharge.</T>
          <T style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>
            Your hospital's care plan, trusted home-care providers, medicines and emergency help in one place.
          </T>
        </SafeAreaView>
      </LinearGradientFallback>
      <SafeAreaView edges={['bottom']} style={{ flex: 1, padding: 18, justifyContent: 'space-between' }}>
        <View>
          <T v="sect" style={{ marginTop: 6 }}>Who is using the app?</T>
          <Card onPress={() => router.push('/login')} accessibilityLabel="I'm family or the patient">
            <Row>
              <Ic label="FM" tone="amber" />
              <View style={{ flex: 1 }}>
                <T v="bodyB">I'm family or the patient</T>
                <T v="small">Recovery plan, book care, track visits, vitals and SOS</T>
              </View>
            </Row>
          </Card>
          <Card onPress={() => router.push('/pro')} accessibilityLabel="I'm a care provider">
            <Row>
              <Ic label="CP" tone="teal" />
              <View style={{ flex: 1 }}>
                <T v="bodyB">I'm a care provider</T>
                <T v="small">Nurses, physios, coordinators, monitoring desk and equipment suppliers</T>
              </View>
            </Row>
          </Card>
        </View>
        <View>
          <Btn title="Continue as family" onPress={() => router.push('/login')} />
          <T v="small" style={{ textAlign: 'center', marginTop: 12 }}>Provider-neutral. No paid placement.</T>
        </View>
      </SafeAreaView>
    </View>
  );
}
