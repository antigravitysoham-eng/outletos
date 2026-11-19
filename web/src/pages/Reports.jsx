import { useMemo, useState } from 'react';
import { ComposedChart, Area, Line, Bar as RBar, LineChart, XAxis, YAxis, Tooltip, ResponsiveContainer, ScatterChart, Scatter, ZAxis, ReferenceLine, Cell } from 'recharts';
import { FileDown, Printer, Target, ShieldAlert, TrendingUp, CalendarRange, CircleCheck, TriangleAlert, CircleAlert, Info, Gauge } from 'lucide-react';
import { useLive, money, num, pct, mmss, BRANCH_COLORS } from '../lib/api.js';
import { useAuth, useBranchQuery } from '../lib/auth.jsx';
import { Card, PageHeader, Badge, Loading, ErrorNote, Button, TOOLTIP, AXIS } from '../components/ui.jsx';

const PERIODS = [['today', 'Today'], ['yesterday', 'Yesterday'], ['7d', '7 days'], ['14d', '14 days']];
const RAG = { green: { tone: 'ok', label: 'On target', color: 'var(--ok)' }, amber: { tone: 'warn', label: 'Watch', color: 'var(--warn)' }, red: { tone: 'bad', label: 'Off target', color: 'var(--bad)' }, none: { tone: 'muted', label: 'Tracked', color: 'var(--faint)' } };
const KRI_RAG = { ...RAG, green: { ...RAG.green, label: 'Within appetite' }, amber: { ...RAG.amber, label: 'Elevated' }, red: { ...RAG.red, label: 'Breach' } };
const CLASS_COLOR = { Star: 'var(--ok)', Plowhorse: 'var(--warn)', Puzzle: 'var(--info)', Dog: 'var(--bad)' };
const CLASS_ADVICE = { Star: 'Protect: keep quality and placement', Plowhorse: 'Re-engineer: trim cost or nudge price', Puzzle: 'Promote: better placement, staff upsell', Dog: 'Review: replace or remove' };

/** Format a value by unit */
function fmt(v, unit) {
  if (v == null || Number.isNaN(v)) return '—';
  switch (unit) {
    case 'money': return money(v);
    case 'money2': return money(v, { compact: false, cents: Math.abs(v) < 1000 });
    case 'pct': return pct(v, 0);
    case 'pct1': return pct(v, 1);
    case 'pctpt': return `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(1)}%`;
    case 'sec': return mmss(v);
    case 'rating': return `${v.toFixed(2)}★`;
    case 'dec': return v.toFixed(v >= 100 ? 0 : 2);
    default: return num(v);
  }
}

function Change({ value, unit, better }) {
  if (value == null || !Number.isFinite(value)) return <span className="text-muted">—</span>;
  const good = better === 'none' ? null : better === 'down' ? value < 0 : value > 0;
  const txt = unit === 'pctpt' ? `${value >= 0 ? '+' : '−'}${Math.abs(value * 100).toFixed(1)} pt` : `${value >= 0 ? '+' : '−'}${Math.abs(value * 100).toFixed(1)}%`;
  return <span className={`font-semibold tnum ${Math.abs(value) < 0.0005 || good == null ? 'text-muted' : good ? 'text-ok' : 'text-bad'}`}>{txt}</span>;
}

function Spark({ data, color = 'var(--primary)' }) {
  const d = (data || []).filter((x) => x.v != null);
  if (d.length < 2) return <span className="text-xs text-muted">—</span>;
  return (
    <div className="h-7 w-24">
      <ResponsiveContainer>
        <LineChart data={d} margin={{ top: 3, right: 2, left: 2, bottom: 3 }}>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.75} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function Dot({ status }) {
  const r = RAG[status] || RAG.none;
  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} title={r.label} />;
}

function SectionTitle({ n, title, subtitle, icon: Icon }) {
  return (
    <div className="mt-8 mb-3 flex items-end gap-3 print:mt-5 print:break-after-avoid">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><Icon size={18} /></span>
      <div>
        <div className="text-[11px] font-bold tracking-widest text-muted uppercase">Section {n}</div>
        <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>
      </div>
      {subtitle && <p className="ml-auto hidden max-w-md text-right text-xs text-muted md:block">{subtitle}</p>}
    </div>
  );
}

