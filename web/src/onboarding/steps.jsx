import { useMemo, useState } from 'react';
import * as Icons from 'lucide-react';
import { Plus, Trash2, Copy, Check, Search, Wand2, Upload, LayoutGrid, Rows3, ShieldCheck, Lock, AlertTriangle, Globe2, Sparkles, Store, Info } from 'lucide-react';
import { fmtMoney, fmtNum } from './previews.jsx';

// ---------- primitives ----------
export function Field({ label, hint, error, children, className = '' }) {
  return (
    <label className={`grid content-start gap-1.5 ${className}`}>
      <span className="text-[12.5px] font-semibold">{label}</span>
      {children}
      {error ? <span className="text-[11.5px] font-medium text-bad">{error}</span> : hint ? <span className="text-[11.5px] text-muted">{hint}</span> : null}
    </label>
  );
}
export const inputCls = 'w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10';
export const selectCls = `${inputCls} h-[42px] py-0`; // same height as text inputs so rows line up
export const Input = (p) => <input {...p} className={`${inputCls} h-[42px] ${p.className || ''}`} />;
export function Chips({ options, value = [], onChange, multi = true }) {
  const set = new Set(multi ? value : [value]);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([id, label]) => (
        <button type="button" key={id} aria-pressed={set.has(id)} onClick={() => onChange(multi ? (set.has(id) ? value.filter((x) => x !== id) : [...value, id]) : id)}
          className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition ${set.has(id) ? 'border-primary bg-primary text-white shadow-sm' : 'border-line bg-surface text-ink hover:border-primary/50'}`}>
          {set.has(id) && multi && <Check size={13} className="mr-1 inline" />}{label}
        </button>
      ))}
    </div>
  );
}
function Toggle({ on, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-primary' : 'bg-faint'}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}
const Section = ({ title, desc, children, right }) => (
  <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-extrabold tracking-tight">{title}</h3>{desc && <p className="mt-0.5 max-w-xl text-[12.5px] text-muted">{desc}</p>}</div>{right}</div>
    {children}
  </section>
);
const Icon = ({ name, ...p }) => { const I = Icons[name] || Store; return <I {...p} />; };
export const validId = (def, v) => !v || !def?.pattern || new RegExp(def.pattern).test(String(v).trim().toUpperCase());

// ---------- 1. Business ----------
const BANDS = [['1', 'Just one'], ['2-5', '2–5'], ['6-20', '6–20'], ['21-100', '21–100'], ['100+', '100+']];
const GOALS = [['food_cost', 'Cut food cost'], ['speed', 'Faster kitchen'], ['labour', 'Labour control'], ['safety', 'Food safety compliance'], ['loyalty', 'Guest loyalty'], ['loss', 'Loss prevention (CCTV)'], ['growth', 'Grow delivery sales'], ['visibility', 'One view of every outlet']];
const POS_NOW = [['none', 'None / paper'], ['petpooja', 'Petpooja'], ['restroworks', 'Restroworks'], ['rista', 'Rista'], ['toast', 'Toast'], ['square', 'Square'], ['lightspeed', 'Lightspeed'], ['simphony', 'Oracle Simphony'], ['foodics', 'Foodics'], ['other', 'Other']];
export function StepBusiness({ data, set, catalog }) {
  const p = data.profile || {};
  const up = (k, v) => set({ ...data, profile: { ...p, [k]: v }, org: k === 'business_type' ? { ...(data.org || {}), business_type: v } : data.org });
  return (
    <div className="space-y-5">
      <Section title="What kind of restaurant business is this?" desc="This sets smart defaults: floor plans or counter service, staffing templates, KDS routing and the modules we recommend. Each outlet can override it later.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {catalog.business_types.map((b) => (
            <button key={b.id} type="button" onClick={() => up('business_type', b.id)} aria-pressed={p.business_type === b.id}
              className={`group relative flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition ${p.business_type === b.id ? 'border-primary bg-primary-soft/60 ring-4 ring-primary/10' : 'border-line hover:border-primary/40 hover:bg-surface-2/50'}`}>
              <span className={`grid h-10 w-10 place-items-center rounded-xl ${p.business_type === b.id ? 'grad-primary text-white' : 'bg-surface-2 text-primary'}`}><Icon name={b.icon} size={19} /></span>
              <span className="font-bold">{b.label}</span>
              <span className="text-[11.5px] text-muted">{b.service === 'table' ? 'Table service · floor plans' : b.service === 'counter' ? 'Counter service · tokens' : 'Delivery only · no dining room'}</span>
              {p.business_type === b.id && <Check size={16} className="absolute top-3 right-3 text-primary" />}
            </button>
          ))}
        </div>
      </Section>
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="How many outlets?" desc="Two or more switches on group tools: templates, bulk grids and inheritance."><Chips multi={false} options={BANDS} value={p.outlet_band || '1'} onChange={(v) => up('outlet_band', v)} /></Section>
        <Section title="What do you use for billing today?" desc="Keep it and connect it, or switch to OutletOS POS."><Chips multi={false} options={POS_NOW} value={p.current_pos || 'none'} onChange={(v) => up('current_pos', v)} /></Section>
      </div>
      <Section title="What matters most right now?" desc="Pick up to three. We'll recommend modules and order your setup checklist around them.">
        <Chips options={GOALS} value={p.goals || []} onChange={(v) => up('goals', v.slice(-3))} />
      </Section>
    </div>
  );
}

// ---------- 2. Country & compliance ----------
export function StepCompliance({ data, set, catalog, country }) {
  const org = data.org || {};
  const [q, setQ] = useState('');
  const up = (patch) => set({ ...data, org: { ...org, ...patch } });
  const pick = (c) => up({ country: c.code, currency: c.currency, timezone: c.timezones[0], tax: { ...c.tax }, fiscal: c.fiscal, service_pct: c.service.default, ids: {} });
  const list = catalog.countries.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.currency.code.toLowerCase().includes(q.toLowerCase()));
  const tax = org.tax || country?.tax;
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return (
    <div className="space-y-5">
      <Section title="Business identity">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Group / brand name" hint="Shown in the app, on receipts and to guests"><Input value={org.group || ''} onChange={(e) => up({ group: e.target.value })} placeholder="e.g. Spice Route Hospitality" autoFocus /></Field>
          <Field label="Registered legal name" hint="Optional now; printed on tax invoices"><Input value={org.legal_name || ''} onChange={(e) => up({ legal_name: e.target.value })} placeholder="e.g. Spice Route Foods Pvt. Ltd." /></Field>
          <Field label="Brands" hint="Press Enter to add. Multi-brand and cloud-kitchen groups list each brand." className="sm:col-span-2">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface px-2 py-1.5">
              {(org.brands || []).map((b) => <span key={b} className="inline-flex items-center gap-1 rounded-lg bg-primary-soft px-2 py-1 text-xs font-semibold text-primary">{b}<button type="button" onClick={() => up({ brands: org.brands.filter((x) => x !== b) })} aria-label={`Remove ${b}`}>×</button></span>)}
              <input className="min-w-40 flex-1 bg-transparent px-1 py-1 text-sm outline-none" placeholder={org.brands?.length ? 'Add another brand' : org.group || 'Brand name'} onKeyDown={(e) => { if (e.key === 'Enter' && e.currentTarget.value.trim()) { e.preventDefault(); up({ brands: [...new Set([...(org.brands || []), e.currentTarget.value.trim()])] }); e.currentTarget.value = ''; } }} />
            </div>
          </Field>
        </div>
      </Section>
      <Section title="Where do you operate?" desc="Your country sets currency, number format, tax engine, legal receipt fields, fiscal year and rounding. Everything stays editable.">
        <label className="relative mb-3 block"><Search size={15} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search country or currency" className="pl-10" /></label>
        <div className="grid max-h-56 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => (
            <button type="button" key={c.code} onClick={() => pick(c)} aria-pressed={org.country === c.code}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${org.country === c.code ? 'border-primary bg-primary-soft/60 ring-4 ring-primary/10' : 'border-line hover:border-primary/40'}`}>
              <span className="grid h-8 w-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-[11px] font-extrabold tracking-wide">{c.code}</span><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-bold">{c.name}</span><span className="text-[11px] text-muted">{c.currency.code} · {c.tax.name} {(c.tax.rate * 100).toFixed(c.tax.rate * 1000 % 10 ? 2 : 0)}%</span></span>
              {org.country === c.code && <Check size={15} className="text-primary" />}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11.5px] text-muted"><Globe2 size={12} className="mr-1 inline" />Not listed? Pick the closest and adjust the tax and currency below; every rule is configurable.</p>
      </Section>
      {country && (
        <Section title={`We've set up ${country.name} for you`} desc="Review and confirm. These defaults come from local rules for restaurants. Confirm with your accountant before going live." right={<span className="inline-flex items-center gap-1 rounded-full bg-ok-soft px-2.5 py-1 text-[11px] font-bold text-ok"><Sparkles size={12} />Auto-configured</span>}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Currency" hint={`Sample: ${fmtMoney(1234567.5, org.currency)}`}><Input value={`${org.currency?.code} · ${org.currency?.symbol?.trim()}`} readOnly /></Field>
            <Field label="Time zone"><select className={selectCls} value={org.timezone} onChange={(e) => up({ timezone: e.target.value })}>{country.timezones.map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Fiscal year starts"><select className={selectCls} value={org.fiscal} onChange={(e) => up({ fiscal: Number(e.target.value) })}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></Field>
            <Field label="Tax name"><Input value={tax?.name || ''} onChange={(e) => up({ tax: { ...tax, name: e.target.value } })} /></Field>
            <Field label="Restaurant tax rate %" hint={country.tax.perOutlet ? 'Varies by location: you can set it per outlet' : undefined}>
              <Input type="number" step="0.001" min="0" max="40" value={Math.round((tax?.rate || 0) * 100000) / 1000} onChange={(e) => { const r = Number(e.target.value) / 100; up({ tax: { ...tax, rate: r, split: tax.split ? tax.split.map(([n]) => [n, r / tax.split.length]) : undefined } }); }} />
            </Field>
            <div className="grid gap-1.5"><span className="text-[12.5px] font-semibold">Menu prices</span>
              <div className="flex rounded-xl border border-line p-1">{[[true, 'Include tax'], [false, 'Exclude tax']].map(([v, l]) => <button type="button" key={l} onClick={() => up({ tax: { ...tax, inclusive: v } })} className={`flex-1 rounded-lg py-1.5 text-[13px] font-semibold ${!!tax?.inclusive === v ? 'grad-primary text-white' : 'text-muted'}`}>{l}</button>)}</div>
              <span className="text-[11.5px] text-muted">{country.tax.inclusive ? 'Local rule: consumer prices shown tax-inclusive' : 'Local convention: tax added on the bill'}</span></div>
            <Field label="Service charge %" hint={country.service.note || 'Optional'}><Input type="number" step="0.5" min="0" max="25" value={Math.round((org.service_pct || 0) * 1000) / 10} onChange={(e) => up({ service_pct: Number(e.target.value) / 100 })} /></Field>
            <Field label="Cash rounding" hint="Bill totals round to this step"><Input value={fmtMoney(country.roundTo, org.currency)} readOnly /></Field>
            {tax?.split && <Field label="Tax split" hint="Intra-state bills"><Input value={tax.split.map(([n, r]) => `${n} ${(r * 100).toFixed(1)}%`).join(' + ')} readOnly /></Field>}
          </div>
          {country.tax.note && <p className="mt-4 flex gap-2 rounded-xl bg-info-soft px-3 py-2.5 text-[12.5px] text-info"><Info size={15} className="mt-0.5 shrink-0" />{country.tax.note}</p>}
          {country.ids.some((d) => d.scope === 'org') && (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {country.ids.filter((d) => d.scope === 'org').map((d) => {
                const v = org.ids?.[d.key] || '', ok = validId(d, v);
                return <Field key={d.key} label={`${d.label}${d.required ? '' : ' (optional)'}`} hint={d.hint} error={!ok ? `That doesn't look like a valid ${d.label}` : null}>
                  <div className="relative"><Input value={v} onChange={(e) => up({ ids: { ...(org.ids || {}), [d.key]: e.target.value.toUpperCase() } })} placeholder={d.hint} className="pr-9 font-mono uppercase" />{v && ok && <ShieldCheck size={16} className="absolute top-1/2 right-3 -translate-y-1/2 text-ok" />}</div></Field>;
              })}
            </div>
          )}
        </Section>
      )}
    </div>
  );
}

