import { View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { C } from '@/theme';

/** Blood pressure: top and bottom numbers with the 140 limit dashed. */
export function BpChart({ data, limit = 140 }: { data: [number, number][]; limit?: number }) {
  const W = 300, H = 120, pad = 14, min = 60, max = 180;
  const y = (v: number) => H - pad - ((v - min) / (max - min)) * (H - 2 * pad);
  const x = (i: number) => pad + i * ((W - 2 * pad) / Math.max(1, data.length - 1));
  return (
    <View accessible accessibilityLabel={`Blood pressure, last ${data.length} readings. Latest ${data[data.length - 1]?.join('/')}`}>
      <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={undefined} style={{ aspectRatio: W / H }}>
        <Line x1={pad} x2={W - pad} y1={y(limit)} y2={y(limit)} stroke={C.red} strokeDasharray="4 4" strokeWidth={1} />
        <Polyline points={data.map((p, i) => `${x(i)},${y(p[0])}`).join(' ')} fill="none" stroke={C.amber} strokeWidth={2.4} strokeLinejoin="round" />
        <Polyline points={data.map((p, i) => `${x(i)},${y(p[1])}`).join(' ')} fill="none" stroke={C.teal} strokeWidth={2.4} strokeLinejoin="round" />
        {data.map((p, i) => (
          <Circle key={'s' + i} cx={x(i)} cy={y(p[0])} r={3.2} fill={p[0] > limit ? C.red : C.amber} />
        ))}
        {data.map((p, i) => <Circle key={'d' + i} cx={x(i)} cy={y(p[1])} r={3} fill={C.teal} />)}
      </Svg>
    </View>
  );
}

/** Sparkline with optional dashed alert limits. */
export function Spark({
  data, min, max, lo, hi, color, label,
}: { data: number[]; min: number; max: number; lo?: number; hi?: number; color: string; label: string }) {
  const W = 300, H = 80, pad = 8;
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const y = (v: number) => H - pad - ((clamp(v) - min) / (max - min)) * (H - 2 * pad);
  const x = (i: number) => pad + i * ((W - 2 * pad) / (data.length - 1));
  const last = data.length - 1;
  return (
    <View accessible accessibilityLabel={`${label}, latest ${data[last]}`}>
      <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={undefined} style={{ aspectRatio: W / H }}>
        {hi != null ? <Line x1={pad} x2={W - pad} y1={y(hi)} y2={y(hi)} stroke={C.red} strokeDasharray="4 4" strokeWidth={1} /> : null}
        {lo != null ? <Line x1={pad} x2={W - pad} y1={y(lo)} y2={y(lo)} stroke={C.red} strokeDasharray="4 4" strokeWidth={1} /> : null}
        <Polyline points={data.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        <Circle cx={x(last)} cy={y(data[last])} r={3.5} fill={color} />
      </Svg>
    </View>
  );
}
