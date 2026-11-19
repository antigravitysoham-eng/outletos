import { useEffect, useState } from 'react';
import { ShoppingBag, ChefHat, Cctv, UserCheck, Star, BellRing, HeartHandshake, Bike } from 'lucide-react';
import { api, useStream, money, clock } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

function describe(e) {
  switch (e.type) {
    case 'order': {
      const online = ['delivery', 'online'].includes(e.channel);
      return { icon: online ? Bike : ShoppingBag, tone: online ? 'online' : 'offline',
        text: online ? `${e.platform} order · ${money(e.total, { compact: false })}` : e.channel === 'takeaway' ? `Takeaway · ${money(e.total, { compact: false })}` : `Table ${e.table_no} paid ${money(e.total, { compact: false })} · ${e.covers} guests` };
    }
    case 'ticket': return e.state === 'ready'
      ? { icon: ChefHat, tone: e.secs > 900 ? 'warn' : 'ok', text: `${e.item} ready in ${Math.floor(e.secs / 60)}m ${e.secs % 60}s · ${e.station}` }
      : null;
    case 'vision': return e.ok ? null : { icon: Cctv, tone: e.severity === 'high' ? 'bad' : 'warn', text: `Camera: ${e.label}` };
    case 'attendance': return { icon: UserCheck, tone: e.late >= 10 ? 'warn' : 'muted', text: `${e.staff} clocked ${e.action}${e.late >= 10 ? ` · ${e.late} min late` : ''}` };
    case 'review': return { icon: Star, tone: e.rating <= 2 ? 'bad' : 'warn', text: `${e.rating}★ on ${e.platform}: “${e.text.slice(0, 50)}…”` };
    case 'guest': return { icon: HeartHandshake, tone: 'primary', text: `${e.name} (${e.tier}, visit #${e.visits + 1}) arrived · ${e.headline}` };
    case 'alert': return { icon: BellRing, tone: e.alert.severity === 'high' ? 'bad' : 'warn', text: e.alert.title };
    default: return null;
  }
}
const COLOR = { online: 'var(--online)', offline: 'var(--offline)', ok: 'var(--ok)', warn: 'var(--warn)', bad: 'var(--bad)', primary: 'var(--primary)', muted: 'var(--faint)' };

export default function LiveFeed({ height = 420, max = 40 }) {
  const { branch, branchName } = useAuth();
  const [items, setItems] = useState([]);
  const toItem = (e) => {
    const oid = e.outlet_id || e.alert?.outlet_id;
    if (branch !== 'all' && oid !== branch) return null;
    const d = describe(e);
    return d && { ...d, id: `${e.type}-${e.ts}-${Math.random()}`, ts: e.ts, oid };
  };
  useEffect(() => {
    setItems([]);
    api('/feed').then((evts) => setItems(evts.map(toItem).filter(Boolean).slice(0, max))).catch(() => {});
  }, [branch]); // eslint-disable-line react-hooks/exhaustive-deps
  useStream((e) => { const it = toItem(e); if (it) setItems((p) => [it, ...p].slice(0, max)); });

  return (
    <div className="overflow-y-auto pr-1" style={{ maxHeight: height }} aria-live="polite">
      {items.length === 0 && <div className="py-8 text-center text-sm text-muted">Waiting for live activity…</div>}
      <ul className="space-y-1">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <li key={it.id} className="slide-in flex gap-3 rounded-xl px-2 py-2 hover:bg-surface-2/70">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: `color-mix(in srgb, ${COLOR[it.tone]} 15%, transparent)`, color: COLOR[it.tone] }}><Icon size={14} strokeWidth={2.2} /></span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{it.text}</div>
                <div className="text-[11px] text-muted">{branch === 'all' ? `${branchName(it.oid)} · ` : ''}{clock(it.ts)}</div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