// ---------- 3. Outlets ----------
let keySeq = 1;
export const newOutlet = (data, catalog, base = {}) => {
  const c = catalog.countries.find((x) => x.code === data.org?.country);
  const bt = catalog.business_types.find((b) => b.id === (data.profile?.business_type || 'casual')) || catalog.business_types[1];
  const n = (data.outlets || []).length + 1;
  return { key: `k${Date.now().toString(36)}${keySeq++}`, name: `${data.org?.group?.split(' ')[0] || 'Outlet'} ${c?.cities?.[(n - 1) % (c?.cities?.length || 1)] || n}`, city: c?.cities?.[(n - 1) % (c?.cities?.length || 1)] || '', address: '', type: bt.id, seats: bt.seats, hours: { open: '11:00', close: '23:00' }, ids: {}, daily_target: '', areas: [], ...base, ...(base.key ? { key: `k${Date.now().toString(36)}${keySeq++}` } : {}) };
};
export function StepOutlets({ data, set, catalog, country }) {
  const outlets = data.outlets || [];
  const [view, setView] = useState(outlets.length > 6 ? 'grid' : 'cards');
  const [sameHours, setSameHours] = useState(true);
  const [paste, setPaste] = useState('');
  const outletIds = (country?.ids || []).filter((d) => d.scope === 'outlet');
  const upd = (i, patch) => { const next = outlets.map((o, j) => (j === i ? { ...o, ...patch } : sameHours && patch.hours ? { ...o, hours: patch.hours } : o)); set({ ...data, outlets: next }); };
  const add = (n = 1) => { let d = { ...data }, list = [...outlets]; for (let k = 0; k < n; k++) { const o = newOutlet({ ...d, outlets: list }, catalog, list.at(-1) ? { type: list.at(-1).type, seats: list.at(-1).seats, hours: list.at(-1).hours } : {}); list.push(o); } set({ ...d, outlets: list }); };
  const remove = (i) => set({ ...data, outlets: outlets.filter((_, j) => j !== i) });
  const importPaste = () => {
    const rows = paste.split(/\r?\n/).map((r) => r.split(/\t|,/).map((x) => x.trim())).filter((r) => r[0]);
    if (!rows.length) return;
    const head = /name/i.test(rows[0][0]) ? rows.shift() : null;
    const list = [...outlets, ...rows.map((r) => newOutlet({ ...data, outlets }, catalog, { name: r[0], city: r[1] || '', seats: Number(r[2]) || undefined, address: r[3] || '' }))];
    set({ ...data, outlets: list }); setPaste(''); setView(list.length > 6 ? 'grid' : 'cards');
    void head;
  };
  const typeOpts = catalog.business_types.map((b) => <option key={b.id} value={b.id}>{b.label}</option>);
  const idErr = (o) => outletIds.filter((d) => (d.required && !o.ids?.[d.key]) || !validId(d, o.ids?.[d.key])).length;
  return (
    <div className="space-y-5">
      <Section title={`Your outlets · ${outlets.length}`} desc="Each outlet keeps its own address, hours, seats and legal registrations. New outlets clone the previous one, so adding twenty takes seconds."
        right={<div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-line p-1">{[['cards', LayoutGrid, 'Cards'], ['grid', Rows3, 'Grid']].map(([v, I, l]) => <button type="button" key={v} onClick={() => setView(v)} aria-pressed={view === v} className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold ${view === v ? 'bg-surface-2 text-ink' : 'text-muted'}`}><I size={13} />{l}</button>)}</div>
          <button type="button" onClick={() => add(1)} className="inline-flex items-center gap-1.5 rounded-xl grad-primary px-3 py-2 text-sm font-semibold text-white"><Plus size={15} />Add outlet</button>
          <button type="button" onClick={() => add(5)} className="rounded-xl border border-line px-3 py-2 text-sm font-semibold">+5</button>
        </div>}>
        <div className="mb-4 flex flex-wrap items-center gap-3 text-[13px]"><Toggle on={sameHours} onChange={setSameHours} label="Same hours for all outlets" /><span className="font-semibold">Same opening hours for every outlet</span><span className="text-muted">Turn off to set hours per outlet.</span></div>
        {view === 'cards' ? (
          <div className="grid gap-3 2xl:grid-cols-2">
            {outlets.map((o, i) => (
              <div key={o.key} className="rounded-2xl border border-line p-4">
                <div className="mb-3 flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-primary-soft text-xs font-extrabold text-primary">{i + 1}</span><input value={o.name} onChange={(e) => upd(i, { name: e.target.value })} className="min-w-0 flex-1 bg-transparent text-[15px] font-extrabold outline-none" aria-label="Outlet name" />
                  {idErr(o) > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-warn-soft px-2 py-0.5 text-[10.5px] font-bold text-warn"><AlertTriangle size={11} />{idErr(o)} to complete</span>}
                  <button type="button" onClick={() => remove(i)} className="rounded-lg p-1.5 text-muted hover:bg-bad-soft hover:text-bad" aria-label="Remove outlet"><Trash2 size={14} /></button></div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="City"><Input list={`cities-${country?.code}`} value={o.city} onChange={(e) => upd(i, { city: e.target.value })} /></Field>
                  <Field label="Outlet type"><select className={selectCls} value={o.type} onChange={(e) => { const b = catalog.business_types.find((x) => x.id === e.target.value); upd(i, { type: e.target.value, seats: b.seats }); }}>{typeOpts}</select></Field>
                  <Field label="Address" className="col-span-2"><Input value={o.address} onChange={(e) => upd(i, { address: e.target.value })} placeholder="Street, area, postcode" /></Field>
                  <Field label="Seats"><Input type="number" min="0" value={o.seats} onChange={(e) => upd(i, { seats: e.target.value })} /></Field>
                  <Field label={`Daily sales budget (${data.org?.currency?.code || ''})`}><Input type="number" min="0" value={o.daily_target} onChange={(e) => upd(i, { daily_target: e.target.value })} placeholder="optional" /></Field>
                  <Field label="Opens"><Input type="time" value={o.hours?.open} onChange={(e) => upd(i, { hours: { ...o.hours, open: e.target.value } })} /></Field>
                  <Field label="Closes"><Input type="time" value={o.hours?.close} onChange={(e) => upd(i, { hours: { ...o.hours, close: e.target.value } })} /></Field>
                  {country?.tax?.perOutlet && <Field label={`${data.org?.tax?.name || 'Tax'} rate here %`} hint="Local rate"><Input type="number" step="0.001" value={o.tax_rate ?? Math.round((data.org?.tax?.rate || 0) * 100000) / 1000} onChange={(e) => upd(i, { tax_rate: Number(e.target.value) })} /></Field>}
                  {outletIds.map((d) => { const v = o.ids?.[d.key] || '', ok = validId(d, v); return (
                    <Field key={d.key} label={`${d.label}${d.required ? '' : ' (optional)'}`} hint={d.hint} error={!ok ? 'Check the format' : null}>
                      <div className="relative"><Input value={v} onChange={(e) => upd(i, { ids: { ...(o.ids || {}), [d.key]: e.target.value.toUpperCase() } })} className="pr-9 font-mono uppercase" placeholder={d.required ? 'Before go-live' : 'Optional'} />{v && ok && <ShieldCheck size={16} className="absolute top-1/2 right-3 -translate-y-1/2 text-ok" />}</div>
                    </Field>); })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[900px] text-[13px]">
              <thead className="bg-surface-2/70"><tr>{['#', 'Name', 'City', 'Type', 'Seats', 'Opens', 'Closes', ...outletIds.map((d) => d.label), 'Budget/day', ''].map((h) => <th key={h} className="px-2 py-2 text-left text-[11px] font-bold tracking-wide text-muted uppercase">{h}</th>)}</tr></thead>
              <tbody>{outlets.map((o, i) => (
                <tr key={o.key} className="border-t border-line">
                  <td className="px-2 text-muted">{i + 1}</td>
                  {['name', 'city'].map((k) => <td key={k} className="p-1"><input value={o[k]} onChange={(e) => upd(i, { [k]: e.target.value })} className="w-full rounded-lg px-2 py-1.5 outline-none focus:bg-surface-2" /></td>)}
                  <td className="p-1"><select value={o.type} onChange={(e) => upd(i, { type: e.target.value })} className="w-full rounded-lg bg-transparent px-1 py-1.5 outline-none">{typeOpts}</select></td>
                  <td className="p-1"><input type="number" value={o.seats} onChange={(e) => upd(i, { seats: e.target.value })} className="w-16 rounded-lg px-2 py-1.5 outline-none focus:bg-surface-2" /></td>
                  <td className="p-1"><input type="time" value={o.hours?.open} onChange={(e) => upd(i, { hours: { ...o.hours, open: e.target.value } })} className="rounded-lg bg-transparent px-1 py-1.5 outline-none" /></td>
                  <td className="p-1"><input type="time" value={o.hours?.close} onChange={(e) => upd(i, { hours: { ...o.hours, close: e.target.value } })} className="rounded-lg bg-transparent px-1 py-1.5 outline-none" /></td>
                  {outletIds.map((d) => <td key={d.key} className="p-1"><input value={o.ids?.[d.key] || ''} onChange={(e) => upd(i, { ids: { ...(o.ids || {}), [d.key]: e.target.value.toUpperCase() } })} className={`w-40 rounded-lg px-2 py-1.5 font-mono text-xs outline-none focus:bg-surface-2 ${validId(d, o.ids?.[d.key]) ? '' : 'bg-bad-soft text-bad'}`} /></td>)}
                  <td className="p-1"><input type="number" value={o.daily_target} onChange={(e) => upd(i, { daily_target: e.target.value })} className="w-24 rounded-lg px-2 py-1.5 outline-none focus:bg-surface-2" /></td>
                  <td className="px-1"><button type="button" onClick={() => remove(i)} className="p-1 text-muted hover:text-bad" aria-label="Remove"><Trash2 size={14} /></button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        {country && <datalist id={`cities-${country.code}`}>{country.cities.map((c) => <option key={c} value={c} />)}</datalist>}
      </Section>
      <Section title="Bulk import" desc="Paste rows from Excel or Google Sheets: name, city, seats, address (tab or comma separated).">
        <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={3} placeholder={'Bandra Social\tMumbai\t96\tLinking Road\nCP Diner\tNew Delhi\t110\tBlock A'} className={`${inputCls} font-mono text-xs`} />
        <button type="button" onClick={importPaste} disabled={!paste.trim()} className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-semibold disabled:opacity-50"><Upload size={14} />Add {paste.trim() ? paste.trim().split(/\r?\n/).length : ''} outlets</button>
      </Section>
    </div>
  );
}

// ---------- 4. Floors & tables ----------
const TEMPLATES = {
  cafe: { label: 'Small café', areas: [['Inside', 6, 2, 'square'], ['Window bar', 4, 1, 'bar']] },
  casual: { label: '60-cover casual', areas: [['Main', 10, 4, 'square'], ['Booths', 4, 4, 'booth'], ['Bar', 6, 1, 'bar']] },
  fine: { label: 'Fine dining + private room', areas: [['Dining room', 10, 4, 'round'], ['Private dining', 2, 8, 'rect']] },
  indian: { label: 'AC hall + family + terrace', areas: [['AC Hall', 10, 4, 'square'], ['Family', 6, 6, 'rect'], ['Terrace', 6, 4, 'round']] },
  bar: { label: 'Bar & pub', areas: [['Bar', 10, 1, 'bar'], ['High tops', 8, 4, 'round'], ['Garden', 6, 6, 'rect']] },
};
const genTables = (area, startNo) => Array.from({ length: Math.max(0, Number(area.count) || 0) }, (_, k) => ({ name: `${area.prefix ?? 'T'}${startNo + k}`, seats: Number(area.seats) || 2, shape: area.shape || 'square' }));
const rebuild = (areas) => { let n = 1; return areas.map((a) => { const prefix = a.prefix ?? 'T'; const start = prefix === 'T' ? n : 1; const tables = genTables(a, start); if (prefix === 'T') n += tables.length; return { ...a, tables }; }); };
export function StepTables({ data, set, focus, setFocus }) {
  const outlets = data.outlets || [];
  const idx = Math.min(focus, Math.max(0, outlets.length - 1));
  const o = outlets[idx];
  const upO = (patch) => set({ ...data, outlets: outlets.map((x, j) => (j === idx ? { ...x, ...patch } : x)) });
  const setAreas = (areas) => upO({ areas: rebuild(areas) });
  const applyTpl = (k) => setAreas(TEMPLATES[k].areas.map(([name, count, seats, shape]) => ({ name, count, seats, shape, prefix: shape === 'bar' ? 'B' : 'T' })));
  const fromSeats = () => { const s = Number(o.seats) || 40; const four = Math.max(1, Math.round((s * 0.7) / 4)), two = Math.max(1, Math.round((s * 0.3) / 2)); setAreas([{ name: 'Main', count: four, seats: 4, shape: 'square', prefix: 'T' }, { name: 'Window', count: two, seats: 2, shape: 'round', prefix: 'T' }]); };
  const copyAll = () => set({ ...data, outlets: outlets.map((x) => (Number(x.seats) === 0 ? x : { ...x, areas: o.areas.map((a) => ({ ...a, tables: a.tables.map((t) => ({ ...t })) })) })) });
  if (!o) return <Section title="Add an outlet first" />;
  const noDine = Number(o.seats) === 0;
  const totalSeats = (o.areas || []).reduce((s, a) => s + a.tables.reduce((x, t) => x + (Number(t.seats) || 0), 0), 0);
  return (
    <div className="space-y-5">
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
        {outlets.map((x, j) => { const t = (x.areas || []).reduce((s, a) => s + a.tables.length, 0); return (
          <button type="button" key={x.key} role="tab" aria-selected={j === idx} onClick={() => setFocus(j)} className={`shrink-0 rounded-xl border px-3 py-2 text-left text-[13px] ${j === idx ? 'border-primary bg-primary-soft/60' : 'border-line'}`}>
            <div className="font-bold">{x.name}</div><div className="text-[11px] text-muted">{Number(x.seats) === 0 ? 'No dine-in' : t ? `${t} tables` : 'Not set'}</div>
          </button>); })}
      </div>
      {noDine ? <Section title={`${o.name} has no dining room`} desc="Delivery-only and counter outlets use order numbers and tokens instead of tables. Set seats above zero in Outlets to add a floor plan." /> : <>
        <Section title={`Floor plan · ${o.name}`} desc="Build areas, then fine-tune table names and seats. Table numbers flow into the POS, reservations, KDS tickets and guest recognition."
          right={<div className="flex flex-wrap gap-2"><button type="button" onClick={fromSeats} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-semibold"><Wand2 size={14} />Generate from {o.seats} seats</button>
            {outlets.length > 1 && <button type="button" onClick={copyAll} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-semibold"><Copy size={14} />Copy to all outlets</button>}</div>}>
          <div className="mb-4 flex flex-wrap gap-2"><span className="py-1.5 text-[12px] font-semibold text-muted">Templates:</span>{Object.entries(TEMPLATES).map(([k, t]) => <button type="button" key={k} onClick={() => applyTpl(k)} className="rounded-full border border-line px-3 py-1.5 text-[12.5px] font-semibold hover:border-primary/50">{t.label}</button>)}</div>
          <div className="space-y-2">
            {(o.areas || []).map((a, ai) => (
              <div key={ai} className="grid grid-cols-2 items-end gap-2 rounded-xl border border-line p-3 sm:grid-cols-[1.4fr_.7fr_.7fr_1fr_.6fr_auto]">
                <Field label="Area"><Input value={a.name} onChange={(e) => setAreas(o.areas.map((x, j) => (j === ai ? { ...x, name: e.target.value } : x)))} /></Field>
                <Field label="Tables"><Input type="number" min="0" max="200" value={a.count} onChange={(e) => setAreas(o.areas.map((x, j) => (j === ai ? { ...x, count: e.target.value } : x)))} /></Field>
                <Field label="Seats each"><Input type="number" min="1" max="20" value={a.seats} onChange={(e) => setAreas(o.areas.map((x, j) => (j === ai ? { ...x, seats: e.target.value } : x)))} /></Field>
                <Field label="Shape"><select className={selectCls} value={a.shape} onChange={(e) => setAreas(o.areas.map((x, j) => (j === ai ? { ...x, shape: e.target.value } : x)))}>{[['square', 'Square'], ['round', 'Round'], ['rect', 'Long table'], ['booth', 'Booth'], ['bar', 'Bar stool']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
                <Field label="Prefix"><Input value={a.prefix ?? 'T'} maxLength={3} title="Table number prefix, e.g. T for T1, B for B1" placeholder="T" onChange={(e) => setAreas(o.areas.map((x, j) => (j === ai ? { ...x, prefix: e.target.value.toUpperCase() } : x)))} /></Field>
                <button type="button" onClick={() => setAreas(o.areas.filter((_, j) => j !== ai))} className="mb-1 rounded-lg p-2 text-muted hover:bg-bad-soft hover:text-bad" aria-label="Remove area"><Trash2 size={15} /></button>
              </div>
            ))}
            <button type="button" onClick={() => setAreas([...(o.areas || []), { name: `Area ${(o.areas || []).length + 1}`, count: 6, seats: 4, shape: 'square', prefix: 'T' }])} className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-line px-3 py-2 text-sm font-semibold text-muted hover:text-ink"><Plus size={14} />Add area</button>
          </div>
          <p className={`mt-3 text-[12px] font-semibold ${Math.abs(totalSeats - Number(o.seats)) > Number(o.seats) * 0.15 ? 'text-warn' : 'text-ok'}`}>{totalSeats} seats on the floor plan vs {o.seats} declared</p>
        </Section>
        {(o.areas || []).length > 0 && (
          <Section title="Fine-tune tables" desc="Rename to match the numbers painted on your tables, or change seats one by one.">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {o.areas.flatMap((a, ai) => a.tables.map((t, ti) => (
                <div key={`${ai}-${ti}`} className="flex items-center gap-2 rounded-xl border border-line px-2 py-1.5">
                  <span className="w-16 truncate text-[10.5px] font-semibold text-muted">{a.name}</span>
                  <input value={t.name} onChange={(e) => upO({ areas: o.areas.map((x, j) => (j === ai ? { ...x, tables: x.tables.map((y, k) => (k === ti ? { ...y, name: e.target.value } : y)) } : x)) })} className="w-16 rounded-lg bg-surface-2 px-2 py-1 text-sm font-bold outline-none" aria-label="Table name" />
                  <input type="number" min="1" value={t.seats} onChange={(e) => upO({ areas: o.areas.map((x, j) => (j === ai ? { ...x, tables: x.tables.map((y, k) => (k === ti ? { ...y, seats: e.target.value } : y)) } : x)) })} className="w-14 rounded-lg bg-surface-2 px-2 py-1 text-sm outline-none" aria-label="Seats" />
                  <span className="text-[11px] text-muted">seats</span>
                </div>
              )))}
            </div>
          </Section>
        )}
      </>}
    </div>
  );
}

// ---------- 5. Menu ----------
const FX = { INR: 84, AED: 3.67, SAR: 3.75, QAR: 3.64, GBP: 0.79, USD: 1, CAD: 1.37, SGD: 1.34, MYR: 4.4, THB: 35, AUD: 1.52, NZD: 1.68, EUR: 0.93, JPY: 152, ZAR: 18, IDR: 16000 };
export const priceFactor = (template, code) => (FX[code] || 1) / (template === 'indian' ? FX.INR : FX.USD);
export function StepMenu({ data, set, catalog }) {
  const m = data.menu || { source: 'template', template: data.org?.country === 'IN' ? 'indian' : 'global' };
  const up = (patch) => set({ ...data, menu: { ...m, ...patch } });
  const [csv, setCsv] = useState('');
  const cur = data.org?.currency;
  const parse = () => {
    const rows = csv.split(/\r?\n/).map((r) => r.split(/\t|,/).map((x) => x.trim())).filter((r) => r[0]);
    if (/name|item/i.test(rows[0]?.[0] || '')) rows.shift();
    up({ source: 'csv', items: [...(m.items || []), ...rows.map((r) => ({ name: r[0], category: r[1] || 'Mains', price: Number(String(r[2]).replace(/[^0-9.]/g, '')) || 0, station: r[3] || 'Hot Line', veg: /veg|yes|true|1/i.test(r[4] || '') }))] });
    setCsv('');
  };
  const items = m.items || [];
  const SRC = [['template', Sparkles, 'Start from a template', 'A complete, costed menu with recipes. Edit later.'], ['csv', Upload, 'Import a spreadsheet', 'Paste from Excel / Sheets, or your current POS export'], ['blank', Plus, 'Build it here', 'Add items one by one']];
  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        {SRC.map(([id, I, t, d]) => (
          <button type="button" key={id} onClick={() => up({ source: id })} aria-pressed={m.source === id} className={`rounded-2xl border p-4 text-left transition ${m.source === id ? 'border-primary bg-primary-soft/60 ring-4 ring-primary/10' : 'border-line hover:border-primary/40'}`}>
            <span className={`mb-2 grid h-9 w-9 place-items-center rounded-xl ${m.source === id ? 'grad-primary text-white' : 'bg-surface-2 text-primary'}`}><I size={17} /></span>
            <div className="font-bold">{t}</div><div className="text-[12px] text-muted">{d}</div>
          </button>
        ))}
      </div>
      {m.source === 'template' && (
        <Section title="Choose a template" desc={`Prices are converted to ${cur?.code || 'your currency'} and rounded. Recipes and ingredients come included, so inventory and food cost work from day one.`}>
          <div className="grid gap-3 md:grid-cols-2">
            {catalog.menu_templates.map((t) => (
              <button type="button" key={t.id} onClick={() => up({ template: t.id })} aria-pressed={m.template === t.id} className={`rounded-2xl border p-4 text-left ${m.template === t.id ? 'border-primary bg-primary-soft/50' : 'border-line'}`}>
                <div className="flex items-center justify-between"><span className="font-bold">{t.label}</span><span className="text-xs text-muted">{t.count} items</span></div>
                <div className="mt-1 text-[12px] text-muted">{t.sample.join(' · ')}…</div>
                <div className="mt-2 text-[12px] font-semibold">e.g. {t.sample[0]} at {fmtMoney((t.id === 'indian' ? 320 : 12) * priceFactor(t.id, cur?.code), cur)}</div>
              </button>
            ))}
          </div>
        </Section>
      )}
      {m.source !== 'template' && (
        <Section title={`Menu items · ${items.length}`} desc={`Prices ${data.org?.tax?.inclusive ? 'include' : 'exclude'} ${data.org?.tax?.name || 'tax'}, matching your country setting.`}
          right={<button type="button" onClick={() => up({ items: [...items, { name: '', category: 'Mains', price: '', station: 'Hot Line', veg: false }] })} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-semibold"><Plus size={14} />Add item</button>}>
          {m.source === 'csv' && <div className="mb-4"><textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={4} className={`${inputCls} font-mono text-xs`} placeholder={'Item, Category, Price, Station, Veg\nPaneer Tikka, Starters, 320, Tandoor, veg\nButter Chicken, Mains, 450, Curry, no'} />
            <button type="button" onClick={parse} disabled={!csv.trim()} className="mt-2 inline-flex items-center gap-1.5 rounded-xl grad-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Upload size={14} />Import to review grid</button></div>}
          {items.length > 0 && (
            <div className="max-h-80 overflow-auto rounded-xl border border-line">
              <table className="w-full min-w-[640px] text-[13px]"><thead className="sticky top-0 bg-surface-2"><tr>{['Item', 'Category', `Price (${cur?.code || ''})`, 'Station', 'Veg', ''].map((h) => <th key={h} className="px-2 py-2 text-left text-[11px] font-bold text-muted uppercase">{h}</th>)}</tr></thead>
                <tbody>{items.map((it, i) => { const bad = !it.name || !(Number(it.price) > 0); const u = (patch) => up({ items: items.map((x, j) => (j === i ? { ...x, ...patch } : x)) }); return (
                  <tr key={i} className={`border-t border-line ${bad ? 'bg-warn-soft/40' : ''}`}>
                    <td className="p-1"><input value={it.name} onChange={(e) => u({ name: e.target.value })} className="w-full rounded-lg px-2 py-1.5 outline-none focus:bg-surface" placeholder="Item name" /></td>
                    <td className="p-1"><input value={it.category} onChange={(e) => u({ category: e.target.value })} className="w-28 rounded-lg px-2 py-1.5 outline-none focus:bg-surface" /></td>
                    <td className="p-1"><input inputMode="decimal" value={it.price} onChange={(e) => u({ price: e.target.value })} className="w-24 rounded-lg px-2 py-1.5 text-right outline-none focus:bg-surface" /></td>
                    <td className="p-1"><input value={it.station} onChange={(e) => u({ station: e.target.value })} className="w-28 rounded-lg px-2 py-1.5 outline-none focus:bg-surface" /></td>
                    <td className="p-1 text-center"><input type="checkbox" checked={!!it.veg} onChange={(e) => u({ veg: e.target.checked })} aria-label="Vegetarian" /></td>
                    <td className="p-1"><button type="button" onClick={() => up({ items: items.filter((_, j) => j !== i) })} className="p-1 text-muted hover:text-bad" aria-label="Remove"><Trash2 size={14} /></button></td>
                  </tr>); })}</tbody></table>
            </div>
          )}
        </Section>
      )}
    </div>
  );
}

// ---------- 6. Team ----------
export function StepTeam({ data, set, catalog }) {
  const t = data.team || { invites: [] };
  const outlets = data.outlets || [];
  const up = (patch) => set({ ...data, team: { ...t, ...patch } });
  const wage = catalog.wage[data.org?.country] || 15;
  const roster = outlets.map((o) => {
    const model = catalog.business_types.find((b) => b.id === o.type)?.service || 'table';
    const tpl = catalog.staff_templates[model];
    const scale = Math.max(0.6, Math.min(3, (Number(o.seats) || 40) / 70)) * (o.staffFactor || 1);
    const people = tpl.reduce((a, r) => a + (r[0].includes('Manager') || r[0].includes('Head') ? 1 : Math.max(1, Math.round(r[3] * scale))), 0);
    const hours = tpl.reduce((a, r) => a + (r[0].includes('Manager') || r[0].includes('Head') ? 1 : Math.max(1, Math.round(r[3] * scale))) * (r[5] - r[4]) / 60, 0);
    return { o, people, hours, cost: hours * wage };
  });
  const setFactor = (key, f) => set({ ...data, outlets: outlets.map((o) => (o.key === key ? { ...o, staffFactor: f } : o)) });
  const roles = catalog.roles.filter(([id]) => id !== 'owner');
  const inv = t.invites || [];
  return (
    <div className="space-y-5">
      <Section title="Rosters" desc="We build each outlet's roster from its service model and seats. Adjust the staffing level; people can be renamed and shifts edited later in Workforce.">
        <div className="space-y-2">{roster.map(({ o, people, hours, cost }) => (
          <div key={o.key} className="grid items-center gap-3 rounded-xl border border-line px-4 py-3 sm:grid-cols-[1.4fr_1.6fr_auto]">
            <div><div className="font-bold">{o.name}</div><div className="text-[11.5px] text-muted">{people} people · {Math.round(hours)} labour h/day · ≈ {fmtMoney(cost, data.org?.currency)}/day</div></div>
            <div className="flex rounded-xl border border-line p-1">{[[0.8, 'Lean'], [1, 'Standard'], [1.25, 'Generous']].map(([f, l]) => <button type="button" key={l} onClick={() => setFactor(o.key, f)} className={`flex-1 rounded-lg py-1.5 text-[12.5px] font-semibold ${(o.staffFactor || 1) === f ? 'grad-primary text-white' : 'text-muted'}`}>{l}</button>)}</div>
            <span className="text-[11px] text-muted">{catalog.business_types.find((b) => b.id === o.type)?.label}</span>
          </div>
        ))}</div>
      </Section>
      <Section title="Invite your managers and team" desc="Each person gets a login scoped to their outlets and role (RBAC + ABAC). Temporary passwords are shown once at launch; nobody is emailed until you say so."
        right={<button type="button" onClick={() => up({ invites: [...inv, { name: '', email: '', role: 'branch_manager', outlets: outlets[0] ? [outlets[0].key] : [] }] })} className="inline-flex items-center gap-1.5 rounded-xl grad-primary px-3 py-2 text-sm font-semibold text-white"><Plus size={14} />Add person</button>}>
        {inv.length === 0 && <p className="rounded-xl border border-dashed border-line p-5 text-center text-sm text-muted">No invites yet. You can add people now or after launch from Access Control.</p>}
        <div className="space-y-2">{inv.map((p, i) => { const u = (patch) => up({ invites: inv.map((x, j) => (j === i ? { ...x, ...patch } : x)) }); const all = ['area_manager', 'auditor', 'it_admin'].includes(p.role); return (
          <div key={i} className="grid items-end gap-2 rounded-xl border border-line p-3 md:grid-cols-[1fr_1.2fr_1fr_1.6fr_auto]">
            <Field label="Name"><Input value={p.name} onChange={(e) => u({ name: e.target.value })} /></Field>
            <Field label="Email" error={p.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email) ? 'Invalid email' : null}><Input type="email" value={p.email} onChange={(e) => u({ email: e.target.value })} /></Field>
            <Field label="Role"><select className={selectCls} value={p.role} onChange={(e) => u({ role: e.target.value })}>{roles.map(([id, l]) => <option key={id} value={id}>{l}</option>)}</select></Field>
            <Field label={all ? 'Scope' : 'Outlets'}>{all ? <Input readOnly value={p.role === 'area_manager' ? 'Pick outlets in Access Control' : 'All outlets'} /> : (
              <div className="flex max-h-20 flex-wrap gap-1 overflow-y-auto rounded-xl border border-line p-1.5">{outlets.map((o) => { const on = p.outlets?.includes(o.key); return <button type="button" key={o.key} onClick={() => u({ outlets: on ? p.outlets.filter((k) => k !== o.key) : [...(p.outlets || []), o.key] })} className={`rounded-lg px-2 py-1 text-[11.5px] font-semibold ${on ? 'bg-primary text-white' : 'bg-surface-2 text-muted'}`}>{o.name}</button>; })}</div>)}</Field>
            <button type="button" onClick={() => up({ invites: inv.filter((_, j) => j !== i) })} className="mb-1 rounded-lg p-2 text-muted hover:text-bad" aria-label="Remove"><Trash2 size={15} /></button>
          </div>); })}</div>
      </Section>
    </div>
  );
}

// ---------- 7. Modules & targets ----------
const NEEDS = { inventory: 'menu + recipes', reservations: 'floor plan', vision: 'existing CCTV + edge box', safety: 'temperature sensors', guests: 'consent text', workforce: 'roster', kds: 'a screen per station', agents: 'nothing extra' };
const GOAL_MOD = { food_cost: ['inventory'], speed: ['kds'], labour: ['workforce'], safety: ['safety', 'vision'], loyalty: ['guests', 'reservations'], loss: ['vision', 'finance'], growth: ['reports'], visibility: ['reports', 'agents'] };
export function StepModules({ data, set, catalog }) {
  const bt = catalog.business_types.find((b) => b.id === data.profile?.business_type) || catalog.business_types[1];
  const rec = new Set([...bt.modules, ...(data.profile?.goals || []).flatMap((g) => GOAL_MOD[g] || [])]);
  const mods = data.modules || [...rec];
  const tg = data.targets || { food: bt.targets.food, labour: bt.targets.labour };
  const up = (patch) => set({ ...data, ...patch });
  return (
    <div className="space-y-5">
      <Section title="Switch on what you need" desc="Recommended for your business type and goals. Anything off stays out of the navigation and can be enabled later."
        right={<button type="button" onClick={() => up({ modules: catalog.modules.map((m) => m.id) })} className="rounded-xl border border-line px-3 py-2 text-sm font-semibold">Enable all</button>}>
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {catalog.modules.map((m) => { const on = mods.includes(m.id) || m.core; return (
            <div key={m.id} className={`flex gap-3 rounded-2xl border p-4 transition ${on ? 'border-primary/50 bg-primary-soft/30' : 'border-line'}`}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 font-bold">{m.label}{m.core && <span className="rounded-full bg-surface-2 px-1.5 py-px text-[10px] font-bold text-muted"><Lock size={9} className="mr-0.5 inline" />Core</span>}{!m.core && rec.has(m.id) && <span className="rounded-full bg-ok-soft px-1.5 py-px text-[10px] font-bold text-ok">Recommended</span>}</div>
                <div className="mt-0.5 text-[12px] text-muted">{m.desc}</div>
                {NEEDS[m.id] && <div className="mt-1.5 text-[11px] text-faint">Needs: {NEEDS[m.id]}</div>}
              </div>
              <Toggle on={on} label={m.label} onChange={(v) => !m.core && up({ modules: v ? [...new Set([...mods, m.id])] : mods.filter((x) => x !== m.id) })} />
            </div>); })}
        </div>
      </Section>
      <Section title="Targets" desc={`Benchmarks for ${bt.label.toLowerCase()}. They drive the KPI scorecard, risk indicators and AI agent alerts.`}>
        <div className="grid gap-6 md:grid-cols-3">
          {[['food', 'Food cost %', 0.2, 0.45], ['labour', 'Labour cost %', 0.15, 0.45]].map(([k, l, min, max]) => (
            <Field key={k} label={`${l}: ${(tg[k] * 100).toFixed(0)}%`} hint={`Benchmark ${(bt.targets[k] * 100).toFixed(0)}%`}>
              <input type="range" min={min} max={max} step="0.005" value={tg[k]} onChange={(e) => up({ targets: { ...tg, [k]: Number(e.target.value) } })} className="accent-[var(--primary)]" />
            </Field>
          ))}
          <div className="rounded-2xl bg-surface-2 p-4"><div className="text-xs font-semibold text-muted">Prime cost target</div><div className="text-2xl font-extrabold">{((tg.food + tg.labour) * 100).toFixed(0)}%</div><div className="text-[11px] text-muted">food + labour</div></div>
        </div>
      </Section>
    </div>
  );
}

// ---------- 8. Integrations ----------
const CAT_ORDER = ['pos', 'aggregator', 'payments', 'accounting', 'cctv', 'attendance', 'iot'];
export function StepIntegrations({ data, set, catalog }) {
  const country = data.org?.country;
  const [cat, setCat] = useState('aggregator');
  const sel = data.integrations || [];
  const chosen = new Set(sel.map((x) => x.catalog_id));
  const recommended = useMemo(() => {
    const posMap = { petpooja: 'petpooja', restroworks: 'restroworks', rista: 'rista', toast: 'toast', square: 'square', lightspeed: 'lightspeed', simphony: 'simphony', foodics: 'foodics' };
    const r = new Set();
    if (posMap[data.profile?.current_pos]) r.add(posMap[data.profile.current_pos]);
    const cn = catalog.countries.find((c) => c.code === country);
    catalog.connectors.forEach((x) => { if (x.category === 'aggregator' && cn?.platforms.some((p) => x.name.startsWith(p))) r.add(x.id); });
    if (country === 'IN') ['urbanpiper', 'razorpay', 'tally', 'essl', 'hikvision', 'cpplus'].forEach((x) => r.add(x));
    else ['stripe', 'xero', 'onvif', 'zkteco'].forEach((x) => r.add(x));
    return r;
  }, [data.profile, country, catalog]);
  const list = catalog.connectors.filter((x) => x.category === cat).sort((a, b) => Number(recommended.has(b.id)) - Number(recommended.has(a.id)) || Number(b.india && country === 'IN') - Number(a.india && country === 'IN'));
  const toggle = (id) => set({ ...data, integrations: chosen.has(id) ? sel.filter((x) => x.catalog_id !== id) : [...sel, { catalog_id: id, outlet: 'all' }] });
  return (
    <Section title="Connect the systems you already use" desc={`${catalog.connectors.length} pre-built connectors. Pick what you run today; each becomes a connector awaiting credentials, with setup steps, on the Integrations page.`}
      right={<button type="button" onClick={() => set({ ...data, integrations: [...new Map([...sel, ...[...recommended].map((id) => ({ catalog_id: id, outlet: 'all' }))].map((x) => [x.catalog_id, x])).values()] })} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-semibold"><Sparkles size={14} />Add recommended</button>}>
      <div className="mb-4 flex flex-wrap gap-1.5">{CAT_ORDER.map((k) => { const n = sel.filter((x) => catalog.connectors.find((c) => c.id === x.catalog_id)?.category === k).length; return (
        <button type="button" key={k} onClick={() => setCat(k)} className={`rounded-full border px-3 py-1.5 text-[12.5px] font-semibold ${cat === k ? 'border-primary bg-primary-soft text-primary' : 'border-line text-muted'}`}>{catalog.categories[k].label}{n ? ` · ${n}` : ''}</button>); })}</div>
      <div className="grid gap-2.5 sm:grid-cols-2 2xl:grid-cols-3">
        {list.map((x) => (
          <button type="button" key={x.id} onClick={() => toggle(x.id)} aria-pressed={chosen.has(x.id)} className={`relative rounded-2xl border p-3.5 text-left transition ${chosen.has(x.id) ? 'border-primary bg-primary-soft/50 ring-4 ring-primary/10' : 'border-line hover:border-primary/40'}`}>
            <div className="flex items-center gap-1.5 pr-6 font-bold">{x.name}</div>
            <div className="mt-0.5 line-clamp-2 text-[11.5px] text-muted">{x.market}</div>
            <div className="mt-2 flex flex-wrap gap-1 text-[10.5px] font-bold">{recommended.has(x.id) && <span className="rounded-full bg-ok-soft px-1.5 py-px text-ok">Recommended</span>}{x.india && <span className="rounded-full bg-primary-soft px-1.5 py-px text-primary">India</span>}<span className="rounded-full bg-surface-2 px-1.5 py-px text-muted">{x.access === 'public' ? 'Public API' : x.access === 'partner' ? 'Partner access' : x.access === 'csv' ? 'Export' : 'Limited docs'}</span></div>
            <span className={`absolute top-3 right-3 grid h-5 w-5 place-items-center rounded-md border ${chosen.has(x.id) ? 'border-primary bg-primary text-white' : 'border-line'}`}>{chosen.has(x.id) && <Check size={13} />}</span>
          </button>
        ))}
      </div>
    </Section>
  );
}

export { fmtNum };
