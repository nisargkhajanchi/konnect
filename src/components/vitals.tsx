import { StyleSheet, Text, View } from 'react-native';

import { C, F } from '@/theme';

export function VTile({ label, value, unit, alert }: { label: string; value: string | number; unit: string; alert?: boolean }) {
  return (
    <View style={[s.tile, alert && { borderColor: C.redBorder, backgroundColor: C.redTint }]} accessible accessibilityLabel={`${label} ${value} ${unit}${alert ? ', outside limit' : ''}`}>
      <Text style={s.l}>{label}</Text>
      <Text style={s.n}>{value} <Text style={s.u}>{unit}</Text></Text>
    </View>
  );
}
export const VGrid = ({ children }: { children: React.ReactNode }) => <View style={s.grid}>{children}</View>;

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 11 },
  tile: { flexBasis: '47%', flexGrow: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: C.stroke, borderRadius: 14, paddingVertical: 11, paddingHorizontal: 12 },
  l: { fontFamily: F.semibold, fontSize: 10.5, letterSpacing: 0.4, textTransform: 'uppercase', color: C.muted },
  n: { fontFamily: F.bold, fontSize: 21, color: C.ink, marginTop: 3 },
  u: { fontFamily: F.medium, fontSize: 11, color: C.muted },
});
