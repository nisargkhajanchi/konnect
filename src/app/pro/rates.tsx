import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import {
  Banner, Between, Btn, Card, ChoiceChips, Field, FieldLabel, Grow, Ic, LinkText, Pill, PriceLine, Row, Screen, Seg, Sub, T, Toggle,
} from '@/components/ui';
import { EQ_CATS, type Equip } from '@/data/demo';
import { rateText, rentUnits } from '@/logic/rules';
import { useStore, usePatient } from '@/state/store';
import { C, inr } from '@/theme';

const ORD = ['Confirmed', 'Out for delivery', 'Delivered'] as const;
const ORD_TONE = ['amber', 'blue', 'teal'] as const;

export default function Rates() {
  const [tab, setTab] = useState<'rates' | 'orders'>('rates');
  const orders = useStore((s) => s.orders);
  const signOut = useStore((s) => s.signOut);
  return (
    <Screen>
      <Stack.Screen options={{ headerRight: () => <LinkText title="Sign out" onPress={() => { signOut().finally(() => router.dismissTo('/')); }} /> }} />
      <Card style={{ backgroundColor: C.navy, borderWidth: 0 }}>
        <Between>
          <Grow>
            <T v="bodyB" style={{ color: '#fff' }}>Equipment desk</T>
            <T v="mono" style={{ color: 'rgba(255,255,255,0.7)' }}>Supplier admin · Home Konnect supply</T>
          </Grow>
          <Pill label="Rates are yours" tone="teal" />
        </Between>
      </Card>
      <T v="h2">Your rate card</T>
      <Sub>You set every rate. Families see a new rate on their next order. Orders already placed keep the rate they were booked at.</Sub>
      <Seg options={[{ k: 'rates', label: 'Rates' }, { k: 'orders', label: `Orders${orders.length ? ` (${orders.length})` : ''}` }]} value={tab} onChange={setTab} />
      {tab === 'rates' ? <RateList /> : <Orders />}
    </Screen>
  );
}

function RateList() {
  const equipment = useStore((s) => s.equipment);
  const deskAddSaved = useStore((s) => s.deskAdd);
  const setDeskAdd = useStore((s) => s.setDeskAdd);
  const toggle = useStore((s) => s.toggleEquip);
  const stamp = useStore((s) => s.rateStamp);
  const toast = useStore((s) => s.showToast);
  const [editing, setEditing] = useState<string | null>(null);
  const [desk, setDesk] = useState(String(deskAddSaved));
  const monRent = equipment.find((e) => e.id === 'mon')?.rentMonth ?? 0;

  return (
    <View>
      {equipment.map((it) => editing === it.id ? (
        <EditForm key={it.id} item={it} onDone={() => setEditing(null)} />
      ) : (
        <Card key={it.id}>
          <Between style={{ alignItems: 'flex-start' }}>
            <Row style={{ alignItems: 'flex-start', flex: 1 }}>
              <Ic label={it.abbr} tone="amber" size={36} />
              <Grow>
                <T v="bodyB" style={{ fontSize: 13.5 }}>{it.name}</T>
                <T v="small" style={{ color: C.ink }}>{rateText(it) || 'No rate set'}</T>
                {it.id !== 'mon' ? (
                  <T v="small">{it.canRent && rentUnits(it).length ? `Deposit ${inr(it.deposit)} · ` : ''}Delivery {it.delivery > 0 ? inr(it.delivery) : 'free'}</T>
                ) : null}
              </Grow>
            </Row>
            <View style={{ alignItems: 'center' }}>
              <Toggle value={it.on} onChange={() => { toggle(it.id); toast(it.on ? `${it.name} is hidden from families.` : `${it.name} is available to families.`); }} />
              <T v="small" style={{ marginTop: 2 }}>{it.on ? 'Available' : 'Hidden'}</T>
            </View>
          </Between>
          <View style={{ marginTop: 8 }}><LinkText title="Edit rates" onPress={() => setEditing(it.id)} /></View>
        </Card>
      ))}
      {editing === 'new' ? <EditForm item={null} onDone={() => setEditing(null)} /> : (
        <Btn v="ghost" title="+ Add equipment" onPress={() => setEditing('new')} />
      )}
      <T v="sect">Monitoring plans</T>
      <Card>
        <T v="small" style={{ marginBottom: 8 }}>The monitor rent above sets the plan price. Set what the clinical desk adds on top.</T>
        <Field label="Clinical desk add-on per month (₹)" keyboardType="number-pad" value={desk} onChangeText={setDesk} />
        <Btn small title="Save add-on" onPress={() => { const n = Math.max(0, parseInt(desk, 10) || 0); setDeskAdd(n); setDesk(String(n)); toast(`Saved. The clinical desk plan now shows ${inr(monRent + n)} per month.`); }} />
        <T v="small" style={{ marginTop: 8 }}>Families see: Monitor and app {inr(monRent)} per month · Monitor and clinical desk {inr(monRent + deskAddSaved)} per month.</T>
      </Card>
      <Btn v="teal" title="Preview what families see" onPress={() => router.push('/equipment')} style={{ marginTop: 4 }} />
      <T v="small" style={{ marginTop: 10 }}>{stamp} Orders already placed keep the rate they were booked at.</T>
    </View>
  );
}

