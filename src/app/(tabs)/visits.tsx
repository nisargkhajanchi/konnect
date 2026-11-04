import { router } from 'expo-router';
import { useState } from 'react';

import { Between, Btn, Card, Grow, Pill, Screen, Seg, T } from '@/components/ui';
import { PAST_SERVICES } from '@/data/demo';
import { STAGE_LABEL, useStore } from '@/state/store';

const ORD = ['Confirmed', 'Out for delivery', 'Delivered'] as const;
const ORD_TONE = ['amber', 'blue', 'teal'] as const;

export default function Visits() {
  const [tab, setTab] = useState<'up' | 'past'>('up');
  const visit = useStore((s) => s.visit);
  const bookings = useStore((s) => s.bookings);
  const orders = useStore((s) => s.orders);
  const done = visit.stage === 4;

  return (
    <Screen tabs>
      <T v="label">Visits</T>
      <T v="h2">Care at home</T>
      <Btn v="ghost" title="+ Book care or a visit" onPress={() => router.push('/(tabs)/care')} style={{ marginBottom: 12 }} />
      <Seg options={[{ k: 'up', label: 'Upcoming' }, { k: 'past', label: 'Past' }]} value={tab} onChange={setTab} />

      {tab === 'up' ? (
        <>
          {!done ? (
            <Card onPress={() => router.push('/visit')}>
              <T v="label">Today · 4:30 PM</T>
              <Between>
                <Grow>
                  <T v="bodyB">Home nurse</T>
                  <T v="small">Sunrise Home Nursing · Meera D'Souza</T>
                </Grow>
                <Pill label={STAGE_LABEL[visit.stage]} tone={visit.stage === 0 ? 'amber' : 'blue'} />
              </Between>
              <T v="small" style={{ marginTop: 8 }}>Tap to track live and see what the nurse records.</T>
            </Card>
          ) : null}
          {bookings.map((b) => (
            <Card key={b.ref}>
              <T v="label">{b.when}</T>
              <Between>
                <Grow>
                  <T v="bodyB">{b.svc}</T>
                  <T v="small">{b.provider} · {b.ref}</T>
                </Grow>
                <Pill label="Confirmed" />
              </Between>
            </Card>
          ))}
          {orders.slice().reverse().map((o) => (
            <Card key={o.ref}>
              <T v="label">Equipment delivery · {o.slot}</T>
              <Between>
                <Grow>
                  <T v="bodyB">{o.lines.map((l) => l.name).join(', ')}</T>
                  <T v="small">Order {o.ref} · Home Konnect supply</T>
                </Grow>
                <Pill label={ORD[o.status]} tone={ORD_TONE[o.status]} />
              </Between>
            </Card>
          ))}
          {done && !bookings.length && !orders.length ? <T v="small">Nothing upcoming. Book care from Find care.</T> : null}
        </>
      ) : (
        <>
          {done ? (
            <Card onPress={() => router.push('/visit')}>
              <T v="label">Today · 21 Oct</T>
              <T v="bodyB">Home nurse</T>
              <T v="small">{visit.vitals ? `BP ${visit.vitals.sys}/${visit.vitals.dia}, SpO₂ ${visit.vitals.spo}%. ` : ''}{visit.note}</T>
            </Card>
          ) : null}
          {PAST_SERVICES.slice().reverse().map((p) => (
            <Card key={p.date + p.svc}>
              <T v="label">{p.date}</T>
              <T v="bodyB">{p.svc}</T>
              <T v="small">{p.note}</T>
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}
