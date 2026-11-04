/** Design tokens carried over from the Home Konnect HTML prototype. */
export const C = {
  bg: '#FAF5EC',
  paper: '#FFFFFF',
  stroke: '#E6DCCB',
  rowLine: '#F0E8DA',
  ink: '#12233B',
  muted: '#6A7788',
  amber: '#C97A2B',
  amberDeep: '#A5611E',
  amberTint: '#FBF0E2',
  amberBorder: '#EAD3B3',
  teal: '#0E8C82',
  tealDeep: '#0B6E66',
  tealTint: '#E4F4F1',
  tealBorder: '#BFE3DC',
  red: '#C3462F',
  redTint: '#FDF1EE',
  redBorder: '#F0C9C0',
  blue: '#1E5799',
  blueTint: '#EDF3FB',
  violet: '#6B4FA0',
  violetTint: '#F1ECFA',
  violetBorder: '#D8CBF0',
  navy: '#143049',
  grey: '#EFEFEF',
  greyText: '#666666',
  checkBorder: '#CBBFA9',
} as const;

export const F = {
  regular: 'IBMPlexSans_400Regular',
  medium: 'IBMPlexSans_500Medium',
  semibold: 'IBMPlexSans_600SemiBold',
  bold: 'IBMPlexSans_700Bold',
  mono: 'IBMPlexMono_500Medium',
  monoBold: 'IBMPlexMono_600SemiBold',
} as const;

export type Tone = 'amber' | 'teal' | 'red' | 'blue' | 'violet' | 'grey';

export const TONE: Record<Tone, { bg: string; fg: string; border: string }> = {
  amber: { bg: C.amberTint, fg: C.amberDeep, border: C.amberBorder },
  teal: { bg: C.tealTint, fg: C.tealDeep, border: C.tealBorder },
  red: { bg: C.redTint, fg: C.red, border: C.redBorder },
  blue: { bg: C.blueTint, fg: C.blue, border: '#CFDDF0' },
  violet: { bg: C.violetTint, fg: C.violet, border: C.violetBorder },
  grey: { bg: C.grey, fg: C.greyText, border: C.stroke },
};

export const inr = (n: number) => '₹' + Math.round(n || 0).toLocaleString('en-IN');
