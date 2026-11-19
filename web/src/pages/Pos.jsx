import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Minus, Search, Send, Percent, Gift, Printer, Wallet, XCircle, ShoppingBag, Bike, Users, Clock, X, Receipt, ChefHat } from 'lucide-react';
import { useLive, api, money, ago, currency } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { PageHeader, Badge, Button, Loading, ErrorNote } from '../components/ui.jsx';

const STATUS = {
  free: { label: 'Free', cls: 'border-line bg-surface text-muted' }, reserved: { label: 'Reserved', cls: 'border-info/50 bg-info-soft text-info' },
  ordering: { label: 'Ordering', cls: 'border-warn/50 bg-warn-soft text-warn' }, occupied: { label: 'Running', cls: 'border-primary/50 bg-primary-soft text-primary' },
  billed: { label: 'Billed', cls: 'border-ok/50 bg-ok-soft text-ok' },
};
// Keep the order panel inside the viewport so Send KOT / Bill / Settle never fall below the fold
function useFitToViewport(ready) {
  const ref = useRef(null);
  useEffect(() => {
    const fit = () => {
      const el = ref.current;
      if (!el || window.innerWidth < 1280) { if (el) el.style.maxHeight = ''; return; }
      const top = Math.max(el.getBoundingClientRect().top, 80);
      el.style.maxHeight = `${Math.max(420, window.innerHeight - top - 16)}px`;
    };
    fit();
    window.addEventListener('scroll', fit, { passive: true });
    window.addEventListener('resize', fit);
    return () => { window.removeEventListener('scroll', fit); window.removeEventListener('resize', fit); };
  }, [ready]);
  return ref;
}
const TENDER_LABEL = { upi: 'UPI', card: 'Card', cash: 'Cash', wallet: 'Wallet', credit: 'Credit (on account)' };

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div className={`relative max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-surface p-5 shadow-xl ${wide ? 'max-w-lg' : 'max-w-md'}`}>
        <div className="mb-3 flex items-center justify-between"><h3 className="text-base font-extrabold">{title}</h3><button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-surface-2" aria-label="Close"><X size={16} /></button></div>
        {children}
      </div>
    </div>
  );
}

function ReasonPicker({ reasons, onPick, extra }) {
  return <div className="grid gap-2">{extra}{reasons.map((r) => <Button key={r} onClick={() => onPick(r)} className="justify-start">{r}</Button>)}</div>;
}

