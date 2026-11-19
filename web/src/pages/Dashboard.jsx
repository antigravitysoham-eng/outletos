import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AreaChart, Area, ComposedChart, Line, BarChart, Bar as RBar, PieChart, Pie, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { UserRound, Pizza, Beef, Salad, CakeSlice, CupSoda, Soup, Drumstick, Fish, Sparkles, ArrowUpRight, ArrowDownRight, Bike, Store, Trophy, BellRing } from 'lucide-react';
import { useLive, money, pct, num, delta, BRANCH_COLORS, SOURCE_COLORS, ago } from '../lib/api.js';
import { useAuth, useBranchQuery } from '../lib/auth.jsx';
import { Card, Badge, Loading, ErrorNote, TOOLTIP, AXIS, SEVERITY_TONE } from '../components/ui.jsx';
import LiveFeed from '../components/LiveFeed.jsx';
import Staffing from '../components/Staffing.jsx';

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const toneOf = (v, good = 0.9, ok = 0.8) => (v >= good ? 'ok' : v >= ok ? 'warn' : 'bad');
const DISH_ICON = (name, cat) => {
  if (/pizza/i.test(name)) return Pizza; if (/steak|burger/i.test(name)) return Beef; if (/salmon|calamari/i.test(name)) return Fish;
  if (/wings|tikka/i.test(name)) return Drumstick; if (cat === 'Desserts') return CakeSlice; if (cat === 'Drinks') return CupSoda;
  if (/salad|burrata/i.test(name)) return Salad; return Soup;
};

/* ---------- Metric tiles: one visual language per metric ---------- */
function Tile({ label, value, caption, tone = 'primary', children }) {
  return (
    <div className="flex min-w-0 flex-col rounded-3xl border border-line bg-surface p-4 shadow-card">
      <div className="text-[13px] font-bold text-muted">{label}</div>
      <div className="mt-1 text-[26px] leading-none font-extrabold tracking-tight tnum" style={{ color: tone === 'ink' ? undefined : `var(--${tone})` }}>{value}</div>
      <div className="flex flex-1 items-center py-3">{children}</div>
      {caption && <div className="text-[11px] leading-snug font-medium text-muted">{caption}</div>}
    </div>
  );
}

/** Split bar: two shares side by side */
function SplitBar({ a, b, colorA, colorB, iconA: A, iconB: B }) {
  const total = Math.max(1, a + b), pa = a / total;
  return (
    <div className="w-full">
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        <div style={{ width: `${pa * 100}%`, background: colorA }} className="transition-[width] duration-700" />
        <div style={{ width: `${(1 - pa) * 100}%`, background: colorB }} />
      </div>
      <div className="mt-2 flex justify-between text-[11px] font-semibold text-muted">
        <span className="flex items-center gap-1"><A size={12} style={{ color: colorA }} />{pct(pa)}</span>
        <span className="flex items-center gap-1">{pct(1 - pa)}<B size={12} style={{ color: colorB }} /></span>
      </div>
    </div>
  );
}

/** Half-circle gauge with a target tick */
function HalfGauge({ value, target, color }) {
  const v = Math.max(0, Math.min(1, value));
  const R = 52, C = Math.PI * R;
  const a = Math.PI * target;
  const tx = 60 - Math.cos(a) * R, ty = 60 - Math.sin(a) * R;
  return (
    <svg viewBox="0 0 120 66" className="mx-auto w-full max-w-[150px]">
      <path d="M8 60 A52 52 0 0 1 112 60" fill="none" stroke="var(--surface-2)" strokeWidth="12" strokeLinecap="round" />
      <path d="M8 60 A52 52 0 0 1 112 60" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - v)} style={{ transition: 'stroke-dashoffset 1s ease' }} />
      <line x1={60 - Math.cos(a) * (R + 7)} y1={60 - Math.sin(a) * (R + 7)} x2={60 - Math.cos(a) * (R - 8)} y2={60 - Math.sin(a) * (R - 8)} stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" />
      <text x="60" y="58" textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--muted)">target {Math.round(target * 100)}%</text>
    </svg>
  );
}

