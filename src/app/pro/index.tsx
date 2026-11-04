import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Btn, ChoiceChips, Field, FieldLabel, Row, T } from '@/components/ui';
import { PRO_ROLES, useStore, type ProRole } from '@/state/store';
import { C, F } from '@/theme';

/** Provider sign-in. The role decides where they land and what they can see. Demo: anything works. */
export default function ProSignIn() {
  const [role, setRole] = useState<ProRole>('Nurse');
  const setProRole = useStore((s) => s.setProRole);

  const signIn = () => {
    setProRole(role);
    if (role === 'Equipment supplier') router.replace('/pro/rates');
    else if (role === 'Coordinator') { router.replace('/pro/today'); router.push('/pro/desk'); }
    else router.replace('/pro/today');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={{ flex: 1, padding: 18 }}>
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
        <T v="small" style={{ marginBottom: 16 }}>Use the ID your company gave you. Your role decides what you can see.</T>
        <Field label="Provider ID" defaultValue="SHN-RN-0142" autoCapitalize="characters" />
        <Field label="PIN" defaultValue="1234" secureTextEntry keyboardType="number-pad" />
        <FieldLabel>Sign in as</FieldLabel>
        <ChoiceChips options={PRO_ROLES} value={role} onChange={setRole} />
        <View style={{ flex: 1 }} />
        <Btn title="Sign in" onPress={signIn} />
        <T v="small" style={{ textAlign: 'center', marginTop: 12 }}>Demo · any ID and PIN work</T>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
