import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card, Chip, ChipRow, Grow, Ic, Pill, Row, Screen, Sub, T } from '@/components/ui';
import { EQ_CATS } from '@/data/demo';
import { calcLine, modesOf, rateText, rentUnits } from '@/logic/rules';
import { useStore } from '@/state/store';
import { C, F, inr } from '@/theme';

export default function Equipment() {
  const equipment = useStore((s) => s.equipment);
  const cart = useStore((s) => s.cart);
  const toast = useStore((s) => s.showToast);
  const [filter, setFilter] = useState<string>('All');

  const list = equipment
    .filter((it) => modesOf(it).length)
    .filter((it) => filter === 'All' || (filter === 'Suggested' ? it.sug : it.cat === filter))
    .sort((a, b) => Number(!!b.sug) - Number(!!a.sug));

  const due = cart.reduce((sum, c) => {
    const it = equipment.find((e) => e.id === c.id);
    if (!it) return sum;
    const l = calcLine(it, c.mode, c.unit, c.n);
    return sum + l.price + l.delivery + l.deposit;
  }, 0);

  return (
    <Screen
      dock={cart.length ? (
        <Pressable onPress={() => router.push('/equipment/order')} accessibilityRole="button" style={{ backgroundColor: C.navy, borderRadius: 16, padding: 12, paddingLeft: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ color: '#fff', fontFamily: F.bold, fontSize: 14 }}>{cart.length} {cart.length === 1 ? 'item' : 'items'}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontFamily: F.regular, fontSize: 12 }}>{inr(due)} due at delivery</Text>
          </View>
          <View style={{ backgroundColor: C.amber, borderRadius: 11, paddingHorizontal: 14, paddingVertical: 9 }}>
            <Text style={{ color: '#fff', fontFamily: F.semibold, fontSize: 13 }}>Review order</Text>
          </View>
        </Pressable>
      ) : undefined}>
      <T v="label">Equipment at home</T>
      <T v="h2">Rent or buy, at fixed rates</T>
      <Sub>Supplied directly by Home Konnect. Every family sees the same rates. No doctor or hospital is paid for recommending equipment.</Sub>
      <ChipRow style={{ marginBottom: 12 }}>
        {['All', 'Suggested', ...EQ_CATS].map((c) => <Chip key={c} label={c} on={filter === c} onPress={() => setFilter(c)} />)}
      </ChipRow>
      {!list.length ? <Card><T v="small">Nothing in this group right now.</T></Card> : null}
      {list.map((it) => (
        <Card
          key={it.id}
          style={!it.on ? { opacity: 0.55 } : undefined}
          onPress={() => (it.on ? router.push({ pathname: '/equipment/[id]', params: { id: it.id } }) : toast('Not available right now. Ask the care coordinator for an alternative.'))}>
          <Row style={{ alignItems: 'flex-start' }}>
            <Ic label={it.abbr} tone="amber" />
            <Grow>
              <T v="bodyB">{it.name}</T>
              <T v="small" style={{ color: C.ink }}>{rateText(it)}</T>
              <ChipRow style={{ gap: 5, marginTop: 7 }}>
                {!it.on ? <Pill label="Not available now" tone="grey" /> : null}
                {it.sug && it.on ? <Pill label="Suggested by your summary" tone="amber" /> : null}
                {it.id === 'mon' ? <Pill label="Own set-up" tone="violet" /> : (
                  <>
                    {it.canRent && it.deposit > 0 && rentUnits(it).length ? <Pill label={`Deposit ${inr(it.deposit)}, refundable`} tone="grey" /> : null}
                    <Pill label={it.delivery > 0 ? `Delivery ${inr(it.delivery)}` : 'Free delivery'} tone="grey" />
                  </>
                )}
              </ChipRow>
            </Grow>
          </Row>
        </Card>
      ))}
      <T v="small">Demo rates. Real rates are set by the supplier and shown here the moment they change.</T>
    </Screen>
  );
}
