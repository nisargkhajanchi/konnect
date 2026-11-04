import { View } from 'react-native';

import { T } from '@/components/ui';
import { MON_TEXT, type MonState } from '@/logic/rules';
import { TONE } from '@/theme';

export function MonStatus({ st, extra }: { st: MonState; extra?: string }) {
  const t = TONE[st === 'alert' ? 'red' : st === 'watch' ? 'amber' : 'teal'];
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 11, backgroundColor: t.bg, borderWidth: 1, borderColor: t.border }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.fg }} />
      <T v="bodyB" style={{ color: t.fg, fontSize: 14.5, flex: 1 }}>{MON_TEXT[st]}{extra ? ` · ${extra}` : ''}</T>
    </View>
  );
}
