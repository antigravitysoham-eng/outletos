import { useState } from 'react';
import { CalendarCheck, Landmark, FileDown, Scale, ShieldAlert, Lock, CircleAlert, CheckCircle2 } from 'lucide-react';
import { useLive, api, money, pct, num, getToken } from '../lib/api.js';
import { useAuth, useBranchQuery } from '../lib/auth.jsx';
import { Card, PageHeader, Badge, Button, Loading, ErrorNote, MiniStat, Bar } from '../components/ui.jsx';

const TABS = [['dayend', 'Day end', CalendarCheck], ['gst', 'Tax register', Landmark], ['recon', 'Aggregator reconciliation', Scale], ['leakage', 'Leakage & audit', ShieldAlert]];
const th = 'px-3 py-2 text-left text-[11px] font-bold tracking-wide text-muted uppercase';
const td = 'px-3 py-2 align-middle';
const dstr = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const TENDER = { upi: 'UPI', card: 'Card', cash: 'Cash', wallet: 'Wallet', credit: 'Credit', prepaid: 'Aggregator (prepaid)', split: 'Split' };

function DayEnd({ bq, can, branches }) {
  const [date, setDate] = useState(dstr(Date.now()));
  const { data, error, reload } = useLive(`/finance/dayend?date=${date}${bq ? '&' + bq : ''}`, { types: [], interval: 60000 });
  const [cash, setCash] = useState({});
  const [msg, setMsg] = useState(null);
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <Loading />;
  const download = async (outlet) => {
    const r = await fetch(`/api/finance/tally?date=${date}&branch=${outlet}`, { headers: { authorization: `Bearer ${getToken()}` } });
    if (!r.ok) { setMsg((await r.json()).error); return; }
    const url = URL.createObjectURL(await r.blob());
    Object.assign(document.createElement('a'), { href: url, download: `tally-sales-${outlet}-${date}.xml` }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none" aria-label="Business date" />
        {msg && <span className="text-sm text-bad">{msg}</span>}</div>
      <div className="grid gap-4 xl:grid-cols-2">{data.outlets.map((o) => {
        const s = o.summary;
        return (
          <Card key={o.id} title={`${o.name} · ${o.city}`} subtitle={`${s.date}${o.gstin ? ` · GSTIN ${o.gstin}` : ''}`}
            action={o.closed ? <Badge tone="ok"><Lock size={11} />Closed by {o.closed.by}</Badge> : <Badge tone="warn">Open</Badge>}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[13px] sm:grid-cols-3">
              <div><div className="text-xs text-muted">Net sales</div><div className="text-lg font-extrabold tnum">{money(s.net, { compact: false })}</div></div>
              <div><div className="text-xs text-muted">Tax</div><div className="text-lg font-extrabold tnum">{money(s.tax, { compact: false })}</div><div className="text-[11px] text-muted">{s.tax_split.map((x) => `${x.name} ${money(x.amount, { compact: false })}`).join(' · ')}</div></div>
              <div><div className="text-xs text-muted">Bills · covers</div><div className="text-lg font-extrabold tnum">{num(s.bills)} · {num(s.covers)}</div></div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div><div className="mb-1 text-[11px] font-bold tracking-widest text-muted uppercase">Tender (incl. tax)</div>
                {Object.entries(s.tenders).sort((a, b) => b[1] - a[1]).map(([k, v]) => <div key={k} className="flex justify-between text-[13px]"><span>{TENDER[k] || k}</span><span className="tnum">{money(v, { compact: false })}</span></div>)}</div>
              <div><div className="mb-1 text-[11px] font-bold tracking-widest text-muted uppercase">Controls</div>
                {[['Discounts', s.discounts], ['Complimentary (NC)', s.nc], ['Cancellations', s.cancellations]].map(([l, x]) => <div key={l} className="flex justify-between text-[13px]"><span>{l} ({x.n})</span><span className="tnum">{money(x.v, { compact: false })}</span></div>)}
                <div className="flex justify-between text-[13px]"><span>Reprints · edits after print</span><span className="tnum">{s.reprints} · {s.modified_after_print}</span></div>
                <div className="flex justify-between text-[13px]"><span>Wastage</span><span className="tnum">{money(s.waste, { compact: false })}</span></div></div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
              {o.closed ? <span className="text-xs text-muted">Cash declared {money(o.closed.cash_declared, { compact: false })} · variance <b className={o.closed.cash_variance < 0 ? 'text-bad' : 'text-ok'}>{money(o.closed.cash_variance, { compact: false })}</b></span>
                : can('finance.close') && <>
                  <input inputMode="decimal" placeholder="Cash counted in drawer" aria-label={`Cash counted, expected ${money(s.tenders.cash || 0, { compact: false })}`} value={cash[o.id] || ''} onChange={(e) => setCash({ ...cash, [o.id]: e.target.value })} className="min-w-56 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-primary" />
                  <Button variant="primary" onClick={async () => { try { await api('/finance/dayend/close', { method: 'POST', body: { branch: o.id, date, cash_declared: Number(cash[o.id]) || 0 } }); setMsg(null); reload(); } catch (e) { setMsg(e.message); } }}><Lock size={14} />Close day</Button></>}
              <span className="flex-1" />
              {can('finance.close') && <Button onClick={() => download(o.id)}><FileDown size={14} />Tally XML</Button>}
            </div>
          </Card>
        );
      })}
      {data.outlets.length === 1 && <CloseChecklist o={data.outlets[0]} cashEntered={!!cash[data.outlets[0].id]} />}</div>
      {branches.length > 1 && <p className="mt-3 text-xs text-muted">Tally XML imports as one sales voucher per branch per day (Gateway of Tally → Import → Vouchers). Map ledgers once: Sales - Restaurant, Output CGST/SGST, UPI/Card/Cash collections, Aggregator Receivable, Round Off.</p>}
    </>
  );
}

// Single-branch view: what has to be true before the day can be closed, plus where today's money came from
const CHANNEL = { 'dine-in': 'Dine-in', takeaway: 'Takeaway', delivery: 'Delivery apps', online: 'Own website / app' };
function CloseChecklist({ o, cashEntered }) {
  const s = o.summary, closed = !!o.closed;
  const flagged = s.discounts.n + s.nc.n + s.cancellations.n;
  const steps = [
    { done: closed || o.open_tables === 0, label: 'Settle every table', hint: o.open_tables ? `${o.open_tables} open or billed table(s) on the POS` : 'No open tables' },
    { done: closed || s.modified_after_print === 0, warn: s.modified_after_print > 0, label: 'Review discounts, NC and cancellations', hint: `${flagged} exception bill(s) · ${s.modified_after_print} edited after print` },
    { done: closed || cashEntered, label: 'Count the cash drawer', hint: `Expected ${money(s.tenders.cash || 0, { compact: false })} in cash` },
    { done: closed, label: 'Close the day', hint: closed ? `Closed by ${o.closed.by}` : 'Locks the figures and the tax register' },
    { done: false, optional: true, label: 'Export to Tally', hint: 'One sales voucher per branch per day' },
  ];
  const total = Object.values(s.channels).reduce((a, b) => a + b, 0) || 1;
  return (
    <Card title="Day-end checklist" subtitle={closed ? 'This business day is closed' : `${steps.filter((x) => x.done).length} of 4 steps done`}>
      <ol className="space-y-2.5">
        {steps.map((x, i) => (
          <li key={x.label} className="flex items-start gap-3">
            <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${x.done ? 'bg-ok text-white' : x.warn ? 'bg-warn-soft text-warn' : 'bg-surface-2 text-muted'}`}>{x.done ? <CheckCircle2 size={14} /> : i + 1}</span>
            <div className="min-w-0"><div className="text-[13px] font-semibold">{x.label}{x.optional && <span className="ml-1.5 text-[11px] font-normal text-muted">optional</span>}</div><div className="text-xs text-muted">{x.hint}</div></div>
          </li>
        ))}
      </ol>
      <div className="mt-5 border-t border-line pt-4">
        <div className="mb-2 text-[11px] font-bold tracking-widest text-muted uppercase">Sales by channel</div>
        {Object.entries(s.channels).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
          <div key={k} className="mb-2">
            <div className="flex justify-between text-[13px]"><span>{CHANNEL[k] || k}</span><span className="tnum font-semibold">{money(v, { compact: false })} <span className="font-normal text-muted">· {Math.round((v / total) * 100)}%</span></span></div>
            <div className="mt-1 h-1.5 rounded-full bg-surface-2"><div className="h-full rounded-full bg-primary" style={{ width: `${(v / total) * 100}%` }} /></div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Gst({ bq }) {
  const [days, setDays] = useState(7);
  const { data, error } = useLive(`/finance/gst?days=${days}${bq ? '&' + bq : ''}`, { types: [], interval: 60000 });
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <Loading />;
  const parts = data.tax.split || [];
  const tot = data.rows.reduce((a, r) => ({ bills: a.bills + r.bills, taxable: a.taxable + r.taxable, tax: a.tax + r.tax, total: a.total + r.total }), { bills: 0, taxable: 0, tax: 0, total: 0 });
  return (
    <Card title={`${data.tax.name} register`} subtitle={data.tax.rate ? `${(data.tax.rate * 100).toFixed(0)}% ${data.tax.name}${data.tax.sac ? ` · SAC ${data.tax.sac} (restaurant service)` : ''}${parts.length ? ` · ${parts.map(([n, r]) => `${n} ${(r * 100).toFixed(1)}%`).join(' + ')} (intra-state)` : ''}. Feeds GSTR-1 (B2C summary) and GSTR-3B.` : 'No sales tax is configured for this instance.'}
      action={<select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-xl border border-line bg-surface px-2 py-1.5 text-xs outline-none">{[7, 14, 31].map((d) => <option key={d} value={d}>Last {d} days</option>)}</select>} pad={false}>
      <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
        <thead className="border-b border-line bg-surface-2/60"><tr><th className={th}>Date</th><th className={th}>Branch · GSTIN</th><th className={`${th} text-right`}>Bills</th><th className={`${th} text-right`}>Taxable value</th>{parts.map(([n]) => <th key={n} className={`${th} text-right`}>{n}</th>)}{!parts.length && <th className={`${th} text-right`}>Tax</th>}<th className={`${th} text-right`}>Invoice value</th></tr></thead>
        <tbody>{data.rows.map((r) => (
          <tr key={r.outlet_id + r.d} className="border-t border-line/70"><td className={`${td} font-mono text-xs`}>{r.d}</td><td className={td}><div className="font-semibold">{r.name}</div><div className="font-mono text-[11px] text-muted">{r.gstin || '—'}{r.state ? ` · ${r.state}` : ''}</div></td>
            <td className={`${td} text-right tnum`}>{num(r.bills)}</td><td className={`${td} text-right tnum`}>{money(r.taxable, { compact: false })}</td>
            {parts.length ? r.parts.map((x) => <td key={x.name} className={`${td} text-right tnum`}>{money(x.amount, { compact: false })}</td>) : <td className={`${td} text-right tnum`}>{money(r.tax, { compact: false })}</td>}
            <td className={`${td} text-right font-semibold tnum`}>{money(r.total, { compact: false })}</td></tr>
        ))}
          <tr className="border-t-2 border-line bg-surface-2/40 font-bold"><td className={td}>Total</td><td /><td className={`${td} text-right tnum`}>{num(tot.bills)}</td><td className={`${td} text-right tnum`}>{money(tot.taxable, { compact: false })}</td>
            {parts.length ? parts.map(([n, r]) => <td key={n} className={`${td} text-right tnum`}>{money(tot.tax * r / data.tax.rate, { compact: false })}</td>) : <td className={`${td} text-right tnum`}>{money(tot.tax, { compact: false })}</td>}<td className={`${td} text-right tnum`}>{money(tot.total, { compact: false })}</td></tr>
        </tbody></table></div>
      {data.tax.sac && <p className="px-5 py-3 text-[11.5px] text-muted">B2C restaurant bills do not need e-invoices. For B2B catering or corporate bills above the turnover threshold, generate an IRN through the GST e-invoicing connector (Integrations).</p>}
    </Card>
  );
}

function Recon({ bq }) {
  const [days, setDays] = useState(7);
  const { data, error } = useLive(`/finance/reconciliation?days=${days}${bq ? '&' + bq : ''}`, { types: [], interval: 60000 });
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <Loading />;
  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat icon={Scale} tone="primary" label="Online gross (incl. tax)" value={money(data.totals.gross)} sub={`last ${days} days`} />
        <MiniStat icon={Landmark} tone="warn" label="Effective platform cost" value={pct(data.totals.effective_commission, 1)} sub={`${money(data.totals.gross - data.totals.expected)} deducted`} />
        <MiniStat icon={Scale} tone="info" label="Expected payout" value={money(data.totals.expected)} />
        <MiniStat icon={CircleAlert} tone={data.totals.gap > 0 ? 'bad' : 'ok'} label="Unreconciled gap" value={money(data.totals.gap)} sub={`${data.issues.length} orders to dispute`} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Card title="By platform" subtitle={data.note} action={<select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-xl border border-line bg-surface px-2 py-1.5 text-xs outline-none">{[7, 14, 28].map((d) => <option key={d} value={d}>Last {d} days</option>)}</select>} pad={false}>
          <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-line bg-surface-2/60"><tr><th className={th}>Platform</th><th className={`${th} text-right`}>Orders</th><th className={`${th} text-right`}>Gross</th><th className={`${th} text-right`}>Commission</th><th className={`${th} text-right`}>GST + TCS</th><th className={`${th} text-right`}>Expected</th><th className={`${th} text-right`}>Received</th><th className={th}>Issues</th></tr></thead>
            <tbody>{data.platforms.map((p) => (
              <tr key={p.platform} className="border-t border-line/70"><td className={`${td} font-semibold`}>{p.platform}<div className="text-[11px] font-normal text-muted">{pct(p.rate, 0)} commission</div></td><td className={`${td} text-right tnum`}>{num(p.orders)}</td>
                <td className={`${td} text-right tnum`}>{money(p.gross)}</td><td className={`${td} text-right tnum`}>{money(p.commission)}</td><td className={`${td} text-right tnum`}>{money(p.gst_on_commission + p.tcs)}</td>
                <td className={`${td} text-right tnum`}>{money(p.expected)}</td><td className={`${td} text-right tnum`}>{money(p.received)}</td>
                <td className={td}>{p.missing + p.short ? <Badge tone="bad">{p.missing} missing · {p.short} short</Badge> : <Badge tone="ok">Matched</Badge>}</td></tr>
            ))}</tbody></table></div>
        </Card>
        <Card title="Orders to dispute" pad={false}>
          <div className="max-h-[380px] overflow-y-auto"><table className="w-full text-sm"><tbody>{data.issues.map((i) => (
            <tr key={i.order_id} className="border-t border-line/70"><td className={td}><div className="font-semibold">#{i.order_id} · {i.platform}</div><div className="text-[11px] text-muted">{new Date(i.at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {i.outlet_id.toUpperCase()}</div></td>
              <td className={td}><Badge tone={i.type.startsWith('Missing') ? 'bad' : 'warn'}>{i.type}</Badge></td><td className={`${td} text-right font-semibold tnum`}>{money(i.gap, { compact: false })}</td></tr>
          ))}</tbody></table></div>
        </Card>
      </div>
    </>
  );
}

function Leakage({ bq }) {
  const [days, setDays] = useState(14);
  const { data, error } = useLive(`/finance/leakage?days=${days}${bq ? '&' + bq : ''}`, { types: [], interval: 60000 });
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <Loading />;
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card title="Sensitive actions" subtitle={`Last ${days} days: every discount, cancel, NC, reprint and edit after print is logged with user and time`} action={<select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-xl border border-line bg-surface px-2 py-1.5 text-xs outline-none">{[7, 14, 28].map((d) => <option key={d} value={d}>Last {d} days</option>)}</select>} pad={false}>
        <table className="w-full text-sm"><tbody>{data.byAction.map((a) => <tr key={a.action} className="border-t border-line/70"><td className={`${td} font-semibold`}>{a.label}</td><td className={`${td} text-right tnum`}>{num(a.n)}</td><td className={`${td} text-right tnum`}>{money(a.value, { compact: false })}</td></tr>)}</tbody></table>
        <div className="border-t border-line px-5 pt-3 pb-1 text-[11px] font-bold tracking-widest text-muted uppercase">By branch</div>
        <table className="w-full text-sm"><tbody>{data.byBranch.map((b) => <tr key={b.id} className="border-t border-line/70"><td className={`${td} font-semibold`}>{b.name}</td><td className={`${td} text-right tnum`}>{b.per_100_bills ?? '—'} / 100 bills</td><td className={`${td} text-right tnum ${b.pct_of_sales > 0.015 ? 'text-bad font-bold' : ''}`}>{pct(b.pct_of_sales, 2)} of sales</td></tr>)}</tbody></table>
      </Card>
      <Card title="Staff risk score" subtitle="Weighted rate of cancels, edits after print, reprints and discount value vs peers (z-score, 50 = typical). A prompt to review CCTV and bills, not proof of wrongdoing.">
        <ul className="space-y-2.5">{data.staff.map((s) => (
          <li key={s.outlet_id + s.user} className="grid grid-cols-[1fr_110px_44px] items-center gap-3">
            <div className="min-w-0"><div className="truncate text-[13px] font-semibold">{s.user} <span className="font-normal text-muted">· {s.branch}</span></div><div className="text-[11px] text-muted">{s.cancels} cancels · {s.after_print} after-print · {s.discounts} discounts · {money(s.value, { compact: false })}</div></div>
            <Bar value={s.score / 100} color={s.score >= 75 ? 'var(--bad)' : s.score >= 60 ? 'var(--warn)' : 'var(--ok)'} />
            <span className={`text-right font-extrabold tnum ${s.score >= 75 ? 'text-bad' : ''}`}>{s.score}</span>
          </li>
        ))}</ul>
      </Card>
      <Card title="Audit trail" className="xl:col-span-2" pad={false}>
        <div className="max-h-[360px] overflow-y-auto"><table className="w-full min-w-[640px] text-sm"><tbody>{data.recent.map((e) => (
          <tr key={e.id} className="border-t border-line/70"><td className={`${td} font-mono text-xs text-muted`}>{new Date(e.ts).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
            <td className={td}><Badge tone={/cancel|after/.test(e.action) ? 'bad' : e.action === 'discount' ? 'warn' : 'muted'}>{data.labels[e.action] || e.action}</Badge></td><td className={td}>{e.detail}</td><td className={`${td} text-muted`}>{e.user} · {e.branch}</td><td className={`${td} text-right tnum`}>{e.amount ? money(e.amount, { compact: false }) : ''}</td></tr>
        ))}</tbody></table></div>
      </Card>
    </div>
  );
}

export default function Finance() {
  const { can, branches } = useAuth();
  const bq = useBranchQuery();
  const [tab, setTab] = useState('dayend');
  return (
    <>
      <PageHeader title="Finance & Compliance" subtitle="Day-end close with cash count, tax register, Tally export, aggregator payout reconciliation, and the leakage panel with staff risk scoring." />
      <div className="mb-4 flex flex-wrap gap-1.5" role="tablist">{TABS.map(([id, label, Icon]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold ${tab === id ? 'grad-primary text-white' : 'border border-line bg-surface text-muted hover:text-ink'}`}><Icon size={15} />{label}</button>)}</div>
      {tab === 'dayend' && <DayEnd bq={bq} can={can} branches={branches} />}
      {tab === 'gst' && <Gst bq={bq} />}
      {tab === 'recon' && <Recon bq={bq} />}
      {tab === 'leakage' && <Leakage bq={bq} />}
    </>
  );
}