/** Thermal-style bill (80 mm) with GST break-up, GSTIN and FSSAI for India. */
export function BillSlip({ st, order }) {
  const b = order.bill;
  const tb = st.tables.find((t) => t.id === order.table_id);
  return (
    <div className="mx-auto w-[300px] rounded-lg border border-dashed border-line bg-white p-4 font-mono text-[11.5px] leading-snug text-black">
      <div className="text-center">
        <div className="text-[13px] font-bold">{st.group}</div>
        <div>{st.outlet.name} · {st.outlet.location}, {st.outlet.city}</div>
        {st.outlet.gstin && <div>GSTIN: {st.outlet.gstin}</div>}
        {st.outlet.fssai && <div>FSSAI Lic. No: {st.outlet.fssai}</div>}
        <div className="mt-1 font-bold">{b.nc ? 'COMPLIMENTARY (NC)' : st.tax.rate ? 'TAX INVOICE' : 'INVOICE'}</div>
      </div>
      <div className="my-2 border-t border-dashed border-black/40" />
      <div className="flex justify-between"><span>Bill: {order.bill_no || 'DRAFT'}</span><span>{new Date(order.settled_at || Date.now()).toLocaleDateString('en-GB')}</span></div>
      <div className="flex justify-between"><span>{tb ? `Table ${tb.name}` : order.channel} · {order.covers} pax</span><span>{new Date(order.settled_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
      <div className="my-2 border-t border-dashed border-black/40" />
      {b.lines.map((l) => <div key={l.item_id} className="flex justify-between gap-2"><span className="truncate">{l.qty} × {l.name}</span><span>{l.amount.toFixed(2)}</span></div>)}
      <div className="my-2 border-t border-dashed border-black/40" />
      <div className="flex justify-between"><span>Sub total</span><span>{b.subtotal.toFixed(2)}</span></div>
      {b.discount > 0 && <div className="flex justify-between"><span>{b.nc ? `NC (${b.nc_reason})` : `Discount ${b.discount_pct}%`}</span><span>-{b.discount.toFixed(2)}</span></div>}
      {b.service > 0 && <div className="flex justify-between"><span>Service charge (optional) {b.service_pct}%</span><span>{b.service.toFixed(2)}</span></div>}
      {b.taxes.map((x) => <div key={x.name} className="flex justify-between"><span>{x.name} @{(x.rate * 100).toFixed(1)}%</span><span>{x.amount.toFixed(2)}</span></div>)}
      {b.round_off !== 0 && <div className="flex justify-between"><span>Round off</span><span>{b.round_off.toFixed(2)}</span></div>}
      <div className="mt-1 flex justify-between text-[13px] font-bold"><span>TOTAL</span><span>{currency().symbol}{b.total.toFixed(2)}</span></div>
      {order.payments?.tenders?.length > 0 && <div className="mt-1">{order.payments.tenders.map((p) => <div key={p.mode} className="flex justify-between"><span>Paid by {TENDER_LABEL[p.mode] || p.mode}</span><span>{p.amount.toFixed(2)}</span></div>)}</div>}
      <div className="my-2 border-t border-dashed border-black/40" />
      {st.tax.sac && <div className="text-center text-[10.5px]">SAC {st.tax.sac} · Restaurant service · GST {(st.tax.rate * 100).toFixed(0)}%</div>}
      <div className="text-center text-[10.5px]">Thank you! Scan the QR on your table to give feedback.</div>
    </div>
  );
}

export default function Pos() {
  const { branches, branch, setBranch } = useAuth();
  const outletId = branch === 'all' ? branches[0]?.id : branch;
  const { data: st, error, reload } = useLive(`/pos?branch=${outletId}`, { types: ['ticket'], throttle: 4000, interval: 15000 });
  const panelRef = useFitToViewport(!!st);
  const [area, setArea] = useState(null);
  const [sel, setSel] = useState(null); // pos order id
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null);
  const [msg, setMsg] = useState(null);
  const [tenders, setTenders] = useState({});
  const [kot, setKot] = useState(null);

  const order = st?.open.find((o) => o.id === sel) || null;
  const menu = useMemo(() => (st?.menu || []).filter((m) => (cat === 'All' || m.category === cat) && (!q || m.name.toLowerCase().includes(q.toLowerCase()))), [st, cat, q]);
  if (error) return <><PageHeader title="Point of Sale" /><ErrorNote>{error}</ErrorNote></>;
  if (!st) return <><PageHeader title="Point of Sale" /><Loading /></>;
  const areaNow = area || st.areas[0];
  const cats = ['All', ...new Set(st.menu.map((m) => m.category))];

  const run = async (fn) => { setMsg(null); try { const r = await fn(); await reload(); return r; } catch (e) { setMsg(e.message); return null; } };
  const openTable = (t) => run(async () => {
    if (t.order_id) { setSel(t.order_id); return; }
    const o = await api('/pos/orders', { method: 'POST', body: { branch: outletId, table_id: t.id, covers: t.reservation?.covers || t.seats, customer: t.reservation?.name } });
    setSel(o.id);
  });
  const newOrder = (channel) => run(async () => { const o = await api('/pos/orders', { method: 'POST', body: { branch: outletId, channel, covers: 1 } }); setSel(o.id); });
  const setQty = (item, qty, reason) => run(async () => {
    const cur = order.items.find((i) => i.item_id === item.item_id || i.item_id === item.id);
    if (cur && qty < cur.sent && !reason) { setModal({ type: 'cancel-item', item, qty }); return; }
    const items = [...order.items.filter((i) => i.item_id !== (item.item_id || item.id)).map((i) => ({ item_id: i.item_id, qty: i.qty, note: i.note })), ...(qty > 0 || (cur?.sent && qty >= 0) ? [{ item_id: item.item_id || item.id, qty }] : [])];
    await api(`/pos/orders/${order.id}`, { method: 'PATCH', body: { items, reason } });
  });
  const add = (m) => { if (!m.available) { setMsg(`${m.name} is 86'd (unavailable) at this branch`); return; } const cur = order?.items.find((i) => i.item_id === m.id); setQty(m, (cur?.qty || 0) + 1); };
  const sendKot = () => run(async () => { const r = await api(`/pos/orders/${order.id}/kot`, { method: 'POST' }); setKot(r.kot); });
  const pending = order ? order.items.some((i) => i.sent < i.qty) : false;
  const b = order?.bill;

  return (
    <>
      <PageHeader title="Point of Sale" subtitle={`${[st.outlet.name, [st.outlet.location, st.outlet.city].filter(Boolean).join(', '), st.outlet.gstin && `GSTIN ${st.outlet.gstin}`].filter(Boolean).join(' · ')}. Tables, KOTs, discounts, complimentary bills, split tender and ${st.tax.rate ? `${st.tax.name} invoices` : 'invoices'}. Every sensitive action is written to the audit log.`}
        right={
          <div className="flex flex-wrap items-center gap-2">
            {branch === 'all' && <span className="rounded-xl bg-info-soft px-3 py-2 text-xs font-semibold text-info">Showing {branches[0]?.name}: pick a branch in the top bar</span>}
            <Button onClick={() => newOrder('takeaway')}><ShoppingBag size={15} />Takeaway</Button>
            <Button onClick={() => newOrder('delivery')}><Bike size={15} />Delivery</Button>
          </div>
        } />
      {msg && <div className="mb-3 rounded-xl bg-bad-soft px-4 py-2 text-sm text-bad">{msg}</div>}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_440px]">
        {/* Left: tables or menu */}
        <section className="min-w-0 rounded-2xl border border-line bg-surface p-4 shadow-card">
          {!order ? (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {st.areas.map((a) => <button key={a} onClick={() => setArea(a)} className={`rounded-full border px-3 py-1 text-sm font-semibold ${areaNow === a ? 'border-primary bg-primary-soft text-primary' : 'border-line text-muted'}`}>{a}</button>)}
                <span className="flex-1" />
                {Object.entries(STATUS).map(([k, v]) => <span key={k} className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted"><span className={`h-2.5 w-2.5 rounded-sm border ${v.cls}`} />{v.label}</span>)}
              </div>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {st.tables.filter((t) => t.area === areaNow).map((t) => (
                  <button key={t.id} onClick={() => openTable(t)} className={`flex aspect-square flex-col items-center justify-center rounded-2xl border-2 p-2 text-center transition hover:scale-[1.03] ${STATUS[t.status].cls}`}>
                    <span className="text-lg font-extrabold text-ink">{t.name}</span>
                    <span className="flex items-center gap-1 text-[11px]"><Users size={11} />{t.seats}</span>
                    {t.order_id ? <span className="mt-1 text-[12px] font-bold tnum">{money(t.total, { compact: false })}</span> : t.reservation ? <span className="mt-1 truncate text-[10.5px]">{t.reservation.name.split(' ')[0]} · {new Date(t.reservation.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> : null}
                    {t.since && <span className="text-[10px] opacity-80">{ago(t.since)}</span>}
                  </button>
                ))}
              </div>
              {st.open.filter((o) => !o.table_id).length > 0 && (
                <div className="mt-5">
                  <div className="mb-2 text-[11px] font-bold tracking-widest text-muted uppercase">Takeaway & delivery</div>
                  <div className="flex flex-wrap gap-2">{st.open.filter((o) => !o.table_id).map((o) => <Button key={o.id} onClick={() => setSel(o.id)}>{o.channel === 'delivery' ? <Bike size={14} /> : <ShoppingBag size={14} />}#{o.id} · {money(o.bill.total, { compact: false })}</Button>)}</div>
                </div>
              )}
              <p className="mt-5 text-xs text-muted">Settled today on this POS: {st.settled_today.n} bills · {money(st.settled_today.v, { compact: false })}</p>
            </>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <label className="relative min-w-48 flex-1"><Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search item or short code" className="w-full rounded-xl border border-line bg-surface py-2 pr-3 pl-9 text-sm outline-none focus:border-primary" autoFocus /></label>
                <Button onClick={() => setSel(null)}>All tables</Button>
              </div>
              <div className="mb-3 flex flex-wrap gap-1.5">{cats.map((c) => <button key={c} onClick={() => setCat(c)} className={`rounded-full border px-3 py-1 text-xs font-semibold ${cat === c ? 'border-primary bg-primary-soft text-primary' : 'border-line text-muted'}`}>{c}</button>)}</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {menu.map((m) => (
                  <button key={m.id} onClick={() => add(m)} className={`rounded-xl border p-3 text-left transition ${m.available ? 'border-line hover:border-primary hover:bg-primary-soft/40' : 'cursor-not-allowed border-line opacity-45'}`}>
                    <div className="flex items-start justify-between gap-1"><span className="text-[13px] leading-tight font-bold">{m.name}</span>{/veg/.test(m.tags) && currency().code === 'INR' && <span className="mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-[3px] border border-ok"><span className="h-1.5 w-1.5 rounded-full bg-ok" /></span>}</div>
                    <div className="mt-1 flex items-center justify-between text-[12px]"><span className="font-semibold tnum">{money(m.price, { compact: false })}</span>{!m.available ? <Badge tone="bad">86</Badge> : <span className="text-muted">{m.station}</span>}</div>
                  </button>
                ))}
              </div>
            </>
          )}
        </section>

        {/* Right: order ticket */}
        <aside ref={panelRef} className="flex min-h-[420px] flex-col rounded-2xl border border-line bg-surface shadow-card xl:sticky xl:top-20">
          {!order ? <div className="grid flex-1 place-items-center p-6 text-center text-sm text-muted"><div><Receipt size={28} className="mx-auto mb-2 text-faint" />Pick a table or start a takeaway / delivery order.</div></div> : (
            <>
              <div className="flex items-center gap-2 border-b border-line px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="font-extrabold">{order.table_id ? `Table ${st.tables.find((t) => t.id === order.table_id)?.name}` : `${order.channel === 'delivery' ? 'Delivery' : 'Takeaway'} #${order.id}`}{order.customer ? ` · ${order.customer}` : ''}</div>
                  <div className="text-[11px] text-muted"><Clock size={11} className="mr-1 inline" />{ago(order.opened_at)} · {order.covers} pax · KOTs {order.kots}{order.printed ? ` · printed ×${order.printed}` : ''}</div>
                </div>
                {order.nc_reason && <Badge tone="info">NC</Badge>}
                {order.discount_pct > 0 && <Badge tone="warn">−{order.discount_pct}%</Badge>}
              </div>
              <ul className="flex-1 divide-y divide-line overflow-y-auto px-4">
                {order.items.length === 0 && <li className="py-8 text-center text-sm text-muted">Tap menu items to add them.</li>}
                {order.items.map((i) => (
                  <li key={i.item_id} className="flex items-center gap-2 py-2.5">
                    <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-semibold">{i.name}</div><div className="text-[11px] text-muted">{money(i.price, { compact: false })} · {i.sent >= i.qty ? <span className="text-ok">sent</span> : <span className="text-warn">{i.qty - i.sent} pending</span>}</div></div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setQty(i, i.qty - 1)} className="grid h-7 w-7 place-items-center rounded-lg border border-line hover:bg-surface-2" aria-label="Less"><Minus size={13} /></button>
                      <span className="w-6 text-center font-bold tnum">{i.qty}</span>
                      <button onClick={() => setQty(i, i.qty + 1)} className="grid h-7 w-7 place-items-center rounded-lg border border-line hover:bg-surface-2" aria-label="More"><Plus size={13} /></button>
                    </div>
                    <span className="w-20 text-right text-[13px] font-bold tnum">{money(i.qty * i.price, { compact: false })}</span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-line px-4 py-3 text-[13px]">
                <div className="flex justify-between text-muted"><span>Sub total</span><span className="tnum">{money(b.subtotal, { compact: false, cents: true })}</span></div>
                {b.discount > 0 && <div className="flex justify-between text-muted"><span>{b.nc ? `Complimentary · ${b.nc_reason}` : `Discount ${b.discount_pct}% · ${b.discount_reason}`}</span><span className="tnum">−{money(b.discount, { compact: false, cents: true })}</span></div>}
                {b.taxes.map((x) => <div key={x.name} className="flex justify-between text-muted"><span>{x.name} {(x.rate * 100).toFixed(1)}%</span><span className="tnum">{money(x.amount, { compact: false, cents: true })}</span></div>)}
                {b.round_off !== 0 && <div className="flex justify-between text-muted"><span>Round off</span><span className="tnum">{b.round_off.toFixed(2)}</span></div>}
                <div className="mt-1 flex justify-between text-lg font-extrabold"><span>Total</span><span className="tnum">{money(b.total, { compact: false, cents: currency().code !== 'INR' })}</span></div>
              </div>
              <div className="grid grid-cols-3 gap-2 border-t border-line p-3">
                <Button variant="primary" onClick={sendKot} disabled={!pending} className="col-span-3"><Send size={15} />Send KOT{pending ? ` (${order.items.reduce((a, i) => a + i.qty - i.sent, 0)})` : ''}</Button>
                <Button onClick={() => setModal({ type: 'discount' })} disabled={!order.items.length}><Percent size={14} />Discount</Button>
                <Button onClick={() => setModal({ type: 'nc' })} disabled={!order.items.length}><Gift size={14} />NC</Button>
                <Button onClick={() => run(async () => { await api(`/pos/orders/${order.id}/print`, { method: 'POST' }); setModal({ type: 'bill' }); })} disabled={!order.items.length || pending}><Printer size={14} />Bill</Button>
                <Button variant="primary" className="col-span-2" disabled={!order.items.length || pending} onClick={() => { setTenders({ [st.tenders[0]]: String(b.total) }); setModal({ type: 'settle' }); }}><Wallet size={15} />Settle {money(b.total, { compact: false })}</Button>
                <Button variant="danger" onClick={() => setModal({ type: 'cancel' })}><XCircle size={14} />Void</Button>
              </div>
            </>
          )}
        </aside>
      </div>

      {modal?.type === 'discount' && <Modal title="Apply discount" onClose={() => setModal(null)}>
        <div className="mb-3 flex flex-wrap gap-2">{[5, 10, 15, 20, 25].map((v) => <Button key={v} onClick={() => setModal({ ...modal, pct: v })} variant={modal.pct === v ? 'primary' : 'default'}>{v}%</Button>)}<Button onClick={() => setModal({ ...modal, pct: 0 })}>Remove</Button></div>
        {modal.pct != null && (modal.pct === 0 ? <Button variant="primary" onClick={() => run(async () => { await api(`/pos/orders/${order.id}/discount`, { method: 'POST', body: { pct: 0 } }); setModal(null); })}>Remove discount</Button>
          : <><p className="mb-2 text-xs text-muted">Reason (required, shown in the leakage report)</p><ReasonPicker reasons={st.reasons.discount} onPick={(reason) => run(async () => { await api(`/pos/orders/${order.id}/discount`, { method: 'POST', body: { pct: modal.pct, reason } }); setModal(null); })} /></>)}
      </Modal>}
      {modal?.type === 'nc' && <Modal title="Complimentary (NC) bill" onClose={() => setModal(null)}><p className="mb-2 text-xs text-muted">The whole bill becomes non-chargeable and is settled to house. Manager only.</p><ReasonPicker reasons={st.reasons.nc} onPick={(reason) => run(async () => { await api(`/pos/orders/${order.id}/nc`, { method: 'POST', body: { reason } }); setModal(null); })} /></Modal>}
      {modal?.type === 'cancel' && <Modal title="Void this order" onClose={() => setModal(null)}><p className="mb-2 text-xs text-muted">Items already sent to the kitchen are logged as a bill cancellation.</p><ReasonPicker reasons={st.reasons.cancel} onPick={(reason) => run(async () => { await api(`/pos/orders/${order.id}/cancel`, { method: 'POST', body: { reason } }); setModal(null); setSel(null); })} /></Modal>}
      {modal?.type === 'cancel-item' && <Modal title={`Cancel ${modal.item.name} after KOT`} onClose={() => setModal(null)}><p className="mb-2 text-xs text-muted">This item was already sent to the kitchen. Pick a reason; it prints on the cancellation KOT and goes to the audit log.</p><ReasonPicker reasons={st.reasons.cancel} onPick={(reason) => { setModal(null); setQty(modal.item, modal.qty, reason); }} /></Modal>}
      {modal?.type === 'bill' && order && <Modal title="Bill preview" onClose={() => setModal(null)} wide><BillSlip st={st} order={order} /><div className="mt-3 flex justify-end gap-2"><Button onClick={() => window.print()}><Printer size={14} />Print</Button></div></Modal>}
      {modal?.type === 'settle' && order && <Modal title={`Settle ${money(b.total, { compact: false })}`} onClose={() => setModal(null)}>
        {b.nc ? <p className="mb-3 text-sm">Complimentary bill: no payment is collected.</p> : (
          <div className="grid gap-2">
            {st.tenders.map((m) => (
              <label key={m} className="flex items-center gap-3"><span className="w-36 text-sm font-semibold">{TENDER_LABEL[m] || m}</span>
                <input inputMode="decimal" value={tenders[m] || ''} onChange={(e) => setTenders({ ...tenders, [m]: e.target.value })} className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-right font-mono text-sm outline-none focus:border-primary" />
                <button className="text-xs font-semibold text-primary" onClick={() => setTenders({ [m]: String(b.total) })}>Full</button></label>
            ))}
            <p className="text-xs text-muted">Split across tenders if needed. Total entered: {money(Object.values(tenders).reduce((a, v) => a + (Number(v) || 0), 0), { compact: false, cents: true })}</p>
          </div>
        )}
        <div className="mt-4 flex justify-end"><Button variant="primary" onClick={() => run(async () => {
          const r = await api(`/pos/orders/${order.id}/settle`, { method: 'POST', body: { payments: Object.entries(tenders).map(([mode, amount]) => ({ mode, amount: Number(amount) })) } });
          setModal({ type: 'settled', order: r }); setSel(null);
        })}><Wallet size={15} />Confirm settlement</Button></div>
      </Modal>}
      {modal?.type === 'settled' && <Modal title={`Settled · ${modal.order.bill_no}`} onClose={() => setModal(null)} wide><BillSlip st={st} order={modal.order} /><p className="mt-3 text-center text-xs text-muted">Recorded in sales, GST register and day end. E-bill can go to the guest by SMS / WhatsApp once a messaging connector is set up.</p></Modal>}
      {kot && <Modal title={`KOT #${kot.no}${kot.table ? ` · Table ${kot.table}` : ` · ${kot.channel}`}`} onClose={() => setKot(null)}>
        <div className="space-y-3">{Object.entries(kot.stations).map(([s, items]) => (
          <div key={s} className="rounded-xl border border-dashed border-line p-3 font-mono text-[12px]"><div className="mb-1 flex items-center gap-1.5 font-bold"><ChefHat size={14} />{s.toUpperCase()}</div>
            {Object.entries(items.reduce((a, i) => ({ ...a, [i.item]: (a[i.item] || 0) + 1 }), {})).map(([n, c]) => <div key={n}>{c} × {n}</div>)}</div>
        ))}</div>
        <p className="mt-3 text-xs text-muted">Sent to the kitchen display by station; tickets show in Kitchen Operations.</p>
      </Modal>}
    </>
  );
}