const th = 'px-3 py-2 text-left text-[11px] font-bold tracking-wide text-muted uppercase';
const td = 'px-3 py-2.5 align-middle';

// ---------- CSV export ----------
function toCsv(r) {
  const esc = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const rows = [];
  const push = (...cols) => rows.push(cols.map(esc).join(','));
  // Money and counts to 2 decimals; ratios (shares, rates) keep 4 significant decimals without trailing zeros
  const fx = (v) => (typeof v !== 'number' ? v ?? '' : Math.abs(v) >= 100 ? v.toFixed(2) : String(+v.toFixed(4)));
  push('OutletOS management report'); push('Period', r.periodLabel, 'Compared with', r.prevLabel); push('Branches', r.scope.map((b) => b.name).join(' | ')); push('Generated', new Date(r.ts).toISOString());
  push(); push('KPI scorecard'); push('Group', 'KPI', 'Actual', 'Target', 'Prior', 'Change', 'Status', 'Definition');
  r.kpis.forEach((k) => push(k.group, k.label, fx(k.value), fx(k.target), fx(k.prior), fx(k.change), k.status, k.def));
  push(); push('KRI register'); push('Indicator', 'Value', 'Amber', 'Red', 'Status', 'Branches in breach', 'Owner', 'Action');
  r.kris.forEach((k) => push(k.label, fx(k.value), k.amber, k.red, k.status, (k.breaches || []).join(' | '), k.owner, k.action));
  push(); push('Branch league'); push('Rank', 'Branch', 'KPIs on target', ...r.comparisons.leagueKpis.map((k) => k.label), 'Red KRIs');
  r.comparisons.league.forEach((l) => push(l.rank, l.name, `${l.on_target}/${l.scored}`, ...r.comparisons.leagueKpis.map((k) => fx(l.metrics[k.id]?.value)), l.red_kris));
  if (r.forecast) {
    push(); push('Forecast (next 7 days)'); push('Date', 'Forecast', 'Low (80%)', 'High (80%)', 'Budget', 'Orders', 'Labour hours needed', 'Labour hours rostered', 'Food purchase');
    r.forecast.days.forEach((d) => push(d.date, d.value.toFixed(0), d.low.toFixed(0), d.high.toFixed(0), d.target, d.orders?.toFixed(0), d.labour_needed?.toFixed(0), d.labour_rostered?.toFixed(0), d.food_purchase.toFixed(0)));
  }
  if (r.menu) {
    push(); push('Menu engineering'); push('Item', 'Category', 'Qty', 'Mix', 'Price', 'Food cost', 'Contribution margin', 'Total margin', 'Class');
    r.menu.items.forEach((i) => push(i.name, i.category, i.qty, i.mix.toFixed(4), i.price, i.cost, i.cm.toFixed(2), i.margin.toFixed(2), i.class));
  }
  return rows.join('\n');
}
function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Reports() {
  const { user, group } = useAuth();
  const bq = useBranchQuery();
  const [period, setPeriod] = useState(() => { try { return localStorage.getItem('report-period') || '7d'; } catch { return '7d'; } });
  const choose = (p) => { setPeriod(p); try { localStorage.setItem('report-period', p); } catch { /* ignore */ } };
  const { data: r, error } = useLive(`/reports?period=${period}${bq ? '&' + bq : ''}`, { types: ['order'], throttle: 30000, interval: 60000 });

  const groups = useMemo(() => {
    const g = new Map();
    (r?.kpis || []).forEach((k) => (g.get(k.group) ?? g.set(k.group, []).get(k.group)).push(k));
    return [...g.entries()];
  }, [r]);

  const right = (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <div className="inline-flex rounded-xl border border-line bg-surface p-1" role="tablist" aria-label="Reporting period">
        {PERIODS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={period === id} onClick={() => choose(id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${period === id ? 'grad-primary text-white shadow-sm' : 'text-muted hover:text-ink'}`}>{label}</button>
        ))}
      </div>
      <Button onClick={() => r && download(`outletos-report-${period}-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(r))} disabled={!r}><FileDown size={15} />Export CSV</Button>
      <Button onClick={() => window.print()} disabled={!r}><Printer size={15} />Print / PDF</Button>
    </div>
  );

  if (error) return <><PageHeader title="Reports & Analytics" right={right} /><ErrorNote>{error}</ErrorNote></>;
  if (!r) return <><PageHeader title="Reports & Analytics" subtitle="KPIs, risk indicators, comparisons and forecasts." right={right} /><Loading /></>;

  const fmtDate = (ms) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const range = r.period === 'today' ? `${fmtDate(r.from)}, 00:00 – ${new Date(r.to).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : `${fmtDate(r.from)} – ${fmtDate(r.to - 1)}`;
  const early = r.period === 'today' && r.forecast && r.forecast.today.share_done < 0.12;
  let section = 0;

  return (
    <div className="report">
      <PageHeader title="Reports & Analytics" subtitle="Management report: KPI scorecard, key risk indicators, comparisons and forecasts. Every figure is computed live from your branches' data." right={right} />

      {/* Report cover */}
      <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <div className="grad-primary px-6 py-5 text-white">
          <div className="text-[11px] font-bold tracking-widest uppercase opacity-80">{group} · Management report</div>
          <div className="mt-1 text-2xl font-extrabold tracking-tight">{r.periodLabel}{r.scope.length === 1 ? ` · ${r.scope[0].name}` : ` · ${r.scope.length} branches`}</div>
          <div className="mt-1 text-sm opacity-90">{range} · compared with {r.prevLabel}{r.department ? ` · ${r.department} team` : ''}</div>
        </div>
        <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Target, label: 'KPIs on target', value: `${r.headline.on_target} / ${r.headline.scored}`, tone: r.headline.on_target / Math.max(1, r.headline.scored) >= 0.7 ? 'ok' : 'warn' },
            { icon: ShieldAlert, label: 'Risk indicators in breach', value: r.headline.red_kris, tone: r.headline.red_kris ? 'bad' : 'ok', sub: `${r.headline.amber_kris} elevated` },
            ...(r.forecast ? [
              { icon: TrendingUp, label: 'Next 7 days forecast', value: money(r.forecast.week_total), tone: r.forecast.week_total >= r.forecast.week_target ? 'ok' : 'warn', sub: r.forecast.week_target > 0 ? `${pct(r.forecast.week_total / r.forecast.week_target - 1, 1)} vs budget` : 'no budget set' },
              { icon: Gauge, label: 'Forecast accuracy (backtest)', value: r.forecast.accuracy ? pct(1 - r.forecast.accuracy.mape, 1) : '—', tone: 'info', sub: r.forecast.accuracy ? `MAPE ${pct(r.forecast.accuracy.mape, 1)} over last 7 days` : '' },
            ] : [
              { icon: CalendarRange, label: 'Prepared for', value: user.name, tone: 'info', sub: user.roleLabel },
              { icon: Info, label: 'Generated', value: new Date(r.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), tone: 'muted', sub: fmtDate(r.ts) },
            ]),
          ].map(({ icon: Icon, label, value, tone, sub }) => (
            <div key={label} className="flex items-center gap-3 bg-surface px-5 py-4">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-${tone}-soft text-${tone}`} style={tone === 'muted' ? { background: 'var(--surface-2)', color: 'var(--muted)' } : undefined}><Icon size={18} /></span>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-muted">{label}</div>
                <div className="truncate text-xl font-extrabold tnum">{value}</div>
                {sub && <div className="truncate text-[11px] text-muted">{sub}</div>}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-line px-6 py-4">
          <div className="mb-2 text-[11px] font-bold tracking-widest text-muted uppercase">Executive summary</div>
          {early && <p className="mb-2 rounded-lg bg-info-soft px-3 py-2 text-xs text-info">Early in the trading day: only {pct(r.forecast.today.share_done)} of a usual day's sales are done, so today's comparisons are volatile. Use 7 or 14 days for trends.</p>}
          <ul className="space-y-1.5">
            {r.summary.map((s, i) => {
              const Icon = s.tone === 'good' ? CircleCheck : s.tone === 'bad' ? CircleAlert : Info;
              return <li key={i} className="flex gap-2 text-sm leading-relaxed"><Icon size={16} className={`mt-0.5 shrink-0 ${s.tone === 'good' ? 'text-ok' : s.tone === 'bad' ? 'text-bad' : 'text-muted'}`} /><span>{s.text}</span></li>;
            })}
          </ul>
        </div>
      </section>

      {/* 1. KPI scorecard */}
      <SectionTitle n={++section} icon={Target} title="KPI scorecard" subtitle={`Actual vs target and vs ${r.prevLabel}. Trend shows the last 14 days plus today.`} />
      <Card pad={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-line bg-surface-2/60"><tr>
              <th className={th}>KPI</th><th className={`${th} text-right`}>Actual</th><th className={`${th} text-right`}>Target</th><th className={`${th} text-right`}>Prior</th>
              <th className={`${th} text-right`}>Change</th><th className={th}>Status</th><th className={th}>Trend</th>
            </tr></thead>
            {groups.map(([g, list]) => (
              <tbody key={g} className="print:break-inside-avoid">
                <tr><td colSpan={7} className="bg-surface-2/40 px-3 py-1.5 text-[11px] font-bold tracking-widest text-muted uppercase">{g}</td></tr>
                {list.map((k) => (
                  <tr key={k.id} className="border-t border-line/70">
                    <td className={td}><div className="font-semibold">{k.label}</div><div className="text-[11px] text-muted">{k.def}</div></td>
                    <td className={`${td} whitespace-nowrap text-right font-bold tnum`}>{fmt(k.value, k.unit)}</td>
                    <td className={`${td} whitespace-nowrap text-right text-muted tnum`}>{k.target != null ? fmt(k.target, k.unit) : '—'}</td>
                    <td className={`${td} whitespace-nowrap text-right text-muted tnum`}>{fmt(k.prior, k.unit)}</td>
                    <td className={`${td} whitespace-nowrap text-right`}><Change value={k.change} unit={k.unit} better={k.better} /></td>
                    <td className={td}><span className="inline-flex items-center gap-2 whitespace-nowrap"><Dot status={k.status} /><span className="text-xs font-semibold">{RAG[k.status].label}</span></span></td>
                    <td className={td}><Spark data={k.trend} color={RAG[k.status].color === 'var(--faint)' ? 'var(--primary)' : RAG[k.status].color} /></td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </Card>

      {/* 2. KRI register */}
      {r.kris.length > 0 && <>
        <SectionTitle n={++section} icon={ShieldAlert} title="Key risk indicators" subtitle="Leading signals of financial, food-safety, people and guest risk, with risk-appetite thresholds and owners." />
        <Card pad={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b border-line bg-surface-2/60"><tr>
                <th className={th}>Indicator</th><th className={`${th} text-right`}>Current</th><th className={`${th} text-right`}>Amber / red</th><th className={th}>Status</th>
                <th className={th}>Branches</th><th className={th}>Owner · response</th>
              </tr></thead>
              <tbody>
                {[...r.kris].sort((a, b) => ({ red: 0, amber: 1, green: 2, none: 3 }[a.status] - { red: 0, amber: 1, green: 2, none: 3 }[b.status])).map((k) => (
                  <tr key={k.id} className="border-t border-line/70 print:break-inside-avoid">
                    <td className={td}><div className="font-semibold">{k.label}</div>{(k.live || k.forward) && <div className="text-[11px] text-muted">{k.live ? 'Live, current state' : 'Forward-looking'}</div>}</td>
                    <td className={`${td} whitespace-nowrap text-right font-bold tnum`}>{fmt(k.value, k.unit)}</td>
                    <td className={`${td} whitespace-nowrap text-right text-xs text-muted tnum`}>{k.worse === 'up' ? '≥' : '≤'} {fmt(k.amber, k.unit)} / {fmt(k.red, k.unit)}</td>
                    <td className={td}><Badge tone={KRI_RAG[k.status].tone}>{k.status === 'red' ? <TriangleAlert size={11} /> : null}{KRI_RAG[k.status].label}</Badge></td>
                    <td className={td}>
                      <div className="flex max-w-[260px] flex-wrap gap-1">
                        {(k.branches || []).length > 1 ? k.branches.map((b) => (
                          <span key={b.id} title={`${b.name}: ${fmt(b.value, k.unit)}`} className="inline-flex items-center gap-1 rounded-md border border-line px-1.5 py-0.5 text-[11px] font-semibold tnum">
                            <Dot status={b.status} />{b.name.replace('Restaurant ', 'R')} {fmt(b.value, k.unit)}
                          </span>
                        )) : <span className="text-xs text-muted">{k.live ? 'Group, now' : '—'}</span>}
                      </div>
                    </td>
                    <td className={td}><div className="text-xs font-semibold">{k.owner}</div><div className="max-w-[300px] text-[11px] leading-snug text-muted">{k.action}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </>}

      {/* 3. Comparisons */}
      <SectionTitle n={++section} icon={CalendarRange} title="Comparisons" subtitle={`Branch against branch, and this period against ${r.prevLabel}.`} />
      {r.comparisons.league.length > 1 && (
        <Card title="Branch league table" subtitle="Ranked by share of KPIs on target, then net sales. Cells are coloured against each KPI's target." pad={false} className="mb-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b border-line bg-surface-2/60"><tr>
                <th className={th}>#</th><th className={th}>Branch</th><th className={`${th} text-right`}>On target</th>
                {r.comparisons.leagueKpis.map((k) => <th key={k.id} className={`${th} text-right`}>{k.label.replace('Average ', 'Avg ').replace(' compliance', '')}</th>)}
                {r.comparisons.league[0].change !== null && <th className={`${th} text-right`}>Sales Δ</th>}
                <th className={`${th} text-right`}>Red KRIs</th>
              </tr></thead>
              <tbody>
                {r.comparisons.league.map((l) => (
                  <tr key={l.id} className="border-t border-line/70">
                    <td className={`${td} font-extrabold text-muted`}>{l.rank}</td>
                    <td className={td}><span className="inline-flex items-center gap-2 font-semibold whitespace-nowrap"><span className="h-2.5 w-2.5 rounded-full" style={{ background: BRANCH_COLORS[l.id] }} />{l.name}</span><div className="text-[11px] text-muted">{l.city}</div></td>
                    <td className={`${td} whitespace-nowrap text-right font-bold tnum`}>{l.on_target}/{l.scored}</td>
                    {r.comparisons.leagueKpis.map((k) => {
                      const m = l.metrics[k.id] || {};
                      const bg = m.status === 'green' ? 'bg-ok-soft' : m.status === 'amber' ? 'bg-warn-soft' : m.status === 'red' ? 'bg-bad-soft' : '';
                      return <td key={k.id} className={`${td} whitespace-nowrap text-right tnum`}><span className={`rounded-md px-1.5 py-0.5 ${bg}`}>{fmt(m.value, k.unit)}</span></td>;
                    })}
                    {l.change !== null && <td className={`${td} whitespace-nowrap text-right`}><Change value={l.change} better="up" /></td>}
                    <td className={`${td} whitespace-nowrap text-right`}>{l.red_kris ? <Badge tone="bad">{l.red_kris}</Badge> : <span className="text-muted">0</span>}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-line bg-surface-2/40 font-semibold">
                  <td className={td} /><td className={td}>Group</td><td className={td} />
                  {r.comparisons.leagueKpis.map((k) => <td key={k.id} className={`${td} whitespace-nowrap text-right tnum`}>{fmt(r.comparisons.groupAvg[k.id], k.unit)}</td>)}
                  {r.comparisons.league[0].change !== null && <td className={td} />}<td className={td} />
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {r.comparisons.daily && (
        <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <Card title={r.comparisons.dailyIsHourly ? 'Today by hour vs same day last week' : 'Net sales by day vs prior period'} subtitle={r.comparisons.dailyIsHourly ? 'Bars: today · line: last week' : `Bars: this period · line: ${r.prevLabel} · dashed: budget`}>
            <div className="h-64">
              <ResponsiveContainer>
                <ComposedChart data={r.comparisons.daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" minTickGap={12} />
                  <YAxis {...AXIS} width={72} tickFormatter={(v) => money(v)} />
                  <Tooltip contentStyle={TOOLTIP} formatter={(v, n) => [money(v, { compact: false }), n]} />
                  <RBar dataKey="sales" name="This period" fill="var(--primary)" radius={[5, 5, 0, 0]} maxBarSize={36} isAnimationActive={false} />
                  <Line dataKey="prior" name={r.prevLabel} stroke="var(--info)" strokeWidth={2} dot={false} isAnimationActive={false} />
                  {!r.comparisons.dailyIsHourly && <Line dataKey="target" name="Budget" stroke="var(--muted)" strokeDasharray="5 4" strokeWidth={1.5} dot={false} isAnimationActive={false} />}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Channel mix" subtitle={`Share of net sales, this period vs ${r.prevLabel}`} pad={false}>
            <table className="w-full text-sm">
              <thead className="border-b border-line"><tr><th className={th}>Channel</th><th className={`${th} text-right`}>Sales</th><th className={`${th} text-right`}>Share</th><th className={`${th} text-right`}>Prior share</th><th className={`${th} text-right`}>Δ sales</th></tr></thead>
              <tbody>{r.comparisons.channels.map((c) => (
                <tr key={c.channel} className="border-t border-line/70">
                  <td className={`${td} font-semibold`}>{c.label}</td><td className={`${td} whitespace-nowrap text-right tnum`}>{money(c.sales)}</td>
                  <td className={`${td} whitespace-nowrap text-right tnum`}>{pct(c.share, 1)}</td><td className={`${td} whitespace-nowrap text-right text-muted tnum`}>{pct(c.prior_share, 1)}</td>
                  <td className={`${td} whitespace-nowrap text-right`}><Change value={c.change} better="up" /></td>
                </tr>
              ))}</tbody>
            </table>
            <div className="border-t border-line px-3 pt-3 pb-1 text-[11px] font-bold tracking-widest text-muted uppercase">Dayparts</div>
            <table className="w-full text-sm">
              <tbody>{r.comparisons.dayparts.map((d) => (
                <tr key={d.label} className="border-t border-line/70">
                  <td className={td}><span className="font-semibold">{d.label}</span> <span className="text-[11px] text-muted">{d.hours}</span></td>
                  <td className={`${td} whitespace-nowrap text-right tnum`}>{money(d.sales)}</td><td className={`${td} whitespace-nowrap text-right tnum text-muted`}>{pct(d.share, 0)}</td>
                  <td className={`${td} whitespace-nowrap text-right tnum text-muted`}>AOV {money(d.aov, { compact: false })}</td>
                  <td className={`${td} whitespace-nowrap text-right`}><Change value={d.change} better="up" /></td>
                </tr>
              ))}</tbody>
            </table>
          </Card>
        </div>
      )}

      {/* 4. Forecast */}
      {r.forecast && <>
        <SectionTitle n={++section} icon={TrendingUp} title="Forecast" subtitle={r.forecast.method} />
        <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <Card title="Net sales: last 14 days and next 7" subtitle="Shaded band is the 80% prediction interval; dashed line is budget">
            <div className="h-64">
              <ResponsiveContainer>
                <ComposedChart data={[
                  ...r.forecast.history.map((h) => ({ label: h.label, actual: h.actual, target: h.target })),
                  ...r.forecast.days.map((d) => ({ label: new Date(d.d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), forecast: d.value, band: [d.low, d.high], target: d.target })),
                ]} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <XAxis dataKey="label" {...AXIS} minTickGap={14} />
                  <YAxis {...AXIS} width={72} tickFormatter={(v) => money(v)} />
                  <Tooltip contentStyle={TOOLTIP} formatter={(v, n) => [Array.isArray(v) ? `${money(v[0])} – ${money(v[1])}` : money(v, { compact: false }), n]} />
                  <Area dataKey="band" name="80% range" stroke="none" fill="var(--primary)" fillOpacity={0.14} isAnimationActive={false} />
                  <RBar dataKey="actual" name="Actual" fill="var(--info)" radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
                  <Line dataKey="forecast" name="Forecast" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
                  <Line dataKey="target" name="Budget" stroke="var(--muted)" strokeDasharray="5 4" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Today: projected close" subtitle={`${pct(r.forecast.today.share_done)} of a usual day's sales done so far`}>
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-[30px] leading-none font-extrabold tnum">{money(r.forecast.today.projection)}</div>
                <div className="mt-1 text-xs text-muted">range {money(r.forecast.today.low)} – {money(r.forecast.today.high)} · budget {money(r.forecast.today.target)}</div>
              </div>
              <div className="text-right">
                <div className={`text-2xl font-extrabold tnum ${r.forecast.today.p_hit >= 0.6 ? 'text-ok' : r.forecast.today.p_hit >= 0.35 ? 'text-warn' : 'text-bad'}`}>{pct(r.forecast.today.p_hit)}</div>
                <div className="text-[11px] text-muted">chance of hitting budget</div>
              </div>
            </div>
            <div className="mt-3 h-36">
              <ResponsiveContainer>
                <ComposedChart data={r.forecast.today.hourly} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <XAxis dataKey="label" {...AXIS} interval={5} />
                  <YAxis hide />
                  <Tooltip contentStyle={TOOLTIP} formatter={(v, n) => [money(v, { compact: false }), n]} />
                  <RBar dataKey="actual" name="Actual" fill="var(--primary)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  <Line dataKey="forecast" name="Expected" stroke="var(--info)" strokeWidth={2} dot={false} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            {r.forecast.accuracy && <p className="mt-2 text-[11px] text-muted">Model check: forecasting last week from the weeks before it gave a mean error of {pct(r.forecast.accuracy.mape, 1)}; {Math.round(r.forecast.accuracy.coverage * 7)} of 7 days fell inside the 80% range. Trend {pct(r.forecast.trend_per_week, 1)} per week.</p>}
          </Card>
        </div>
        <Card title="7-day plan" subtitle={`Forecast sales and orders, the labour hours they need at ${r.kpis.find((k) => k.id === 'tpph')?.target ?? 2.2} orders per labour hour, and the food purchase they imply`} pad={false} className="mt-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b border-line bg-surface-2/60"><tr>
                <th className={th}>Day</th><th className={`${th} text-right`}>Forecast</th><th className={`${th} text-right`}>80% range</th><th className={`${th} text-right`}>vs budget</th>
                <th className={`${th} text-right`}>Orders</th><th className={`${th} text-right`}>Labour h needed</th><th className={`${th} text-right`}>Rostered</th><th className={`${th} text-right`}>Food purchase</th>
              </tr></thead>
              <tbody>
                {r.forecast.days.map((d) => {
                  const gap = d.labour_needed != null ? d.labour_rostered - d.labour_needed : null;
                  return (
                    <tr key={d.date} className="border-t border-line/70">
                      <td className={`${td} font-semibold`}>{d.label}</td>
                      <td className={`${td} whitespace-nowrap text-right font-bold tnum`}>{money(d.value, { compact: false })}</td>
                      <td className={`${td} whitespace-nowrap text-right text-xs text-muted tnum`}>{money(d.low)} – {money(d.high)}</td>
                      <td className={`${td} whitespace-nowrap text-right`}><Change value={d.target > 0 ? d.value / d.target - 1 : null} better="up" /></td>
                      <td className={`${td} whitespace-nowrap text-right tnum`}>{num(d.orders)}</td>
                      <td className={`${td} whitespace-nowrap text-right tnum`}>{num(d.labour_needed)}</td>
                      <td className={`${td} whitespace-nowrap text-right tnum`}>{num(d.labour_rostered)} {gap != null && <span className={`ml-1 text-[11px] font-semibold ${Math.abs(gap) / d.labour_needed < 0.1 ? 'text-muted' : gap > 0 ? 'text-warn' : 'text-bad'}`}>{gap > 0 ? '+' : '−'}{num(Math.abs(gap))}</span>}</td>
                      <td className={`${td} whitespace-nowrap text-right tnum`}>{money(d.food_purchase)}</td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-line bg-surface-2/40 font-semibold">
                  <td className={td}>Week</td><td className={`${td} whitespace-nowrap text-right tnum`}>{money(r.forecast.week_total, { compact: false })}</td>
                  <td className={`${td} whitespace-nowrap text-right text-xs tnum`}>{money(r.forecast.week_low)} – {money(r.forecast.week_high)}</td>
                  <td className={`${td} whitespace-nowrap text-right`}><Change value={r.forecast.week_target > 0 ? r.forecast.week_total / r.forecast.week_target - 1 : null} better="up" /></td>
                  <td className={`${td} whitespace-nowrap text-right tnum`}>{num(r.forecast.days.reduce((a, d) => a + (d.orders || 0), 0))}</td>
                  <td className={`${td} whitespace-nowrap text-right tnum`}>{num(r.forecast.days.reduce((a, d) => a + (d.labour_needed || 0), 0))}</td>
                  <td className={`${td} whitespace-nowrap text-right tnum`}>{num(r.forecast.days.reduce((a, d) => a + d.labour_rostered, 0))}</td>
                  <td className={`${td} whitespace-nowrap text-right tnum`}>{money(r.forecast.days.reduce((a, d) => a + d.food_purchase, 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {r.forecast.branches.length > 1 && (
            <div className="grid gap-px border-t border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
              {r.forecast.branches.map((b) => (
                <div key={b.id} className="bg-surface px-4 py-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold"><span className="h-2 w-2 rounded-full" style={{ background: BRANCH_COLORS[b.id] }} />{b.name}</div>
                  <div className="mt-0.5 font-extrabold tnum">{money(b.week)}</div>
                  <div className="text-[11px]"><Change value={b.gap} better="up" /> <span className="text-muted">vs budget · trend {pct(b.trend_per_week, 1)}/wk</span></div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </>}

      {/* 5. Menu engineering */}
      {r.menu && r.menu.items.length > 0 && <>
        <SectionTitle n={++section} icon={Gauge} title="Menu engineering" subtitle="Kasavana–Smith matrix: popularity (menu mix vs 70% of fair share) against contribution margin (vs weighted average)." />
        <div className="grid gap-4 xl:grid-cols-[1fr_1.3fr]">
          <Card title="Popularity × profitability" subtitle={`Fair-share line ${pct(r.menu.popThreshold, 1)} mix · average margin ${money(r.menu.avgCm, { compact: false, cents: true })}`}>
            <div className="mb-1 flex flex-wrap gap-3 text-[11px] font-semibold">{Object.keys(CLASS_COLOR).map((c) => <span key={c} className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: CLASS_COLOR[c] }} />{c}</span>)}</div>
            <div className="h-72">
              <ResponsiveContainer>
                <ScatterChart margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                  <XAxis type="number" dataKey="mix" name="Menu mix" {...AXIS} tickFormatter={(v) => pct(v, 0)} />
                  <YAxis type="number" dataKey="cm" name="Margin" {...AXIS} width={64} tickFormatter={(v) => money(v)} />
                  <ZAxis type="number" dataKey="margin" range={[40, 360]} />
                  <ReferenceLine x={r.menu.popThreshold} stroke="var(--faint)" strokeDasharray="4 4" />
                  <ReferenceLine y={r.menu.avgCm} stroke="var(--faint)" strokeDasharray="4 4" />
                  <Tooltip contentStyle={TOOLTIP} formatter={(v, n) => [n === 'Menu mix' ? pct(v, 1) : money(v, { compact: false, cents: true }), n]} labelFormatter={() => ''}
                    content={({ payload }) => payload?.[0] ? <div style={TOOLTIP} className="px-3 py-2"><b>{payload[0].payload.name}</b><div>{payload[0].payload.class} · mix {pct(payload[0].payload.mix, 1)} · margin {money(payload[0].payload.cm, { compact: false, cents: true })}</div></div> : null} />
                  <Scatter data={r.menu.items} isAnimationActive={false}>{r.menu.items.map((i) => <Cell key={i.id} fill={CLASS_COLOR[i.class]} fillOpacity={0.8} />)}</Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Items by total margin" pad={false}>
            <div className="max-h-[330px] overflow-y-auto print:max-h-none">
              <table className="w-full text-sm">
                <thead className="sticky top-0 border-b border-line bg-surface"><tr><th className={th}>Item</th><th className={`${th} text-right`}>Qty</th><th className={`${th} text-right`}>Food %</th><th className={`${th} text-right`}>Margin</th><th className={th}>Class · action</th></tr></thead>
                <tbody>{r.menu.items.map((i) => (
                  <tr key={i.id} className="border-t border-line/70">
                    <td className={td}><div className="font-semibold">{i.name}</div><div className="text-[11px] text-muted">{i.category}</div></td>
                    <td className={`${td} whitespace-nowrap text-right tnum`}>{num(i.qty)}</td>
                    <td className={`${td} whitespace-nowrap text-right tnum`}>{pct(i.food_pct, 0)}</td>
                    <td className={`${td} whitespace-nowrap text-right font-semibold tnum`}>{money(i.margin)}</td>
                    <td className={td}><span className="inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: CLASS_COLOR[i.class] }}><span className="h-2 w-2 rounded-full" style={{ background: CLASS_COLOR[i.class] }} />{i.class}</span><div className="text-[11px] text-muted">{CLASS_ADVICE[i.class]}</div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </Card>
        </div>
      </>}

      <p className="mt-8 text-center text-[11px] text-muted">
        {group} · OutletOS management report · {r.periodLabel} · generated {new Date(r.ts).toLocaleString()} for {user.name} ({user.roleLabel}). Figures you are not permitted to see are not computed. Confidential.
      </p>
    </div>
  );
}
