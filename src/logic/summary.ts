/**
 * Builds the "Summary for your doctor" document as HTML (for PDF via expo-print)
 * and plain text (for sharing). All dynamic text is escaped.
 */
import { TODAY_LABEL, type Med } from '@/data/demo';
import { clock } from '@/logic/rules';
import type { Booking, Order, useStore } from '@/state/store';

export type SumKey = 'svc' | 'notes' | 'vit' | 'alerts' | 'med' | 'eq' | 'plan' | 'docs';
export type Period = 'all' | 'two' | 'today';
export const SUM_SECTIONS: { k: SumKey; t: string; s: string }[] = [
  { k: 'svc', t: 'Services given at home', s: 'Visits, lab collection, who and when' },
  { k: 'notes', t: 'Visit notes', s: 'What the nurse recorded' },
  { k: 'vit', t: 'Blood pressure and vitals', s: 'Home readings, trend chart, monitor data' },
  { k: 'alerts', t: 'Alerts and incidents', s: 'From the 24-hour monitor, if set up' },
  { k: 'med', t: 'Medicines', s: 'List and what was marked taken today' },
  { k: 'eq', t: 'Equipment and monitor at home', s: 'What is installed and since when' },
  { k: 'plan', t: 'Care plan and warning signs', s: 'From the discharge summary' },
  { k: 'docs', t: 'List of reports you hold', s: 'Names only, not the files' },
];
export const PERIODS: { k: Period; label: string; long: string; since: number }[] = [
  { k: 'all', label: 'Since discharge', long: 'Since discharge, 19 to 21 Oct', since: 19 },
  { k: 'two', label: 'Last 2 days', long: 'Last 2 days, 20 and 21 Oct', since: 20 },
  { k: 'today', label: 'Today', long: 'Today, 21 Oct', since: 21 },
];

export const esc = (t: unknown) =>
  String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

type S = ReturnType<typeof useStore.getState>;
export type SummaryInput = {
  period: Period; inc: Record<SumKey, boolean>; doctor: string; reason: string; questions: string[];
};

const ORD_STATUS = ['Confirmed', 'Out for delivery', 'Delivered'];

export function servicesDone(s: S, since: number) {
  const arr = s.pastServices.map((x) => ({ ...x }));
  if (s.visit.id && s.visit.stage === 4) {
    const v = s.visit.vitals;
    arr.push({
      d: 21, date: s.live ? 'Latest' : '21 Oct', svc: s.visit.service, by: s.visit.provider, amount: 650, abbr: 'HN', tone: 'amber',
      note: (v ? `BP ${v.sys}/${v.dia}, pulse ${v.pul}, SpO₂ ${v.spo}%. ` : '') + s.visit.note + (s.visit.escalated ? ' The nurse flagged a concern to the clinical desk.' : ''),
    });
  }
  // Live dates are real; the period filter uses the demo calendar only.
  return s.live ? arr : arr.filter((x) => x.d >= since);
}
function upcoming(s: S): { svc: string; provider: string; when: string }[] {
  const a: { svc: string; provider: string; when: string }[] = [];
  if (s.visit.id && s.visit.stage < 4) a.push({ svc: s.visit.service, provider: s.visit.provider, when: s.visit.when });
  s.bookings.forEach((b: Booking) => a.push(b));
  return a;
}

