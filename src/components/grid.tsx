import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Ic } from '@/components/ui';
import { C, F, type Tone } from '@/theme';

export const Grid = ({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 4 }) => (
  <View style={[s.grid, cols === 4 && { gap: 8 }]}>{children}</View>
);

/** Two-up tool tile (icon, title, subtitle). */
export function Tile({ abbr, tone, title, sub, onPress }: { abbr: string; tone: Tone; title: string; sub: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => [s.tile, pressed && { opacity: 0.85 }]}>
      <Ic label={abbr} tone={tone} />
      <Text style={s.title}>{title}</Text>
      <Text style={s.sub}>{sub}</Text>
    </Pressable>
  );
}

/** Four-up quick action. */
export function QuickAction({ abbr, tone, label, onPress }: { abbr: string; tone: Tone; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [s.qa, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}>
      <Ic label={abbr} tone={tone} size={38} />
      <Text style={s.qaT}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 11 },
  tile: { flexBasis: '47%', flexGrow: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: C.stroke, borderRadius: 16, padding: 14 },
  title: { fontFamily: F.semibold, fontSize: 13.5, color: C.ink, marginTop: 8 },
  sub: { fontFamily: F.regular, fontSize: 12, color: C.muted, lineHeight: 17 },
  qa: { flexBasis: '22%', flexGrow: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: C.stroke, borderRadius: 14, paddingVertical: 11, paddingHorizontal: 4, alignItems: 'center', gap: 7 },
  qaT: { fontFamily: F.semibold, fontSize: 11.5, color: C.ink, textAlign: 'center', lineHeight: 14 },
});
