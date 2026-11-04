import { View } from 'react-native';

import { C } from '@/theme';

export function DocThumb() {
  return (
    <View style={{ width: 46, height: 58, borderRadius: 7, backgroundColor: '#fff', borderWidth: 1, borderColor: C.stroke, padding: 7, gap: 4 }}>
      {[0.6, 1, 1, 0.8, 1].map((w, i) => (
        <View key={i} style={{ height: 3, borderRadius: 2, width: `${w * 100}%`, backgroundColor: i === 0 ? C.amber : '#D8CFBE' }} />
      ))}
    </View>
  );
}
