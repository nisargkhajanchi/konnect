import { router, useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';

import { Avatar, Btn, Card, ChipRow, Grow, Ic, Pill, PriceLine, Row, Screen, T } from '@/components/ui';
import { NURSE, PACKS } from '@/data/demo';
import { useStore } from '@/state/store';
import { C, F, inr } from '@/theme';

export default function ProviderDetail() {
  const { id, service = 'Home nursing' } = useLocalSearchParams<{ id: string; service?: string }>();
  const p = useStore((s) => s.providers.find((x) => x.id === id));
  if (!p) return <Screen><T>Provider not found.</T></Screen>;

  return (
    <Screen dock={<Btn title="Book a visit" onPress={() => router.push({ pathname: '/book', params: { provider: p.id, service } })} />}>
      <Card>
        <Row style={{ alignItems: 'flex-start' }}>
          <Ic label={p.short} tone="amber" />
          <Grow>
            <T v="h3" style={{ fontSize: 16 }}>{p.name}</T>
            <T v="small"><Text style={{ color: C.amber, fontFamily: F.bold }}>★ {p.rate}</Text> ({p.reviews} families) · {p.dist.toFixed(1)} km away</T>
          </Grow>
        </Row>
        <ChipRow style={{ marginTop: 8, gap: 5 }}>{p.verified.map((v) => <Pill key={v} label={v} />)}</ChipRow>
      </Card>
      <T v="sect">About</T>
      <Card><T style={{ fontSize: 13 }}>{p.about}</T></Card>
      <T v="sect">Prices</T>
      <Card>
        {PACKS.map((pk) => <PriceLine key={pk.label} l={pk.label} r={inr(p.price * pk.n * pk.disc)} />)}
      </Card>
      <T v="sect">Your likely caregiver</T>
      <Card>
        <Row>
          <Avatar label={NURSE.short} size={40} />
          <Grow>
            <T v="bodyB">Nurse {NURSE.name}</T>
            <T v="small">{NURSE.bio}</T>
          </Grow>
        </Row>
      </Card>
      <T v="sect">Recent family reviews</T>
      <Card>
        <Text style={{ color: C.amber, fontFamily: F.bold }}>★★★★★</Text>
        <T style={{ fontSize: 13 }}>"On time, patient with my father, explained every reading to us."</T>
        <T v="small" style={{ marginTop: 4 }}>Verified visit · 2 weeks ago</T>
      </Card>
      <Card>
        <Text style={{ color: C.amber, fontFamily: F.bold }}>★★★★☆</Text>
        <T style={{ fontSize: 13 }}>"Good dressing care. Evening slots fill quickly."</T>
        <T v="small" style={{ marginTop: 4 }}>Verified visit · 1 month ago</T>
      </Card>
    </Screen>
  );
}
