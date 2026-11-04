import { useState } from 'react';

import { Banner, Btn, Card, Ic, Screen, T, TaskRow } from '@/components/ui';
import { useStore } from '@/state/store';
import { C, F, inr, type Tone } from '@/theme';

export default function Bills() {
  const visit = useStore((s) => s.visit);
  const PAST_SERVICES = useStore((s) => s.pastServices);
  const visitDone = !!visit.id && visit.stage === 4;
  const orders = useStore((s) => s.orders);
  const ready = useStore((s) => s.claimReady);
  const setReady = useStore((s) => s.setClaimReady);
  const [busy, setBusy] = useState(false);

  const rows: { t: string; s: string; a: number; ic: string; tone: Tone }[] = PAST_SERVICES.slice().reverse().map((p) => ({
    t: `${p.svc} · ${p.date}`, s: p.by, a: p.amount, ic: p.abbr, tone: p.tone,
  }));
  // Today's visit is billed once the nurse completes it.
  if (visitDone) rows.unshift({ t: `${visit.service} · ${visit.when.split(',')[0]}`, s: visit.provider, a: 650, ic: 'HN', tone: 'amber' });
  let deposits = 0, eqN = 0;
  orders.forEach((o) => o.lines.forEach((l) => {
    eqN++; deposits += l.deposit;
    rows.push({ t: `Equipment · ${l.name}`, s: `Home Konnect supply · ${l.desc}${l.delivery > 0 ? ` · incl. delivery ${inr(l.delivery)}` : ''}`, a: l.price + l.delivery, ic: 'EQ', tone: 'teal' });
  }));
  const total = rows.reduce((a, r) => a + r.a, 0);
  const nurses = PAST_SERVICES.filter((p) => /nurse/i.test(p.svc)).length + (visitDone ? 1 : 0);

  const make = () => { setBusy(true); setTimeout(() => { setReady(); setBusy(false); }, 800); };

  return (
    <Screen>
      <T v="label">Bills and claims</T>
      <T v="h2">Home care spending</T>
      <Card tone="amber">
        <T v="small">This month</T>
        <T v="big" style={{ fontSize: 26 }}>{inr(total)}</T>
        <T v="small">{nurses} nurse visits · 1 lab collection{eqN ? ` · ${eqN} equipment item${eqN === 1 ? '' : 's'}` : ''}</T>
      </Card>
      <T v="sect">Invoices</T>
      <Card>
        {rows.map((r, i) => (
          <TaskRow
            key={r.t + i} left={<Ic label={r.ic} tone={r.tone} size={34} />} title={r.t} sub={r.s} last={i === rows.length - 1}
            right={<T v="bodyB" style={{ fontFamily: F.bold }}>{inr(r.a)}</T>}
          />
        ))}
      </Card>
      {deposits > 0 ? <T v="small" style={{ marginBottom: 8 }}>Refundable deposits held: {inr(deposits)}. Not counted above. Returned after the equipment is collected and checked.</T> : null}
      <T v="sect">Insurance</T>
      <Card>
        <T v="bodyB" style={{ fontSize: 13.5 }}>Claim pack</T>
        <T v="small">Bundles discharge summary, prescriptions and invoices into one file for your insurer or TPA.</T>
        <Btn small title={ready ? 'Claim pack ready ✓' : busy ? 'Preparing…' : 'Generate claim pack'} disabled={ready || busy} onPress={make} style={{ marginTop: 10 }} />
      </Card>
      {ready ? <Banner text="Claim pack ready · sent to your email and saved in Records." /> : null}
      <T v="small" style={{ color: C.muted }}>Home-care cover varies by policy. The app prepares documents. It does not guarantee reimbursement.</T>
    </Screen>
  );
}
