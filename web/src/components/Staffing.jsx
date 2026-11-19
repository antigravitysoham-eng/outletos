import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { Card, TOOLTIP, AXIS } from './ui.jsx';
import { money } from '../lib/api.js';

const STATUS = { over: 'var(--warn)', under: 'var(--bad)', ok: 'var(--ok)', closed: 'var(--line)' };

function Metric({ label, value, hint, tone }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <div className="text-[11px] font-semibold text-muted">{label}</div>
      <div className="mt-0.5 text-xl font-extrabold tnum" style={tone ? { color: `var(--${tone})` } : undefined}>{value}</div>
      {hint && <div className="text-[11px] text-muted">{hint}</div>}
    </div>
  );
}

/** Labour productivity: transactions per person-hour (TPPH), sales per labour hour, labour hours per order. */
export default function Staffing({ s, compact = false }) {
  if (!s) return null;
  const tpphTone = s.tpph == null ? undefined : s.tpph < s.target_tpph * 0.75 ? 'warn' : s.tpph > s.target_tpph * 1.25 ? 'bad' : 'ok';
  return (
    <Card title="Staffing & productivity" subtitle={`${s.department} · today · target ${s.target_tpph.toFixed(1)} orders per labour hour`}>
      {compact ? (
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-surface-2 px-3 py-1.5 text-xs font-semibold">TPPH <b className="ml-1 text-sm" style={tpphTone ? { color: `var(--${tpphTone})` } : undefined}>{s.tpph?.toFixed(2) ?? '—'}</b> <span className="text-muted">/ {s.target_tpph.toFixed(1)}</span></span>
          {'splh' in s && <span className="rounded-full bg-surface-2 px-3 py-1.5 text-xs font-semibold">Sales / labour hr <b className="ml-1 text-sm">{money(s.splh)}</b></span>}
          <span className="rounded-full bg-surface-2 px-3 py-1.5 text-xs font-semibold">Off-target hours <b className="ml-1 text-sm" style={{ color: s.under_hours ? 'var(--bad)' : 'var(--ok)' }}>{s.over_hours + s.under_hours}</b></span>
        </div>
      ) : (
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <Metric label="TPPH (orders / labour hr)" value={s.tpph?.toFixed(2) ?? '—'} hint={`target ${s.target_tpph.toFixed(1)}`} tone={tpphTone} />
        <Metric label="Labour hrs per order" value={s.lhpo?.toFixed(2) ?? '—'} hint={s.lhpo ? `${Math.round(s.lhpo * 60)} min of labour each` : ''} />
        {'splh' in s && <Metric label="Sales per labour hr" value={money(s.splh, { compact: false })} />}
        <Metric label="Guests per labour hr" value={s.covers_plh?.toFixed(1) ?? '—'} />
        <Metric label="Labour hours" value={s.labour_hours} hint={'labour_cost' in s ? money(s.labour_cost) : `${s.orders} orders`} />
        <Metric label="Hours off target" value={`${s.over_hours + s.under_hours}`} hint={`${s.over_hours} overstaffed · ${s.under_hours} understaffed`} tone={s.under_hours ? 'bad' : s.over_hours ? 'warn' : 'ok'} />
      </div>
      )}
      <div className="mt-4 h-64">
        <ResponsiveContainer>
          <ComposedChart data={s.hours} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="label" {...AXIS} interval={2} />
            <YAxis yAxisId="l" {...AXIS} width={40} allowDecimals={false} />
            <YAxis yAxisId="r" orientation="right" {...AXIS} width={36} />
            <Tooltip contentStyle={TOOLTIP} cursor={{ fill: 'var(--surface-2)' }}
              formatter={(v, n) => [n === 'TPPH' ? v?.toFixed(2) : v, n]} />
            <Bar yAxisId="l" dataKey="staff" name="Staff on shift" radius={[5, 5, 0, 0]} maxBarSize={22}>
              {s.hours.map((h) => <Cell key={h.h} fill={STATUS[h.status]} />)}
            </Bar>
            <Line yAxisId="l" type="stepAfter" dataKey="recommended" name="Recommended staff" stroke="var(--primary)" strokeWidth={2} strokeDasharray="5 4" dot={false} />
            <Line yAxisId="r" type="monotone" dataKey="tpph" name="TPPH" stroke="var(--info)" strokeWidth={2} dot={false} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted">
        <span className="font-semibold text-ink">Bars: staff on shift</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: STATUS.ok }} />On target</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: STATUS.over }} />Overstaffed (cut hours)</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: STATUS.under }} />Understaffed (service at risk)</span>
        <span className="flex items-center gap-1.5"><svg width="18" height="6" aria-hidden><line x1="0" y1="3" x2="18" y2="3" stroke="var(--primary)" strokeWidth="2" strokeDasharray="5 3" /></svg>Recommended staff</span>
        <span className="flex items-center gap-1.5"><svg width="18" height="6" aria-hidden><line x1="0" y1="3" x2="18" y2="3" stroke="var(--info)" strokeWidth="2" /></svg>TPPH (right axis)</span>
      </div>
    </Card>
  );
}
