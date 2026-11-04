import * as Print from 'expo-print';
import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Share, View } from 'react-native';

import { Banner, Between, Btn, Card, ChoiceChips, Field, Grow, Row, Screen, Sub, T, Toggle } from '@/components/ui';
import { PATIENT } from '@/data/demo';
import { buildSummary, PERIODS, SUM_SECTIONS, type Period, type SumKey } from '@/logic/summary';
import { useStore } from '@/state/store';

const ALL_ON = Object.fromEntries(SUM_SECTIONS.map((x) => [x.k, true])) as Record<SumKey, boolean>;

export default function DoctorSummary() {
  const { saved } = useLocalSearchParams<{ saved?: string }>();
  const savedCopy = useStore((s) => (saved != null ? s.summaries[Number(saved)] : undefined));
  const saveSummary = useStore((s) => s.saveSummary);

  const [period, setPeriod] = useState<Period>('all');
  const [inc, setInc] = useState(ALL_ON);
  const [showOpts, setShowOpts] = useState(false);
  const [doctor, setDoctor] = useState(`${PATIENT.doctor}, ${PATIENT.hospital}`);
  const [reason, setReason] = useState(`${PATIENT.followUp.dept} follow-up, 28 Oct`);
  const [qs, setQs] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [useSaved, setUseSaved] = useState(!!savedCopy);

  const nOn = Object.values(inc).filter(Boolean).length;
  const periodLabel = PERIODS.find((p) => p.k === period)!.label;

  const build = () => {
    if (useSaved && savedCopy) return savedCopy;
    const b = buildSummary(useStore.getState(), {
      period, inc, doctor: doctor.trim(), reason: reason.trim(),
      questions: qs.split(/\n+/).map((x) => x.trim()).filter(Boolean),
    });
    saveSummary(b);
    return b;
  };
  const changed = () => { setUseSaved(false); setMsg(null); };

  const preview = async () => {
    try { await Print.printAsync({ html: build().html }); } catch { setMsg('Could not open the preview on this device.'); }
  };
  const pdf = async () => {
    try {
      const b = build();
      const { uri } = await Print.printToFileAsync({ html: b.html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Home care summary' });
      }
      setMsg('PDF ready. Save it to Files or send it by WhatsApp or email. A copy is saved in Records.');
    } catch { setMsg('Could not create the PDF on this device.'); }
  };
  const text = async () => {
    const b = build();
    try { await Share.share({ message: b.text, title: 'Home care summary' }); setMsg('Shared as text. A copy is saved in Records.'); } catch { /* cancelled */ }
  };

  return (
    <Screen
      dock={
        <View>
          {msg ? <Banner text={msg} /> : null}
          <Btn title="Save or send as PDF" onPress={pdf} />
          <Row gap={8} style={{ marginTop: 8 }}>
            <Btn v="ghost" small title="Preview" onPress={preview} style={{ flex: 1 }} />
            <Btn v="ghost" small title="Share as text" onPress={text} style={{ flex: 1 }} />
          </Row>
        </View>
      }>
      <T v="label">For your doctor</T>
      <T v="h2">Summary for the next visit</T>
      <Sub>Services given at home and health updates in one document. Take it to the appointment as a PDF or on paper.</Sub>
      {useSaved && savedCopy ? <Banner tone="amber" text={`Showing the copy saved at ${savedCopy.when}. Change an option to build a fresh one.`} /> : null}

      <Card>
        <T v="label">Covers</T>
        <ChoiceChips options={PERIODS.map((p) => p.label)} value={periodLabel} onChange={(l) => { setPeriod(PERIODS.find((p) => p.label === l)!.k); changed(); }} />
      </Card>

      <Card onPress={() => setShowOpts((v) => !v)} accessibilityLabel="Choose what to include">
        <Between>
          <T v="bodyB">Choose what to include <T v="small">· {nOn === SUM_SECTIONS.length ? `all ${nOn} on` : `${nOn} of ${SUM_SECTIONS.length} on`}</T></T>
          <T v="bodyB" style={{ color: '#A5611E', fontSize: 12.5 }}>{showOpts ? 'Hide' : 'Show'}</T>
        </Between>
      </Card>
      {showOpts ? (
        <Card style={{ marginTop: -6 }}>
          {SUM_SECTIONS.map((x) => (
            <Between key={x.k} style={{ paddingVertical: 8 }}>
              <Grow><T v="bodyB" style={{ fontSize: 13.5 }}>{x.t}</T><T v="small">{x.s}</T></Grow>
              <Toggle value={inc[x.k]} onChange={(v) => { setInc({ ...inc, [x.k]: v }); changed(); }} />
            </Between>
          ))}
        </Card>
      ) : null}

      <Field label="Doctor or clinic (optional)" value={doctor} onChangeText={(v) => { setDoctor(v); changed(); }} />
      <Field label="Reason for the visit (optional)" value={reason} onChangeText={(v) => { setReason(v); changed(); }} />
      <Field
        label="Your questions for the doctor (optional)"
        value={qs}
        onChangeText={(v) => { setQs(v); changed(); }}
        multiline
        placeholder="One per line. For example: Can walking be increased? Is the dizziness in the evening from the tablets?"
      />
      <Card tone="teal">
        <T v="bodyB" style={{ fontSize: 13 }}>You decide who sees this</T>
        <T v="small">Home Konnect does not send it to anyone. Billing, amounts and phone numbers are never included. Each copy you make is saved in Records.</T>
      </Card>
      <T v="small">Readings from home devices are for the doctor's information and are not a diagnosis.</T>
    </Screen>
  );
}
