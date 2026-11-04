import { router } from 'expo-router';
import { Linking } from 'react-native';

import { Spark } from '@/components/charts';
import { MonStatus } from '@/components/mon-status';
import { VGrid, VTile } from '@/components/vitals';
import { Btn, Card, Chip, ChipRow, Row, Screen, T, TaskRow, Track } from '@/components/ui';
import { PATIENT } from '@/data/demo';
import { monFlags } from '@/logic/rules';
import { ALERT_STEPS, useMonState, useStore } from '@/state/store';
import { C } from '@/theme';

export default function LiveMonitor() {
  const mon = useStore((s) => s.mon);
  const event = useStore((s) => s.monEvent);
  const clearAlert = useStore((s) => s.clearAlert);
  const st = useMonState();
  const f = monFlags(mon.v, mon.thr);
  const resolved = mon.step === 3;

  return (
    <Screen>
      <T v="h2">{PATIENT.first}, right now</T>
      <MonStatus st={st} extra={!mon.online ? 'connection lost' : !mon.onBed ? 'out of bed' : undefined} />
      <Row style={{ justifyContent: 'space-between', marginBottom: 11 }}>
        <T v="small">{mon.online ? '● Connected · updated just now' : '○ No signal for 5 min'}</T>
        <T v="small">{mon.online ? 'Battery backup 100%' : 'On battery backup'}</T>
      </Row>

      {mon.alert ? (
        <Card tone={resolved ? 'teal' : 'red'}>
          <T v="label" style={{ color: resolved ? C.tealDeep : C.red }}>{resolved ? 'Resolved' : 'Alert'} · {mon.alert.time}</T>
          <T v="bodyB">{mon.alert.title}</T>
          <T v="small" style={{ color: C.ink, marginBottom: 10 }}>{mon.alert.detail}</T>
          <Track steps={ALERT_STEPS.map((name) => ({ name }))} current={mon.step} allDone={resolved} />
          {resolved ? (
            <Btn v="ghost" small title="Close this alert" onPress={clearAlert} style={{ marginTop: 10 }} />
          ) : (
            <>
              <Row gap={8} style={{ marginTop: 10 }}>
                <Btn v="red" small title="Open SOS" onPress={() => router.push('/sos')} style={{ flex: 1 }} />
                <Btn v="ghost" small title="Call 108" onPress={() => Linking.openURL('tel:108').catch(() => {})} style={{ flex: 1 }} />
              </Row>
              <T v="small" style={{ marginTop: 8 }}>If he is struggling to breathe, unresponsive or in chest pain, call 108 now.</T>
            </>
          )}
        </Card>
      ) : null}

      <VGrid>
        <VTile label="Heart rate" value={mon.v.hr} unit="bpm" alert={f.hr} />
        <VTile label="Oxygen" value={mon.v.spo2} unit="%" alert={f.sp} />
        <VTile label="Breathing" value={mon.v.rr} unit="/min" alert={f.rr} />
        <VTile label="Temperature" value={mon.v.temp.toFixed(1)} unit="°F" alert={f.tm} />
      </VGrid>

      <Card>
        <T v="label">Heart rate · last 24 hours</T>
        <Spark data={mon.hHr} min={40} max={140} lo={mon.thr.hrLo} hi={mon.thr.hrHi} color={C.amber} label="Heart rate trend" />
        <T v="label" style={{ marginTop: 8 }}>Oxygen · last 24 hours</T>
        <Spark data={mon.hSp} min={86} max={100} lo={mon.thr.spo2} color={C.teal} label="Oxygen trend" />
        <T v="small">Dashed lines show your alert limits.</T>
      </Card>

      <Card tone="violet">
        <T v="label" style={{ color: C.violet }}>Last night</T>
        <T v="small" style={{ color: C.ink }}>Slept 6 h 40 min. Restless twice. Lowest oxygen 94%. Average heart rate 66. Nothing needed action.</T>
      </Card>

      <T v="sect">Try an event (demo)</T>
      <ChipRow>
        <Chip tone="red" label="Low oxygen" onPress={() => event('lowO2')} />
        <Chip tone="red" label="Fast heartbeat" onPress={() => event('fastHr')} />
        <Chip label="Fever" onPress={() => event('fever')} />
        <Chip label="Out of bed" onPress={() => event('offBed')} />
        <Chip label="Connection lost" onPress={() => event('offline')} />
        <Chip tone="teal" label="Back to normal" onPress={() => event('normal')} />
      </ChipRow>

      <T v="sect">Today's log</T>
      <Card>
        {mon.log.map((l, i) => (
          <TaskRow key={l.t + l.m + i} left={<T v="mono" style={{ minWidth: 42 }}>{l.t}</T>} title={l.m} last={i === mon.log.length - 1} />
        ))}
      </Card>
      <Row gap={8}>
        <Btn v="ghost" small title="Alert limits" onPress={() => router.push({ pathname: '/monitor/setup', params: { step: '5' } })} style={{ flex: 1 }} />
        <Btn v="ghost" small title="Share report" onPress={() => router.push('/summary')} style={{ flex: 1 }} />
      </Row>
      {!mon.paired ? <T v="small" style={{ marginTop: 10 }}>The monitor is not set up yet.</T> : null}
    </Screen>
  );
}