/** Segmented meter */
function Segments({ value, color, n = 10 }) {
  const on = Math.round(Math.max(0, Math.min(1, value)) * n);
  return (
    <div className="flex w-full gap-1">
      {Array.from({ length: n }, (_, i) => <span key={i} className="h-7 flex-1 rounded-md transition-colors" style={{ background: i < on ? color : 'var(--surface-2)', opacity: i < on ? 0.5 + (0.5 * (i + 1)) / n : 1 }} />)}
    </div>
  );
}

/** Waffle grid: each square is a share of checks */
function Waffle({ value, cols = 10, rows = 4 }) {
  const n = cols * rows, on = Math.round(Math.max(0, Math.min(1, value)) * n);
  return (
    <div className="grid w-full gap-[3px]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {Array.from({ length: n }, (_, i) => <span key={i} className="aspect-square rounded-[3px]" style={{ background: i < on ? 'var(--ok)' : 'var(--bad)', opacity: i < on ? 0.85 : 0.8 }} />)}
    </div>
  );
}

/** People row: who is on shift */
function PeopleRow({ on, total, color }) {
  const slots = 12, filled = total ? Math.round((on / total) * slots) : slots;
  return (
    <div className="grid w-full grid-cols-6 gap-y-1.5">
      {Array.from({ length: slots }, (_, i) => <UserRound key={i} size={18} strokeWidth={2.4} style={{ color: i < filled ? color : 'var(--line)' }} className="mx-auto" />)}
    </div>
  );
}

/** One dot per sensor */
function DotGrid({ ok, n }) {
  return (
    <div className="grid w-full grid-cols-9 gap-1.5">
      {Array.from({ length: n }, (_, i) => <span key={i} className={`aspect-square w-full rounded-full ${i >= ok ? 'live-dot' : ''}`} style={{ background: i < ok ? 'var(--ok)' : 'var(--bad)', boxShadow: i < ok ? 'none' : '0 0 0 3px var(--bad-soft)' }} />)}
    </div>
  );
}

// Hero chart tooltip: the hour's sales against yesterday, channel split, orders, ticket size and running total
function HeroTip({ active, payload, hourly }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const end = `${String((p.h + 1) % 24).padStart(2, '0')}:00`;
  if (p.today == null) return (
    <div className="rounded-xl border border-line bg-surface px-3.5 py-3 text-[12px] text-ink shadow-xl">
      <div className="font-bold">{p.label}–{end}</div><div className="mt-1 text-muted">Yesterday: <b className="text-ink tnum">{money(p.yesterday, { compact: false })}</b> · {num(p.yorders)} orders</div>
    </div>
  );
  const upto = hourly.filter((x) => x.h <= p.h);
  const cumToday = upto.reduce((a, x) => a + (x.today || 0), 0), cumY = upto.reduce((a, x) => a + (x.yesterday || 0), 0);
  const d = p.yesterday ? (p.today - p.yesterday) / p.yesterday : null;
  const cd = cumY ? (cumToday - cumY) / cumY : null;
  const aov = p.orders ? p.today / p.orders : 0;
  const onlineShare = p.today ? p.online / p.today : 0;
  const Delta = ({ v }) => v == null ? null : <span className={`ml-1.5 rounded-md px-1 py-px text-[10.5px] font-bold ${v >= 0 ? 'bg-ok-soft text-ok' : 'bg-bad-soft text-bad'}`}>{v >= 0 ? '+' : ''}{(v * 100).toFixed(1)}%</span>;
  const Row = ({ k, children }) => <div className="flex items-center justify-between gap-6"><span className="text-muted">{k}</span><span className="font-semibold tnum">{children}</span></div>;
  return (
    <div className="w-64 rounded-xl border border-line bg-surface px-3.5 py-3 text-[12px] text-ink shadow-xl">
      <div className="mb-2 flex items-center justify-between"><span className="font-bold">{p.label}–{end}</span>{p.current && <span className="rounded-full bg-primary-soft px-1.5 py-px text-[10px] font-bold text-primary">In progress</span>}</div>
      <div className="flex items-baseline justify-between"><span className="text-xl font-extrabold tracking-tight tnum">{money(p.today, { compact: false })}</span><Delta v={d} /></div>
      <div className="mb-2 text-[11px] text-muted">vs {money(p.yesterday, { compact: false })} in the same hour yesterday</div>
      <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full bg-primary" style={{ width: `${(1 - onlineShare) * 100}%` }} /></div>
      <div className="space-y-1">
        <Row k="In-store · online">{money(p.offline, { compact: false })} · {money(p.online, { compact: false })}</Row>
        <Row k="Orders">{num(p.orders)} <span className="font-normal text-muted">(yday {num(p.yorders)})</span></Row>
        <Row k="Avg order">{money(aov, { compact: false })}</Row>
        {p.covers > 0 && <Row k="Covers">{num(p.covers)}</Row>}
        {p.top && <Row k="Top dish"><span className="block max-w-[130px] truncate" title={p.top.name}>{p.top.name} ×{p.top.qty}</span></Row>}
      </div>
      <div className="mt-2 border-t border-line pt-2"><Row k="Day so far">{money(cumToday, { compact: false })}<Delta v={cd} /></Row></div>
    </div>
  );
}

