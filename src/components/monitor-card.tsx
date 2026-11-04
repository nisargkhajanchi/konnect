import { router } from 'expo-router';
import { View } from 'react-native';

import { Between, Card, Pill, T } from '@/components/ui';
import { MON_TEXT } from '@/logic/rules';
import { useMonState, useStore } from '@/state/store';

export const openMonitor = () => {
  router.push(useStore.getState().mon.paired ? '/monitor/live' : '/monitor');
};

/** Today-screen summary of the 24-hour monitor, or a prompt to set it up. */
export function MonitorCard() {
  const mon = useStore((s) => s.mon);
  const st = useMonState();
  if (!mon.paired) {
    return (
      <Card tone="teal" onPress={openMonitor}>
        <T v="label" style={{ color: '#0B6E66' }}>New</T>
        <Between>
          <View style={{ flex: 1 }}>
            <T v="bodyB">Know how he is overnight</T>
            <T v="small">24-hour monitor with alerts to family, nurse and clinical desk</T>
          </View>
          <Pill label="See how" />
        </Between>
      </Card>
    );
  }
  const tone = st === 'alert' ? 'red' : st === 'watch' ? 'amber' : undefined;
  return (
    <Card tone={tone} onPress={openMonitor} accessibilityLabel={`Live monitor, ${MON_TEXT[st]}`}>
      <Between>
        <T v="label" style={{ marginBottom: 0 }}>Live monitor</T>
        <Pill label={MON_TEXT[st]} tone={st === 'alert' ? 'red' : st === 'watch' ? 'amber' : 'teal'} />
      </Between>
      <Between style={{ marginTop: 8 }}>
        {[['Heart rate', mon.v.hr], ['Oxygen', mon.v.spo2 + '%'], ['Breathing', mon.v.rr], ['Temp °F', mon.v.temp.toFixed(1)]].map(([l, v]) => (
          <View key={l}>
            <T v="small">{l}</T>
            <T v="big" style={{ fontSize: 18 }}>{v}</T>
          </View>
        ))}
      </Between>
    </Card>
  );
}
