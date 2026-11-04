import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { VGrid, VTile } from '@/components/vitals';
import { Banner, Between, Btn, Card, ChoiceChips, Field, FieldLabel, Grow, Row, Screen, StepDot, Stepper, Sub, T, TaskRow, Toggle } from '@/components/ui';

import { useStore, usePatient } from '@/state/store';
import { C } from '@/theme';

const INSTALL = ['Delivered and installed by a nurse', 'Delivered, I set it up'] as const;
const WHEN = ['Today 6:00 PM', 'Tomorrow 10:00 AM'] as const;

export default function MonitorSetup() {
  const patient = usePatient();
  const { step: startStep } = useLocalSearchParams<{ step?: string }>();
  const mon = useStore((s) => s.mon);
  const setThr = useStore((s) => s.setThreshold);
  const start = useStore((s) => s.startMonitoring);
  const toast = useStore((s) => s.showToast);

  // Editing limits on an already-paired monitor jumps straight to step 5.
  const [step, setStep] = useState(Number(startStep) || 1);
  const [install, setInstall] = useState<(typeof INSTALL)[number]>(INSTALL[0]);
  const [when, setWhen] = useState<(typeof WHEN)[number]>(WHEN[0]);
  const [code, setCode] = useState('HK-MON-7731');
  const [pair, setPair] = useState<'idle' | 'busy' | 'ok'>(mon.paired ? 'ok' : 'idle');
  const [test, setTest] = useState<'idle' | 'busy' | 'ok'>(mon.paired ? 'ok' : 'idle');
  const [notify, setNotify] = useState({ kiran: true, anita: true, nurse: true });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const canNext = !(step === 3 && pair !== 'ok') && !(step === 4 && test !== 'ok');
  const next = () => {
    if (step < 5) { setStep(step + 1); return; }
    if (mon.paired) { toast('Alert limits saved.'); router.back(); return; }
    start();
    router.replace('/monitor/live');
    toast('Monitoring is live. Alerts go to Kiran, Anita, the nurse and the clinical desk.');
  };

  return (
    <Screen
      dock={
        <Row gap={8}>
          {step > 1 && !(mon.paired && Number(startStep) === 5) ? <Btn v="ghost" title="Back" onPress={() => setStep(step - 1)} style={{ flex: 1 }} /> : null}
          <Btn title={step === 5 ? (mon.paired ? 'Save limits' : 'Finish and start monitoring') : 'Continue'} disabled={!canNext} onPress={next} style={{ flex: 2 }} />
        </Row>
      }>
      <T v="label">Step {step} of 5</T>
      <Row gap={6} style={{ marginBottom: 14 }}>
        {[1, 2, 3, 4, 5].map((i) => <View key={i} style={{ flex: 1, height: 5, borderRadius: 4, backgroundColor: i <= step ? C.amber : '#EADFCB' }} />)}
      </Row>

      {step === 1 ? (
        <View>
          <T v="h2">How should it arrive?</T>
          <Sub>A nurse can bring it, place it and test it with you.</Sub>
          <ChoiceChips options={INSTALL} value={install} onChange={setInstall} />
          <View style={{ height: 14 }} />
          <Field label="Address" defaultValue={patient.address} />
          <FieldLabel>When</FieldLabel>
          <ChoiceChips options={WHEN} value={when} onChange={setWhen} />
        </View>
      ) : step === 2 ? (
        <View>
          <T v="h2">Place the sensor</T>
          <Sub>Slide it flat under the mattress, level with his chest.</Sub>
          <Card>
            <TaskRow left={<StepDot n={1} />} title="Lift the mattress at the chest end" />
            <TaskRow left={<StepDot n={2} />} title="Lay the sensor flat, cable towards the wall" />
            <TaskRow left={<StepDot n={3} />} title="Plug into power. A green light means ready" last />
          </Card>
        </View>
      ) : step === 3 ? (
        <View>
          <T v="h2">Pair the monitor</T>
          <Sub>Type the code on the underside of the sensor.</Sub>
          <Field label="Device code" value={code} onChangeText={setCode} autoCapitalize="characters" />
          <Btn
            v="teal"
            title={pair === 'ok' ? 'Paired ✓' : pair === 'busy' ? 'Pairing…' : 'Pair'}
            disabled={pair !== 'idle' || !code.trim()}
            onPress={() => { setPair('busy'); timers.current.push(setTimeout(() => setPair('ok'), 900)); }}
          />
          {pair === 'ok' ? <View style={{ marginTop: 12 }}><Banner text="Paired. Signal strong. Battery backup 100%." /></View> : null}
        </View>
      ) : step === 4 ? (
        <View>
          <T v="h2">Test reading</T>
          <Sub>Keep him still for 20 seconds.</Sub>
          {test === 'ok' ? (
            <VGrid>
              <VTile label="Heart rate" value={71} unit="bpm" />
              <VTile label="Oxygen" value={97} unit="%" />
              <VTile label="Breathing" value={16} unit="/min" />
              <VTile label="Temperature" value="98.1" unit="°F" />
            </VGrid>
          ) : null}
          <Btn
            title={test === 'ok' ? 'Test passed ✓' : test === 'busy' ? 'Reading…' : 'Start test'}
            disabled={test !== 'idle'}
            onPress={() => { setTest('busy'); timers.current.push(setTimeout(() => setTest('ok'), 1700)); }}
          />
          {test === 'ok' ? <View style={{ marginTop: 12 }}><Banner text="Good signal. Readings look right." /></View> : null}
        </View>
      ) : (
        <View>
          <T v="h2">Who gets alerted, and when</T>
          <Sub>Starting limits come from the discharge summary. Your doctor can change them.</Sub>
          <Card>
            <Stepper label="Oxygen below (%)" value={mon.thr.spo2} onMinus={() => setThr('spo2', mon.thr.spo2 - 1)} onPlus={() => setThr('spo2', mon.thr.spo2 + 1)} />
            <Stepper label="Heart rate above" value={mon.thr.hrHi} onMinus={() => setThr('hrHi', mon.thr.hrHi - 5)} onPlus={() => setThr('hrHi', mon.thr.hrHi + 5)} />
            <Stepper label="Heart rate below" value={mon.thr.hrLo} onMinus={() => setThr('hrLo', mon.thr.hrLo - 5)} onPlus={() => setThr('hrLo', mon.thr.hrLo + 5)} />
            <Stepper label="Temperature above (°F)" value={mon.thr.temp.toFixed(1)} onMinus={() => setThr('temp', mon.thr.temp - 0.2)} onPlus={() => setThr('temp', mon.thr.temp + 0.2)} />
          </Card>
          <T v="sect">Notify</T>
          <Card>
            {[
              { k: 'kiran' as const, t: 'Kiran, primary contact', s: 'Call and push alert' },
              { k: 'anita' as const, t: 'Anita, backup contact', s: 'Push alert' },
              { k: 'nurse' as const, t: 'Home nurse', s: 'Sunrise Home Nursing' },
            ].map((r) => (
              <Between key={r.k} style={{ paddingVertical: 8 }}>
                <Grow><T v="bodyB" style={{ fontSize: 13.5 }}>{r.t}</T><T v="small">{r.s}</T></Grow>
                <Toggle value={notify[r.k]} onChange={(v) => setNotify({ ...notify, [r.k]: v })} />
              </Between>
            ))}
            <Between style={{ paddingVertical: 8 }}>
              <Grow>
                <T v="bodyB" style={{ fontSize: 13.5 }}>Clinical desk</T>
                <T v="small">{mon.plan === 'B' ? 'Trained staff review every alert and call you' : 'Sees alerts, calls if you do not respond'}</T>
              </Grow>
              <Toggle value disabled />
            </Between>
          </Card>
        </View>
      )}
    </Screen>
  );
}
