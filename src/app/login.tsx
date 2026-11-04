import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Banner, Brand, Btn, Field, T } from '@/components/ui';
import * as api from '@/lib/api';
import { useStore } from '@/state/store';
import { C, F } from '@/theme';

/** Family sign-in by SMS one-time password. Demo mode accepts any 4 digits. */
export default function Login() {
  const live = useStore((s) => s.live);
  const setSignedIn = useStore((s) => s.setSignedIn);
  const loadFamily = useStore((s) => s.loadFamily);
  const [phone, setPhone] = useState(live ? '' : '98765 43210');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [otp, setOtp] = useState(live ? '' : '4827');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const otpLen = live ? 6 : 4;
  const e164 = api.toIndianE164(phone);

  const next = async () => {
    setErr(null);
    if (!live) {
      if (!sentTo) { setSentTo(phone); return; }
      setSignedIn(true);
      router.replace('/onboarding/upload');
      return;
    }
    setBusy(true);
    try {
      if (!sentTo) {
        if (!e164) throw new Error('Enter a 10-digit Indian mobile number.');
        await api.sendOtp(e164);
        setSentTo(e164);
      } else {
        await api.verifyOtp(sentTo, otp.trim());
        setSignedIn(true);
        if (!(await loadFamily())) return;
        // First sign-in goes to set-up; returning families go straight to Today.
        router.replace(useStore.getState().hasSummary ? '/(tabs)/today' : '/onboarding/upload');
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={{ flex: 1, padding: 18 }}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ marginBottom: 18 }}>
          <Text style={{ fontFamily: F.semibold, color: C.muted }}>← Back</Text>
        </Pressable>
        <Brand />
        <T v="h2" style={{ marginTop: 24 }}>Sign in with your mobile</T>
        <T v="small" style={{ marginBottom: 18 }}>{sentTo ? `We sent a code to ${sentTo}.` : "We'll send a one-time password."}</T>
        <Field label="Mobile number" keyboardType="phone-pad" value={phone} onChangeText={(v) => { setPhone(v); setSentTo(null); }} textContentType="telephoneNumber" placeholder="98765 43210" />
        {sentTo ? (
          <Field
            label="One-time password"
            keyboardType="number-pad"
            maxLength={otpLen}
            value={otp}
            onChangeText={setOtp}
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            autoFocus
            style={{ fontFamily: F.monoBold, fontSize: 22, letterSpacing: 10, textAlign: 'center' }}
          />
        ) : null}
        {err ? <Banner tone="red" text={err} /> : null}
        <View style={{ flex: 1 }} />
        <Btn
          title={busy ? 'Please wait…' : sentTo ? 'Verify and continue' : 'Send OTP'}
          onPress={next}
          disabled={busy || (sentTo ? otp.trim().length !== otpLen : live ? !e164 : phone.replace(/\D/g, '').length < 10)}
        />
        <T v="small" style={{ textAlign: 'center', marginTop: 14 }}>
          No personal numbers are ever shared with caregivers. Calls and chats run through the app.
        </T>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
