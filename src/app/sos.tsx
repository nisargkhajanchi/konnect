import { useState } from 'react';
import { Linking, View } from 'react-native';

import { Btn, Card, Chip, ChipRow, Grow, Ic, Row, Screen, Sub, T } from '@/components/ui';
import { SYMPTOMS } from '@/data/demo';
import { triage, type TriageLevel } from '@/logic/rules';
import { useStore } from '@/state/store';
import { C } from '@/theme';

const call108 = () => Linking.openURL('tel:108').catch(() => {});

/**
 * Symptom triage. Weights are DEMO rules; a clinical lead must approve the real rules.
 * The 108 call is real (opens the phone dialler).
 */
export default function Sos() {
  const [sel, setSel] = useState<string[]>([]);
  const [result, setResult] = useState<TriageLevel | null>(null);
  const [erSent, setErSent] = useState(false);
  const toast = useStore((s) => s.showToast);
  const first = useStore((s) => s.patient.first);

  const toggle = (s: string) => { setResult(null); setSel((x) => (x.includes(s) ? x.filter((y) => y !== s) : [...x, s])); };
  const run = () => setResult(triage(SYMPTOMS.filter((s) => sel.includes(s.s)).map((s) => s.w)));

  return (
    <Screen>
      <T v="h2">What is happening?</T>
      <Sub>Tap everything that applies. The app tells you the safest next step. In any emergency, call 108 first.</Sub>
      <Btn v="red" title="Call 108 now" onPress={call108} style={{ marginBottom: 14 }} />
      <ChipRow>{SYMPTOMS.map((s) => <Chip key={s.s} tone="red" label={s.s} on={sel.includes(s.s)} onPress={() => toggle(s.s)} />)}</ChipRow>
      <Btn v="ghost" title="Tell me what to do" onPress={run} style={{ marginTop: 12 }} />

      {result === 'none' ? (
        <Card tone="teal" style={{ marginTop: 12 }}><T v="bodyB">Pick what you are seeing first.</T><T v="small">Then tap again.</T></Card>
      ) : result === 'red' ? (
        <Card tone="red" style={{ marginTop: 12 }}>
          <T v="label" style={{ color: C.red }}>Emergency</T>
          <T v="h3" style={{ marginBottom: 6 }}>Call 108 now. Do not wait.</T>
          <T v="small" style={{ color: C.ink }}>Keep {first} sitting upright and calm. Don't give any new medicine unless the doctor's plan says so. We can send the discharge summary to the ER you are heading to, so they are ready.</T>
          <Btn v="red" title="Call 108" onPress={call108} style={{ marginTop: 10 }} />
          <Btn v="ghost" title={erSent ? 'Summary sent ✓' : 'Send summary to the ER'} disabled={erSent} onPress={() => { setErSent(true); toast(`The ER can now see ${first}'s discharge summary and medicines through a secure link (demo).`); }} style={{ marginTop: 8 }} />
        </Card>
      ) : result === 'amber' ? (
        <Card tone="amber" style={{ marginTop: 12 }}>
          <T v="label">Needs a doctor today</T>
          <T v="h3" style={{ marginBottom: 6 }}>Speak to a doctor within the hour.</T>
          <T v="small" style={{ color: C.ink }}>Recheck BP and pulse now. If anything gets worse, treat it as an emergency.</T>
          <Btn title="Video call a doctor now" onPress={() => toast('Video consultations are coming soon.')} style={{ marginTop: 10 }} />
        </Card>
      ) : result === 'green' ? (
        <Card tone="teal" style={{ marginTop: 12 }}>
          <T v="label" style={{ color: C.tealDeep }}>Monitor at home</T>
          <T v="h3" style={{ marginBottom: 6 }}>Rest, and ask the nurse.</T>
          <T v="small" style={{ color: C.ink }}>Log a BP reading, take medicines on time, and message the nurse. Escalate if new symptoms appear.</T>
          <Btn v="teal" title="Message the nurse" onPress={() => toast('Chat with the nurse is coming soon.')} style={{ marginTop: 10 }} />
        </Card>
      ) : null}

      <T v="sect">Always available</T>
      {[
        { ic: '108', tone: 'red' as const, t: 'Ambulance', s: "Or your hospital's ambulance", go: call108 },
        { ic: 'VC', tone: 'blue' as const, t: 'Video call a doctor', s: 'Home Konnect partner doctor · about 5 min wait', go: () => toast('Video consultations are coming soon.') },
        { ic: 'RN', tone: 'amber' as const, t: 'Ask the nurse', s: 'Reply within 10 minutes', go: () => toast('Chat with the nurse is coming soon.') },
      ].map((r) => (
        <Card key={r.t} onPress={r.go}>
          <Row><Ic label={r.ic} tone={r.tone} /><Grow><T v="bodyB">{r.t}</T><T v="small">{r.s}</T></Grow></Row>
        </Card>
      ))}
      <View><T v="small">This is guidance, not a diagnosis. If you are unsure, treat it as an emergency.</T></View>
    </Screen>
  );
}