function bpSvg(bp: [number, number][], limit: number) {
  const W = 560, H = 150, pad = 28, min = 60, max = 180;
  const y = (v: number) => H - 18 - ((v - min) / (max - min)) * (H - 30);
  const x = (i: number) => pad + i * ((W - pad - 12) / Math.max(1, bp.length - 1));
  let g = '';
  [80, 100, 120, 160].forEach((v) => {
    g += `<line x1="${pad}" x2="${W - 12}" y1="${y(v)}" y2="${y(v)}" stroke="#e5e5e5" stroke-width="1"/><text x="${pad - 5}" y="${y(v) + 3}" text-anchor="end" font-size="9" fill="#777">${v}</text>`;
  });
  g += `<line x1="${pad}" x2="${W - 12}" y1="${y(limit)}" y2="${y(limit)}" stroke="#C3462F" stroke-width="1" stroke-dasharray="5 4"/><text x="${pad - 5}" y="${y(limit) + 3}" text-anchor="end" font-size="9" fill="#C3462F">${limit}</text>`;
  g += `<polyline points="${bp.map((p, i) => `${x(i)},${y(p[0])}`).join(' ')}" fill="none" stroke="#C97A2B" stroke-width="2.2"/>`;
  g += `<polyline points="${bp.map((p, i) => `${x(i)},${y(p[1])}`).join(' ')}" fill="none" stroke="#0E8C82" stroke-width="2.2"/>`;
  bp.forEach((p, i) => {
    g += `<circle cx="${x(i)}" cy="${y(p[0])}" r="3" fill="${p[0] > limit ? '#C3462F' : '#C97A2B'}"/><circle cx="${x(i)}" cy="${y(p[1])}" r="3" fill="#0E8C82"/>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:560px">${g}</svg><div class="note"><span style="color:#C97A2B">&#9632;</span> Top number &nbsp; <span style="color:#0E8C82">&#9632;</span> Bottom number. Reading 1 is the oldest.</div>`;
}

const tbl = (head: string[], rows: string[][]) =>
  `<table><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</table>`;

export function buildSummary(s: S, o: SummaryInput) {
  const per = PERIODS.find((p) => p.k === o.period)!;
  const inc = o.inc, H: string[] = [], T: string[] = [];
  const now = `${TODAY_LABEL}, ${clock()}`;
  const svcs = servicesDone(s, per.since), ups = upcoming(s);
  const bp = s.bp, last = bp[bp.length - 1];
  const sys = bp.map((p) => p[0]), dia = bp.map((p) => p[1]);
  const limitSys = s.patient.bpLimit.sys;
  const above = sys.filter((v) => v > limitSys).length;
  const hasBp = bp.length > 0;
  const mon = s.mon;
  const PATIENT = s.patient;
  const fu = PATIENT.followUp;
  const PLAN_POINTS = [
    `${PATIENT.short}${PATIENT.discharged ? `, discharged ${PATIENT.discharged}` : ''}${PATIENT.hospital ? ` from ${PATIENT.hospital}` : ''}.${fu ? ` Follow-up: ${fu.dept}, ${fu.when}${PATIENT.doctor ? `, ${PATIENT.doctor}` : ''}.` : ''}`,
    `Blood pressure limit ${PATIENT.bpLimit.sys}/${PATIENT.bpLimit.dia}.`,
    ...s.plan.limits, ...s.plan.dietActivity,
    ...(s.plan.allergies.length ? [`Allergies: ${s.plan.allergies.join(', ')}.`] : []),
  ];
  const WARN_SIGNS = s.plan.warningSigns.length ? s.plan.warningSigns : ['None listed in the discharge summary'];

  H.push(`<div class="hdr"><div><div class="brand">HOME KONNECT</div><h1>Home care summary</h1></div><div class="note" style="text-align:right">Prepared ${esc(now)}<br>Covers: ${esc(per.long)}</div></div>`);
  H.push(`<div class="kv"><div>Patient</div><div><b>${esc(PATIENT.name)}</b>${PATIENT.age ? `, ${PATIENT.age}` : ''}</div><div>Condition</div><div>${esc(PATIENT.condition || PATIENT.short)}${PATIENT.discharged ? `. Discharged ${esc(PATIENT.discharged)}` : ''}${PATIENT.hospital ? ` from ${esc(PATIENT.hospital)}` : ''}</div><div>Allergy</div><div>${esc(PATIENT.allergy)}</div>${o.doctor ? `<div>For</div><div>${esc(o.doctor)}</div>` : ''}${o.reason ? `<div>Visit</div><div>${esc(o.reason)}</div>` : ''}</div>`);
  T.push(`HOME CARE SUMMARY - ${PATIENT.name}${PATIENT.age ? `, ${PATIENT.age}` : ''}`, `${PATIENT.condition || PATIENT.short}. Allergy: ${PATIENT.allergy}.`);
  if (o.doctor) T.push('For: ' + o.doctor);
  if (o.reason) T.push('Visit: ' + o.reason);
  T.push(`Prepared ${now}. Covers: ${per.long}`, '');

  const gl: string[] = [];
  if (inc.svc) {
    const nv = svcs.filter((x) => /nurse/i.test(x.svc)).length, nl = svcs.length - nv;
    gl.push(svcs.length ? `${nv} nurse visit${nv === 1 ? '' : 's'}${nl ? ` and ${nl} lab collection` : ''} in this period.` : 'No home services in this period.');
  }
  if (inc.vit && !hasBp) gl.push('No blood pressure readings logged at home yet.');
  if (inc.vit && hasBp) {
    gl.push(`Latest home BP ${last[0]}/${last[1]}. Across ${bp.length} readings the top number ranged ${Math.min(...sys)} to ${Math.max(...sys)} and the bottom ${Math.min(...dia)} to ${Math.max(...dia)}. ${above ? `${above} reading${above === 1 ? '' : 's'} above the ${limitSys} limit.` : `None above the ${limitSys} limit.`}`);
    if (mon.paired) {
      const avg = Math.round(mon.hHr.reduce((a, b) => a + b, 0) / mon.hHr.length);
      gl.push(`Home monitor, last 24 h: heart rate average ${avg} (range ${Math.min(...mon.hHr)} to ${Math.max(...mon.hHr)}), lowest oxygen ${Math.min(...mon.hSp)}%.`);
    }
  }
  if (inc.alerts && mon.paired) gl.push(mon.alerts.length ? `${mon.alerts.length} monitor alert${mon.alerts.length === 1 ? '' : 's'} today. See Alerts below.` : 'No monitor alerts.');
  if (inc.med) gl.push(`${s.meds.length} medicines listed. ${s.meds.filter((m) => m.taken).length} of ${s.meds.length} marked taken today in the app.`);
  if (gl.length) {
    H.push(`<h2>At a glance</h2><ul>${gl.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>`);
    T.push('AT A GLANCE', ...gl.map((g) => '- ' + g), '');
  }
  if (o.questions.length) {
    H.push(`<h2>Questions from the family</h2><ol>${o.questions.map((q) => `<li>${esc(q)}</li>`).join('')}</ol>`);
    T.push('QUESTIONS FROM THE FAMILY', ...o.questions.map((q, i) => `${i + 1}. ${q}`), '');
  }
  if (inc.svc) {
    H.push('<h2>Services given at home</h2>'); T.push('SERVICES GIVEN AT HOME');
    if (svcs.length) {
      H.push(tbl(['Date', 'Service', 'Provided by'], svcs.map((x) => [esc(x.date), esc(x.svc), esc(x.by)])));
      svcs.forEach((x) => T.push(`- ${x.date}: ${x.svc} (${x.by})`));
    } else { H.push('<p class="note">None in this period.</p>'); T.push('None in this period.'); }
    if (ups.length) {
      const u = ups.map((x) => `${x.svc}, ${x.provider}, ${x.when}`).join('; ');
      H.push(`<p class="note"><b>Booked, not yet done:</b> ${esc(u)}.</p>`); T.push(`Booked, not yet done: ${u}.`);
    }
    T.push('');
  }
  if (inc.vit || inc.alerts || inc.med || inc.notes) { H.push('<h2 class="grp">Health updates</h2>'); T.push('HEALTH UPDATES', ''); }
  if (inc.notes) {
    H.push('<h3>Visit notes</h3>'); T.push('Visit notes');
    if (svcs.length) {
      H.push(`<ul>${svcs.map((x) => `<li><b>${esc(x.date)}</b> ${esc(x.note)}</li>`).join('')}</ul>`);
      svcs.forEach((x) => T.push(`- ${x.date}: ${x.note}`));
    } else { H.push('<p class="note">No visit notes in this period.</p>'); T.push('No visit notes in this period.'); }
    T.push('');
  }
  if (inc.vit && hasBp) {
    H.push(`<h3>Blood pressure logged at home</h3>${bpSvg(bp, limitSys)}${tbl(['Reading', ...bp.map((_, i) => String(i + 1))], [['Top / bottom', ...bp.map((p) => `${p[0]}/${p[1]}`)]])}<p class="note">Limit from the discharge summary: ${PATIENT.bpLimit.sys}/${PATIENT.bpLimit.dia} mmHg.</p>`);
    T.push(`Blood pressure logged at home (oldest to latest, limit ${s.patient.bpLimit.sys}/${s.patient.bpLimit.dia})`, bp.map((p) => `${p[0]}/${p[1]}`).join(', '), '');
    if (mon.paired) {
      const avg = Math.round(mon.hHr.reduce((a, b) => a + b, 0) / mon.hHr.length);
      H.push(`<h3>24-hour home monitor</h3><div class="kv"><div>Heart rate</div><div>average ${avg}, range ${Math.min(...mon.hHr)} to ${Math.max(...mon.hHr)} beats a minute</div><div>Oxygen (SpO₂)</div><div>lowest ${Math.min(...mon.hSp)}%, now ${mon.v.spo2}%</div><div>Breathing</div><div>${mon.v.rr} a minute now</div><div>Temperature</div><div>${mon.v.temp.toFixed(1)} °F now</div></div>`);
      T.push('24-hour home monitor', `Heart rate average ${avg}. Lowest oxygen ${Math.min(...mon.hSp)}%, now ${mon.v.spo2}%. Breathing ${mon.v.rr}/min. Temperature ${mon.v.temp.toFixed(1)} F.`, '');
    }
  }
  if (inc.alerts) {
    H.push('<h3>Alerts and incidents</h3>'); T.push('Alerts and incidents');
    if (!mon.paired) { H.push('<p class="note">No 24-hour monitor at home, so no automatic alerts were recorded.</p>'); T.push('No 24-hour monitor at home.'); }
    else if (!mon.alerts.length) { H.push('<p class="note">No alerts raised by the monitor.</p>'); T.push('No alerts raised by the monitor.'); }
    else {
      H.push(tbl(['Time', 'Alert', 'Outcome'], mon.alerts.map((a) => [esc(a.time), esc(`${a.title}. ${a.detail}`), a.resolved ? `Resolved at ${esc(a.resolved)}` : 'Open'])));
      mon.alerts.forEach((a) => T.push(`- ${a.time}: ${a.title}. ${a.detail} ${a.resolved ? `Resolved at ${a.resolved}.` : 'Open.'}`));
    }
    T.push('');
  }
  if (inc.med) {
    H.push(`<h3>Medicines</h3>${tbl(['Medicine', 'When', 'Marked taken today'], s.meds.map((m: Med) => [esc(m.name), esc(m.time), m.taken ? 'Yes' : 'No']))}<p class="note">Read from the discharge summary and confirmed by the family. Please check against the original.</p>`);
    T.push('Medicines (read from the discharge summary, confirmed by the family)', ...s.meds.map((m) => `- ${m.name}, ${m.time}. Taken today: ${m.taken ? 'yes' : 'no'}`), '');
  }
  if (inc.eq) {
    const rows: string[][] = [], tx: string[] = [];
    s.orders.forEach((ord: Order) => ord.lines.forEach((l) => {
      const arr = l.mode === 'buy' ? 'Bought' : l.desc;
      rows.push([esc(l.name), esc(arr), ORD_STATUS[ord.status]]);
      tx.push(`- ${l.name}: ${arr} (${ORD_STATUS[ord.status]})`);
    }));
    if (mon.paired) {
      const pn = mon.plan === 'B' ? 'with clinical desk' : 'app only';
      rows.push(['24-hour monitor (under-mattress sensor)', `Rented, set up ${esc(mon.since)}, ${pn}`, 'Live']);
      tx.push(`- 24-hour monitor: set up ${mon.since} (${pn}).`);
    }
    H.push('<h2>Equipment and monitor at home</h2>'); T.push('EQUIPMENT AND MONITOR AT HOME');
    if (rows.length) {
      H.push(tbl(['Item', 'Arrangement', 'Status'], rows)); T.push(...tx);
      if (mon.paired) H.push(`<p class="note">Monitor alert limits: oxygen below ${mon.thr.spo2}%, heart rate above ${mon.thr.hrHi} or below ${mon.thr.hrLo}, temperature above ${mon.thr.temp.toFixed(1)} °F. Set with the care team, not a diagnosis.</p>`);
    } else { H.push('<p class="note">None ordered through Home Konnect.</p>'); T.push('None ordered through Home Konnect.'); }
    T.push('');
  }
  if (inc.plan) {
    H.push(`<h2>Care plan from the discharge summary</h2><ul>${PLAN_POINTS.map((p) => `<li>${esc(p)}</li>`).join('')}</ul><p class="note"><b>Warning signs given to the family:</b> ${WARN_SIGNS.map(esc).join('; ')}.</p>`);
    T.push('CARE PLAN FROM THE DISCHARGE SUMMARY', ...PLAN_POINTS.map((p) => '- ' + p), `Warning signs given to the family: ${WARN_SIGNS.join('; ')}.`, '');
  }
  if (inc.docs) {
    const docs = [...(s.hasSummary ? [`Discharge summary${PATIENT.hospital ? `, ${PATIENT.hospital}` : ''}`] : []), `Prescriptions (${s.meds.length} medicines)`];
    H.push(`<h2>Reports the family holds</h2><ul>${docs.map((p) => `<li>${esc(p)}</li>`).join('')}</ul><p class="note">Names only. The family can show the originals.</p>`);
    T.push('REPORTS THE FAMILY HOLDS', ...docs.map((p) => '- ' + p), '');
  }
  H.push(`<h2>Doctor's notes</h2><div class="box"></div>`);
  H.push('<p class="foot">Prepared by the family using Home Konnect from records they uploaded and entries made by home care providers. Readings from home devices are for information and are not a diagnosis. This is not a prescription or a medical record. Billing and contact details are not included.</p>');
  T.push('Prepared by the family using Home Konnect. Home device readings are for information and are not a diagnosis. Not a prescription or medical record.');

  const css = [
    'body{font-family:Helvetica,Arial,sans-serif;color:#12233B;margin:0 auto;padding:22px;max-width:780px;font-size:13px;line-height:1.5}',
    '.hdr{border-bottom:3px solid #C97A2B;padding-bottom:10px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:flex-end;gap:10px;flex-wrap:wrap}',
    '.brand{font-size:11px;letter-spacing:.12em;font-weight:700;color:#A5611E}h1{font-size:21px;margin:2px 0 0}',
    'h2{font-size:14px;margin:20px 0 6px;padding-bottom:3px;border-bottom:1px solid #ccc;color:#0B6E66}',
    'h2.grp{font-size:15px;color:#fff;background:#0B6E66;border:0;padding:5px 9px;border-radius:4px}',
    'h3{font-size:13px;margin:14px 0 4px}ul,ol{margin:4px 0 4px 18px;padding:0}li{margin:2px 0}',
    'table{width:100%;border-collapse:collapse;font-size:12px;margin:4px 0}th,td{border:1px solid #ccc;padding:5px 7px;text-align:left;vertical-align:top}th{background:#f6f1e6}tr{break-inside:avoid}',
    '.kv{display:grid;grid-template-columns:120px 1fr;gap:3px 10px}.kv>div:nth-child(odd){color:#667}',
    '.note{font-size:11px;color:#667;margin:4px 0}.foot{font-size:10.5px;color:#667;margin-top:18px;border-top:1px solid #ccc;padding-top:8px}',
    '.box{border:1px solid #aaa;height:130px;margin-top:6px}',
    '@page{size:A4;margin:13mm}@media print{body{padding:0;max-width:none}}',
  ].join('');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Home care summary</title><style>${css}</style></head><body>${H.join('')}</body></html>`;
  return { html, text: T.join('\n'), sub: per.long };
}