const num = (s: string) => { const v = parseInt(s, 10); return isNaN(v) || v < 0 ? 0 : v; };
const abbrOf = (n: string) => { const w = n.trim().split(/\s+/); return ((w[0] ?? '?').charAt(0) + (w[1] ? w[1].charAt(0) : (w[0] ?? '  ').charAt(1))).toUpperCase(); };

function EditForm({ item, onDone }: { item: Equip | null; onDone: () => void }) {
  const save = useStore((s) => s.saveEquip);
  const add = useStore((s) => s.addEquip);
  const remove = useStore((s) => s.removeEquip);
  const toast = useStore((s) => s.showToast);
  const isMon = item?.id === 'mon';
  const [f, setF] = useState({
    name: item?.name ?? '', cat: item?.cat ?? EQ_CATS[0], desc: item?.desc ?? '',
    canRent: item?.canRent ?? true, canBuy: item?.canBuy ?? false,
    rentDay: String(item?.rentDay ?? 0), rentMonth: String(item?.rentMonth ?? 0), buy: String(item?.buy ?? 0),
    deposit: String(item?.deposit ?? 0), delivery: String(item?.delivery ?? 0),
  });
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (v: string | boolean) => { setF({ ...f, [k]: v }); setErr(null); };

  const rd = num(f.rentDay), rm = num(f.rentMonth), by = num(f.buy);
  const warn: string[] = [];
  if (f.canRent && rd > 0 && rm > rd * 30) warn.push('Monthly rent is higher than 30 days at the daily rate, so families will never choose monthly.');
  if (f.canRent && rd > 0 && rm > 0 && rm <= rd * 30) warn.push(`Families see: monthly is cheaper from day ${Math.ceil(rm / rd)}.`);
  if (f.canRent && f.canBuy && rd > 0 && by > 0 && by < rd * 30) warn.push('Buying costs less than one month of daily rent.');

  const submit = () => {
    const name = f.name.trim();
    if (!name) { setErr('Give the item a name families will recognise.'); return; }
    const next: Equip = isMon
      ? { ...item!, name, desc: f.desc.trim(), rentMonth: rm, canRent: true, canBuy: false }
      : {
        id: item?.id ?? 'x' + Date.now(), abbr: item?.abbr ?? abbrOf(name), on: item?.on ?? true, sug: item?.sug,
        name, cat: f.cat, desc: f.desc.trim(), canRent: f.canRent, canBuy: f.canBuy,
        rentDay: f.canRent ? rd : 0, rentMonth: f.canRent ? rm : 0, buy: f.canBuy ? by : 0,
        deposit: f.canRent ? num(f.deposit) : 0, delivery: num(f.delivery),
      };
    if (isMon && rm <= 0) { setErr('Set a monthly rent for the monitor.'); return; }
    if (!isMon && !((next.canRent && (next.rentDay > 0 || next.rentMonth > 0)) || (next.canBuy && next.buy > 0))) {
      setErr('Set a price families can pay: a daily or monthly rent, or a buy price. Switch off what you do not offer.'); return;
    }
    if (item) save(next); else add(next);
    toast('Saved. Families see the new rates now.');
    onDone();
  };

  return (
    <Card tone="amber">
      <T v="label">{item ? 'Edit rates' : 'New equipment'}</T>
      <Field label="Name" value={f.name} onChangeText={set('name')} placeholder="For example: Suction machine" />
      {!isMon ? (
        <>
          <FieldLabel>Category</FieldLabel>
          <ChoiceChips options={EQ_CATS} value={f.cat as (typeof EQ_CATS)[number]} onChange={set('cat')} />
          <Between style={{ marginTop: 14, marginBottom: 8 }}><T v="bodyB" style={{ fontSize: 13 }}>Offer for rent</T><Toggle value={f.canRent} onChange={set('canRent')} /></Between>
          <Between style={{ marginBottom: 12 }}><T v="bodyB" style={{ fontSize: 13 }}>Offer to buy</T><Toggle value={f.canBuy} onChange={set('canBuy')} /></Between>
          {f.canRent ? (
            <Row gap={9} style={{ alignItems: 'flex-start' }}>
              <Grow><Field label="Rent per day (₹)" keyboardType="number-pad" value={f.rentDay} onChangeText={set('rentDay')} /></Grow>
              <Grow><Field label="Per month (₹)" keyboardType="number-pad" value={f.rentMonth} onChangeText={set('rentMonth')} /></Grow>
            </Row>
          ) : null}
          <Row gap={9} style={{ alignItems: 'flex-start' }}>
            {f.canBuy ? <Grow><Field label="Buy price (₹)" keyboardType="number-pad" value={f.buy} onChangeText={set('buy')} /></Grow> : null}
            {f.canRent ? <Grow><Field label="Deposit (₹)" keyboardType="number-pad" value={f.deposit} onChangeText={set('deposit')} /></Grow> : null}
          </Row>
          <Field label="Delivery and setup (₹)" keyboardType="number-pad" value={f.delivery} onChangeText={set('delivery')} />
        </>
      ) : (
        <Field label="Rent per month (₹)" keyboardType="number-pad" value={f.rentMonth} onChangeText={set('rentMonth')} />
      )}
      <Field label="What families read" value={f.desc} onChangeText={set('desc')} multiline />
      {warn.length ? <Banner tone="amber" text={warn.join(' ')} /> : null}
      {err ? <Banner tone="red" text={err} /> : null}
      <Row gap={8}>
        <Btn v="teal" small title="Save rates" onPress={submit} style={{ flex: 1 }} />
        <Btn v="ghost" small title="Cancel" onPress={onDone} style={{ flex: 1 }} />
      </Row>
      {item && item.id.startsWith('x') ? (
        <View style={{ marginTop: 10 }}>
          <LinkText title="Remove this item" color={C.red} onPress={() => { remove(item.id); toast('Item removed from the rate card.'); onDone(); }} />
        </View>
      ) : null}
    </Card>
  );
}

