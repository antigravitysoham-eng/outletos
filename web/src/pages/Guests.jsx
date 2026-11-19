import { useState } from 'react';
import { ScanFace, QrCode, Phone, CalendarCheck, HeartHandshake, Repeat, Sparkles, Wine, AlertTriangle, Cake, Crown, Gift, Armchair, Bike, Star, X, TrendingUp } from 'lucide-react';
import { useLive, api, money, pct, ago, clock, num } from '../lib/api.js';
import { useAuth, useBranchQuery } from '../lib/auth.jsx';
import { Card, PageHeader, MiniStat, Badge, Avatar, Loading, ErrorNote, Empty } from '../components/ui.jsx';

const METHOD = { face: [ScanFace, 'Face ID (opted in)'], 'loyalty-qr': [QrCode, 'Loyalty QR'], phone: [Phone, 'Phone number'], reservation: [CalendarCheck, 'Reservation'] };
const SUGGEST = {
  allergy: [AlertTriangle, 'var(--bad)'], reorder: [Repeat, 'var(--primary)'], try: [Sparkles, 'var(--ok)'], pair: [Wine, 'var(--online)'],
  winback: [Gift, 'var(--offline)'], milestone: [Star, 'var(--warn)'], birthday: [Cake, 'var(--offline)'], comfort: [Armchair, 'var(--muted)'],
  vip: [Crown, 'var(--warn)'], channel: [Bike, 'var(--online)'],
};
const TIER = { Gold: 'warn', Silver: 'info', Regular: 'primary', New: 'muted' };
const TIER_COLOR = { Gold: '#F5B300', Silver: '#0BA5EC', Regular: '#5B4CFA', New: '#98A2B8' };

function Suggestions({ list }) {
  return (
    <ul className="space-y-2">
      {list.map((s, i) => {
        const [Icon, color] = SUGGEST[s.kind] || [Sparkles, 'var(--primary)'];
        return (
          <li key={i} className="flex items-start gap-2.5 text-[13px] leading-snug">
            <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}><Icon size={13} strokeWidth={2.4} /></span>
            <span>{s.text}</span>
          </li>
        );
      })}
    </ul>
  );
}

function ArrivalCard({ v, onOpen }) {
  const p = v.profile;
  const [MIcon, mLabel] = METHOD[v.method] || METHOD['loyalty-qr'];
  return (
    <div className="slide-in rounded-2xl border border-line bg-surface p-4 shadow-card">
      <div className="flex items-start gap-3">
        <Avatar name={p.name} size={44} color={TIER_COLOR[p.tier]} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <button onClick={() => onOpen(p.id)} className="truncate text-[15px] font-extrabold hover:text-primary">{p.name}</button>
            <Badge tone={TIER[p.tier]}>{p.tier}</Badge>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
            <span className="inline-flex items-center gap-1"><MIcon size={12} />{mLabel}{v.method === 'face' ? ` · ${Math.round(v.confidence * 100)}%` : ''}</span>
            <span>· {v.branch} · table {v.table_no ?? '—'} · {v.covers} guests</span>
          </div>
        </div>
        <span className="shrink-0 text-xs font-semibold text-muted">{clock(v.ts)}</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-surface-2 p-2.5 text-center">
        <div><div className="text-sm font-extrabold tnum">{p.visits}</div><div className="text-[10.5px] text-muted">visits</div></div>
        <div><div className="text-sm font-extrabold tnum">{money(p.avg_spend)}</div><div className="text-[10.5px] text-muted">avg spend</div></div>
        <div><div className="text-sm font-extrabold">{p.days_since == null ? 'First' : p.days_since === 0 ? 'Today' : `${p.days_since}d`}</div><div className="text-[10.5px] text-muted">last visit</div></div>
      </div>
      {(p.favorites.length > 0 || p.allergies.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {p.allergies.map((a) => <Badge key={a} tone="bad">⚠ {a}</Badge>)}
          {p.favorites.slice(0, 4).map((f) => <Badge key={f.id} tone="primary">{f.name} ×{f.qty}</Badge>)}
        </div>
      )}
      <div className="mt-3 border-t border-line pt-3">
        <div className="mb-2 text-[11px] font-bold tracking-wide text-muted uppercase">Suggestions for the team</div>
        <Suggestions list={p.suggestions.slice(0, 5)} />
      </div>
    </div>
  );
}

