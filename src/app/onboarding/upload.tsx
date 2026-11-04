import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DocThumb } from '@/components/doc-thumb';
import { Btn, Card, Ic, Row, Screen, Sub, T } from '@/components/ui';
import { useStore } from '@/state/store';
import { C, F } from '@/theme';

const STEPS = ['Finding diagnosis and doctor', 'Reading medicines and timings', 'Finding follow-up and warning signs', 'Building your recovery plan'];

/**
 * Pick a photo or PDF of the discharge summary. Reading is SIMULATED for now:
 * the review screen always shows the sample extraction. Real OCR + extraction is the next backend task.
 */
export default function Upload() {
  const [file, setFile] = useState<string | null>(null);
  const [done, setDone] = useState(0);
  const startReview = useStore((s) => s.startReview);
  const skip = useStore((s) => s.skipSummary);
  const toast = useStore((s) => s.showToast);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const scan = (name: string) => {
    setFile(name.length > 30 ? name.slice(0, 27) + '…' : name);
    setDone(0);
    startReview();
    STEPS.forEach((_, i) => timers.current.push(setTimeout(() => setDone(i + 1), 650 * (i + 1))));
    timers.current.push(setTimeout(() => { router.push('/onboarding/review'); setFile(null); }, 650 * 4 + 700));
  };

  const camera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { toast('Camera access is off. You can upload a file instead.'); return; }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!r.canceled && r.assets[0]) scan(r.assets[0].fileName ?? 'Discharge summary photo.jpg');
  };
  const upload = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
    if (!r.canceled && r.assets[0]) scan(r.assets[0].name);
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
              <T v="small">{done === 4 ? "Done. Let's check it together." : 'Reading your document…'}</T>
            </View>
          </Row>
          <View style={s.bar}><View style={[s.barFill, { width: `${done * 25}%` }]} /></View>
          {STEPS.map((st, i) => (
            <Row key={st} gap={10} style={{ paddingVertical: 7 }}>
              <View style={[s.sd, i < done && { backgroundColor: C.teal, borderColor: C.teal }]}>
                {i < done ? <Text style={{ color: '#fff', fontSize: 10, fontFamily: F.bold }}>✓</Text> : null}
              </View>
              <Text style={{ fontFamily: F.regular, fontSize: 13.5, color: i < done ? C.ink : C.muted }}>{st}</Text>
            </Row>
          ))}
        </Card>
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
          <T v="small">Lay the pages flat in good light.</T>
        </View>
      </Pressable>
      <Pressable style={s.tile} onPress={upload} accessibilityRole="button" accessibilityLabel="Upload a PDF or image">
        <Ic label="PDF" tone="blue" size={46} />
        <View style={{ flex: 1 }}>
          <T v="bodyB">Upload a PDF or image</T>
          <T v="small">From your phone, email or WhatsApp downloads.</T>
        </View>
      </Pressable>
      <Card tone="teal" style={{ marginTop: 4 }}>
        <T v="small" style={{ color: C.ink }}>
          <Text style={{ fontFamily: F.bold }}>Private. </Text>
          Your document stays in your account. A provider sees it only if you switch sharing on for that booking.
        </T>
      </Card>
      <Btn v="ghost" title="Try with a sample summary" onPress={() => scan('Sample discharge summary.pdf')} style={{ marginTop: 10 }} />
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
