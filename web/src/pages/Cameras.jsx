import { useState } from 'react';
import { BarChart, Bar as RBar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Cctv, ShieldCheck, AlertTriangle, Eye, Cpu, ChevronRight } from 'lucide-react';
import { useLive, pct, clock, ago } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Card, PageHeader, MiniStat, Badge, Bar, Select, Loading, ErrorNote, TOOLTIP, AXIS, SEVERITY_TONE } from '../components/ui.jsx';
import CameraFeed from '../components/CameraFeed.jsx';
import WebcamLab from '../components/WebcamLab.jsx';

export default function Cameras() {
  const { branch, branches } = useAuth();
  // Video walls are per branch; when "All branches" is selected, pick one here
  const [local, setLocal] = useState(branches[0]?.id);
  const shown = branch !== 'all' ? branch : local;
  const { data, error } = useLive(`/vision?branch=${shown}`, { types: ['vision'], throttle: 6000 });
  const { data: all } = useLive(branches.length > 1 ? '/vision' : null, { types: [], interval: 60000 });

  if (error) return <ErrorNote>{error}</ErrorNote>;
  const scored = data?.byType.filter((t) => ['realtime', 'kpi'].includes(t.tier)) || [];
  const overall = data ? scored.reduce((a, t) => a + t.ok, 0) / Math.max(1, scored.reduce((a, t) => a + t.n, 0)) : null;
  const flags = scored.reduce((a, t) => a + (t.n - t.ok), 0);
  const m = data?.measured || {};
  const mmss2 = (s) => (s == null ? '—' : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`);

  return (
    <>
      <PageHeader title="Vision Intelligence"
        subtitle="What existing CCTV can measure reliably, in real time: station coverage, occupancy, queue wait, dishes waiting at the pass, walk-in door time, unattended counters and after-hours access. Small-object checks (gloves, hair cover, phones, hand-wash sequence) are sampled for human audit. Video stays on-premise."
        right={branch === 'all' && branches.length > 1 && <Select value={local} onChange={setLocal} options={branches.map((b) => ({ value: b.id, label: `${b.name} · ${b.city}` }))} />} />
      {!data ? <Loading /> : (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <MiniStat label="Feeds online" value={`${data.cameras.filter((c) => c.status !== 'offline').length}/${data.cameras.length}`} icon={Cctv} tone={data.cameras.some((c) => c.status === 'offline') ? 'bad' : 'info'} />
            <MiniStat label="Station coverage (2h)" value={pct(m.station_coverage, 1)} icon={ShieldCheck} tone={m.station_coverage < 0.93 ? 'warn' : 'ok'} sub="staffed seconds ÷ open seconds" />
            <MiniStat label="Real-time compliance (2h)" value={pct(overall, 1)} icon={AlertTriangle} tone={overall < 0.93 ? 'warn' : 'ok'} sub={`${flags} exceptions`} />
            <MiniStat label="Guests in dining room" value={m.occupancy_now ?? '—'} icon={Eye} tone="primary" sub="zone occupancy, last 30 min" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MiniStat label="Queue wait p50 · p90" value={`${mmss2(m.queue_wait_p50)} · ${mmss2(m.queue_wait_p90)}`} tone={m.queue_wait_p90 > 300 ? 'warn' : 'info'} sub={`Little's law · ${m.queue_samples || 0} samples`} />
            <MiniStat label="Pass dwell p50 · p90" value={`${mmss2(m.pass_dwell_p50)} · ${mmss2(m.pass_dwell_p90)}`} tone={m.pass_over_2min ? 'warn' : 'ok'} sub={`${m.pass_over_2min || 0} dishes waited > 2 min`} />
            <MiniStat label="Walk-in door" value={`${m.door_events || 0} opens`} tone={m.door_long ? 'bad' : 'ok'} sub={`avg ${Math.round(m.door_open_avg_s || 0)} s · ${m.door_long || 0} over 3 min`} />
            <MiniStat label="Unattended counter · after-hours" value={`${m.counter_unattended || 0} · ${m.after_hours_access_24h || 0}`} tone={(m.counter_unattended || m.after_hours_access_24h) ? 'warn' : 'ok'} sub="2 h · 24 h" />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="grid content-start gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {data.cameras.map((c, i) => <CameraFeed key={c.id} camera={c} index={i + 1} />)}
            </div>
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-4">
              <EdgePipeline cameras={data.cameras} />
              <Card title="Checks by reliability tier" subtitle="Last 2 hours · audit checks are estimates for human review">
                <ul className="space-y-3">
                  {[...data.byType].sort((a, b) => ({ realtime: 0, kpi: 1, audit: 2 }[a.tier] - { realtime: 0, kpi: 1, audit: 2 }[b.tier]) || a.rate - b.rate).map((t) => (
                    <li key={t.type}>
                      <div className="mb-1 flex items-center justify-between gap-2 text-[13px]"><span className="min-w-0 truncate font-semibold">{t.label}</span><span className="flex items-center gap-1.5"><Badge tone={t.tier === 'realtime' ? 'ok' : t.tier === 'kpi' ? 'info' : 'warn'}>{t.tier === 'realtime' ? 'Real-time' : t.tier === 'kpi' ? 'KPI' : 'Audit'}</Badge><span className="tnum text-muted">{pct(t.rate, 1)}</span></span></div>
                      <Bar value={t.rate} color={`var(--${t.rate >= 0.95 ? 'ok' : t.rate >= 0.88 ? 'warn' : 'bad'})`} />
                    </li>
                  ))}
                </ul>
              </Card>
              {data.audit?.length > 0 && (
                <Card title="Audit queue" subtitle="Small-object flags for a supervisor to confirm from the clip. Never auto-alerted or ranked per person." pad={false}>
                  <ul className="max-h-60 divide-y divide-line overflow-y-auto px-5 pb-3">{data.audit.slice(0, 15).map((e) => (
                    <li key={e.id} className="flex items-center gap-2 py-2 text-[12.5px]"><Badge tone="warn">Review</Badge><span className="flex-1 truncate">{e.label}<span className="text-muted"> · {e.camera_name}</span></span><span className="font-mono text-[11px] text-muted">{clock(e.ts)}</span></li>
                  ))}</ul>
                </Card>
              )}
              <Card title="Detection log" pad={false}>
                <ul className="max-h-80 divide-y divide-line overflow-y-auto px-5 pb-3">
                  {data.events.slice(0, 30).map((e) => (
                    <li key={e.id} className="flex items-center gap-2 py-2 text-[12.5px]">
                      <Badge tone={SEVERITY_TONE[e.severity]} className="capitalize">{e.severity}</Badge>
                      <span className="flex-1 truncate font-medium">{e.label}<span className="text-muted"> · {e.camera_name}{e.zone ? ` · ${e.zone}` : ''}{e.duration_s ? ` · ${e.duration_s}s` : ''}</span></span>
                      <span className="font-mono text-[11px] text-muted">{clock(e.ts)}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
          {all && all.byBranch.length > 1 && (
            <Card className="mt-4" title="Compliance by branch" subtitle="Last 2 hours, all branches you can see">
              <div className="h-56">
                <ResponsiveContainer>
                  <BarChart data={all.byBranch.map((b) => ({ ...b, rate: Math.round(b.rate * 1000) / 10 }))} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <XAxis dataKey="name" {...AXIS} />
                    <YAxis {...AXIS} domain={[80, 100]} unit="%" width={44} />
                    <Tooltip contentStyle={TOOLTIP} cursor={{ fill: 'var(--surface-2)' }} formatter={(v) => [`${v}%`, 'Compliance']} />
                    <RBar dataKey="rate" radius={[8, 8, 0, 0]} maxBarSize={56}>
                      {all.byBranch.map((b) => <Cell key={b.outlet_id} fill={b.rate >= 0.95 ? 'var(--ok)' : b.rate >= 0.9 ? 'var(--warn)' : 'var(--bad)'} />)}
                    </RBar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
          <Card className="mt-4" title="Live model validation" subtitle="Run the detection model on this device’s camera to validate the event pipeline. Leaving the frame raises “station unattended”; a visible phone raises “phone on the line”.">
            <WebcamLab outlets={branches} />
          </Card>
          <Card className="mt-4" title="What this CCTV measures, and how reliably" subtitle="Based on pixel density at typical camera distances, 2 fps edge detection and published accuracy evidence. Each check is enabled per camera after an install-time pixel-density test." pad={false}>
            <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-[13px]"><thead className="border-b border-line bg-surface-2/60"><tr>{['Check', 'Tier', 'How it is measured'].map((h) => <th key={h} className="px-4 py-2 text-left text-[11px] font-bold tracking-wide text-muted uppercase">{h}</th>)}</tr></thead>
              <tbody>{(data.tiers || []).map((t) => (
                <tr key={t.id} className="border-t border-line/70"><td className="px-4 py-2 font-semibold">{t.label}</td>
                  <td className="px-4 py-2"><Badge tone={{ realtime: 'ok', kpi: 'info', audit: 'warn', dropped: 'muted' }[t.tier]}>{{ realtime: 'Real-time', kpi: 'KPI (aggregate)', audit: 'Audit (human review)', dropped: 'Not measured' }[t.tier]}</Badge></td>
                  <td className="px-4 py-2 text-muted">{t.metric}</td></tr>
              ))}</tbody></table></div>
          </Card>
        </>
      )}
    </>
  );
}

const STAGES = ['RTSP sub-stream', 'Detector', 'Tracker', 'Zones', 'Rules', 'Outbox'];

/** Health of the on-site edge agent(s) feeding this page, from their heartbeats. */
function EdgePipeline({ cameras }) {
  const live = cameras.filter((c) => c.last_seen);
  if (!live.length) return null;
  const avg = (k) => live.reduce((a, c) => a + (c[k] || 0), 0) / live.length;
  const newest = Math.max(...live.map((c) => c.last_seen));
  const offline = cameras.filter((c) => c.status === 'offline');
  return (
    <Card title="Edge pipeline" subtitle={live[0].agent} action={<Cpu size={16} className="text-primary" />}>
      <div className="flex flex-wrap items-center gap-1 text-[11px] font-semibold text-muted">
        {STAGES.map((s, i) => <span key={s} className="inline-flex items-center gap-1"><span className="rounded-md bg-surface-2 px-1.5 py-0.5">{s}</span>{i < STAGES.length - 1 && <ChevronRight size={11} />}</span>)}
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-surface-2 p-2"><dt className="text-[10.5px] text-muted">Frame rate</dt><dd className="tnum text-[15px] font-bold">{avg('fps').toFixed(1)} fps</dd></div>
        <div className="rounded-lg bg-surface-2 p-2"><dt className="text-[10.5px] text-muted">Latency</dt><dd className="tnum text-[15px] font-bold">{Math.round(avg('latency_ms'))} ms</dd></div>
        <div className="rounded-lg bg-surface-2 p-2"><dt className="text-[10.5px] text-muted">Heartbeat</dt><dd className="tnum text-[15px] font-bold">{ago(newest)}</dd></div>
      </dl>
      <p className="mt-2.5 text-[11.5px] leading-snug text-muted">Model: {live[0].model}. Only events leave the restaurant; video stays on the edge box.</p>
      {offline.length > 0 && <p className="mt-2 text-[12px] font-semibold text-bad">Offline: {offline.map((c) => c.name).join(', ')}</p>}
    </Card>
  );
}
