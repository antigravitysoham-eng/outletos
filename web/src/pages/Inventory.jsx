import { useMemo, useState } from 'react';
import { Package, Truck, Trash2, BookOpen, UtensilsCrossed, ClipboardCheck, AlertTriangle, Check } from 'lucide-react';
import { useLive, api, money, pct, num, ago } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Card, PageHeader, Badge, Button, Loading, ErrorNote, MiniStat, Bar } from '../components/ui.jsx';

const TABS = [['stock', 'Stock', Package], ['po', 'Purchasing', Truck], ['waste', 'Wastage', Trash2], ['count', 'Stock count', ClipboardCheck], ['recipes', 'Recipes', BookOpen], ['menu', 'Menu & 86', UtensilsCrossed]];
const ST = { out: ['bad', 'Out'], low: ['warn', 'Reorder'], ok: ['ok', 'OK'], over: ['info', 'Overstock'] };
const th = 'px-3 py-2 text-left text-[11px] font-bold tracking-wide text-muted uppercase';
const td = 'px-3 py-2 align-middle';
const qty = (v, unit) => `${v == null ? '—' : Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 100) / 100} ${unit}`;

export default function Inventory() {
  const { branches, branch, setBranch, can } = useAuth();
  const outletId = branch === 'all' ? branches[0]?.id : branch;
  const [tab, setTab] = useState('stock');
  const inv = useLive(can('inventory.manage') ? `/inventory?branch=${outletId}` : null, { types: [], interval: 30000 });
  const men = useLive(`/menu?branch=${outletId}`, { types: [], interval: 30000 });
  const [msg, setMsg] = useState(null);
  const [filter, setFilter] = useState('all');
  const [waste, setWaste] = useState({ ingredient_id: '', qty: '', reason: '' });
  const [counts, setCounts] = useState({});
  const [prices, setPrices] = useState({});
  const d = inv.data, m = men.data;
  const run = async (fn, ok) => { setMsg(null); try { await fn(); setMsg({ ok: true, text: ok }); inv.reload(); men.reload(); } catch (e) { setMsg({ ok: false, text: e.message }); } };
  const rows = useMemo(() => (d?.items || []).filter((i) => filter === 'all' || (filter === 'attention' ? ['low', 'out'].includes(i.status) : i.category === filter)), [d, filter]);
  const recipes = useMemo(() => { const g = {}; (d?.recipes || []).forEach((r) => (g[r.item_id] ??= { item: r.item, price: r.price, std: r.std_cost, lines: [] }).lines.push(r)); return Object.entries(g); }, [d]);
  if (inv.error || men.error) return <><PageHeader title="Inventory & Menu" /><ErrorNote>{inv.error || men.error}</ErrorNote></>;
  if ((can('inventory.manage') && !d) || !m) return <><PageHeader title="Inventory & Menu" /><Loading /></>;
  const tabs = TABS.filter(([id]) => can('inventory.manage') || id === 'menu');
  const active = tabs.find(([id]) => id === tab) ? tab : tabs[0][0];

  return (
    <>
      <PageHeader title="Inventory & Menu" subtitle="Recipe-based stock (sales × bill of materials), reorder suggestions from usage and vendor lead time, purchase orders, wastage, physical counts with variance, and menu availability (86) per branch."
        right={branch === 'all' && <span className="rounded-xl bg-info-soft px-3 py-2 text-xs font-semibold text-info">Showing {branches[0]?.name}: pick a branch in the top bar</span>} />
      {d && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MiniStat icon={Package} tone="primary" label="Stock value on hand" value={money(d.stock_value)} sub={`last count ${ago(d.count_ts)}`} />
          <MiniStat icon={AlertTriangle} tone={d.low ? 'warn' : 'ok'} label="Items to reorder" value={d.low} sub={`${d.suggested.length} suggested POs`} />
          <MiniStat icon={Trash2} tone={d.waste_pct > 0.02 ? 'bad' : 'ok'} label="Wastage (7 days)" value={money(d.waste_value)} sub={`${pct(d.waste_pct, 1)} of sales`} />
          <MiniStat icon={Truck} tone="info" label="Open purchase orders" value={d.pos.filter((p) => p.status === 'sent').length} sub={money(d.pos.filter((p) => p.status === 'sent').reduce((a, p) => a + p.total, 0))} />
        </div>
      )}
      <div className="mb-4 flex flex-wrap gap-1.5" role="tablist">
        {tabs.map(([id, label, Icon]) => <button key={id} role="tab" aria-selected={active === id} onClick={() => setTab(id)} className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold ${active === id ? 'grad-primary text-white' : 'border border-line bg-surface text-muted hover:text-ink'}`}><Icon size={15} />{label}</button>)}
      </div>
      {msg && <div className={`mb-3 rounded-xl px-4 py-2 text-sm ${msg.ok ? 'bg-ok-soft text-ok' : 'bg-bad-soft text-bad'}`}>{msg.text}</div>}

      {active === 'stock' && (
        <Card pad={false} title="Stock on hand" subtitle="On hand = last count + purchases − wastage − theoretical usage from sales. Par = daily usage × (vendor lead time + 2 days)."
          action={<select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-xl border border-line bg-surface px-2 py-1.5 text-xs outline-none"><option value="all">All</option><option value="attention">Needs attention</option>{[...new Set(d.items.map((i) => i.category))].map((c) => <option key={c}>{c}</option>)}</select>}>
          <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-sm">
            <thead className="border-b border-line bg-surface-2/60"><tr><th className={th}>Ingredient</th><th className={`${th} text-right`}>On hand</th><th className={th}>Cover</th><th className={`${th} text-right`}>Use / day</th><th className={`${th} text-right`}>Par</th><th className={`${th} text-right`}>Suggest</th><th className={`${th} text-right`}>Value</th><th className={th}>Status</th></tr></thead>
            <tbody>{rows.map((i) => (
              <tr key={i.id} className="border-t border-line/70">
                <td className={td}><div className="font-semibold">{i.name}</div><div className="text-[11px] text-muted">{i.category} · {i.vendor}</div></td>
                <td className={`${td} text-right font-bold tnum`}>{qty(i.on_hand, i.unit)}</td>
                <td className={`${td} w-40`}><div className="flex items-center gap-2"><Bar value={Math.min(1, (i.days_left || 0) / 7)} color={i.status === 'ok' ? 'var(--ok)' : i.status === 'over' ? 'var(--info)' : i.status === 'low' ? 'var(--warn)' : 'var(--bad)'} /><span className="w-12 text-right text-xs tnum">{i.days_left != null ? `${i.days_left}d` : '—'}</span></div></td>
                <td className={`${td} text-right tnum text-muted`}>{qty(i.usage_per_day, i.unit)}</td>
                <td className={`${td} text-right tnum text-muted`}>{qty(i.par, i.unit)}</td>
                <td className={`${td} text-right tnum`}>{i.suggest ? <b>{qty(i.suggest, i.unit)}</b> : '—'}</td>
                <td className={`${td} text-right tnum`}>{money(i.value)}</td>
                <td className={td}><Badge tone={ST[i.status][0]}>{ST[i.status][1]}</Badge></td>
              </tr>
            ))}</tbody>
          </table></div>
        </Card>
      )}

      {active === 'po' && (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card title="Suggested purchase orders" subtitle="Everything below its reorder point, topped up to par, grouped by vendor">
            {d.suggested.length === 0 && <p className="py-6 text-center text-sm text-muted">Nothing to reorder. Stock covers vendor lead time for every item.</p>}
            <div className="space-y-3">{d.suggested.map((s) => (
              <div key={s.vendor_id} className="rounded-xl border border-line p-3">
                <div className="flex items-center gap-2"><span className="font-bold">{s.vendor}</span><Badge tone="muted">lead {s.lead_days}d</Badge><span className="flex-1" /><span className="font-bold tnum">{money(s.total, { compact: false })}</span></div>
                <ul className="mt-2 grid gap-1 text-[12.5px]">{s.lines.map((l) => <li key={l.ingredient_id} className="flex justify-between"><span>{l.name}</span><span className="tnum text-muted">{qty(l.qty, l.unit)} × {money(l.cost, { compact: false, cents: l.cost < 100 })}</span></li>)}</ul>
                <Button variant="primary" className="mt-3" onClick={() => run(() => api('/inventory/po', { method: 'POST', body: { branch: outletId, vendor_id: s.vendor_id, lines: s.lines } }), `PO sent to ${s.vendor}`)}><Truck size={14} />Raise PO</Button>
              </div>
            ))}</div>
          </Card>
          <Card title="Purchase orders" pad={false}>
            <table className="w-full text-sm"><thead className="border-b border-line"><tr><th className={th}>PO</th><th className={th}>Vendor</th><th className={`${th} text-right`}>Value</th><th className={th}>Status</th><th className={th} /></tr></thead>
              <tbody>{d.pos.map((p) => (
                <tr key={p.id} className="border-t border-line/70">
                  <td className={td}><div className="font-semibold">PO-{p.id}</div><div className="text-[11px] text-muted">{new Date(p.created_at).toLocaleDateString('en-GB')} · {p.lines.length} lines</div></td>
                  <td className={td}>{p.vendor}</td><td className={`${td} text-right tnum`}>{money(p.total, { compact: false })}</td>
                  <td className={td}><Badge tone={p.status === 'received' ? 'ok' : 'warn'}>{p.status === 'received' ? `Received ${ago(p.received_at)}` : `Due ${new Date(p.expected_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}</Badge></td>
                  <td className={td}>{p.status === 'sent' && <Button onClick={() => run(() => api(`/inventory/po/${p.id}/receive`, { method: 'POST', body: {} }), `PO-${p.id} received into stock (GRN)`)}><Check size={14} />Receive</Button>}</td>
                </tr>
              ))}</tbody></table>
            <div className="border-t border-line px-5 py-3 text-[12px] text-muted">Vendors: {d.vendors.map((v) => `${v.name}${v.gstin ? ` (GSTIN ${v.gstin})` : ''}`).join(' · ')}</div>
          </Card>
        </div>
      )}

      {active === 'waste' && (
        <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
          <Card title="Log wastage">
            <div className="grid gap-3 text-sm">
              <select value={waste.ingredient_id} onChange={(e) => setWaste({ ...waste, ingredient_id: e.target.value })} className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-primary"><option value="">Ingredient…</option>{d.items.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}</select>
              <input inputMode="decimal" placeholder="Quantity" value={waste.qty} onChange={(e) => setWaste({ ...waste, qty: e.target.value })} className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-primary" />
              <div className="flex flex-wrap gap-1.5">{d.reasons.map((r) => <button key={r} onClick={() => setWaste({ ...waste, reason: r })} className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${waste.reason === r ? 'border-primary bg-primary-soft text-primary' : 'border-line text-muted'}`}>{r}</button>)}</div>
              <Button variant="primary" onClick={() => run(async () => { await api('/inventory/waste', { method: 'POST', body: { branch: outletId, ...waste } }); setWaste({ ingredient_id: '', qty: '', reason: '' }); }, 'Wastage logged')}><Trash2 size={14} />Log wastage</Button>
            </div>
          </Card>
          <Card title="Wastage log · last 7 days" subtitle={`${money(d.waste_value, { compact: false })} · ${pct(d.waste_pct, 1)} of sales (benchmark under 2%)`} pad={false}>
            <div className="max-h-[420px] overflow-y-auto"><table className="w-full text-sm"><tbody>{d.waste.map((w) => (
              <tr key={w.id} className="border-t border-line/70"><td className={td}><div className="font-semibold">{w.name}</div><div className="text-[11px] text-muted">{new Date(w.ts).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {w.user}</div></td>
                <td className={td}><Badge tone="muted">{w.reason}</Badge></td><td className={`${td} text-right tnum`}>{qty(-w.qty, w.unit)}</td><td className={`${td} text-right font-semibold tnum`}>{money(w.value, { compact: false })}</td></tr>
            ))}</tbody></table></div>
          </Card>
        </div>
      )}

      {active === 'count' && (
        <Card title="Physical stock count" subtitle="Enter what is on the shelf. Blank lines keep the system quantity. Saving records the variance (actual vs theoretical) and resets the stock baseline."
          action={<Button variant="primary" onClick={() => run(async () => { await api('/inventory/count', { method: 'POST', body: { branch: outletId, counts } }); setCounts({}); }, 'Count saved, variance recorded')}><ClipboardCheck size={14} />Save count</Button>} pad={false}>
          <div className="grid gap-4 p-5 pt-2 xl:grid-cols-2">
            <div className="max-h-[480px] overflow-y-auto"><table className="w-full text-sm"><thead className="sticky top-0 bg-surface"><tr><th className={th}>Ingredient</th><th className={`${th} text-right`}>System</th><th className={th}>Counted</th></tr></thead>
              <tbody>{d.items.map((i) => <tr key={i.id} className="border-t border-line/70"><td className={td}>{i.name}</td><td className={`${td} text-right tnum text-muted`}>{qty(i.on_hand, i.unit)}</td>
                <td className={td}><input inputMode="decimal" value={counts[i.id] ?? ''} onChange={(e) => setCounts({ ...counts, [i.id]: e.target.value })} placeholder={String(Math.round(i.on_hand * 100) / 100)} className="w-28 rounded-lg border border-line bg-surface px-2 py-1 text-right font-mono text-xs outline-none focus:border-primary" /> <span className="text-xs text-muted">{i.unit}</span></td></tr>)}</tbody></table></div>
            <div>
              <div className="mb-2 text-[11px] font-bold tracking-widest text-muted uppercase">Variance at the last count</div>
              {d.variance.length === 0 ? <p className="text-sm text-muted">No manual count yet. After you save one, shortages and surpluses against theoretical stock appear here (theft, over-portioning, unrecorded waste).</p> : (
                <table className="w-full text-sm"><tbody>{d.variance.map((v) => <tr key={v.ingredient_id} className="border-t border-line/70"><td className={td}>{v.name}</td><td className={`${td} text-right tnum`}>{v.diff > 0 ? '+' : ''}{qty(v.diff, v.unit)}</td><td className={`${td} text-right font-semibold tnum ${v.value < 0 ? 'text-bad' : 'text-ok'}`}>{money(v.value, { compact: false })}</td></tr>)}
                  <tr className="border-t-2 border-line font-bold"><td className={td}>Net variance</td><td /><td className={`${td} text-right tnum`}>{money(d.variance.reduce((a, v) => a + v.value, 0), { compact: false })}</td></tr></tbody></table>
              )}
            </div>
          </div>
        </Card>
      )}

      {active === 'recipes' && (
        <Card title="Recipes (bill of materials)" subtitle="Per-portion quantities. Sales deduct these from stock in real time; recipe cost drives theoretical food cost." pad={false}>
          <div className="grid gap-3 p-5 pt-2 md:grid-cols-2 xl:grid-cols-3">{recipes.map(([id, r]) => {
            const cost = r.lines.reduce((a, l) => a + l.line_cost, 0);
            return (
              <div key={id} className="rounded-xl border border-line p-3">
                <div className="flex items-baseline justify-between gap-2"><span className="font-bold">{r.item}</span><span className={`text-xs font-bold ${cost / r.price > 0.35 ? 'text-bad' : 'text-ok'}`}>{pct(cost / r.price, 0)} food cost</span></div>
                <ul className="mt-1.5 grid gap-0.5 text-[12px] text-muted">{r.lines.map((l) => <li key={l.ingredient_id} className="flex justify-between"><span>{l.ingredient}</span><span className="tnum">{qty(l.qty, l.unit)} · {money(l.line_cost, { compact: false, cents: true })}</span></li>)}</ul>
                <div className="mt-1.5 flex justify-between border-t border-line pt-1.5 text-[12px] font-semibold"><span>Plate cost / price</span><span className="tnum">{money(cost, { compact: false, cents: true })} / {money(r.price, { compact: false })}</span></div>
              </div>
            );
          })}</div>
        </Card>
      )}

      {active === 'menu' && (
        <Card title="Menu, prices & availability" subtitle={`86 an item to hide it on the POS, QR menu and delivery channels at ${branches.find((x) => x.id === outletId)?.name}. Prices are group-wide, with a margin guard.`} pad={false}>
          <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-line bg-surface-2/60"><tr><th className={th}>Item</th><th className={`${th} text-right`}>Price</th><th className={`${th} text-right`}>Food cost</th><th className={`${th} text-right`}>Sold (7d)</th><th className={`${th} text-right`}>Sales (7d)</th><th className={th}>Available here</th></tr></thead>
            <tbody>{m.items.map((i) => (
              <tr key={i.id} className="border-t border-line/70">
                <td className={td}><div className="font-semibold">{i.name} {i.is_new ? <Badge tone="primary">New</Badge> : null}</div><div className="text-[11px] text-muted">{i.category} · {i.station}</div></td>
                <td className={`${td} text-right`}>{can('menu.manage') ? (
                  <span className="inline-flex items-center gap-1"><input inputMode="decimal" value={prices[i.id] ?? i.price} onChange={(e) => setPrices({ ...prices, [i.id]: e.target.value })} className="w-20 rounded-lg border border-line bg-surface px-2 py-1 text-right font-mono text-xs outline-none focus:border-primary" />
                    {prices[i.id] != null && Number(prices[i.id]) !== i.price && <Button variant="ghost" onClick={() => run(async () => { await api(`/menu/${i.id}`, { method: 'PATCH', body: { price: Number(prices[i.id]) } }); setPrices((x) => { const n = { ...x }; delete n[i.id]; return n; }); }, `${i.name} price updated`)}><Check size={14} /></Button>}</span>
                ) : <span className="tnum">{money(i.price, { compact: false })}</span>}</td>
                <td className={`${td} text-right tnum ${i.food_pct > 0.35 ? 'text-bad' : ''}`}>{pct(i.food_pct, 0)}</td>
                <td className={`${td} text-right tnum`}>{num(i.qty_7d)}</td><td className={`${td} text-right tnum`}>{money(i.sales_7d)}</td>
                <td className={td}>
                  <button role="switch" aria-checked={i.available} onClick={() => run(() => api(`/menu/${i.id}/availability`, { method: 'POST', body: { branch: outletId, available: !i.available } }), `${i.name} ${i.available ? '86’d' : 'back on'}`)}
                    className={`relative h-6 w-11 rounded-full transition ${i.available ? 'bg-ok' : 'bg-faint'}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${i.available ? 'left-[22px]' : 'left-0.5'}`} /></button>
                  {!i.available && <span className="ml-2 text-xs font-semibold text-bad">86</span>}
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        </Card>
      )}
    </>
  );
}
