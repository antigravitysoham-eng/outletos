import { AreaChart, Area, ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

export function Card({ title, subtitle, action, children, className = '', pad = true, fill = false }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-line bg-surface shadow-card ${fill ? 'flex flex-col' : ''} ${className}`}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-1">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-bold tracking-tight">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={`${pad ? 'px-5 pb-5 pt-3' : ''} ${fill ? 'flex flex-1 flex-col justify-center' : ''}`}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, right }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

const TONES = {
  primary: ['var(--primary-soft)', 'var(--primary)'], online: ['var(--primary-soft)', 'var(--online)'], offline: ['var(--warn-soft)', 'var(--offline)'],
  ok: ['var(--ok-soft)', 'var(--ok)'], warn: ['var(--warn-soft)', 'var(--warn)'], bad: ['var(--bad-soft)', 'var(--bad)'], info: ['var(--info-soft)', 'var(--info)'],
};

export function Delta({ value, invert = false, suffix = 'vs yesterday' }) {
  if (value == null || !Number.isFinite(value)) return <span className="text-xs text-muted">{suffix ? 'no comparison yet' : ''}</span>;
  const up = value >= 0;
  const good = invert ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold ${good ? 'bg-ok-soft text-ok' : 'bg-bad-soft text-bad'}`}>
        <Icon size={12} strokeWidth={2.5} />{Math.abs(value * 100).toFixed(1)}%
      </span>
      {suffix && <span className="text-muted">{suffix}</span>}
    </span>
  );
}

export function KPI({ label, value, icon: Icon, tone = 'primary', delta, invert, sub, spark, sparkKey = 'v' }) {
  const [bg, fg] = TONES[tone] || TONES.primary;
  const gid = `sp-${label.replace(/\W/g, '')}`;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between">
        <span className="label">{label}</span>
        {Icon && <span className="grid h-8 w-8 place-items-center rounded-xl" style={{ background: bg, color: fg }}><Icon size={16} strokeWidth={2.2} /></span>}
      </div>
      <div className="mt-2 text-[26px] font-extrabold leading-none tracking-tight tnum">{value}</div>
      <div className="mt-2 min-h-5">{delta !== undefined ? <Delta value={delta} invert={invert} /> : <span className="text-xs text-muted">{sub}</span>}</div>
      {spark && spark.length > 1 && (
        <div className="pointer-events-none -mx-4 -mb-4 mt-2 h-10">
          <ResponsiveContainer>
            <AreaChart data={spark} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={fg} stopOpacity={0.35} /><stop offset="1" stopColor={fg} stopOpacity={0} /></linearGradient></defs>
              <Area type="monotone" dataKey={sparkKey} stroke={fg} strokeWidth={2} fill={`url(#${gid})`} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export function MiniStat({ label, value, tone, icon: Icon, sub }) {
  const [bg, fg] = TONES[tone] || ['var(--surface-2)', 'var(--muted)'];
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-card">
      {Icon && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: bg, color: fg }}><Icon size={17} strokeWidth={2.2} /></span>}
      <div className="min-w-0">
        <div className="text-xs leading-tight font-semibold text-muted">{label}</div>
        <div className="text-lg font-extrabold leading-tight tnum">{value}</div>
        {sub && <div className="truncate text-[11px] text-muted">{sub}</div>}
      </div>
    </div>
  );
}

export const TOOLTIP = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, fontSize: 12, boxShadow: 'var(--shadow)', color: 'var(--ink)' };
export const AXIS = { stroke: 'var(--faint)', fontSize: 11, tickLine: false, axisLine: false };

export function Donut({ data, colors, size = 150, thickness = 22, center, label = 'name', value = 'value', format = (v) => v }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey={value} nameKey={label} innerRadius={size / 2 - thickness} outerRadius={size / 2} paddingAngle={2} stroke="none" isAnimationActive={false}>
            {data.map((d, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Pie>
          <Tooltip formatter={(v, n) => [format(v), n]} contentStyle={TOOLTIP} />
        </PieChart>
      </ResponsiveContainer>
      {center && <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">{center}</div>}
    </div>
  );
}

const BADGE = { ok: 'bg-ok-soft text-ok', warn: 'bg-warn-soft text-warn', bad: 'bg-bad-soft text-bad', muted: 'bg-surface-2 text-muted', primary: 'bg-primary-soft text-primary', info: 'bg-info-soft text-info', offline: 'bg-warn-soft text-offline' };
export function Badge({ tone = 'muted', children, className = '' }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${BADGE[tone]} ${className}`}>{children}</span>;
}
export const SEVERITY_TONE = { high: 'bad', medium: 'warn', low: 'muted', none: 'ok' };

export function Bar({ value, color = 'var(--primary)', height = 6 }) {
  return (
    <div className="w-full overflow-hidden rounded-full bg-surface-2" style={{ height }}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(2, Math.min(100, (value || 0) * 100))}%`, background: color }} />
    </div>
  );
}

export function Empty({ children = 'Nothing here yet.' }) {
  return <div className="grid place-items-center py-10 text-center text-sm text-muted">{children}</div>;
}
export function Loading() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true">
      {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-surface-2" />)}
    </div>
  );
}
export function ErrorNote({ children }) {
  return <div className="rounded-2xl border border-line bg-bad-soft px-4 py-3 text-sm text-bad">{children}</div>;
}

export function Select({ value, onChange, options, label, className = '' }) {
  return (
    <label className={`inline-flex items-center gap-2 text-sm ${className}`}>
      {label && <span className="text-muted">{label}</span>}
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium outline-none focus:border-primary">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function Button({ children, onClick, variant = 'default', className = '', ...rest }) {
  const s = { default: 'border border-line bg-surface hover:bg-surface-2', primary: 'grad-primary text-white shadow-sm hover:opacity-95', ghost: 'hover:bg-surface-2', danger: 'bg-bad-soft text-bad hover:opacity-90' };
  return <button onClick={onClick} className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition disabled:opacity-50 ${s[variant]} ${className}`} {...rest}>{children}</button>;
}

export function Avatar({ name, size = 36, color = 'var(--primary)' }) {
  const ini = (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return <span className="grid shrink-0 place-items-center rounded-full font-bold text-white" style={{ width: size, height: size, fontSize: size * 0.38, background: color }}>{ini}</span>;
}
