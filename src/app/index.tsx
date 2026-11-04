import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LinearGradientFallback } from '@/components/hero';
import { Brand, Btn, Card, Ic, Row, T } from '@/components/ui';
import * as api from '@/lib/api';
import { useStore, type ProRole } from '@/state/store';
import { C } from '@/theme';

/** Role switch: the same app serves families and care providers. Live mode resumes a saved session. */
export default function Welcome() {
  const live = useStore((s) => s.live);
  const [restoring, setRestoring] = useState(live);

  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    (async () => {
      const profile = await api.getProfile().catch(() => null);
      if (cancelled) return;
      if (!profile) { setRestoring(false); return; }
      const st = useStore.getState();
      st.setSignedIn(true);
      if (profile.kind === 'provider') {
        const roles: Record<string, ProRole> = { nurse: 'Nurse', physio: 'Physiotherapist', coordinator: 'Coordinator', supplier: 'Equipment supplier' };
        const role = roles[profile.provider_role ?? ''] ?? 'Nurse';
        st.setProRole(role);
        await st.loadProvider();
        router.replace(role === 'Equipment supplier' ? '/pro/rates' : '/pro/today');
      } else if (await st.loadFamily()) {
        const now = useStore.getState();
        router.replace(!now.me.name ? '/onboarding/about-you' : now.hasSummary ? '/(tabs)/today' : '/onboarding/upload');
      } else {
        setRestoring(false);
      }
    })();
    return () => { cancelled = true; };
  }, [live]);

  if (restoring) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Brand />
        <ActivityIndicator color={C.teal} />
      </View>
    );
  }

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
