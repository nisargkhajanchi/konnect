import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, Btn, Field, T } from '@/components/ui';
import { useStore } from '@/state/store';
import { C, F } from '@/theme';

/** Demo OTP login. Any 4 digits work; real OTP comes with the backend. */
export default function Login() {
  const [phone, setPhone] = useState('98765 43210');
  const [sent, setSent] = useState(false);
  const [otp, setOtp] = useState('4827');
  const setSignedIn = useStore((s) => s.setSignedIn);

  const next = () => {
    if (!sent) { setSent(true); return; }
    setSignedIn(true);
    router.replace('/onboarding/upload');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={{ flex: 1, padding: 18 }}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ marginBottom: 18 }}>
          <Text style={{ fontFamily: F.semibold, color: C.muted }}>← Back</Text>
        </Pressable>
        <Brand />
        <T v="h2" style={{ marginTop: 24 }}>Sign in with your mobile</T>
        <T v="small" style={{ marginBottom: 18 }}>We'll send a one-time password.</T>
        <Field label="Mobile number" keyboardType="phone-pad" value={phone} onChangeText={setPhone} textContentType="telephoneNumber" />
        {sent ? (
          <Field
            label="One-time password sent to your mobile"
            keyboardType="number-pad"
            maxLength={4}
            value={otp}
            onChangeText={setOtp}
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            style={{ fontFamily: F.monoBold, fontSize: 22, letterSpacing: 10, textAlign: 'center' }}
          />
        ) : null}
        <View style={{ flex: 1 }} />
        <Btn title={sent ? 'Verify and continue' : 'Send OTP'} onPress={next} disabled={sent ? otp.length !== 4 : phone.replace(/\D/g, '').length < 10} />
        <T v="small" style={{ textAlign: 'center', marginTop: 14 }}>
          No personal numbers are ever shared with caregivers. Calls and chats run through the app.
        </T>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
