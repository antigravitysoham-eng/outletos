import { LineChart, Line, YAxis, ResponsiveContainer, ReferenceArea } from 'recharts';
import { Thermometer, CheckCircle2, AlertTriangle, ClipboardCheck } from 'lucide-react';
import { useLive, clock } from '../lib/api.js';
import { useBranchQuery } from '../lib/auth.jsx';
import { Card, PageHeader, MiniStat, Badge, Loading, ErrorNote } from '../components/ui.jsx';

export default function Safety() {
  const q = useBranchQuery();
  const { data, error } = useLive(`/safety?${q}`, { types: [], interval: 20000 });
  const { data: alerts } = useLive(`/alerts?status=all&limit=300&${q}`, { types: ['alert'] });
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <><PageHeader title="Food Safety & HACCP" /><Loading /></>;
  const groups = [...new Map(data.map((s) => [s.outlet_id, s.branch])).entries()];
  const out = data.filter((s) => s.ok === false);
  const log = (alerts || []).filter((a) => a.category === 'safety');

  return (
    <>
      <PageHeader title="Food Safety & HACCP" subtitle="Every fridge and freezer logs a reading each minute. Excursions are timestamped automatically, so the HACCP log can't be skipped or filled in later." />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MiniStat label="Sensors" value={data.length} icon={Thermometer} tone="info" />
        <MiniStat label="In safe range" value={data.length - out.length} icon={CheckCircle2} tone="ok" />
        <MiniStat label="Out of range now" value={out.length} icon={AlertTriangle} tone={out.length ? 'bad' : undefined} />
        <MiniStat label="Excursions logged today" value={log.length} icon={ClipboardCheck} tone="primary" />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid min-w-0 gap-4">
          {groups.map(([oid, name]) => (
            <Card key={oid} title={name}>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.filter((s) => s.outlet_id === oid).map((s) => {
                  const pad = (s.max - s.min) * 0.8;
                  const bad = s.ok === false;
                  return (
                    <div key={s.id} className={`rounded-xl border p-3 ${bad ? 'border-bad bg-bad-soft' : 'border-line'}`}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[13px] font-semibold">{s.name}</span>
                        <span className="text-lg font-extrabold tnum" style={{ color: bad ? 'var(--bad)' : undefined }}>{s.value?.toFixed(1)}{s.unit}</span>
                      </div>
                      <div className="h-10">
                        <ResponsiveContainer>
                          <LineChart data={s.history} margin={{ top: 3, right: 0, left: 0, bottom: 0 }}>
                            <YAxis hide domain={[s.min - pad, s.max + pad]} />
                            <ReferenceArea y1={s.min} y2={s.max} fill="var(--ok)" fillOpacity={0.1} />
                            <Line dataKey="value" type="monotone" stroke={bad ? 'var(--bad)' : 'var(--ok)'} dot={false} strokeWidth={2} isAnimationActive={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="text-[11px] text-muted">Safe {s.min} to {s.max}{s.unit}</div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
        <Card title="HACCP excursion log" subtitle="Logged automatically" className="h-fit">
          <ul className="divide-y divide-line">
            {log.length === 0 && <li className="py-4 text-sm text-muted">No excursions today.</li>}
            {log.slice(0, 15).map((a) => (
              <li key={a.id} className="py-2.5 text-[13px]">
                <div className="flex items-center justify-between gap-2"><span className="truncate font-semibold">{a.title}</span>{a.ack ? <Badge>Closed</Badge> : <Badge tone="bad">Open</Badge>}</div>
                <div className="text-[11px] text-muted">{a.branch} · {clock(a.ts)} · {a.detail}</div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
