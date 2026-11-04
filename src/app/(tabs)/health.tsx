import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { BpChart } from '@/components/charts';
import { openMonitor } from '@/components/monitor-card';
import { VGrid, VTile } from '@/components/vitals';
import { Banner, Between, Btn, Card, Grow, Ic, Pill, Row, Screen, Seg, Stepper, T, TaskRow } from '@/components/ui';

import { bpStatus, MON_TEXT } from '@/logic/rules';
import { useMonState, useStore, usePatient } from '@/state/store';
import { C } from '@/theme';

type Tab = 'vit' | 'med' | 'rec';

export default function Health() {
  const patient = usePatient();
  // The tab lives in the URL so links like "Log BP" from Today land on the right panel.
  const { tab = 'vit' } = useLocalSearchParams<{ tab?: Tab }>();
  const setTab = (t: Tab) => router.setParams({ tab: t });

  return (
    <Screen tabs>
      <T v="label">Health</T>
      <T v="h2">{patient.first}'s health</T>
      <Seg options={[{ k: 'vit', label: 'Vitals' }, { k: 'med', label: 'Medicines' }, { k: 'rec', label: 'Records' }]} value={tab} onChange={setTab} />
      {tab === 'vit' ? <Vitals /> : tab === 'med' ? <Meds /> : <Records />}
    </Screen>
  );
}

function Vitals() {
  const patient = usePatient();
  const bp = useStore((s) => s.bp);
  const add = useStore((s) => s.addReading);
  const mon = useStore((s) => s.mon);
  const visitVitals = useStore((s) => s.visit.vitals);
  const monSt = useMonState();
  const last = bp.length ? bp[bp.length - 1] : null;
  const limit = useStore((s) => s.patient.bpLimit);
  const [sys, setSys] = useState(last?.[0] ?? 128);
  const [dia, setDia] = useState(last?.[1] ?? 82);
  const [saved, setSaved] = useState<null | ReturnType<typeof bpStatus>>(null);
  const st = last ? bpStatus(last[0], limit.sys) : 'ok';

  const save = () => { add(sys, dia); setSaved(bpStatus(sys, limit.sys)); };

  return (
    <View>
      <Card tone="teal" onPress={openMonitor}>
        <Between>
          <Grow>
            <T v="bodyB" style={{ fontSize: 13.5 }}>24-hour live monitor</T>
            <T v="small">{mon.paired ? `Live: ${mon.v.hr} bpm · ${mon.v.spo2}% oxygen` : 'Not set up. See how it works.'}</T>
          </Grow>
          <Pill label={mon.paired ? MON_TEXT[monSt] : 'Set up'} tone={!mon.paired ? 'amber' : monSt === 'alert' ? 'red' : monSt === 'watch' ? 'amber' : 'teal'} />
        </Between>
      </Card>
      {saved ? (
        <Banner
          tone={saved === 'red' ? 'red' : saved === 'amber' ? 'amber' : 'teal'}
          text={
            saved === 'red'
              ? "Top number above 160. Sit down, rest, and recheck in 5 minutes. If it stays high or you have chest pain or breathlessness, open SOS now. Home Konnect's clinical desk has been alerted."
              : saved === 'amber'
                ? `Above the limit of ${limit.sys} in your summary. Rest for 10 minutes and recheck, and tell the nurse.`
                : 'Saved. Within the range in your summary.'
          }
          onPress={saved === 'red' ? () => router.push('/sos') : undefined}
        />
      ) : null}
      <VGrid>
        <VTile label="Blood pressure" value={last ? `${last[0]}/${last[1]}` : '—'} unit="mmHg" alert={st !== 'ok'} />
        <VTile label="Pulse" value={visitVitals?.pul ?? 72} unit="bpm" />
        <VTile label="Oxygen (SpO₂)" value={visitVitals?.spo ?? 97} unit="%" />
        <VTile label="Sugar (fasting)" value={104} unit="mg/dL" />
      </VGrid>
      <Card>
        <T v="label">Add a reading</T>
        <Stepper label="Top number" value={sys} onMinus={() => setSys((v) => Math.max(80, v - 2))} onPlus={() => setSys((v) => Math.min(220, v + 2))} />
        <Stepper label="Bottom number" value={dia} onMinus={() => setDia((v) => Math.max(40, v - 2))} onPlus={() => setDia((v) => Math.min(130, v + 2))} />
        <Btn small title="Save reading" onPress={save} style={{ marginTop: 4 }} />
      </Card>
      <Card>
        <T v="label">Blood pressure · last {bp.length} readings</T>
        <BpChart data={bp} limit={patient.bpLimit.sys} />
        <T v="small">
          <T v="small" style={{ color: C.amber }}>■</T> Top number   <T v="small" style={{ color: C.teal }}>■</T> Bottom number   Dashed: limit 140 from your summary
        </T>
      </Card>
      <T v="small">Readings above the limit in your summary alert the nurse and show you what to do next.</T>
    </View>
  );
}

