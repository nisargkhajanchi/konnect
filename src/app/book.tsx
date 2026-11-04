import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import {
  Between, Btn, Card, ChoiceChips, Field, FieldLabel, Grow, PriceLine, Row, Screen, T, Toggle,
} from '@/components/ui';
import { BOOK_DAYS, BOOK_TIMES, PACKS } from '@/data/demo';
import { useStore, usePatient } from '@/state/store';
import { C, inr } from '@/theme';

const PACK_LABELS = PACKS.map((p) => p.label);
const PREFS = ['No preference', 'Female', 'Male'] as const;
const PAYS = ['UPI after visit', 'Card', 'Insurance claim'] as const;
const STEP_NAMES = ['When', 'Your details', 'Review and pay'];

/** Tomorrow and the two days after, labelled like "Tomorrow" / "Thu 6 Nov". */
function nextDays() {
  return [1, 2, 3].map((n) => {
    const date = new Date(Date.now() + n * 86400000);
    const label = n === 1 ? 'Tomorrow' : date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
    return { label, date };
  });
}
function demoDays() {
  return BOOK_DAYS.map((label, i) => ({ label, date: new Date(Date.now() + (i + 1) * 86400000) }));
}
/** Sets "4:30 PM" on the given day, in the phone's time zone. */
function atTime(day: Date, time: string) {
  const m = /^(\d{1,2}):(\d{2}) ([AP]M)$/.exec(time);
  const d = new Date(day);
  if (m) d.setHours((Number(m[1]) % 12) + (m[3] === 'PM' ? 12 : 0), Number(m[2]), 0, 0);
  return d;
}

export default function Book() {
  const patient = usePatient();
  const { provider, service = 'Home nursing' } = useLocalSearchParams<{ provider: string; service?: string }>();
  const p = useStore((s) => s.providers.find((x) => x.id === provider));
  const addBooking = useStore((s) => s.addBooking);
  const setShare = useStore((s) => s.setShare);

  const live = useStore((s) => s.live);
  // Computed once per visit to the screen, so the dates don't shift between renders.
  const [days] = useState(() => (live ? nextDays() : demoDays()));
  const [step, setStep] = useState(1);
  const [pack, setPack] = useState(PACK_LABELS[0]);
  const [day, setDay] = useState(days[0].label);
  const [time, setTime] = useState(BOOK_TIMES[1]);
  const [pref, setPref] = useState<(typeof PREFS)[number]>('No preference');
  const [addr, setAddr] = useState(patient.address);
  const [share, setShareOn] = useState(true);
  const [pay, setPay] = useState<(typeof PAYS)[number]>('UPI after visit');
  const [busy, setBusy] = useState(false);

  if (!p) return <Screen><T>Provider not found.</T></Screen>;
  const pk = PACKS.find((x) => x.label === pack)!;
  const total = Math.round(p.price * pk.n * pk.disc);

  const next = async () => {
    if (step < 3) { setStep(step + 1); return; }
    setBusy(true);
    const at = atTime(days.find((d) => d.label === day)!.date, time);
    const b = await addBooking({ svc: service, provider: p.name, when: `${day}, ${time}`, total, providerId: p.id, at, share });
    setBusy(false);
    if (!b) return;
    if (!live) setShare(share ? 'active' : 'off');
    router.replace({ pathname: '/booked', params: { ref: b.ref, svc: b.svc, provider: b.provider, when: b.when } });
  };

  return (
    <Screen
      dock={
        <View>
          {step < 3 ? <Between style={{ marginBottom: 8 }}><T v="small">Total</T><T v="h3">{inr(total)}</T></Between> : null}
          <Row gap={8}>
            {step > 1 ? <Btn v="ghost" title="Back" onPress={() => setStep(step - 1)} style={{ flex: 0.55 }} /> : null}
            <Btn title={busy ? 'Booking…' : ['Next: your details', 'Next: review and pay', 'Confirm booking'][step - 1]} onPress={next} disabled={busy} style={{ flex: 1 }} />
          </Row>
        </View>
      }>
      <T v="label">Step {step} of 3 · {STEP_NAMES[step - 1]}</T>
      <T v="h2">{service} visit</T>
      <T v="small" style={{ marginBottom: 10 }}>{p.name}</T>
      <Row gap={6} style={{ marginBottom: 16 }}>
        {[1, 2, 3].map((i) => <View key={i} style={{ flex: 1, height: 5, borderRadius: 4, backgroundColor: i <= step ? C.amber : '#EADFCB' }} />)}
      </Row>

      {step === 1 ? (
        <View>
          <FieldLabel>How many visits?</FieldLabel>
          <ChoiceChips options={PACK_LABELS} value={pack} onChange={setPack} />
          <View style={{ height: 14 }} />
          <FieldLabel>Day</FieldLabel>
          <ChoiceChips options={days.map((d) => d.label)} value={day} onChange={setDay} />
          <View style={{ height: 14 }} />
          <FieldLabel>Time</FieldLabel>
          <ChoiceChips options={BOOK_TIMES} value={time} onChange={setTime} />
        </View>
      ) : step === 2 ? (
        <View>
          <FieldLabel>Caregiver preference</FieldLabel>
          <ChoiceChips options={PREFS} value={pref} onChange={setPref} />
          <View style={{ height: 14 }} />
          <Field label="Visit address" value={addr} onChangeText={setAddr} />
          <Card tone="teal">
            <Between>
              <Grow>
                <T v="bodyB" style={{ fontSize: 13.5 }}>Share records with this provider</T>
                <T v="small">Discharge summary, medicines, allergies, warning signs. Billing is never shared. Expires after the last visit and you can revoke anytime.</T>
              </Grow>
              <Toggle value={share} onChange={setShareOn} />
            </Between>
          </Card>
        </View>
      ) : (
        <View>
          <Card tone="amber">
            <T v="small">You are booking</T>
            <T v="bodyB">{service} · {day}, {time}</T>
            <T v="small">{p.name} · {addr}</T>
            {pref !== 'No preference' ? <T v="small">Caregiver: {pref.toLowerCase()}</T> : null}
          </Card>
          <Card>
            <PriceLine l={`${pk.n} ${pk.n === 1 ? 'visit' : 'visits'} × ${inr(p.price)}${pk.disc < 1 ? ' (pack price)' : ''}`} r={inr(total)} />
            <PriceLine l="Travel" r="₹0" />
            <PriceLine l="Platform fee for you" r="₹0" />
            <PriceLine l="Total" r={inr(total)} total />
          </Card>
          <FieldLabel>Pay with</FieldLabel>
          <ChoiceChips options={PAYS} value={pay} onChange={setPay} />
        </View>
      )}
    </Screen>
  );
}