function Hero({ s, hourly, scopeLabel, score }) {
  const d = delta(s.today.sales, s.yesterday.sales);
  const up = (d ?? 0) >= 0;
  return (
    <section className="relative z-10 rounded-3xl p-6 text-white shadow-card sm:p-7" style={{ background: 'linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 70%, #000) 55%, var(--primary-2) 140%)' }}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl"><div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" /></div>
      <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:items-end">
        <div>
          <div className="text-sm font-semibold text-white/75">Net sales today · {scopeLabel}</div>
          <div className="mt-2 text-5xl font-extrabold tracking-tight tnum sm:text-6xl">{money(s.today.sales)}</div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            {d != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 font-bold backdrop-blur">
                {up ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}{Math.abs(d * 100).toFixed(1)}%
              </span>
            )}
            <span className="text-white/75">vs {money(s.yesterday.sales)} at this time yesterday</span>
          </div>
          <div className="mt-6 flex gap-6">
            <div><div className="text-2xl font-extrabold tnum">{num(s.today.orders)}</div><div className="text-xs text-white/70">orders</div></div>
            <div><div className="text-2xl font-extrabold tnum">{money(s.today.orders ? s.today.sales / s.today.orders : 0, { compact: false })}</div><div className="text-xs text-white/70">avg order</div></div>
            {score != null && <div><div className="text-2xl font-extrabold tnum">{score}</div><div className="text-xs text-white/70">branch score</div></div>}
          </div>
        </div>
        <div className="h-44 sm:h-52">
          <ResponsiveContainer>
            <ComposedChart data={hourly} margin={{ top: 6, right: 12, left: 16, bottom: 0 }}>
              <defs><linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity={0.45} /><stop offset="1" stopColor="#fff" stopOpacity={0} /></linearGradient></defs>
              <XAxis dataKey="label" stroke="rgba(255,255,255,.55)" fontSize={11} tickLine={false} axisLine={false} interval={3} />
              <Tooltip content={<HeroTip hourly={hourly} />} cursor={{ stroke: 'rgba(255,255,255,.6)', strokeWidth: 1, strokeDasharray: '3 3' }} wrapperStyle={{ outline: 'none', zIndex: 20 }} allowEscapeViewBox={{ x: false, y: true }} />
              <Line type="monotone" dataKey="yesterday" name="Yesterday" stroke="rgba(255,255,255,.55)" strokeDasharray="4 5" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="today" name="Today" stroke="#fff" strokeWidth={3} fill="url(#heroFill)" activeDot={{ r: 5, fill: '#fff', stroke: 'var(--primary)', strokeWidth: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}

function Channels({ sources, total }) {
  const data = sources.slice(0, 7).map((x, i) => ({ name: x.src, value: x.sales, fill: SOURCE_COLORS[i % SOURCE_COLORS.length], kind: x.kind }));
  return (
    <div className="grid gap-4">
      <div className="relative mx-auto h-[170px] w-[170px]">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="64%" outerRadius="100%" paddingAngle={3} cornerRadius={6} stroke="none">
              {data.map((x) => <Cell key={x.name} fill={x.fill} />)}
            </Pie>
            <Tooltip contentStyle={TOOLTIP} formatter={(v, n) => [money(v, { compact: false }), n]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center"><div><div className="text-xl font-extrabold">{data.length}</div><div className="text-[11px] font-semibold text-muted">channels</div></div></div>
      </div>
      <ul className="grid gap-2">
        {data.map((x) => (
          <li key={x.name} className="flex min-w-0 items-center gap-2 text-[13px]">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: x.fill }} />
            <span className="flex-1 truncate font-semibold">{x.name}</span>
            {x.kind === 'online' ? <Bike size={13} className="text-online" /> : <Store size={13} className="text-offline" />}
            <span className="w-10 text-right font-bold tnum">{pct(x.value / Math.max(1, total))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TopDishes({ items }) {
  const max = Math.max(1, ...items.map((i) => i.sales));
  return (
    <ul className="flex flex-1 flex-col justify-between gap-3">
      {items.slice(0, 7).map((it, i) => {
        const Icon = DISH_ICON(it.name, it.category);
        return (
          <li key={it.id} className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl" style={{ background: `color-mix(in srgb, ${SOURCE_COLORS[i]} 14%, var(--surface))`, color: SOURCE_COLORS[i] }}><Icon size={19} strokeWidth={2.2} /></span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 truncate text-[13px] font-bold">{it.name}{it.is_new ? <Badge tone="ok"><Sparkles size={10} />New</Badge> : null}</div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full" style={{ width: `${(it.sales / max) * 100}%`, background: `linear-gradient(90deg, ${SOURCE_COLORS[i]}88, ${SOURCE_COLORS[i]})` }} /></div>
            </div>
            <span className="w-14 text-right text-[13px] font-extrabold tnum">{money(it.sales)}</span>
          </li>
        );
      })}
    </ul>
  );
}

function Heatmap({ rows }) {
  const days = [...new Set(rows.map((r) => r.d))].sort();
  const max = Math.max(1, ...rows.map((r) => r.v));
  const get = (d, h) => rows.find((r) => r.d === d && r.h === h)?.v || 0;
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[400px]">
        {days.map((d) => (
          <div key={d} className="mb-1.5 flex items-center gap-1">
            <span className="w-9 shrink-0 text-[11px] font-bold text-muted">{DAYS[new Date(d + 'T12:00').getDay()]}</span>
            {Array.from({ length: 24 }, (_, h) => {
              const v = get(d, h);
              return <span key={h} title={`${h}:00 · ${money(v)}`} className="h-6 flex-1 rounded-md transition-transform hover:scale-125" style={{ background: `color-mix(in srgb, var(--primary) ${Math.round((v / max) ** 0.8 * 95) + 3}%, var(--surface-2))` }} />;
            })}
          </div>
        ))}
        <div className="mt-1 flex gap-1 pl-10 text-[10px] font-semibold text-faint">{Array.from({ length: 24 }, (_, h) => <span key={h} className="flex-1 text-center">{h % 4 === 0 ? `${h}h` : ''}</span>)}</div>
      </div>
    </div>
  );
}

function BranchCards({ board, scores, onPick }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {board.map((b, i) => {
        const sc = scores?.find((x) => x.id === b.id)?.score ?? 0;
        const d = delta(b.sales, b.yesterday);
        const color = BRANCH_COLORS[b.id];
        return (
          <button key={b.id} onClick={() => onPick(b.id)} className="group relative overflow-hidden rounded-3xl border border-line bg-surface p-4 text-left shadow-card transition hover:-translate-y-0.5 hover:border-primary">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {i === 0 && <Trophy size={14} className="text-warn" />}
                  <span className="truncate text-[15px] font-extrabold">{b.name}</span>
                </div>
                <div className="text-xs text-muted">{b.location}, {b.city}</div>
                <div className="mt-3 text-2xl font-extrabold tracking-tight tnum">{money(b.sales)}</div>
                {d != null && <div className={`mt-0.5 inline-flex items-center gap-0.5 text-xs font-bold ${d >= 0 ? 'text-ok' : 'text-bad'}`}>{d >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{Math.abs(d * 100).toFixed(1)}%</div>}
              </div>
              <div className="relative h-16 w-16 shrink-0">
                <svg viewBox="0 0 64 64" className="-rotate-90"><circle cx="32" cy="32" r="27" fill="none" stroke="var(--surface-2)" strokeWidth="7" />
                  <circle cx="32" cy="32" r="27" fill="none" stroke={`var(--${toneOf(sc / 100, 0.88, 0.78)})`} strokeWidth="7" strokeLinecap="round" strokeDasharray={170} strokeDashoffset={170 * (1 - sc / 100)} /></svg>
                <span className="absolute inset-0 grid place-items-center text-sm font-extrabold">{sc}</span>
              </div>
            </div>
            <div className="-mx-4 -mb-4 mt-2 h-14">
              <ResponsiveContainer>
                <AreaChart data={b.spark} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                  <defs><linearGradient id={`bc-${b.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity={0.35} /><stop offset="1" stopColor={color} stopOpacity={0} /></linearGradient></defs>
                  <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2.2} fill={`url(#bc-${b.id})`} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const { user, can, setBranch } = useAuth();
  const q = useBranchQuery();
  const { data, error } = useLive(`/dashboard?${q}`, { types: ['order', 'alert', 'guest', 'attendance'], throttle: 5000 });
  const week = useMemo(() => (data?.week || []).map((w) => ({ ...w, day: DAYS[new Date(w.d + 'T12:00').getDay()] })), [data]);

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <><h1 className="mb-6 text-2xl font-extrabold">{greeting()}, {user.name.split(' ')[0]}</h1><Loading /></>;
  const s = data.sales, f = data.finance, o = data.ops;
  const scopeLabel = data.branches.length === 1 ? `${data.branches[0].name}, ${data.branches[0].city}` : `${data.branches.length} branches`;
  const onlineShare = s?.today.sales ? s.today.online / s.today.sales : 0;
  const weakest = data.scores && data.branches.length > 1 ? [...data.scores].sort((a, b) => a.score - b.score)[0] : null;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-[28px]">{greeting()}, {user.name.split(' ')[0]}</h1>
          <p className="mt-1 text-sm text-muted">{new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
            {weakest && weakest.score < 85 && <> · <button onClick={() => setBranch(weakest.id)} className="font-semibold text-primary hover:underline">Restaurant {weakest.id.slice(1)} needs attention</button></>}</p>
        </div>
      </div>

      {s && <Hero s={s} hourly={data.hourly} scopeLabel={scopeLabel} score={data.score} />}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {s && <Tile label="Online share" value={pct(onlineShare)} tone="online" caption={`${money(s.today.online)} via apps & web`}>
          <SplitBar a={s.today.online} b={s.today.sales - s.today.online} colorA="var(--online)" colorB="var(--offline)" iconA={Bike} iconB={Store} /></Tile>}
        {f && <Tile label="Prime cost" value={pct(f.prime_pct)} tone={f.prime_pct > 0.65 ? 'bad' : f.prime_pct > 0.6 ? 'warn' : 'ok'} caption={`food ${pct(f.food_pct)} · labour ${pct(f.labor_pct)}`}>
          <HalfGauge value={f.prime_pct} target={0.6} color={`var(--${f.prime_pct > 0.65 ? 'bad' : f.prime_pct > 0.6 ? 'warn' : 'ok'})`} /></Tile>}
        {o.kitchen && <Tile label="Kitchen on time" value={pct(o.kitchen.on_time)} tone={toneOf(o.kitchen.on_time, 0.9, 0.8)} caption={`${o.kitchen.open} dishes cooking now`}>
          <Segments value={o.kitchen.on_time} color={`var(--${toneOf(o.kitchen.on_time, 0.9, 0.8)})`} /></Tile>}
        {o.hygiene && <Tile label="Camera checks" value={pct(o.hygiene.rate)} tone={toneOf(o.hygiene.rate, 0.95, 0.9)} caption={`${o.hygiene.flags} exceptions · last 2h`}>
          <Waffle value={o.hygiene.rate} /></Tile>}
        {o.staff && <Tile label="Staff coverage" value={`${o.staff.on_duty}/${o.staff.scheduled}`} tone="ink" caption={`${o.staff.late} arrived late today`}>
          <PeopleRow on={o.staff.on_duty} total={o.staff.scheduled} color={`var(--${toneOf(o.staff.scheduled ? o.staff.on_duty / o.staff.scheduled : 1, 0.97, 0.88)})`} /></Tile>}
        {o.safety?.n > 0 && <Tile label="Cold chain" value={`${o.safety.ok}/${o.safety.n}`} tone={o.safety.ok < o.safety.n ? 'bad' : 'ok'} caption={o.safety.ok < o.safety.n ? `${o.safety.n - o.safety.ok} sensor out of range` : 'every fridge & freezer in range'}>
          <DotGrid ok={o.safety.ok} n={o.safety.n} /></Tile>}
        {!s && o.guests && <Tile label="Regulars today" value={num(o.guests.recognized)} tone="primary" caption={`${o.guests.in_house} in house now`}>
          <Segments value={Math.min(1, o.guests.recognized / 120)} color="var(--primary)" /></Tile>}
        {!s && o.alerts && <Tile label="Open alerts" value={o.alerts.open} tone={o.alerts.high ? 'bad' : 'ok'} caption={`${o.alerts.high} high priority`}>
          <SplitBar a={o.alerts.high} b={o.alerts.open - o.alerts.high} colorA="var(--bad)" colorB="var(--warn)" iconA={BellRing} iconB={BellRing} /></Tile>}
      </div>

      {s && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <Card title="Online vs in-store" subtitle="Share of today’s sales" fill>
            <div className="flex flex-col items-center gap-5">
              <div className="relative h-48 w-48">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={[{ name: 'Online', v: s.today.online }, { name: 'In-store', v: s.today.sales - s.today.online }]} dataKey="v" innerRadius="68%" outerRadius="100%" paddingAngle={3} cornerRadius={8} stroke="none" startAngle={90} endAngle={-270}>
                      <Cell fill="var(--online)" /><Cell fill="var(--offline)" />
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP} formatter={(v, n) => [money(v, { compact: false }), n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 grid place-items-center text-center"><div><div className="text-3xl font-extrabold">{pct(onlineShare)}</div><div className="text-xs font-semibold text-muted">online</div></div></div>
              </div>
              <div className="grid w-full grid-cols-2 gap-3">
                <div className="rounded-2xl bg-primary-soft/60 p-3"><div className="flex items-center gap-1.5 text-xs font-semibold text-muted"><Bike size={14} className="text-online" />Delivery & web</div><div className="mt-1 text-xl font-extrabold tnum">{money(s.today.online)}</div></div>
                <div className="rounded-2xl bg-warn-soft/60 p-3"><div className="flex items-center gap-1.5 text-xs font-semibold text-muted"><Store size={14} className="text-offline" />Dine-in & takeaway</div><div className="mt-1 text-xl font-extrabold tnum">{money(s.today.sales - s.today.online)}</div></div>
              </div>
            </div>
          </Card>
          <Card title="Where sales come from" subtitle="Channels and delivery platforms" fill>
            <Channels sources={data.sources} total={s.today.sales} />
          </Card>
          <Card title="Top dishes" subtitle="Today’s best sellers" className="lg:col-span-2 xl:col-span-1" fill>
            <TopDishes items={data.topItems} />
          </Card>
        </div>
      )}

      {s && (
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <Card title="This week" subtitle="Daily sales · in-store and online">
            <div className="h-60">
              <ResponsiveContainer>
                <BarChart data={week} margin={{ top: 8, right: 0, left: 0, bottom: 0 }} barCategoryGap="22%">
                  <defs>
                    <linearGradient id="wOff" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--offline)" /><stop offset="1" stopColor="var(--offline)" stopOpacity={0.55} /></linearGradient>
                    <linearGradient id="wOn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--online)" /><stop offset="1" stopColor="var(--online)" stopOpacity={0.6} /></linearGradient>
                  </defs>
                  <XAxis dataKey="day" {...AXIS} />
                  <YAxis {...AXIS} tickFormatter={(v) => money(v)} width={62} />
                  <Tooltip contentStyle={TOOLTIP} cursor={{ fill: 'var(--surface-2)', radius: 8 }} formatter={(v, n) => [money(v, { compact: false }), n]} />
                  <RBar dataKey="offline" name="In-store" stackId="a" fill="url(#wOff)" />
                  <RBar dataKey="online" name="Online" stackId="a" fill="url(#wOn)" radius={[10, 10, 0, 0]}>
                    {week.map((w, i) => <Cell key={w.d} fillOpacity={i === week.length - 1 ? 1 : 0.85} />)}
                  </RBar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Busiest hours" subtitle="When customers come in, last 7 days. Plan staff and prep around the hot spots.">
            <Heatmap rows={data.heatmap} />
          </Card>
        </div>
      )}

      {data.board && (
        <div className="mt-6">
          <div className="mb-3 flex items-end justify-between"><h2 className="text-lg font-extrabold">Branches</h2><span className="text-xs text-muted">Tap a branch to focus the app on it</span></div>
          <BranchCards board={data.board} scores={data.scores} onPick={setBranch} />
        </div>
      )}

      {data.staffing && <div className="mt-4"><Staffing s={data.staffing} compact /></div>}

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {can('alerts.view') && <DashAlerts q={q} />}
        <Card title="Live activity" subtitle="Orders, kitchen, guests and alerts as they happen"><LiveFeed height={340} /></Card>
      </div>
    </>
  );
}

function DashAlerts({ q }) {
  const { data } = useLive(`/alerts?status=open&limit=6&${q}`, { types: ['alert'] });
  return (
    <Card title="Needs attention" action={<Link to="/alerts" className="text-xs font-bold text-primary">View all</Link>}>
      <ul className="grid gap-2">
        {data?.map((a) => (
          <li key={a.id} className="flex items-center gap-3 rounded-2xl bg-surface-2/70 px-3 py-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl" style={{ background: `var(--${SEVERITY_TONE[a.severity] === 'muted' ? 'surface' : SEVERITY_TONE[a.severity] + '-soft'})`, color: `var(--${SEVERITY_TONE[a.severity] === 'muted' ? 'muted' : SEVERITY_TONE[a.severity]})` }}><BellRing size={15} /></span>
            <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-bold">{a.title}</div><div className="text-[11px] text-muted">{a.branch} · {ago(a.ts)}</div></div>
          </li>
        ))}
        {data?.length === 0 && <li className="py-6 text-center text-sm text-muted">All clear. Nothing needs you right now.</li>}
      </ul>
    </Card>
  );
}
