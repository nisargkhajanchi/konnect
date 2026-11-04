import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { DocThumb } from '@/components/doc-thumb';
import { Banner, Between, Btn, Card, Field, Grow, LinkText, Pill, Row, Screen, Sub, T, TaskRow, Toggle } from '@/components/ui';
import { followUpFrom, medLabel, shortDate } from '@/logic/plan';
import { useStore } from '@/state/store';
import { C, F } from '@/theme';

/** The family confirms what was read before anything is saved. Low-confidence medicines block the build. */
export default function Review() {
  const review = useStore((s) => s.review);
  const confirmMed = useStore((s) => s.confirmReviewMed);
  const renameMed = useStore((s) => s.renameReviewMed);
  const removeMed = useStore((s) => s.removeReviewMed);
  const addMed = useStore((s) => s.addReviewMed);
  const setText = useStore((s) => s.setReviewText);
  const buildPlan = useStore((s) => s.buildPlan);
  const busy = useStore((s) => s.busy);
  const toast = useStore((s) => s.showToast);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [remind, setRemind] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newMed, setNewMed] = useState({ name: '', strength: '', timing: '' });

  if (!review) {
    return (
      <Screen>
        <T v="h2">Nothing to review</T>
        <Btn title="Add a discharge summary" onPress={() => router.replace('/onboarding/upload')} />
      </Screen>
    );
  }
  const e = review.extraction;
  const pending = e.medicines.filter((m) => m.confidence === 'low').length;
  const manual = review.fileName === 'Typed in by hand';
  const notSummary = !e.is_discharge_summary;
  const blocked = pending > 0 || editing !== null || adding || !!busy || notSummary || (manual && !e.medicines.length);
  const fu = e.follow_ups.map(followUpFrom).filter((x) => x !== null);

  const build = async () => {
    if (await buildPlan()) {
      router.dismissTo('/(tabs)/today');
      toast('Your plan is ready: medicines, reminders, follow-up and warning signs.');
    }
  };

  const lists: [string, { text: string; source_page: number | null }[]][] = [
    ['Doctor’s limits', e.limits],
    ['Go to hospital straight away if', e.warning_signs],
    ['Allergies', e.allergies],
    ['Diet and activity', e.diet_activity],
  ];

  return (
    <Screen
      dock={
        <View>
          {busy ? <Row gap={8} style={{ justifyContent: 'center', marginBottom: 8 }}><ActivityIndicator color={C.teal} /><T v="small">{busy}</T></Row> : null}
          <Btn
            v="teal"
            title={notSummary ? 'This is not a discharge summary' : pending ? `Confirm the highlighted item${pending > 1 ? 's' : ''} first` : 'Looks right. Build my plan'}
            disabled={blocked}
            onPress={build}
          />
        </View>
      }>
      <Stack.Screen options={{ title: manual ? 'Type in details' : 'Check what we read' }} />
      <T v="h2">{manual ? 'Type in the discharge details' : 'Is this right?'}</T>
      <Sub>{manual ? 'Copy them from the discharge summary. Add each medicine exactly as written.' : 'Please confirm. Your plan is built only from what is in your document.'}</Sub>
      {!manual ? <Card>
        <Row>
          <DocThumb />
          <Grow>
            <T v="bodyB" numberOfLines={1}>{review.fileName}</T>
            <T v="small">{[e.hospital.name, e.hospital.discharge_date ? `discharged ${shortDate(e.hospital.discharge_date)}` : null].filter(Boolean).join(' · ') || 'Hospital not found'}</T>
          </Grow>
          <Pill label={e.legibility === 'clear' ? 'Read clearly' : e.legibility === 'unreadable' ? 'Hard to read' : 'Partly unclear'} tone={e.legibility === 'clear' ? 'teal' : 'amber'} />
        </Row>
      </Card> : null}
      {notSummary ? <Banner tone="red" text="This does not look like a discharge summary. Go back and choose the summary the hospital gave you." onPress={() => router.back()} /> : null}
      {e.legibility === 'unreadable' ? <Banner tone="amber" text="Most of this document was hard to read. Try a clearer photo in good light, or the PDF from the hospital." /> : null}

      <T v="sect">Patient and diagnosis</T>
      <Card>
        <Field label={`Patient${e.patient.age ? ` (age ${e.patient.age})` : ''}`} value={e.patient.name ?? ''} onChangeText={(v) => setText('patient', v)} placeholder="Full name" />
        <Field label="Hospital" value={e.hospital.name ?? ''} onChangeText={(v) => setText('hospital', v)} placeholder="Hospital name" />
        <Field label="Diagnosis" value={e.diagnosis.text ?? ''} onChangeText={(v) => setText('diagnosis', v)} placeholder="As written on the summary" multiline style={{ minHeight: 48 }} />
        {e.diagnosis.text && e.diagnosis.confidence === 'low' ? <Text style={{ fontFamily: F.semibold, fontSize: 12, color: C.amberDeep, marginTop: -6 }}>Partly unclear. Check it against the document.</Text> : null}
        {e.treating_doctor ? <T v="small">Doctor: {e.treating_doctor}</T> : null}
      </Card>

      <T v="sect">Medicines · {e.medicines.length}</T>
      <Card>
        {e.medicines.map((m, i) => (
          <View key={`${m.name}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.rowLine }}>
            {editing === i ? (
              <>
                <Grow>
                  <TextInput
                    value={draft} onChangeText={setDraft} autoFocus accessibilityLabel="Medicine name and strength"
                    style={{ borderWidth: 1, borderColor: C.amber, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 7, fontFamily: F.regular, fontSize: 14, color: C.ink }}
                  />
                  <T v="small" style={{ marginTop: 5 }}>{m.timing}</T>
                </Grow>
                <LinkText title="Save" onPress={() => { if (draft.trim()) renameMed(i, draft.trim()); else confirmMed(i); setEditing(null); }} />
              </>
            ) : (
              <>
                <Grow>
                  <T v="bodyB" style={{ fontSize: 13.5 }}>{medLabel(m)}</T>
                  <T v="small">{[m.timing, m.frequency, m.duration].filter(Boolean).join(' · ')}</T>
                  {m.instructions ? <T v="small">{m.instructions}</T> : null}
                  {m.confidence === 'low' ? <Text style={{ fontFamily: F.semibold, fontSize: 12, color: C.amberDeep, marginTop: 3 }}>Check this: {m.uncertainty_reason}</Text> : null}
                </Grow>
                {m.confidence === 'high' ? (
                  <Row gap={8}>
                    <Pill label="Confirmed" />
                    <Pressable accessibilityLabel={`Remove ${m.name}`} onPress={() => removeMed(i)} hitSlop={8} style={{ width: 28, height: 28, borderRadius: 8, borderWidth: 1, borderColor: C.stroke, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: C.muted, fontSize: 15 }}>×</Text>
                    </Pressable>
                  </Row>
                ) : (
                  <View style={{ alignItems: 'flex-end', gap: 8 }}>
                    <LinkText title="Looks right" onPress={() => confirmMed(i)} />
                    <LinkText title="Edit" color={C.muted} onPress={() => { setDraft(medLabel(m)); setEditing(i); }} />
                  </View>
                )}
              </>
            )}
          </View>
        ))}
        {!e.medicines.length && !adding ? <T v="small" style={{ paddingVertical: 8 }}>{manual ? 'No medicines added yet.' : 'No medicines found in this document.'}</T> : null}
        {adding ? (
          <View style={{ paddingTop: 12 }}>
            <Field label="Medicine name" value={newMed.name} onChangeText={(v) => setNewMed({ ...newMed, name: v })} placeholder="For example: Metoprolol" autoFocus />
            <Field label="Strength" value={newMed.strength} onChangeText={(v) => setNewMed({ ...newMed, strength: v })} placeholder="For example: 25 mg" />
            <Field label="When to take it" value={newMed.timing} onChangeText={(v) => setNewMed({ ...newMed, timing: v })} placeholder="For example: Morning and night, after food" />
            <Row gap={8}>
              <Btn small v="teal" title="Add medicine" disabled={!newMed.name.trim()} style={{ flex: 1 }}
                onPress={() => { addMed({ name: newMed.name.trim(), strength: newMed.strength.trim(), timing: newMed.timing.trim() }); setNewMed({ name: '', strength: '', timing: '' }); setAdding(false); }} />
              <Btn small v="ghost" title="Cancel" style={{ flex: 1 }} onPress={() => setAdding(false)} />
            </Row>
          </View>
        ) : (
          <View style={{ paddingTop: 10 }}>
            <LinkText title={manual ? '+ Add a medicine' : '+ Add a medicine we missed'} onPress={() => setAdding(true)} />
          </View>
        )}
      </Card>

      <T v="sect">Follow-up</T>
      <Card>
        {fu.length ? fu.map((f, i) => (
          <Between key={i} style={{ paddingVertical: 4 }}>
            <Grow>
              <T v="bodyB" style={{ fontSize: 13.5 }}>{f.dept}{e.follow_ups[i].doctor ? ` · ${e.follow_ups[i].doctor}` : ''}</T>
              <T v="small">{[f.when, f.where].filter(Boolean).join(' · ')}</T>
            </Grow>
            {i === 0 ? <Toggle value={remind} onChange={setRemind} /> : null}
          </Between>
        )) : <T v="small">No follow-up appointment found.</T>}
        {fu.length ? <T v="small" style={{ marginTop: 6 }}>Remind me a day before and on the morning.</T> : null}
      </Card>

      {lists.map(([title, items]) => items.length ? (
        <View key={title}>
          <T v="sect">{title}</T>
          <Card>
            {items.map((x, i) => <TaskRow key={x.text + i} title={x.text} sub={x.source_page ? `Page ${x.source_page}` : undefined} last={i === items.length - 1} />)}
          </Card>
        </View>
      ) : null)}

      <T v="small" style={{ textAlign: 'center' }}>Home Konnect never changes your doctor's instructions. If something looks wrong, edit it or talk to your doctor.</T>
    </Screen>
  );
}