function ProfileDrawer({ id, onClose }) {
  const { data, error } = useLive(id ? `/guests/${id}` : null, { types: [] });
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto bg-surface p-6 shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 rounded-lg p-2 hover:bg-surface-2" aria-label="Close"><X size={18} /></button>
        {error && <ErrorNote>{error}</ErrorNote>}
        {!data ? <div className="h-40 animate-pulse rounded-2xl bg-surface-2" /> : (
          <>
            <div className="flex items-center gap-3">
              <Avatar name={data.name} size={56} color={TIER_COLOR[data.tier]} />
              <div><div className="text-xl font-extrabold">{data.name}</div><div className="text-sm text-muted">{data.phone} · <Badge tone={TIER[data.tier]}>{data.tier}</Badge></div></div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
              {[['Visits', data.visits], ['Lifetime', money(data.spend)], ['Avg spend', money(data.avg_spend)], ...(data.loyalty ? [['Wallet (5% back)', money(data.loyalty.earned)]] : [])].map(([l, v]) => (
                <div key={l} className="rounded-xl bg-surface-2 p-3"><div className="text-lg font-extrabold">{v}</div><div className="text-[11px] text-muted">{l}</div></div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5 text-xs">
              <Badge tone={data.consent_face ? 'ok' : 'muted'}>{data.consent_face ? 'Face ID opted in' : 'No face ID consent'}</Badge>
              <Badge>Prefers {data.seating}</Badge><Badge>Birthday {data.birthday}</Badge>{data.allergies.map((a) => <Badge key={a} tone="bad">⚠ {a}</Badge>)}
            </div>
            <h3 className="mt-6 mb-2 text-sm font-bold">Suggestions</h3>
            <Suggestions list={data.suggestions} />
            <h3 className="mt-6 mb-2 text-sm font-bold">Favourite dishes</h3>
            <div className="flex flex-wrap gap-1.5">{data.favorites.map((f) => <Badge key={f.id} tone="primary">{f.name} ×{f.qty}</Badge>)}</div>
            <h3 className="mt-6 mb-2 text-sm font-bold">Recent orders</h3>
            <ul className="divide-y divide-line text-[13px]">
              {data.recent.map((r) => (
                <li key={r.id} className="py-2.5">
                  <div className="flex justify-between"><span className="font-semibold capitalize">{r.channel === 'dine-in' ? 'Dine-in' : r.platform}</span><span className="font-bold tnum">{money(r.total, { compact: false })}</span></div>
                  <div className="text-xs text-muted">{ago(r.closed_at)} · {r.items}</div>
                </li>
              ))}
            </ul>
          </>
        )}
      </aside>
    </div>
  );
}

export default function Guests() {
  const q = useBranchQuery();
  const { can } = useAuth();
  const { data, error } = useLive(`/guests?${q}`, { types: ['guest'], throttle: 2000 });
  const [open, setOpen] = useState(null);
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <><PageHeader title="Guest Intelligence" /><Loading /></>;
  const k = data.kpi;

  return (
    <>
      <PageHeader title="Guest Intelligence"
        subtitle="Regulars are recognised the moment they arrive: by Face ID if they opted in, otherwise by loyalty QR, phone or reservation. Their past orders turn into suggestions for your team." />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MiniStat label="Regulars recognised today" value={num(k.recognized)} icon={HeartHandshake} tone="primary" sub={`${k.in_house} in house now`} />
        <MiniStat label="Via Face ID (opt-in)" value={num(k.face)} icon={ScanFace} tone="info" sub={`${num(k.qr)} via loyalty QR`} />
        <MiniStat label="Returning guests (7d)" value={pct(k.returning_share)} icon={Repeat} tone="ok" sub="share of dine-in orders" />
        <MiniStat label="Regulars spend more" value={money(k.known_aov, { compact: false })} icon={TrendingUp} tone="warn" sub={`vs ${money(k.new_aov, { compact: false })} for new guests`} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <h2 className="mb-3 flex items-center gap-2 text-[15px] font-bold"><span className="live-dot h-2 w-2 rounded-full bg-ok" />Arriving now</h2>
          {data.arrivals.length === 0 ? <Card><Empty>No recognised guests yet today.</Empty></Card> : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">{data.arrivals.map((v) => <ArrivalCard key={v.id} v={v} onOpen={setOpen} />)}</div>
          )}
        </div>
        <Card title="Top guests" subtitle={can('guests.pii') ? 'By lifetime spend' : 'By lifetime spend · phone numbers masked for your role'} pad={false} className="h-fit">
          <ul className="divide-y divide-line px-5 pb-3">
            {data.top.map((g) => (
              <li key={g.id}>
                <button onClick={() => setOpen(g.id)} className="flex w-full items-center gap-3 py-2.5 text-left hover:opacity-80">
                  <Avatar name={g.name} size={32} color={TIER_COLOR[g.tier]} />
                  <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-bold">{g.name}</span><span className="text-[11px] text-muted">{g.visits} visits · {g.phone}</span></span>
                  <span className="text-right"><span className="block text-sm font-extrabold tnum">{money(g.spend)}</span><Badge tone={TIER[g.tier]}>{g.tier}</Badge></span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <p className="mt-6 text-center text-xs text-faint">Privacy: face matching runs only for guests who gave explicit consent. Others are never identified from video.</p>
      {open && <ProfileDrawer id={open} onClose={() => setOpen(null)} />}
    </>
  );
}
