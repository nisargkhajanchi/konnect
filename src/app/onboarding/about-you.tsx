import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Btn, ChoiceChips, Field, FieldLabel, Screen, Sub, T } from '@/components/ui';
import { useStore } from '@/state/store';

const RELATIONS = ['Son', 'Daughter', 'Spouse', 'Parent', 'Sibling', 'Grandchild', 'Myself', 'Other'] as const;
type Relation = (typeof RELATIONS)[number];

/** Asks the signed-in family member who they are. Shown once after the first sign-in, and from More to edit. */
export default function AboutYou() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const me = useStore((s) => s.me);
  const hasSummary = useStore((s) => s.hasSummary);
  const saveMe = useStore((s) => s.saveMe);
  const [name, setName] = useState(me.name ?? '');
  const known = RELATIONS.find((r) => r === me.relation);
  const [relation, setRelation] = useState<Relation>(known ?? (me.relation ? 'Other' : 'Son'));
  const [other, setOther] = useState(known || !me.relation ? '' : me.relation);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const ok = await saveMe(name, relation === 'Other' ? other : relation);
    setBusy(false);
    if (!ok) return;
    if (edit) router.back();
    else router.replace(hasSummary ? '/(tabs)/today' : '/onboarding/upload');
  };

  return (
    <Screen dock={<Btn title={busy ? 'Saving…' : edit ? 'Save' : 'Continue'} disabled={busy || !name.trim()} onPress={save} />}>
      <T v="h2">About you</T>
      <Sub>So the care team and your family know who is updating the plan. Your number is never shown to caregivers.</Sub>
      <Field label="Your name" value={name} onChangeText={setName} placeholder="For example: Kiran Patel" autoCapitalize="words" textContentType="name" autoFocus={!edit} />
      <FieldLabel>You are the patient's…</FieldLabel>
      <ChoiceChips options={RELATIONS} value={relation} onChange={setRelation} />
      {relation === 'Other' ? (
        <View style={{ marginTop: 14 }}>
          <Field label="Relation" value={other} onChangeText={setOther} placeholder="For example: Neighbour, caregiver" />
        </View>
      ) : null}
    </Screen>
  );
}
