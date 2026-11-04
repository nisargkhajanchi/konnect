import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Grid, QuickAction, Tile } from '@/components/grid';
import { MonitorCard, openMonitor } from '@/components/monitor-card';
import { Avatar, Between, Brand, Btn, Card, Grow, Ic, Pill, Row, Screen, SosButton, T, TaskRow } from '@/components/ui';
import { DISCHARGE_DAY, PATIENT, TODAY_DAY } from '@/data/demo';
import { bpStatus, buildTodayTasks } from '@/logic/rules';
import { STAGE_LABEL, useStore } from '@/state/store';

export default function Today() {
  const meds = useStore((s) => s.meds);
  const hasSummary = useStore((s) => s.hasSummary);
  const done = useStore((s) => s.tasksDone);
  const toggle = useStore((s) => s.toggleTask);
  const visit = useStore((s) => s.visit);
  const bp = useStore((s) => s.bp);
  const toast = useStore((s) => s.showToast);

  const tasks = buildTodayTasks(meds);
  const next = tasks.find((t) => !done[t.id]);
  const last = bp[bp.length - 1];
  const st = bpStatus(last[0]);
  const day = TODAY_DAY - DISCHARGE_DAY + 1;
  const visitDone = visit.stage === 4;

  return (
    <Screen tabs>
      <Between style={{ marginBottom: 14 }}>
        <Brand />
        <Row gap={10}>
          <SosButton />
          <Pressable accessibilityRole="button" accessibilityLabel="Account and more" onPress={() => router.push('/(tabs)/more')}><Avatar label="K" /></Pressable>
        </Row>
      </Between>

      <Card tone="amber" style={{ paddingVertical: 12 }}>
        <Between>
          <View>
            <T v="h3">{PATIENT.name}</T>
            <T v="mono" style={{ fontSize: 10.5 }}>{PATIENT.age} · {PATIENT.short} · Day {day} at home</T>
          </View>
          <Pill label={st === 'ok' ? 'On track' : 'Check BP'} tone={st === 'ok' ? 'teal' : 'amber'} />
        </Between>
      </Card>

      {!hasSummary ? (
        <Card tone="violet" onPress={() => router.push('/onboarding/upload')}>
          <T v="label" style={{ color: '#6B4FA0' }}>Finish setting up</T>
          <T v="bodyB">Add the discharge summary</T>
          <T v="small">Your plan below uses sample medicines until you add it.</T>
        </Card>
      ) : null}

      {/* What to do next: live visit beats tasks beats "all done". */}
      {visit.stage >= 1 && visit.stage <= 3 ? (
        <Card tone="amber" style={{ borderWidth: 1.5, borderColor: '#C97A2B' }}>
          <T v="label">Right now</T>
          <T v="h3">{['', 'Your nurse is on the way', 'Your nurse has arrived', 'Your nurse is with you now'][visit.stage]}</T>
          <T v="small" style={{ marginBottom: 10 }}>Home nurse · Sunrise Home Nursing</T>
          <Btn small title="Track live" onPress={() => router.push('/visit')} />
        </Card>
      ) : next ? (
        <Card tone="amber" style={{ borderWidth: 1.5, borderColor: '#C97A2B' }}>
          <T v="label">Do this next</T>
          <T v="h3">{next.title}</T>
          <T v="small" style={{ marginBottom: 10 }}>{next.sub}</T>
          <Btn small title="Mark as done" onPress={() => toggle(next.id)} />
        </Card>
      ) : (
        <Card tone="teal">
          <T v="label" style={{ color: '#0B6E66' }}>All done for today</T>
          <T v="h3">Nothing left on today's plan</T>
          <T v="small">
            {visitDone ? `Next: ${PATIENT.followUp.dept} follow-up, ${PATIENT.followUp.when}.` : 'Next: home nurse visit, today 4:30 PM.'}
          </T>
        </Card>
      )}

      <Grid cols={4}>
        <QuickAction abbr="+" tone="amber" label="Book care" onPress={() => router.push('/(tabs)/care')} />
        <QuickAction abbr="RX" tone="teal" label="Medicines" onPress={() => router.push({ pathname: '/(tabs)/health', params: { tab: 'med' } })} />
        <QuickAction abbr="BP" tone="red" label="Log BP" onPress={() => router.push({ pathname: '/(tabs)/health', params: { tab: 'vit' } })} />
        <QuickAction abbr="RN" tone="blue" label="Ask the nurse" onPress={() => toast('Chat with the nurse is coming soon.')} />
      </Grid>

      <MonitorCard />

      <Card onPress={() => router.push('/visit')}>
        <T v="label">{visitDone ? 'Today’s visit' : 'Next visit'}</T>
        <Between>
          <Grow>
            <T v="bodyB">Home nurse · today 4:30 PM</T>
            <T v="small">Sunrise Home Nursing · Nurse Meera D'Souza</T>
          </Grow>
          <Pill label={STAGE_LABEL[visit.stage]} tone={visit.stage === 0 ? 'amber' : visit.stage === 1 ? 'blue' : visit.stage === 2 ? 'violet' : 'teal'} />
        </Between>
      </Card>

      <T v="sect">Today's plan from your discharge summary</T>
      <Card>
        {tasks.map((t, i) => (
          <TaskRow key={t.id} title={t.title} sub={t.sub} done={!!done[t.id]} onPress={() => toggle(t.id)} last={i === tasks.length - 1} />
        ))}
      </Card>

      <T v="sect">Latest reading</T>
      <Card onPress={() => router.push({ pathname: '/(tabs)/health', params: { tab: 'vit' } })}>
        <Between>
          <View>
            <T v="small">Blood pressure · latest</T>
            <T v="big">{last[0]}/{last[1]} <T v="small">mmHg</T></T>
          </View>
          <Pill label={st === 'ok' ? 'Within range' : 'Above limit'} tone={st === 'ok' ? 'teal' : st === 'amber' ? 'amber' : 'red'} />
        </Between>
      </Card>

      <Card tone="teal" onPress={() => router.push('/care-plan')}>
        <T v="label" style={{ color: '#0B6E66' }}>From your discharge summary</T>
        <T v="bodyB" style={{ fontSize: 13.5 }}>Follow-up with {PATIENT.followUp.dept} · {PATIENT.followUp.when}</T>
        <T v="small">{PATIENT.doctor}, {PATIENT.hospital}. Reminders are on. Tap to see your plan and warning signs.</T>
      </Card>

      <Card onPress={() => router.push('/summary')}>
        <Row>
          <Ic label="SUM" tone="amber" />
          <Grow>
            <T v="bodyB" style={{ fontSize: 13.5 }}>Seeing the doctor on 28 Oct?</T>
            <T v="small">Create a summary of services and health updates to take along.</T>
          </Grow>
        </Row>
      </Card>

      <T v="sect">All your tools</T>
      <Grid>
        <Tile abbr="CP" tone="teal" title="Care plan" sub="Recovery steps and warning signs" onPress={() => router.push('/care-plan')} />
        <Tile abbr="EQ" tone="amber" title="Equipment" sub="Rent or buy · fixed rates" onPress={() => router.push('/equipment')} />
        <Tile abbr="24" tone="teal" title="24-hour monitor" sub="Live view and alerts" onPress={openMonitor} />
        <Tile abbr="SUM" tone="amber" title="Doctor summary" sub="To take to the visit" onPress={() => router.push('/summary')} />
        <Tile abbr="PDF" tone="blue" title="Records" sub="Reports and who can see them" onPress={() => router.push({ pathname: '/(tabs)/health', params: { tab: 'rec' } })} />
        <Tile abbr="CC" tone="blue" title="Care circle" sub="Family in the loop" onPress={() => router.push('/care-circle')} />
        <Tile abbr="₹" tone="amber" title="Bills and claims" sub="Invoices and insurance pack" onPress={() => router.push('/bills')} />
        <Tile abbr="VS" tone="violet" title="My visits" sub="Upcoming and past" onPress={() => router.push('/(tabs)/visits')} />
      </Grid>
      <Btn v="ghost" small title="Ask a care coordinator" onPress={() => toast("Message sent to Home Konnect's clinical desk. Replies arrive in the care thread.")} />
    </Screen>
  );
}
