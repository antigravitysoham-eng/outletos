import { useState } from 'react';
import { CalendarDays, Users, UserX, ListOrdered, Plus, Armchair, Check, X } from 'lucide-react';
import { useLive, api, money, pct } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Card, PageHeader, Badge, Button, Loading, ErrorNote, MiniStat } from '../components/ui.jsx';

const TONE = { booked: 'info', seated: 'primary', completed: 'ok', no_show: 'bad', cancelled: 'muted', waitlist: 'warn' };
const LABEL = { booked: 'Booked', seated: 'Seated', completed: 'Completed', no_show: 'No-show', cancelled: 'Cancelled', waitlist: 'Waitlist' };
const dstr = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export default function Reservations() {
  const { branches, branch, setBranch } = useAuth();
  const outletId = branch === 'all' ? branches[0]?.id : branch;
  const [date, setDate] = useState(dstr(Date.now()));
  const { data, error, reload } = useLive(`/reservations?branch=${outletId}&date=${date}`, { types: [], interval: 30000 });
  const [form, setForm] = useState({ name: '', phone: '', covers: 2, time: '20:00', source: 'Phone', notes: '', deposit: '' });
  const [seat, setSeat] = useState(null);
  const [msg, setMsg] = useState(null);
  if (error) return <><PageHeader title="Reservations" /><ErrorNote>{error}</ErrorNote></>;
  if (!data) return <><PageHeader title="Reservations" /><Loading /></>;
  const run = async (fn, ok) => { setMsg(null); try { await fn(); setMsg({ ok: true, text: ok }); reload(); } catch (e) { setMsg({ ok: false, text: e.message }); } };
  const add = (waitlist) => run(async () => {
    await api('/reservations', { method: 'POST', body: { branch: outletId, ...form, waitlist, ts: new Date(`${date}T${form.time}:00`).getTime() } });
    setForm({ ...form, name: '', phone: '', notes: '', deposit: '' });
  }, waitlist ? 'Added to the waitlist' : 'Reservation saved');
  const setStatus = (r, status, table_id) => run(() => api(`/reservations/${r.id}`, { method: 'PATCH', body: { status, table_id } }), `${r.name}: ${LABEL[status]}`);
  const slots = {};
  data.list.forEach((r) => { const h = new Date(r.ts).getHours(); (slots[h] ??= []).push(r); });

  return (
    <>
      <PageHeader title="Reservations & Waitlist" subtitle="Bookings from phone, walk-ins and dining platforms in one list, deposits, no-show tracking, and seating straight onto a POS table."
        right={<div className="flex flex-wrap items-center gap-2">
          {branch === 'all' && <span className="rounded-xl bg-info-soft px-3 py-2 text-xs font-semibold text-info">Showing {branches[0]?.name}: pick a branch in the top bar</span>}
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none" aria-label="Date" />
        </div>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat icon={CalendarDays} tone="primary" label="Bookings" value={data.stats.bookings} sub={date === dstr(Date.now()) ? 'today' : date} />
        <MiniStat icon={Users} tone="info" label="Covers expected" value={data.stats.covers} />
        <MiniStat icon={ListOrdered} tone={data.stats.waitlist ? 'warn' : 'ok'} label="Waitlist" value={data.stats.waitlist} />
        <MiniStat icon={UserX} tone={data.stats.no_show_rate > 0.1 ? 'bad' : 'ok'} label="No-show rate" value={pct(data.stats.no_show_rate, 1)} sub={`deposits ${money(data.stats.deposits, { compact: false })}`} />
      </div>
      {msg && <div className={`mb-3 rounded-xl px-4 py-2 text-sm ${msg.ok ? 'bg-ok-soft text-ok' : 'bg-bad-soft text-bad'}`}>{msg.text}</div>}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card title="Day sheet" pad={false}>
          {data.list.length === 0 && <p className="p-6 text-center text-sm text-muted">No bookings for this date.</p>}
          {Object.entries(slots).map(([h, list]) => (
            <div key={h} className="border-t border-line">
              <div className="bg-surface-2/50 px-5 py-1.5 text-[11px] font-bold tracking-widest text-muted uppercase">{String(h).padStart(2, '0')}:00</div>
              <ul className="divide-y divide-line">{list.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5">
                  <span className="w-12 font-mono text-sm font-bold">{new Date(r.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                  <div className="min-w-0 flex-1"><div className="font-semibold">{r.name} <span className="text-muted">· {r.covers} pax</span></div>
                    <div className="text-[11.5px] text-muted">{r.source}{r.phone ? ` · ${r.phone}` : ''}{r.notes ? ` · ${r.notes}` : ''}{r.deposit ? ` · deposit ${money(r.deposit, { compact: false })}` : ''}{r.table_name ? ` · ${r.table_name}` : ''}</div></div>
                  <Badge tone={TONE[r.status]}>{LABEL[r.status]}</Badge>
                  {['booked', 'waitlist'].includes(r.status) && <>
                    <Button onClick={() => setSeat(r)}><Armchair size={14} />Seat</Button>
                    <Button variant="ghost" onClick={() => setStatus(r, 'no_show')} title="No-show"><UserX size={14} /></Button>
                    <Button variant="ghost" onClick={() => setStatus(r, 'cancelled')} title="Cancel"><X size={14} /></Button>
                  </>}
                  {r.status === 'seated' && <Button variant="ghost" onClick={() => setStatus(r, 'completed')}><Check size={14} />Done</Button>}
                </li>
              ))}</ul>
            </div>
          ))}
        </Card>
        <Card title="New booking">
          <div className="grid gap-2.5 text-sm">
            <input placeholder="Guest name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-primary" />
            <input placeholder="Phone (links to the guest profile)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-primary" />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" min={1} value={form.covers} onChange={(e) => setForm({ ...form, covers: e.target.value })} className="rounded-xl border border-line bg-surface px-3 py-2 outline-none" aria-label="Covers" />
              <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="rounded-xl border border-line bg-surface px-3 py-2 outline-none" aria-label="Time" />
            </div>
            <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="rounded-xl border border-line bg-surface px-3 py-2 outline-none">{data.sources.map((s) => <option key={s}>{s}</option>)}</select>
            <input placeholder="Notes (occasion, allergy, seating)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-xl border border-line bg-surface px-3 py-2 outline-none" />
            <input inputMode="decimal" placeholder="Deposit (optional)" value={form.deposit} onChange={(e) => setForm({ ...form, deposit: e.target.value })} className="rounded-xl border border-line bg-surface px-3 py-2 outline-none" />
            <div className="flex gap-2"><Button variant="primary" onClick={() => add(false)} className="flex-1"><Plus size={14} />Book</Button><Button onClick={() => add(true)}><ListOrdered size={14} />Waitlist now</Button></div>
          </div>
        </Card>
      </div>
      {seat && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/45" onClick={() => setSeat(null)} />
          <div className="relative w-full max-w-lg rounded-2xl bg-surface p-5 shadow-xl">
            <h3 className="mb-3 font-extrabold">Seat {seat.name} · {seat.covers} pax</h3>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">{data.tables.map((t) => (
              <button key={t.id} disabled={t.seats < seat.covers - 1} onClick={async () => { await setStatus(seat, 'seated', t.id); setSeat(null); }}
                className={`rounded-xl border p-2 text-center text-sm font-bold ${t.seats >= seat.covers ? 'border-ok/50 hover:bg-ok-soft' : 'border-line opacity-50'}`}>{t.name}<div className="text-[10px] font-normal text-muted">{t.area} · {t.seats}</div></button>
            ))}</div>
            <p className="mt-3 text-xs text-muted">Seating opens the order on that table in the POS.</p>
          </div>
        </div>
      )}
    </>
  );
}
