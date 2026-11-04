import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Banner, Btn, Card, ChipRow, Chip, FieldLabel, Grow, Ic, Pill, PriceLine, Row, Screen, Stepper, T } from '@/components/ui';
import { calcLine, modesOf, monthlyBreakEven, rentUnits, type Mode, type Unit } from '@/logic/rules';
import { useStore } from '@/state/store';
import { inr } from '@/theme';

export default function EquipItem() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const it = useStore((s) => s.equipment.find((e) => e.id === id));
  const addToCart = useStore((s) => s.addToCart);
  const toast = useStore((s) => s.showToast);

  const modes = it ? modesOf(it) : [];
  const units = it ? rentUnits(it) : [];
  const [mode, setMode] = useState<Mode>(modes[0] ?? 'rent');
  const [unit, setUnitRaw] = useState<Unit>(units.includes('day') ? 'day' : (units[0] ?? 'day'));
  const [n, setN] = useState(unit === 'month' ? 1 : 7);
  const setUnit = (u: Unit) => { setUnitRaw(u); setN(u === 'month' ? 1 : 7); };

  if (!it) return <Screen><T>Item not found.</T></Screen>;

  const header = (
    <>
      <Stack.Screen options={{ title: it.name }} />
      <Card>
        <Row style={{ alignItems: 'flex-start' }}>
          <Ic label={it.abbr} tone="amber" />
          <Grow>
            <T v="h3" style={{ fontSize: 16 }}>{it.name}</T>
            <ChipRow style={{ gap: 5, marginTop: 5 }}>
              <Pill label={it.cat} tone="blue" />
              {it.sug ? <Pill label="Suggested by your summary" tone="amber" /> : null}
            </ChipRow>
          </Grow>
        </Row>
        <T style={{ fontSize: 13, marginTop: 10 }}>{it.desc}</T>
      </Card>
    </>
  );

  if (it.id === 'mon') {
    return (
      <Screen dock={<Btn title="See plans and set up" onPress={() => router.push('/monitor')} />}>
        {header}
        <Card tone="teal">
          <T v="bodyB" style={{ fontSize: 13.5 }}>This one has its own set-up</T>
          <T v="small">The monitor is paired to the bed, thresholds are set with the nurse, and alerts go to your care circle. Plans and set-up are on the next screen.</T>
        </Card>
      </Screen>
    );
  }

  const rent = mode === 'rent';
  const k = calcLine(it, mode, unit, rent ? n : 1);
  const due = k.price + k.delivery + k.deposit;
  const be = monthlyBreakEven(it);
  const max = unit === 'month' ? 24 : 120;

  return (
    <Screen
      dock={
        <Btn
          title={`Add to order · ${inr(due)}`}
          onPress={() => { addToCart({ id: it.id, mode, unit, n: rent ? n : 1 }); toast(`${it.name} added. Add more, or review your order.`); router.back(); }}
        />
      }>
      {header}
      {modes.length > 1 ? (
        <View style={{ marginBottom: 14 }}>
          <FieldLabel>How would you like it?</FieldLabel>
          <ChipRow>{modes.map((m) => <Chip key={m} label={m === 'rent' ? 'Rent' : 'Buy'} on={mode === m} onPress={() => setMode(m)} />)}</ChipRow>
        </View>
      ) : null}
      {rent ? (
        <>
          {units.length > 1 ? (
            <View style={{ marginBottom: 14 }}>
              <FieldLabel>Rent by</FieldLabel>
              <ChipRow>{units.map((u) => <Chip key={u} label={u === 'day' ? 'Per day' : 'Per month'} on={unit === u} onPress={() => setUnit(u)} />)}</ChipRow>
            </View>
          ) : null}
          <Card>
            <Stepper label={unit === 'month' ? 'Months' : 'Days'} value={n} onMinus={() => setN((v) => Math.max(1, v - 1))} onPlus={() => setN((v) => Math.min(max, v + 1))} />
            <T v="small">{inr(k.rate)} per {unit}{units.length > 1 && be ? ` · monthly is cheaper from day ${be}` : ''}</T>
          </Card>
          {unit === 'day' && be && n >= be ? (
            <Banner tone="amber" text={`At ${n} days the monthly rate (${inr(it.rentMonth)}) costs less. Tap to switch to per month.`} onPress={() => setUnit('month')} />
          ) : null}
        </>
      ) : null}
      <Card>
        <PriceLine l={rent ? `${k.desc} × ${inr(k.rate)}` : 'Price'} r={inr(k.price)} />
        <PriceLine l="Delivery and setup" r={k.delivery > 0 ? inr(k.delivery) : 'Free'} />
        {k.deposit > 0 ? <PriceLine l="Refundable deposit" r={inr(k.deposit)} /> : null}
        <PriceLine l="Platform fee for you" r="₹0" />
        <PriceLine l="Due at delivery" r={inr(due)} total />
      </Card>
      <T v="small">
        {rent
          ? 'Delivered, set up and collected by Home Konnect when you are done. The deposit is returned after the equipment is checked.'
          : "Delivered and set up at home. Warranty as per the manufacturer's card."}
      </T>
    </Screen>
  );
}
