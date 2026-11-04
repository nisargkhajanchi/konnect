import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { DocThumb } from '@/components/doc-thumb';
import { Between, Btn, Card, Grow, LinkText, Pill, Row, Screen, Sub, T, TaskRow, Toggle } from '@/components/ui';
import { DOCTOR_LIMITS, PATIENT } from '@/data/demo';
import { useStore } from '@/state/store';
import { C, F } from '@/theme';

/** The family confirms what was read before anything is saved. Low-confidence items block the build. */
export default function Review() {
  const meds = useStore((s) => s.reviewMeds);
  const confirmMed = useStore((s) => s.confirmMed);
  const renameMed = useStore((s) => s.renameMed);
  const removeMed = useStore((s) => s.removeMed);
  const buildPlan = useStore((s) => s.buildPlan);
  const toast = useStore((s) => s.showToast);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [remind, setRemind] = useState(true);

  const pending = meds.filter((m) => !m.ok).length;
  const blocked = pending > 0 || editing !== null;

  const build = () => {
    buildPlan();
    router.dismissTo('/(tabs)/today');
    toast('Your plan is ready: medicines, reminders, follow-up and warning signs.');
  };

  return (
    <Screen
      dock={<Btn v="teal" title={pending ? `Confirm the highlighted item${pending > 1 ? 's' : ''} first` : 'Looks right. Build my plan'} disabled={blocked} onPress={build} />}>
      <T v="h2">Is this right?</T>
      <Sub>Please confirm. Your plan is built only from what is in your document.</Sub>
      <Card>
        <Row>
          <DocThumb />
          <Grow>
            <T v="bodyB">Discharge summary</T>
            <T v="small">{PATIENT.hospital} · discharged {PATIENT.discharged}</T>
          </Grow>
          <Pill label="Read clearly" />
        </Row>
      </Card>

      <T v="sect">Patient and diagnosis</T>
      <Card>
        <T v="small">Patient</T>
        <T v="bodyB" style={{ marginBottom: 8 }}>{PATIENT.name}, {PATIENT.age}</T>
        <T v="small">Diagnosis</T>
        <T v="bodyB">{PATIENT.condition}</T>
      </Card>

      <T v="sect">Medicines · {meds.length}</T>
      <Card>
        {meds.map((m) => (
          <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.rowLine }}>
            {editing === m.id ? (
              <>
                <Grow>
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    autoFocus
                    accessibilityLabel="Medicine name"
                    style={{ borderWidth: 1, borderColor: C.amber, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 7, fontFamily: F.regular, fontSize: 14, color: C.ink }}
                  />
                  <T v="small" style={{ marginTop: 5 }}>{m.time}</T>
                </Grow>
                <LinkText title="Save" onPress={() => { if (draft.trim()) renameMed(m.id, draft.trim()); else confirmMed(m.id); setEditing(null); }} />
              </>
            ) : (
              <>
                <Grow>
                  <T v="bodyB" style={{ fontSize: 13.5 }}>{m.name}</T>
                  <T v="small">{m.time}</T>
                  {!m.ok ? <Text style={{ fontFamily: F.semibold, fontSize: 12, color: C.amberDeep, marginTop: 3 }}>Check this: {m.why}</Text> : null}
                </Grow>
                {m.ok ? (
                  <Row gap={8}>
                    <Pill label="Confirmed" />
                    <Pressable accessibilityLabel={`Remove ${m.name}`} onPress={() => removeMed(m.id)} hitSlop={8} style={{ width: 28, height: 28, borderRadius: 8, borderWidth: 1, borderColor: C.stroke, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: C.muted, fontSize: 15 }}>×</Text>
                    </Pressable>
                  </Row>
                ) : (
                  <View style={{ alignItems: 'flex-end', gap: 8 }}>
                    <LinkText title="Looks right" onPress={() => confirmMed(m.id)} />
                    <LinkText title="Edit" color={C.muted} onPress={() => { setDraft(m.name); setEditing(m.id); }} />
                  </View>
                )}
              </>
            )}
          </View>
        ))}
        <View style={{ paddingTop: 10 }}>
          <LinkText title="+ Add a medicine we missed" onPress={() => toast('Add a medicine by typing its name or photographing the strip (coming soon).')} />
        </View>
      </Card>

      <T v="sect">Follow-up</T>
      <Card>
        <Between>
          <Grow>
            <T v="bodyB" style={{ fontSize: 13.5 }}>{PATIENT.followUp.dept} · {PATIENT.doctor}</T>
            <T v="small">{PATIENT.followUp.when} · {PATIENT.followUp.where}</T>
          </Grow>
          <Toggle value={remind} onChange={setRemind} />
        </Between>
        <T v="small" style={{ marginTop: 6 }}>Remind me a day before and on the morning.</T>
      </Card>

      <T v="sect">Doctor's limits and warning signs</T>
      <Card>
        {DOCTOR_LIMITS.map((l, i) => <TaskRow key={l.t} title={l.t} sub={l.src} done={false} left={<Pill label="Read" tone="grey" />} last={i === DOCTOR_LIMITS.length - 1} />)}
      </Card>
      <T v="small" style={{ textAlign: 'center' }}>Home Konnect never changes your doctor's instructions. If something looks wrong, edit it or talk to your doctor.</T>
    </Screen>
  );
}
