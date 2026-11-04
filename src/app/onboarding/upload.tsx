import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { needsReview } from '@shared/extraction';
import { parseSummary } from '@shared/parse-summary';
import { DocThumb } from '@/components/doc-thumb';
import { Banner, Btn, Card, Ic, Row, Screen, Sub, T } from '@/components/ui';
import { EMPTY_EXTRACTION, SAMPLE_EXTRACTION } from '@/data/demo';
import * as api from '@/lib/api';
import { readPdfLines } from '@/lib/pdf-reader';
import { useStore } from '@/state/store';
import { C, F } from '@/theme';

type Picked = { uri: string; name: string; mimeType?: string };
const STEPS = ['Opening the PDF', 'Reading the text on your phone', 'Finding medicines, dates and warning signs'];
const isPdf = (p: Picked) => p.mimeType === 'application/pdf' || /\.pdf$/i.test(p.name);

/**
 * Add the discharge summary. PDFs are read on the device (no server, no AI) and the result goes to
 * the review screen. Photos and scans have no text, so the family types the details in.
 * In live mode a copy of the file is also saved to the patient's private records.
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
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const shortName = (n: string) => (n.length > 30 ? n.slice(0, 27) + '…' : n);

  const typeIn = (documentId: string | null = null) => {
    setFile(null); setError(null);
    setReview({ documentId, fileName: 'Typed in by hand', extraction: EMPTY_EXTRACTION, notes: [] });
    router.push('/onboarding/review');
  };

  /** Live mode: keep a private copy of the file with the patient's records. */
  const saveCopy = async (p: Picked): Promise<string | null> => {
    if (!live) return null;
    let pid = useStore.getState().patient.id;
    if (!pid) { await loadFamily(); pid = useStore.getState().patient.id; }
    if (!pid) throw new Error('Could not find your account. Please sign in again.');
    return api.uploadDocument(pid, p.uri, p.mimeType, p.name);
  };

  const handle = async (p: Picked) => {
    setFile(shortName(p.name)); setDone(0); setError(null);
    try {
      if (!isPdf(p)) {
        // Photos have no text layer: keep the photo (live) and type the details in.
        typeIn(await saveCopy(p));
        toast('Photos can’t be read automatically. Please type the details in.');
        return;
      }
      setDone(1);
      const lines = await readPdfLines(p.uri);
      setDone(2);
      if (!lines.length) {
        typeIn(await saveCopy(p));
        toast('This PDF is a scanned image with no text to read. Please type the details in.');
        return;
      }
      const extraction = parseSummary(lines);
      setDone(3);
      const docId = await saveCopy(p);
      setReview({ documentId: docId, fileName: p.name, extraction, notes: needsReview(extraction) });
      router.push('/onboarding/review');
      setFile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    }
  };

  const sample = () => {
    setFile('Sample discharge summary.pdf'); setDone(0); setError(null);
    STEPS.forEach((_, i) => timers.current.push(setTimeout(() => setDone(i + 1), 500 * (i + 1))));
    timers.current.push(setTimeout(() => {
      setReview({ documentId: null, fileName: 'Sample discharge summary.pdf', extraction: SAMPLE_EXTRACTION, notes: needsReview(SAMPLE_EXTRACTION) });
      router.push('/onboarding/review');
      setFile(null);
    }, 500 * STEPS.length + 400));
  };

  const pdf = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf'], copyToCacheDirectory: true });
    const a = r.canceled ? null : r.assets[0];
    if (a) handle({ uri: a.uri, name: a.name, mimeType: a.mimeType ?? 'application/pdf' });
  };
  const camera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { toast('Camera access is off. You can upload the PDF instead.'); return; }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 });
    const a = r.canceled ? null : r.assets[0];
    if (a) handle({ uri: a.uri, name: a.fileName ?? 'Discharge summary photo.jpg', mimeType: a.mimeType ?? 'image/jpeg' });
  };

  if (file) {
    return (
      <Screen>
        <T v="label">Reading your document</T>
        <Card>
          <Row>
            <DocThumb />
            <View style={{ flex: 1 }}>
              <T v="bodyB">{file}</T>
              <T v="small">{error ? 'Could not finish' : 'Reading on your phone. Nothing is sent anywhere.'}</T>
            </View>
            {!error && done < STEPS.length ? <ActivityIndicator color={C.teal} /> : null}
          </Row>
          <View style={s.bar}><View style={[s.barFill, { width: `${(done / STEPS.length) * 100}%` }]} /></View>
          {STEPS.map((st, i) => (
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
            <Btn title="Type the details in instead" onPress={() => typeIn()} />
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
      <Sub>From any hospital. We read it on your phone and build your recovery plan and medicine list. You check everything before it is saved.</Sub>
      <Pressable style={s.tile} onPress={pdf} accessibilityRole="button" accessibilityLabel="Upload the PDF">
        <Ic label="PDF" tone="blue" size={46} />
        <View style={{ flex: 1 }}>
          <T v="bodyB">Upload the PDF</T>
          <T v="small">From email or WhatsApp downloads. Read automatically, in seconds.</T>
        </View>
      </Pressable>
      <Pressable style={s.tile} onPress={camera} accessibilityRole="button" accessibilityLabel="Take a photo of the discharge summary">
        <Ic label="CAM" tone="amber" size={46} />
        <View style={{ flex: 1 }}>
          <T v="bodyB">Only have paper? Take a photo</T>
          <T v="small">Kept with your records. You type the details in.</T>
        </View>
      </Pressable>
      <Card tone="teal" style={{ marginTop: 4 }}>
        <T v="small" style={{ color: C.ink }}>
          <Text style={{ fontFamily: F.bold }}>Private. </Text>
          The PDF is read on your phone. A provider sees your plan only if you switch sharing on for a booking.
        </T>
      </Card>
      <Btn v="ghost" title="Type the details in" onPress={() => typeIn()} style={{ marginTop: 10 }} />
      {!live ? <Btn v="ghost" title="Try with a sample summary" onPress={sample} style={{ marginTop: 10 }} /> : null}
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
