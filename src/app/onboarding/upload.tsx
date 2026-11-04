import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { DocThumb } from '@/components/doc-thumb';
import { Banner, Btn, Card, Ic, Row, Screen, Sub, T } from '@/components/ui';
import { needsReview } from '@shared/extraction';
import { SAMPLE_EXTRACTION } from '@/data/demo';
import * as api from '@/lib/api';
import { useStore } from '@/state/store';
import { C, F } from '@/theme';

const DEMO_STEPS = ['Finding diagnosis and doctor', 'Reading medicines and timings', 'Finding follow-up and warning signs', 'Building your recovery plan'];
const LIVE_STEPS = ['Uploading privately to your account', 'Reading the document (up to a minute)', 'Ready for you to check'];

type Picked = { uri: string; name: string; mimeType?: string };

/**
 * Pick a photo or PDF of the discharge summary.
 * Live mode uploads it and runs the reader; demo mode shows the sample result.
 */
export default function Upload() {
  const live = useStore((s) => s.live);
  const setReview = useStore((s) => s.setReview);
  const loadFamily = useStore((s) => s.loadFamily);
  const skip = useStore((s) => s.skipSummary);
  const toast = useStore((s) => s.showToast);
  const [file, setFile] = useState<string | null>(null);
  const [done, setDone] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<Picked | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const shortName = (n: string) => (n.length > 30 ? n.slice(0, 27) + '…' : n);

  const runDemo = (name: string) => {
    setFile(shortName(name)); setDone(0); setError(null);
    DEMO_STEPS.forEach((_, i) => timers.current.push(setTimeout(() => setDone(i + 1), 650 * (i + 1))));
    timers.current.push(setTimeout(() => {
      setReview({ documentId: null, fileName: name, extraction: SAMPLE_EXTRACTION, notes: needsReview(SAMPLE_EXTRACTION) });
      router.push('/onboarding/review');
      setFile(null);
    }, 650 * 4 + 700));
  };

  const runLive = async (p: Picked) => {
    setFile(shortName(p.name)); setDone(0); setError(null); setLast(p);
    try {
      let pid = useStore.getState().patient.id;
      if (!pid) { await loadFamily(); pid = useStore.getState().patient.id; }
      if (!pid) throw new Error('Could not set up your account. Please sign in again.');
      const docId = await api.uploadDocument(pid, p.uri, p.mimeType, p.name);
      setDone(1);
      const r = await api.readSummary(docId);
      setDone(3);
      setReview({ documentId: docId, fileName: p.name, extraction: r.extraction, notes: r.needs_review });
      router.push('/onboarding/review');
      setFile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    }
  };

  const handle = (p: Picked) => (live ? runLive(p) : runDemo(p.name));

  const camera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { toast('Camera access is off. You can upload a file instead.'); return; }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 });
    const a = r.canceled ? null : r.assets[0];
    if (a) handle({ uri: a.uri, name: a.fileName ?? 'Discharge summary photo.jpg', mimeType: a.mimeType ?? 'image/jpeg' });
  };
  const photo = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], quality: 0.85,
      // iPhone photos are often HEIC, which the reader cannot open; ask iOS for a JPEG copy.
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    const a = r.canceled ? null : r.assets[0];
    if (a) handle({ uri: a.uri, name: a.fileName ?? 'Discharge summary photo.jpg', mimeType: a.mimeType ?? 'image/jpeg' });
  };
  const pdf = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png'], copyToCacheDirectory: true });
    const a = r.canceled ? null : r.assets[0];
    if (a) handle({ uri: a.uri, name: a.name, mimeType: a.mimeType });
  };

  if (file) {
    const steps = live ? LIVE_STEPS : DEMO_STEPS;
    return (
      <Screen>
        <T v="label">Reading your document</T>
        <Card>
          <Row>
            <DocThumb />
            <View style={{ flex: 1 }}>
              <T v="bodyB">{file}</T>
              <T v="small">{error ? 'Could not finish' : done >= steps.length - 1 && live ? "Done. Let's check it together." : 'Reading your document…'}</T>
            </View>
            {!error && done < steps.length ? <ActivityIndicator color={C.teal} /> : null}
          </Row>
          <View style={s.bar}><View style={[s.barFill, { width: `${(done / steps.length) * 100}%` }]} /></View>
          {steps.map((st, i) => (
            <Row key={st} gap={10} style={{ paddingVertical: 7 }}>
              <View style={[s.sd, i < done && { backgroundColor: C.teal, borderColor: C.teal }]}>
                {i < done ? <Text style={{ color: '#fff', fontSize: 10, fontFamily: F.bold }}>✓</Text> : null}
              </View>
              <Text style={{ fontFamily: F.regular, fontSize: 13.5, color: i < done ? C.ink : C.muted }}>{st}</Text>
            </Row>
          ))}
        </Card>
        {error ? (
          <>
            <Banner tone="red" text={error} />
            {last ? <Btn title="Try again" onPress={() => runLive(last)} /> : null}
            <Btn v="ghost" title="Choose a different file" onPress={() => { setFile(null); setError(null); }} style={{ marginTop: 10 }} />
          </>
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen>
      <T v="label">Set up · 1 minute</T>
      <T v="h2">Add your discharge summary</T>
      <Sub>From any hospital. We read it and build your recovery plan, medicines and reminders. You check everything before it is saved.</Sub>
      <Pressable style={s.tile} onPress={camera} accessibilityRole="button" accessibilityLabel="Take a photo of the discharge summary">
        <Ic label="CAM" tone="amber" size={46} />
        <View style={{ flex: 1 }}>
          <T v="bodyB">Take a photo</T>
          <T v="small">Lay the page flat in good light.</T>
        </View>
      </Pressable>
      <Pressable style={s.tile} onPress={photo} accessibilityRole="button" accessibilityLabel="Choose a photo from your library">
        <Ic label="IMG" tone="teal" size={46} />
        <View style={{ flex: 1 }}>
          <T v="bodyB">Choose a photo</T>
          <T v="small">From your gallery or WhatsApp images.</T>
        </View>
      </Pressable>
      <Pressable style={s.tile} onPress={pdf} accessibilityRole="button" accessibilityLabel="Upload a PDF">
        <Ic label="PDF" tone="blue" size={46} />
        <View style={{ flex: 1 }}>
          <T v="bodyB">Upload a PDF</T>
          <T v="small">From your phone, email or WhatsApp downloads. Best for several pages.</T>
        </View>
      </Pressable>
      <Card tone="teal" style={{ marginTop: 4 }}>
        <T v="small" style={{ color: C.ink }}>
          <Text style={{ fontFamily: F.bold }}>Private. </Text>
          Your document stays in your account. A provider sees your plan only if you switch sharing on for a booking.
        </T>
      </Card>
      {!live ? <Btn v="ghost" title="Try with a sample summary" onPress={() => runDemo('Sample discharge summary.pdf')} style={{ marginTop: 10 }} /> : null}
      <Btn
        v="ghost"
        title="I don't have it with me. Start without one"
        onPress={() => { skip(); router.replace('/(tabs)/today'); toast('No problem. Add your summary anytime from Health, then Records.'); }}
        style={{ marginTop: 10 }}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  tile: { flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: '#fff', borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#D9C9AD', borderRadius: 16, padding: 15, marginBottom: 10 },
  bar: { height: 4, borderRadius: 4, backgroundColor: '#EFE6D6', overflow: 'hidden', marginTop: 10, marginBottom: 6 },
  barFill: { height: '100%', backgroundColor: C.teal },
  sd: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: C.stroke, alignItems: 'center', justifyContent: 'center' },
});
