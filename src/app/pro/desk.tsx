import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Pill, Screen, Sub, T } from '@/components/ui';
import { OTHER_DESK_PATIENTS } from '@/data/demo';
import { MON_TEXT, type MonState } from '@/logic/rules';
import { useMonState, useStore, usePatient } from '@/state/store';
import { C, TONE } from '@/theme';

const RANK: Record<MonState, number> = { alert: 0, watch: 1, ok: 2 };

/** Clinical desk: every monitored patient, most urgent first. */
export default function Desk() {
  const patient = usePatient();
  const mon = useStore((s) => s.mon);
  const toast = useStore((s) => s.showToast);
  const st = useMonState();
  const rows = [
    { n: `${patient.name}, ${patient.age}`, s: st, sub: mon.paired ? `${patient.short} · HR ${mon.v.hr} · SpO₂ ${mon.v.spo2}%` : 'Monitor not paired yet', live: true },
    ...OTHER_DESK_PATIENTS.map((o) => ({ ...o, live: false })),
  ].sort((a, b) => RANK[a.s] - RANK[b.s]);

  return (
    <Screen>
      <T v="label" style={{ color: C.violet }}>Monitoring desk</T>
      <T v="h2">5 patients</T>
      <Sub>Sorted by risk. The most urgent patient is always on top.</Sub>
      {rows.map((r) => {
        const t = r.s === 'alert' ? TONE.red : r.s === 'watch' ? TONE.amber : null;
        return (
          <Pressable
            key={r.n}
            accessibilityRole="button"
            onPress={() => (r.live ? router.push('/pro/patient') : toast('Demo: only the first patient is live.'))}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: t?.bg ?? '#fff', borderWidth: 1, borderColor: t?.border ?? C.stroke, borderRadius: 14, padding: 12, marginBottom: 8 }}>
            <View style={{ flex: 1 }}>
              <T v="bodyB" style={{ fontSize: 13.5 }}>{r.n}</T>
              <T v="small">{r.sub}</T>
            </View>
            <Pill label={MON_TEXT[r.s]} tone={r.s === 'alert' ? 'red' : r.s === 'watch' ? 'amber' : 'teal'} />
          </Pressable>
        );
      })}
      <T v="small" style={{ marginTop: 4 }}>Alerts use limits set with each patient's doctor. The score here is a demo rule. Your clinical lead must approve the real rules before use.</T>
    </Screen>
  );
}
