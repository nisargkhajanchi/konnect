import { router } from 'expo-router';
import { useState } from 'react';

import { Grid, Tile } from '@/components/grid';
import { Between, Card, Chip, ChipRow, Field, Grow, Ic, Screen, T } from '@/components/ui';
import { SERVICES, SUGGESTED_SERVICES, type Service } from '@/data/demo';
import { C, F } from '@/theme';

const MONITOR_KW = 'monitor monitoring 24-hour sensor night live heart';

const openService = (sv: Service) => {
  if (sv.key === 'equipment') router.push('/equipment');
  else router.push({ pathname: '/providers', params: { service: sv.name } });
};

export default function FindCare() {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const hits = SERVICES.filter((sv) => !query || `${sv.name} ${sv.sub} ${sv.kw}`.toLowerCase().includes(query));
  const monHit = !query || MONITOR_KW.includes(query);

  return (
    <Screen tabs>
      <T v="label">Find care</T>
      <T v="h2">What help do you need at home?</T>
      <Field
        placeholder="Search nurse, physio, oxygen, attendant"
        value={q}
        onChangeText={setQ}
        clearButtonMode="while-editing"
        returnKeyType="search"
        accessibilityLabel="Search services"
      />
      {query && !hits.length && !monHit ? (
        <T v="small" style={{ marginBottom: 10 }}>Nothing matches. Try "nurse", "oxygen", "physio" or "monitor".</T>
      ) : null}

      {!query ? (
        <>
          <T v="sect" style={{ marginTop: 0 }}>Suggested by your discharge summary</T>
          <Card tone="amber">
            <ChipRow>
              {SERVICES.filter((sv) => SUGGESTED_SERVICES.includes(sv.key)).map((sv) => (
                <Chip key={sv.key} label={sv.name} onPress={() => openService(sv)} />
              ))}
            </ChipRow>
            <T v="small" style={{ marginTop: 8 }}>These come from your discharge summary. No provider paid to be suggested.</T>
          </Card>
        </>
      ) : null}

      {monHit ? (
        <Card tone="teal" onPress={() => router.push('/monitor')}>
          <Between>
            <Grow>
              <T v="label" style={{ color: '#0B6E66' }}>New</T>
              <T v="bodyB">24-hour monitoring at home</T>
              <T v="small">Contactless sensor, nurse and clinical desk alerts, live view for the family.</T>
            </Grow>
            <Ic label="LIVE" tone="teal" />
          </Between>
        </Card>
      ) : null}

      {!query ? <T v="sect">All services</T> : null}
      <Grid>
        {hits.map((sv) => <Tile key={sv.key} abbr={sv.abbr} tone={sv.tone} title={sv.name} sub={sv.sub} onPress={() => openService(sv)} />)}
      </Grid>

      <Card>
        <T v="small">
          <T v="small" style={{ fontFamily: F.bold, color: C.ink }}>How providers are listed. </T>
          Every verified provider appears on equal terms, ordered by distance, availability and family ratings. Doctors and hospitals receive no payment from any provider.
        </T>
      </Card>
    </Screen>
  );
}
