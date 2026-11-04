import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { type ReactNode } from 'react';
import {
  Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
  type StyleProp, type TextInputProps, type TextProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore } from '@/state/store';
import { C, F, TONE, type Tone } from '@/theme';

const tap = () => { if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {}); };

/* ---------- text ---------- */
type TV = 'h1' | 'h2' | 'h3' | 'body' | 'bodyB' | 'small' | 'label' | 'sect' | 'mono' | 'big';
const TS: Record<TV, TextStyle> = {
  h1: { fontFamily: F.bold, fontSize: 26, lineHeight: 31, color: C.ink },
  h2: { fontFamily: F.bold, fontSize: 22, lineHeight: 28, color: C.ink, marginBottom: 6 },
  h3: { fontFamily: F.bold, fontSize: 15, color: C.ink },
  body: { fontFamily: F.regular, fontSize: 14, lineHeight: 21, color: C.ink },
  bodyB: { fontFamily: F.semibold, fontSize: 14, lineHeight: 20, color: C.ink },
  small: { fontFamily: F.regular, fontSize: 12.5, lineHeight: 18.5, color: C.muted },
  label: { fontFamily: F.monoBold, fontSize: 10.5, letterSpacing: 1, textTransform: 'uppercase', color: C.amberDeep, marginBottom: 6 },
  sect: { fontFamily: F.monoBold, fontSize: 10.5, letterSpacing: 0.9, textTransform: 'uppercase', color: C.muted, marginTop: 18, marginBottom: 8 },
  mono: { fontFamily: F.mono, fontSize: 11, color: C.muted },
  big: { fontFamily: F.bold, fontSize: 22, color: C.ink },
};
export function T({ v = 'body', style, ...p }: TextProps & { v?: TV; style?: StyleProp<TextStyle> }) {
  return <Text {...p} style={[TS[v], style]} />;
}
export const Sub = ({ children }: { children: ReactNode }) => (
  <T v="small" style={{ fontSize: 13.5, lineHeight: 21, marginBottom: 16 }}>{children}</T>
);

/* ---------- layout ---------- */
export function Screen({
  children, dock, tabs, scroll = true, style,
}: { children: ReactNode; dock?: ReactNode; tabs?: boolean; scroll?: boolean; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  const Body = scroll ? ScrollView : View;
  const body = (
    <Body
      style={{ flex: 1 }}
      contentInsetAdjustmentBehavior={tabs ? undefined : 'automatic'}
      keyboardShouldPersistTaps="handled"
      {...(scroll
        ? { contentContainerStyle: [{ padding: 18, paddingBottom: dock ? 24 : 40 + (tabs ? 60 : insets.bottom) }, style] }
        : { style: [{ flex: 1, padding: 18 }, style] })}>
      {children}
    </Body>
  );
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {tabs ? <SafeAreaView edges={['top']} style={{ flex: 1 }}>{body}</SafeAreaView> : body}
      {dock ? (
        <View style={[s.dock, { paddingBottom: Math.max(insets.bottom, 14) }]}>{dock}</View>
      ) : null}
    </View>
  );
}
export const Row = ({ children, style, gap = 11 }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>
);
export const Between = ({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, style]}>{children}</View>
);
export const Grow = ({ children }: { children: ReactNode }) => <View style={{ flex: 1, minWidth: 0 }}>{children}</View>;

/* ---------- card ---------- */
export function Card({
  children, tone, onPress, style, accessibilityLabel,
}: { children: ReactNode; tone?: Tone; onPress?: () => void; style?: StyleProp<ViewStyle>; accessibilityLabel?: string }) {
  const toneStyle = tone ? { backgroundColor: TONE[tone].bg, borderColor: TONE[tone].border } : null;
  if (!onPress) return <View style={[s.card, toneStyle, style]}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => { tap(); onPress(); }}
      style={({ pressed }) => [s.card, toneStyle, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }, style]}>
      {children}
    </Pressable>
  );
}

