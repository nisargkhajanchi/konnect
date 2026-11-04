import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Card, Chip, ChipRow, Grow, Ic, Pill, Row, Screen, Sub, T } from '@/components/ui';
import { useStore } from '@/state/store';
import { C, F, inr } from '@/theme';

const SORTS = [
  { k: 'dist', label: 'Nearest' },
  { k: 'rate', label: 'Top rated' },
  { k: 'price', label: 'Lowest price' },
  { k: 'slot', label: 'Earliest' },
] as const;
type SortK = (typeof SORTS)[number]['k'];

export default function Providers() {
  const { service = 'Home nursing' } = useLocalSearchParams<{ service?: string }>();
  const providers = useStore((s) => s.providers);
  const [sort, setSort] = useState<SortK>('dist');
  const list = [...providers].sort((a, b) =>
    sort === 'rate' ? b.rate - a.rate : sort === 'price' ? a.price - b.price : sort === 'slot' ? a.slotRank - b.slotRank : a.dist - b.dist);

  return (
    <Screen>
      <Stack.Screen options={{ title: service }} />
      <T v="label">Verified providers</T>
      <T v="h2">{service}</T>
      <Sub>Ordered by what you pick below. No paid placement.</Sub>
      <ChipRow style={{ marginBottom: 12 }}>
        {SORTS.map((o) => <Chip key={o.k} label={o.label} on={sort === o.k} onPress={() => setSort(o.k)} />)}
      </ChipRow>
      {list.map((p) => (
        <Card key={p.id} onPress={() => router.push({ pathname: '/provider/[id]', params: { id: p.id, service } })} accessibilityLabel={`${p.name}, rated ${p.rate}, ${inr(p.price)} per visit`}>
          <Row style={{ alignItems: 'flex-start' }}>
            <Ic label={p.short} tone="amber" />
            <Grow>
              <T v="bodyB">{p.name}</T>
              <T v="small"><Text style={{ color: C.amber, fontFamily: F.bold }}>★ {p.rate}</Text> ({p.reviews}) · {p.dist.toFixed(1)} km</T>
            </Grow>
            <View style={{ alignItems: 'flex-end' }}>
              <T v="bodyB" style={{ fontFamily: F.bold, fontSize: 15 }}>{inr(p.price)}</T>
              <T v="small">per visit</T>
            </View>
          </Row>
          <ChipRow style={{ marginTop: 8, gap: 5 }}>
            {p.verified.map((v) => <Pill key={v} label={v} />)}
            <Pill label={`Next: ${p.slot}`} tone="amber" />
          </ChipRow>
        </Card>
      ))}
    </Screen>
  );
}