function Orders() {
  const patient = usePatient();
  const orders = useStore((s) => s.orders);
  const advance = useStore((s) => s.advanceOrder);
  const toast = useStore((s) => s.showToast);
  if (!orders.length) return <Card><T v="small">No orders yet. When a family places an equipment order, it appears here with the rates it was booked at.</T></Card>;
  return (
    <View>
      {orders.slice().reverse().map((o) => {
        const total = o.lines.reduce((a, l) => a + l.price + l.delivery + l.deposit, 0);
        return (
          <Card key={o.ref}>
            <Between><T v="label" style={{ marginBottom: 0 }}>{o.ref}</T><Pill label={ORD[o.status]} tone={ORD_TONE[o.status]} /></Between>
            <T v="small" style={{ marginVertical: 6 }}>{patient.name} · {patient.address.split(',').slice(0, 2).join(',')} · {o.slot}</T>
            {o.lines.map((l) => <PriceLine key={l.id} l={`${l.name}\n${l.desc}${l.per ? ` at ${inr(l.rate)}/${l.per}` : ''}`} r={inr(l.price)} />)}
            <PriceLine l="Delivery and setup" r={inr(o.lines.reduce((a, l) => a + l.delivery, 0))} />
            <PriceLine l="Refundable deposit" r={inr(o.lines.reduce((a, l) => a + l.deposit, 0))} />
            <PriceLine l="To collect" r={inr(total)} total />
            <T v="small">Pay: {o.pay}</T>
            {o.status < 2 ? (
              <Btn v="teal" small title={o.status === 0 ? 'Mark out for delivery' : 'Mark delivered'} onPress={() => { advance(o.ref); toast(`${o.ref}: ${ORD[o.status + 1]}. The family sees this now.`); }} style={{ marginTop: 10 }} />
            ) : <T v="bodyB" style={{ color: C.tealDeep, marginTop: 8 }}>Delivered ✓</T>}
          </Card>
        );
      })}
    </View>
  );
}
