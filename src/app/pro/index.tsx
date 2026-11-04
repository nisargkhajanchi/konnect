import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Banner, Btn, ChoiceChips, Field, FieldLabel, Row, T } from '@/components/ui';
import * as api from '@/lib/api';
import { PRO_ROLE_KEY, PRO_ROLES, useStore, type ProRole } from '@/state/store';
import { C, F } from '@/theme';

/**
 * Provider sign-in. Live mode: phone OTP, then (first time only) the organisation's join code.
 * Demo mode: any ID and PIN work. The role decides where they land.
 */
export default function ProSignIn() {
  const live = useStore((s) => s.live);
  const setProRole = useStore((s) => s.setProRole);
  const setSignedIn = useStore((s) => s.setSignedIn);
  const loadProvider = useStore((s) => s.loadProvider);
  const [role, setRole] = useState<ProRole>('Nurse');
  const [phone, setPhone] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [needsJoin, setNeedsJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const land = async (r: ProRole) => {
    setProRole(r);
    setSignedIn(true);
    await loadProvider();
    if (r === 'Equipment supplier') router.replace('/pro/rates');
    else if (r === 'Coordinator') { router.replace('/pro/today'); router.push('/pro/desk'); }
    else router.replace('/pro/today');
  };

  const liveNext = async () => {
    setErr(null); setBusy(true);
    try {
      if (!sentTo) {
        const e164 = api.toIndianE164(phone);
        if (!e164) throw new Error('Enter a 10-digit Indian mobile number.');
        await api.sendOtp(e164);
        setSentTo(e164);
      } else if (!needsJoin) {
        await api.verifyOtp(sentTo, otp.trim());
        const profile = await api.getProfile();
        if (profile?.kind === 'provider' && profile.provider_org_id) {
          const r = (Object.keys(PRO_ROLE_KEY) as ProRole[]).find((k) => PRO_ROLE_KEY[k] === profile.provider_role) ?? role;
          await land(r);
        } else {
          setNeedsJoin(true);
        }
      } else {
        await api.joinOrg(joinCode, PRO_ROLE_KEY[role]);
        await land(role);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 18, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} hitSlop={10} style={{ marginBottom: 18 }}>
            <Text style={{ fontFamily: F.semibold, color: C.muted }}>← Back</Text>
          </Pressable>
          <Row gap={9} style={{ marginBottom: 24 }}>
            <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontFamily: F.bold, fontSize: 13 }}>HK</Text>
            </View>
            <View>
              <Text style={{ fontFamily: F.bold, fontSize: 14, color: C.ink }}>HOME KONNECT</Text>
              <Text style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, letterSpacing: 0.8 }}>CARE PROVIDER</Text>
            </View>
          </Row>
          <T v="h2">Care provider sign-in</T>
          {live ? (
            <>
              <T v="small" style={{ marginBottom: 16 }}>Sign in with your work mobile. The first time, your organisation gives you a join code.</T>
              <Field label="Mobile number" keyboardType="phone-pad" value={phone} onChangeText={(x) => { setPhone(x); setSentTo(null); setNeedsJoin(false); }} placeholder="98765 43210" />
              {sentTo && !needsJoin ? (
                <Field label="One-time password" keyboardType="number-pad" maxLength={6} value={otp} onChangeText={setOtp} textContentType="oneTimeCode" autoComplete="sms-otp" autoFocus />
              ) : null}
              {needsJoin ? (
                <>
                  <Field label="Organisation join code" value={joinCode} onChangeText={setJoinCode} autoCapitalize="characters" placeholder="From your coordinator" />
                  <FieldLabel>Your role</FieldLabel>
                  <ChoiceChips options={PRO_ROLES} value={role} onChange={setRole} />
                </>
              ) : null}
            </>
          ) : (
            <>
              <T v="small" style={{ marginBottom: 16 }}>Use the ID your company gave you. Your role decides what you can see.</T>
              <Field label="Provider ID" defaultValue="SHN-RN-0142" autoCapitalize="characters" />
              <Field label="PIN" defaultValue="1234" secureTextEntry keyboardType="number-pad" />
              <FieldLabel>Sign in as</FieldLabel>
              <ChoiceChips options={PRO_ROLES} value={role} onChange={setRole} />
            </>
          )}
          {err ? <View style={{ marginTop: 12 }}><Banner tone="red" text={err} /></View> : null}
          <View style={{ flex: 1, minHeight: 20 }} />
          {live ? (
            <Btn
              title={busy ? 'Please wait…' : !sentTo ? 'Send OTP' : needsJoin ? 'Join and continue' : 'Verify and continue'}
              disabled={busy || (!sentTo ? !api.toIndianE164(phone) : needsJoin ? joinCode.trim().length < 4 : otp.trim().length !== 6)}
              onPress={liveNext}
            />
          ) : (
            <Btn title="Sign in" onPress={() => land(role)} />
          )}
          <T v="small" style={{ textAlign: 'center', marginTop: 12 }}>{live ? 'Your number is never shown to families.' : 'Demo · any ID and PIN work'}</T>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