/* ---------- buttons ---------- */
type BtnV = 'amber' | 'teal' | 'red' | 'ghost';
const BTN_BG: Record<BtnV, string> = { amber: C.amber, teal: C.teal, red: C.red, ghost: '#fff' };
export function Btn({
  title, onPress, v = 'amber', small, disabled, style,
}: { title: string; onPress: () => void; v?: BtnV; small?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={() => { tap(); onPress(); }}
      style={({ pressed }) => [
        s.btn, small && s.btnSm, { backgroundColor: BTN_BG[v] },
        v === 'ghost' && { borderWidth: 1, borderColor: C.stroke },
        disabled && { opacity: 0.45 }, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }, style,
      ]}>
      <Text style={[s.btnT, small && { fontSize: 13 }, v === 'ghost' && { color: C.ink }]}>{title}</Text>
    </Pressable>
  );
}
export function LinkText({ title, onPress, color = C.amberDeep }: { title: string; onPress: () => void; color?: string }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={8}>
      <Text style={{ fontFamily: F.semibold, fontSize: 12.5, color, textDecorationLine: 'underline' }}>{title}</Text>
    </Pressable>
  );
}

/* ---------- chips & pills ---------- */
export function Chip({ label, on, onPress, tone = 'amber' }: { label: string; on?: boolean; onPress: () => void; tone?: 'amber' | 'teal' | 'red' }) {
  const bg = tone === 'teal' ? C.teal : tone === 'red' ? C.red : C.amber;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!on }}
      onPress={() => { tap(); onPress(); }}
      style={[s.chip, on && { backgroundColor: bg, borderColor: bg }]}>
      <Text style={[s.chipT, on && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}
export const ChipRow = ({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) => (
  <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, style]}>{children}</View>
);
export function ChoiceChips<T extends string>({ options, value, onChange }: { options: readonly T[]; value: T; onChange: (v: T) => void }) {
  return <ChipRow>{options.map((o) => <Chip key={o} label={o} on={o === value} onPress={() => onChange(o)} />)}</ChipRow>;
}
export function Pill({ label, tone = 'teal' }: { label: string; tone?: Tone }) {
  return (
    <View style={[s.pill, { backgroundColor: TONE[tone].bg }]}>
      <Text style={[s.pillT, { color: TONE[tone].fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}
export function Ic({ label, tone = 'amber', size = 40 }: { label: string; tone?: Tone; size?: number }) {
  return (
    <View style={[s.ic, { width: size, height: size, backgroundColor: TONE[tone].bg }]}>
      <Text style={{ fontFamily: F.bold, fontSize: size < 36 ? 11 : 12.5, color: TONE[tone].fg }}>{label}</Text>
    </View>
  );
}

/* ---------- form ---------- */
export function Field({ label, style, ...p }: TextInputProps & { label?: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={s.fieldL}>{label}</Text> : null}
      <TextInput placeholderTextColor={C.muted} {...p} style={[s.input, p.multiline && { minHeight: 70, textAlignVertical: 'top' }, style]} />
    </View>
  );
}
export const FieldLabel = ({ children }: { children: ReactNode }) => <Text style={s.fieldL}>{children}</Text>;
export function Toggle({ value, onChange, disabled }: { value: boolean; onChange?: (v: boolean) => void; disabled?: boolean }) {
  return (
    <Switch
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      trackColor={{ true: C.teal, false: C.checkBorder }}
      thumbColor="#fff"
      ios_backgroundColor={C.checkBorder}
    />
  );
}
export function Stepper({ value, onMinus, onPlus, label }: { value: string | number; onMinus: () => void; onPlus: () => void; label: string }) {
  return (
    <Between style={{ marginBottom: 10 }}>
      <T v="bodyB" style={{ fontSize: 13 }}>{label}</T>
      <Row gap={10}>
        <Pressable accessibilityLabel={`Decrease ${label}`} onPress={() => { tap(); onMinus(); }} style={s.stepBtn}><Text style={s.stepT}>−</Text></Pressable>
        <Text style={s.stepV}>{value}</Text>
        <Pressable accessibilityLabel={`Increase ${label}`} onPress={() => { tap(); onPlus(); }} style={s.stepBtn}><Text style={s.stepT}>+</Text></Pressable>
      </Row>
    </Between>
  );
}
export function Seg<K extends string>({ options, value, onChange }: { options: { k: K; label: string }[]; value: K; onChange: (k: K) => void }) {
  return (
    <View style={s.seg} accessibilityRole="tablist">
      {options.map((o) => (
        <Pressable key={o.k} accessibilityRole="tab" accessibilityState={{ selected: o.k === value }} onPress={() => { tap(); onChange(o.k); }} style={[s.segI, o.k === value && s.segOn]}>
          <Text style={[s.segT, o.k === value && { color: C.ink }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/* ---------- rows ---------- */
export function Check({ on }: { on: boolean }) {
  return <View style={[s.check, on && { backgroundColor: C.teal, borderColor: C.teal }]}>{on ? <Text style={{ color: '#fff', fontFamily: F.bold, fontSize: 13 }}>✓</Text> : null}</View>;
}
export function TaskRow({ title, sub, done, onPress, last, left, right }: { title: string; sub?: string; done?: boolean; onPress?: () => void; last?: boolean; left?: ReactNode; right?: ReactNode }) {
  const inner = (
    <>
      {left ?? (done !== undefined ? <Check on={!!done} /> : null)}
      <Grow>
        <Text style={[s.tName, done && { textDecorationLine: 'line-through', color: C.muted }]}>{title}</Text>
        {sub ? <Text style={s.tSub}>{sub}</Text> : null}
      </Grow>
      {right}
    </>
  );
  const st = [s.task, last && { borderBottomWidth: 0 }];
  if (!onPress) return <View style={st}>{inner}</View>;
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: !!done }} onPress={() => { tap(); onPress(); }} style={st}>{inner}</Pressable>
  );
}
export const StepDot = ({ n }: { n: number }) => (
  <View style={s.stepDot}><Text style={{ fontFamily: F.bold, fontSize: 12, color: C.amberDeep }}>{n}</Text></View>
);
export function PriceLine({ l, r, total }: { l: string; r: string; total?: boolean }) {
  return (
    <View style={[s.price, total && s.priceTotal]}>
      <Text style={[s.priceT, { flex: 1 }, total && { fontFamily: F.bold, fontSize: 15 }]}>{l}</Text>
      <Text style={[s.priceT, total && { fontFamily: F.bold, fontSize: 15 }]}>{r}</Text>
    </View>
  );
}
export function Banner({ text, tone = 'teal', onPress }: { text: string; tone?: 'teal' | 'amber' | 'red'; onPress?: () => void }) {
  const t = TONE[tone];
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={[s.banner, { backgroundColor: t.bg }]}>
      <Text style={{ fontFamily: F.semibold, fontSize: 12.5, lineHeight: 19, color: t.fg }}>{text}</Text>
    </Pressable>
  );
}
export function Track({ steps, current, allDone }: { steps: { name: string; time?: string }[]; current: number; allDone?: boolean }) {
  return (
    <View>
      {steps.map((st, i) => {
        const done = allDone || i < current, now = !allDone && i === current;
        const last = i === steps.length - 1;
        return (
          <View key={st.name} style={{ flexDirection: 'row', gap: 12, paddingBottom: last ? 0 : 16 }}>
            <View style={{ alignItems: 'center' }}>
              <View style={[s.tDot, done && { backgroundColor: C.teal, borderColor: C.teal }, now && { borderColor: C.teal, borderWidth: 3 }]} />
              {!last ? <View style={[s.tLine, done && { backgroundColor: C.teal }]} /> : null}
            </View>
            <Grow>
              <Text style={[s.tName, { fontFamily: done || now ? F.semibold : F.medium, color: done || now ? C.ink : C.muted }]}>{st.name}</Text>
              {st.time ? <Text style={s.tSub}>{st.time}</Text> : null}
            </Grow>
          </View>
        );
      })}
    </View>
  );
}
export function Avatar({ label, size = 32 }: { label: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.tealTint, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.tealDeep }}>{label}</Text>
    </View>
  );
}
export function Brand({ light }: { light?: boolean }) {
  return (
    <Row gap={9}>
      <View style={[s.mark, light && { backgroundColor: '#fff' }]}><Text style={{ fontFamily: F.bold, fontSize: 13, color: light ? C.amberDeep : '#fff' }}>HK</Text></View>
      <Text style={{ fontFamily: F.bold, fontSize: 14, letterSpacing: 0.3, color: light ? '#fff' : C.ink }}>HOME KONNECT</Text>
    </Row>
  );
}

/* ---------- SOS & toast ---------- */
export function SosButton() {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="SOS, urgent help" onPress={() => router.push('/sos')} style={s.sos} hitSlop={8}>
      <Text style={{ color: '#fff', fontFamily: F.bold, fontSize: 12 }}>SOS</Text>
    </Pressable>
  );
}
export function Toast() {
  const msg = useStore((st) => st.toast);
  const insets = useSafeAreaInsets();
  if (!msg) return null;
  return (
    <View pointerEvents="none" style={[s.toast, { top: insets.top + 8 }]} accessibilityLiveRegion="polite">
      <Text style={{ color: '#fff', fontFamily: F.medium, fontSize: 13, lineHeight: 19 }}>{msg}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  dock: { paddingHorizontal: 18, paddingTop: 12, backgroundColor: C.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.stroke },
  card: {
    backgroundColor: C.paper, borderWidth: 1, borderColor: C.stroke, borderRadius: 16, padding: 14, marginBottom: 11,
    shadowColor: C.ink, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1,
  },
  btn: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  btnSm: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 11 },
  btnT: { color: '#fff', fontFamily: F.semibold, fontSize: 15 },
  chip: { borderWidth: 1, borderColor: C.stroke, backgroundColor: '#fff', borderRadius: 100, paddingVertical: 9, paddingHorizontal: 13 },
  chipT: { fontFamily: F.medium, fontSize: 13, color: C.ink },
  pill: { borderRadius: 100, paddingVertical: 3, paddingHorizontal: 9, alignSelf: 'flex-start' },
  pillT: { fontFamily: F.semibold, fontSize: 11 },
  ic: { borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  fieldL: { fontFamily: F.semibold, fontSize: 12.5, color: C.muted, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: C.stroke, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 13, fontFamily: F.regular, fontSize: 15, color: C.ink, backgroundColor: '#fff' },
  stepBtn: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: C.stroke, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  stepT: { fontSize: 19, color: C.ink },
  stepV: { minWidth: 56, textAlign: 'center', fontFamily: F.monoBold, fontSize: 18, color: C.ink },
  seg: { flexDirection: 'row', backgroundColor: '#F1E9DA', borderRadius: 12, padding: 3, marginBottom: 14 },
  segI: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10 },
  segOn: { backgroundColor: '#fff', shadowColor: C.ink, shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  segT: { fontFamily: F.semibold, fontSize: 13, color: C.muted },
  check: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: C.checkBorder, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  task: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.rowLine },
  tName: { fontFamily: F.medium, fontSize: 14, color: C.ink },
  tSub: { fontFamily: F.regular, fontSize: 11.5, color: C.muted, marginTop: 1 },
  stepDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.amberTint, alignItems: 'center', justifyContent: 'center' },
  price: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, gap: 10 },
  priceTotal: { borderTopWidth: 1, borderStyle: 'dashed', borderTopColor: C.stroke, marginTop: 5, paddingTop: 9 },
  priceT: { fontFamily: F.regular, fontSize: 13.5, color: C.ink },
  banner: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 13, marginBottom: 11 },
  tDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: C.stroke, backgroundColor: '#fff' },
  tLine: { width: 2, flex: 1, backgroundColor: C.stroke, marginTop: 2 },
  mark: { width: 30, height: 30, borderRadius: 9, backgroundColor: C.amber, alignItems: 'center', justifyContent: 'center' },
  sos: { backgroundColor: C.red, borderRadius: 100, paddingHorizontal: 13, paddingVertical: 5 },
  toast: { position: 'absolute', left: 16, right: 16, backgroundColor: C.navy, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, zIndex: 100, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 },
});
