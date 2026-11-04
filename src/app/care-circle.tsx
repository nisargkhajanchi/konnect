import { Avatar, Btn, Card, Grow, Pill, Row, Screen, Sub, T, TaskRow } from '@/components/ui';
import { CARE_CIRCLE } from '@/data/demo';
import { useStore } from '@/state/store';

export default function CareCircle() {
  const toast = useStore((s) => s.showToast);
  const visit = useStore((s) => s.visit);
  const bookings = useStore((s) => s.bookings);
  const activity = [
    ...(visit.stage === 4 && visit.vitals ? [{ t: `Nurse recorded BP ${visit.vitals.sys}/${visit.vitals.dia}`, s: 'Today' }] : []),
    ...(bookings.length ? [{ t: 'Kiran booked a visit', s: 'Today' }] : []),
    { t: 'Nurse recorded BP 128/82', s: 'Yesterday' },
    { t: 'Anita viewed the care plan', s: 'Yesterday' },
  ];
  return (
    <Screen>
      <T v="label">Care circle</T>
      <T v="h2">Who is in the loop</T>
      <Sub>Everyone here sees the same updates. Only the two main contacts can book and approve.</Sub>
      {CARE_CIRCLE.map((p) => (
        <Card key={p.name}>
          <Row>
            <Avatar label={p.init} />
            <Grow><T v="bodyB">{p.name}</T><T v="small">{p.role}</T></Grow>
            <Pill label={p.access} tone={p.access === 'View only' ? 'grey' : 'teal'} />
          </Row>
        </Card>
      ))}
      <Btn v="ghost" title="Invite someone" onPress={() => toast('Invite sent by SMS (demo). They verify with an OTP.')} />
      <T v="sect">Latest activity</T>
      <Card>
        {activity.map((a, i) => <TaskRow key={a.t + i} title={a.t} sub={a.s} last={i === activity.length - 1} />)}
      </Card>
    </Screen>
  );
}
