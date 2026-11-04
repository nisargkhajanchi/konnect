import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Btn, Card, ChoiceChips, Field, FieldLabel, LinkText, PriceLine, Screen, T, TaskRow } from '@/components/ui';
import { PATIENT } from '@/data/demo';
import { calcLine } from '@/logic/rules';
import { useStore, type Order } from '@/state/store';
import { C, F, inr } from '@/theme';

const SLOTS = ['Tomorrow, 9 AM to 1 PM', 'Tomorrow, 2 PM to 6 PM', 'Thu 23 Oct, morning'] as const;
const PAYS = ['UPI on delivery', 'Card', 'Insurance claim'] as const;

export default function EquipOrder() {
  const cart = useStore((s) => s.cart);
  const equipment = useStore((s) => s.equipment);
  const remove = useStore((s) => s.removeFromCart);
  const place = useStore((s) => s.placeOrder);
  const [slot, setSlot] = useState<(typeof SLOTS)[number]>(SLOTS[0]);
  const [pay, setPay] = useState<(typeof PAYS)[number]>(PAYS[0]);
  const [addr, setAddr] = useState(PATIENT.address);
  const [placed, setPlaced] = useState<Order | null>(null);

  if (placed) {
    return (
      <Screen>
        <View style={{ alignItems: 'center', marginTop: 14, marginBottom: 6 }}>
          <View style={{ width: 74, height: 74, borderRadius: 37, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Text style={{ color: '#fff', fontSize: 36, fontFamily: F.bold }}>✓</Text>
          </View>
          <T v="h2">Order placed</T>
          <T v="small" style={{ textAlign: 'center', marginBottom: 16 }}>{placed.lines.map((l) => l.name).join(', ')}</T>
        </View>
        <Card>
          <PriceLine l="Delivery" r={placed.slot} />
          <PriceLine l="Order" r={placed.ref} />
        </Card>
        <T v="small" style={{ marginBottom: 10 }}>Your order shows under Visits. The invoice is under Bills and claims. Both go into the summary for your doctor.</T>
        <Btn title="See my visits" onPress={() => router.dismissTo('/(tabs)/visits')} />
        <Btn v="ghost" title="Back to equipment" onPress={() => router.back()} style={{ marginTop: 10 }} />
      </Screen>
    );
  }

  const lines = cart.flatMap((c) => {
    const it = equipment.find((e) => e.id === c.id);
    return it ? [{ it, l: calcLine(it, c.mode, c.unit, c.n) }] : [];
  });
  const t = lines.reduce((a, { l }) => ({ items: a.items + l.price, del: a.del + l.delivery, dep: a.dep + l.deposit }), { items: 0, del: 0, dep: 0 });
  const due = t.items + t.del + t.dep;

  return (
    <Screen dock={<Btn title={`Place order · ${inr(due)}`} disabled={!cart.length} onPress={() => { const o = place(slot, pay); if (o) setPlaced(o); }} />}>
      <T v="label">Your equipment order</T>
      <T v="h2">Review and place order</T>
      <Card>
        {lines.length ? lines.map(({ it, l }, i) => (
          <TaskRow
            key={it.id} title={it.name} sub={l.desc + (l.per ? ` at ${inr(l.rate)} per ${l.per}` : '')} last={i === lines.length - 1}
            right={<View style={{ alignItems: 'flex-end', gap: 4 }}><T v="bodyB" style={{ fontFamily: F.bold }}>{inr(l.price)}</T><LinkText title="Remove" onPress={() => remove(i)} /></View>}
          />
        )) : <T v="small">Your order is empty. Pick equipment from the list.</T>}
      </Card>
      <Field label="Delivery address" value={addr} onChangeText={setAddr} />
      <FieldLabel>Delivery slot</FieldLabel>
      <ChoiceChips options={SLOTS} value={slot} onChange={setSlot} />
      <View style={{ height: 14 }} />
      {lines.length ? (
        <Card>
          <PriceLine l="Equipment" r={inr(t.items)} />
          <PriceLine l="Delivery and setup" r={t.del > 0 ? inr(t.del) : 'Free'} />
          {t.dep > 0 ? <PriceLine l="Refundable deposit" r={inr(t.dep)} /> : null}
          <PriceLine l="Platform fee for you" r="₹0" />
          <PriceLine l="Due at delivery" r={inr(due)} total />
        </Card>
      ) : null}
      <FieldLabel>Pay with</FieldLabel>
      <ChoiceChips options={PAYS} value={pay} onChange={setPay} />
      <T v="small" style={{ marginTop: 12 }}>Rented items: the deposit is returned after we collect the equipment and check it. Rates are locked at the price shown today, even if the supplier changes rates later.</T>
    </Screen>
  );
}
