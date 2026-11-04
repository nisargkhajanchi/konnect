import { type ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/** Amber-to-teal hero background drawn with react-native-svg (no extra gradient dependency). */
export function LinearGradientFallback({ children }: { children: ReactNode }) {
  return (
    <View style={{ overflow: 'hidden' }}>
      <Svg style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="hk" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#A5611E" />
            <Stop offset="1" stopColor="#0B6E66" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#hk)" />
      </Svg>
      {children}
    </View>
  );
}