function Meds() {
  const meds = useStore((s) => s.meds);
  const toggle = useStore((s) => s.toggleMedTaken);
  const sent = useStore((s) => s.reorderSent);
  const reorder = useStore((s) => s.setReorderSent);
  const low = meds.find((m) => /metoprolol/i.test(m.name)) ?? meds[0];

  return (
    <View>
      <Card>
        {meds.length ? meds.map((m, i) => (
          <TaskRow key={m.id} title={m.name} sub={m.time} done={m.taken} onPress={() => toggle(m.id)} last={i === meds.length - 1} />
        )) : <T v="small">No medicines yet. Add your discharge summary to fill this in.</T>}
      </Card>
      {low ? (
        <Card tone="amber">
          <T v="label">Running low</T>
          <T v="bodyB" style={{ fontSize: 13.5 }}>{low.name} · 6 days left</T>
          <T v="small">Reorder from a licensed partner pharmacy near you. Your uploaded prescription is used, and the pharmacist checks it before dispatch.</T>
          <Btn small title={sent ? 'Order sent ✓' : 'Reorder from a partner pharmacy'} disabled={sent} onPress={reorder} style={{ marginTop: 10 }} />
        </Card>
      ) : null}
      {sent ? <Banner text="Order sent. The pharmacist checks your prescription and confirms in about 30 minutes. Delivery tomorrow morning." /> : null}
    </View>
  );
}

function Records() {
  const patient = usePatient();
  const meds = useStore((s) => s.meds);
  const hasSummary = useStore((s) => s.hasSummary);
  const summaries = useStore((s) => s.summaries);
  const share = useStore((s) => s.share);
  const setShare = useStore((s) => s.setShare);
  const toast = useStore((s) => s.showToast);

  const docs: { ic: string; tone: 'blue' | 'violet' | 'teal'; t: string; s: string }[] = [
    ...(hasSummary ? [{ ic: 'PDF', tone: 'blue' as const, t: 'Discharge summary', s: `${patient.hospital || 'Hospital'} · uploaded by you` }] : []),
    { ic: 'RX', tone: 'blue', t: 'Prescriptions', s: `${meds.length} medicines · from your summary` },
    { ic: 'ECG', tone: 'violet', t: 'ECG and Echo reports', s: 'Echo EF 58% · uploaded by you' },
    { ic: 'LAB', tone: 'teal', t: 'Lab reports', s: 'Lipid profile, kidney function' },
  ];

  return (
    <View>
      <Card tone="amber" onPress={() => router.push('/summary')}>
        <Row>
          <Ic label="SUM" tone="amber" />
          <Grow>
            <T v="bodyB" style={{ fontSize: 13.5 }}>Summary for your doctor</T>
            <T v="small">Services given and health updates, ready for the next visit</T>
          </Grow>
          <Pill label="Create" tone="amber" />
        </Row>
      </Card>
      {summaries.map((sm, i) => (
        <Card key={sm.when + i} onPress={() => router.push({ pathname: '/summary', params: { saved: String(i) } })}>
          <Row>
            <Ic label="DOC" tone="blue" />
            <Grow>
              <T v="bodyB" style={{ fontSize: 13.5 }}>Summary for your doctor</T>
              <T v="small">{sm.when} · {sm.sub}</T>
            </Grow>
            <Pill label="Open" />
          </Row>
        </Card>
      ))}
      {docs.map((d) => (
        <Card key={d.t} onPress={() => toast(`Opening ${d.t.toLowerCase()} (demo).`)}>
          <Row>
            <Ic label={d.ic} tone={d.tone} />
            <Grow>
              <T v="bodyB" style={{ fontSize: 13.5 }}>{d.t}</T>
              <T v="small">{d.s}</T>
            </Grow>
            <Pill label="View" />
          </Row>
        </Card>
      ))}
      <Btn v="ghost" title={hasSummary ? '+ Add another document' : '+ Add your discharge summary'} onPress={() => router.push('/onboarding/upload')} />
      <T v="sect">Who can see your records</T>
      <Card>
        <Between>
          <Grow>
            <T v="bodyB" style={{ fontSize: 13.5 }}>Sunrise Home Nursing</T>
            <T v="small">Discharge summary, medicines, warning signs · until last visit</T>
          </Grow>
          <Pill label={share === 'active' ? 'Active' : share === 'revoked' ? 'Revoked' : 'Not shared'} tone={share === 'active' ? 'amber' : share === 'revoked' ? 'red' : 'grey'} />
        </Between>
        <Btn
          v="ghost" small style={{ marginTop: 10 }}
          title={share === 'active' ? 'Revoke access' : 'Access revoked'}
          disabled={share !== 'active'}
          onPress={() => { setShare('revoked'); toast('Sunrise Home Nursing can no longer see your records. Past visit notes stay in your history.'); }}
        />
      </Card>
    </View>
  );
}
