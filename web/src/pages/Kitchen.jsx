import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { Timer, CheckCircle2, Flame, ClipboardList, Bike, Utensils, ShoppingBag } from 'lucide-react';
import { useLive, mmss, pct, clock, num, api } from '../lib/api.js';
import { useAuth, useBranchQuery } from '../lib/auth.jsx';
import { Card, PageHeader, MiniStat, Bar, Loading, ErrorNote, Empty, TOOLTIP, AXIS } from '../components/ui.jsx';

function useNow() { const [n, s] = useState(Date.now()); useEffect(() => { const id = setInterval(() => s(Date.now()), 1000); return () => clearInterval(id); }, []); return n; }
const CH = { 'dine-in': [Utensils, 'Dine-in'], takeaway: [ShoppingBag, 'Takeaway'], delivery: [Bike, 'Delivery'], online: [Bike, 'Web order'] };

export default function Kitchen() {
  const { branch, branchName } = useAuth();
  const q = useBranchQuery();
  const { data, error, reload } = useLive(`/kitchen?${q}`, { types: ['ticket'], throttle: 2500 });
  const now = useNow();
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <><PageHeader title="Kitchen Operations" /><Loading /></>;
  const k = data.kpi;

  return (
    <>
      <PageHeader title={data.station ? `${data.station} Station` : 'Kitchen Operations'}
        subtitle={data.station ? 'Only tickets for your station are shown.' : 'Live tickets from every channel, with speed by station.'} />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MiniStat label="Avg ticket time (1h)" value={mmss(k.avg_sec)} icon={Timer} tone="info" />
        <MiniStat label="On time (1h)" value={pct(k.on_time)} icon={CheckCircle2} tone={k.on_time < 0.85 ? 'warn' : 'ok'} />
        <MiniStat label="Cooking now" value={data.open.length} icon={Flame} tone="offline" />
        <MiniStat label="Tickets today" value={num(data.today)} icon={ClipboardList} tone="primary" />
      </div>

      {!data.station && data.stations.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          {data.stations.map((s) => (
            <div key={s.station} className="rounded-2xl border border-line bg-surface p-3.5 shadow-card">
              <div className="text-sm font-bold">{s.station}</div>
              <div className="mt-1 text-xl font-extrabold tnum">{mmss(s.avg_sec)}</div>
              <div className="mb-2 text-[11px] text-muted">{s.open} cooking · {s.n}/h</div>
              <Bar value={s.on_time} color={`var(--${s.on_time >= 0.9 ? 'ok' : s.on_time >= 0.8 ? 'warn' : 'bad'})`} />
              <div className="mt-1 text-[11px] text-muted">{pct(s.on_time)} on time</div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card title="Live tickets" subtitle="Oldest first. Colour shows time against the dish’s target.">
          {data.open.length === 0 ? <Empty>No tickets cooking right now.</Empty> : (
            <div className="grid max-h-[560px] gap-2.5 overflow-y-auto pr-1 sm:grid-cols-2 2xl:grid-cols-3">
              {data.open.map((t) => {
                const el = (now - t.fired_at) / 1000, r = el / t.target_sec;
                const tone = r > 1.3 ? 'bad' : r > 0.9 ? 'warn' : 'ok';
                const [Icon, label] = CH[t.channel] || CH['dine-in'];
                return (
                  <div key={t.id} className="rounded-xl border border-line bg-surface p-3" style={{ borderTop: `3px solid var(--${tone})` }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted"><Icon size={13} />{t.channel === 'dine-in' ? `Table ${t.table_no}` : label}</span>
                      <span className="font-mono text-sm font-semibold tnum" style={{ color: `var(--${tone})` }}>{mmss(el)}</span>
                    </div>
                    <div className="mt-1 truncate text-[14px] font-bold">{t.item}</div>
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-muted"><span className="shrink-0">{t.station}</span><Bar value={r} color={`var(--${tone})`} height={4} /><span className="shrink-0 tnum">{mmss(t.target_sec)}</span></div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      {branch === 'all' ? <span className="text-[10.5px] text-faint">{branchName(t.outlet_id)}</span> : <span />}
                      <button onClick={async () => { try { await api(`/kitchen/tickets/${t.id}/ready`, { method: 'POST' }); reload?.(); } catch { /* ignore */ } }} className="rounded-lg bg-ok-soft px-2 py-1 text-[11px] font-bold text-ok hover:opacity-90">Bump · ready</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-4">
          <Card title="Ticket time today" subtitle="Average minutes per dish, every 30 min">
            <div className="h-48">
              <ResponsiveContainer>
                <LineChart data={data.series} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="bucket" tickFormatter={clock} {...AXIS} minTickGap={40} />
                  <YAxis {...AXIS} tickFormatter={(v) => `${v}m`} width={46} />
                  <ReferenceLine y={10} stroke="var(--warn)" strokeDasharray="4 4" />
                  <Tooltip contentStyle={TOOLTIP} labelFormatter={clock} formatter={(v) => [`${v.toFixed(1)} min`, 'Avg']} />
                  <Line type="monotone" dataKey="avg_min" stroke="var(--primary)" strokeWidth={2.2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Slowest dishes today" subtitle="Actual vs target time">
            <ul className="space-y-2.5">
              {data.slowest.map((s) => (
                <li key={s.item} className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="min-w-0"><span className="block truncate font-semibold">{s.item}</span><span className="text-[11px] text-muted">{s.station} · {s.n} made</span></span>
                  <span className={`shrink-0 font-mono font-semibold ${s.avg_sec > s.target * 1.1 ? 'text-bad' : 'text-muted'}`}>{mmss(s.avg_sec)} / {mmss(s.target)}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Just sent" pad={false}>
            <ul className="divide-y divide-line px-5 pb-3 text-[13px]">
              {data.done.slice(0, 8).map((t) => {
                const s = (t.ready_at - t.fired_at) / 1000;
                return <li key={t.id} className="flex justify-between gap-2 py-2"><span className="truncate">{t.item}</span><span className="font-mono tnum" style={{ color: s > t.target_sec * 1.3 ? 'var(--bad)' : 'var(--muted)' }}>{mmss(s)}</span></li>;
              })}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
