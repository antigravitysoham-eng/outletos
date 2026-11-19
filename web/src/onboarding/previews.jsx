// Live previews shown beside the onboarding steps: a legal receipt that reflects the country's tax rules and IDs,
// a floor plan drawn from the area builder, and a running summary of the workspace being created.
import { Users, Store, UtensilsCrossed, Plug, LayoutGrid, Boxes } from 'lucide-react';

export const fmtMoney = (v, cur) => {
  try { return new Intl.NumberFormat(cur?.locale || 'en-US', { style: 'currency', currency: cur?.code || 'USD', maximumFractionDigits: ['JPY', 'IDR'].includes(cur?.code) ? 0 : 2 }).format(v); }
  catch { return `${cur?.symbol || '$'}${Number(v).toFixed(2)}`; }
};
export const fmtNum = (v, cur) => new Intl.NumberFormat(cur?.locale || 'en-US').format(v);

export function ReceiptPreview({ data, country, sampleItems }) {
  const org = data.org || {}, cur = org.currency || country?.currency, tax = org.tax || country?.tax || { rate: 0 };
  const outlet = data.outlets?.[0] || {};
  const items = (sampleItems?.length ? sampleItems : [['Signature main', 2, 18], ['House bread', 1, 5], ['Fresh lime soda', 2, 4]]).slice(0, 3);
  const sub = items.reduce((a, [, q, p]) => a + q * p, 0);
  const svc = (org.service_pct || 0) * sub;
  const inclusive = !!tax.inclusive;
  const taxAmt = inclusive ? (sub + svc) - (sub + svc) / (1 + (tax.rate || 0)) : (sub + svc) * (tax.rate || 0);
  const gross = inclusive ? sub + svc : sub + svc + taxAmt;
  const step = country?.roundTo || 0.01;
  const total = Math.round(gross / step) * step;
  const ids = [...(country?.ids || [])].map((d) => ({ ...d, value: d.scope === 'outlet' ? outlet.ids?.[d.key] : org.ids?.[d.key] })).filter((d) => d.required || d.value);
  return (
    <div className="mx-auto w-full max-w-[290px] rotate-[0.4deg] rounded-md bg-white px-4 py-5 font-mono text-[11px] leading-snug text-neutral-900 shadow-[0_18px_40px_-12px_rgba(0,0,0,.35)]">
      <div className="text-center">
        <div className="text-[13px] font-bold tracking-tight">{org.group || 'Your restaurant group'}</div>
        <div>{outlet.name || 'Outlet name'}{outlet.city ? ` · ${outlet.city}` : ''}</div>
        {org.legal_name && <div className="text-[10px] text-neutral-500">{org.legal_name}</div>}
        {ids.map((d) => <div key={d.key} className={d.value ? '' : 'text-amber-600'}>{d.label}: {d.value || '— required —'}</div>)}
        <div className="mt-1 font-bold">{tax.rate ? (country?.code === 'SA' ? 'Simplified Tax Invoice · فاتورة ضريبية مبسطة' : 'TAX INVOICE') : 'INVOICE'}</div>
      </div>
      <div className="my-2 border-t border-dashed border-neutral-400" />
      {items.map(([n, q, p]) => <div key={n} className="flex justify-between gap-2"><span className="truncate">{q} × {n}</span><span>{fmtMoney(q * p, cur)}</span></div>)}
      <div className="my-2 border-t border-dashed border-neutral-400" />
      <div className="flex justify-between"><span>Subtotal</span><span>{fmtMoney(sub, cur)}</span></div>
      {svc > 0 && <div className="flex justify-between"><span>Service charge {(org.service_pct * 100).toFixed(1)}%{country?.code === 'IN' ? ' (optional)' : ''}</span><span>{fmtMoney(svc, cur)}</span></div>}
      {tax.rate > 0 && (tax.split && !inclusive
        ? tax.split.map(([n, r]) => <div key={n} className="flex justify-between"><span>{n} @{(r * 100).toFixed(1)}%</span><span>{fmtMoney((sub + svc) * r, cur)}</span></div>)
        : <div className="flex justify-between"><span>{tax.name} {(tax.rate * 100).toFixed(tax.rate * 100 % 1 ? 3 : 0)}%{inclusive ? ' (incl.)' : ''}</span><span>{fmtMoney(taxAmt, cur)}</span></div>)}
      {Math.abs(total - gross) > 0.0001 && <div className="flex justify-between"><span>Round off</span><span>{(total - gross).toFixed(2)}</span></div>}
      <div className="mt-1 flex justify-between text-[13px] font-bold"><span>TOTAL</span><span>{fmtMoney(total, cur)}</span></div>
      <div className="my-2 border-t border-dashed border-neutral-400" />
      {country?.tax?.sac && <div className="text-center text-[10px]">SAC {country.tax.sac} · Restaurant service</div>}
      {country?.code === 'SA' && <div className="mx-auto my-1 grid h-12 w-12 grid-cols-6 gap-px bg-white p-0.5">{Array.from({ length: 36 }, (_, i) => <span key={i} className={(i * 7) % 3 ? 'bg-neutral-900' : 'bg-white'} />)}</div>}
      <div className="text-center text-[10px] text-neutral-500">Thank you · {new Date().toLocaleDateString(cur?.locale)}</div>
    </div>
  );
}

const SHAPE = { round: 'rounded-full', square: 'rounded-md', rect: 'rounded-md', booth: 'rounded-t-xl rounded-b-md', bar: 'rounded-full' };
export function FloorPreview({ outlet }) {
  const areas = outlet?.areas || [];
  if (!areas.length) return <div className="grid h-48 place-items-center rounded-2xl border border-dashed border-line text-sm text-muted">{Number(outlet?.seats) === 0 ? 'No dine-in: tables are not needed' : 'Add an area to see the floor plan'}</div>;
  return (
    <div className="space-y-3">
      {areas.map((a, ai) => (
        <div key={ai} className="rounded-2xl border border-line bg-[repeating-linear-gradient(0deg,transparent,transparent_19px,var(--line)_20px),repeating-linear-gradient(90deg,transparent,transparent_19px,var(--line)_20px)] p-3">
          <div className="mb-2 flex items-center justify-between text-[11px] font-bold tracking-widest text-muted uppercase"><span>{a.name || 'Area'}</span><span>{(a.tables || []).length} tables · {(a.tables || []).reduce((s, t) => s + (Number(t.seats) || 0), 0)} seats</span></div>
          <div className="flex flex-wrap gap-2">
            {(a.tables || []).map((t, ti) => {
              const big = (Number(t.seats) || 2) >= 6, w = t.shape === 'rect' || big ? 'w-16' : t.shape === 'bar' ? 'w-8' : 'w-11';
              return (
                <div key={ti} className={`relative grid h-11 ${w} place-items-center border-2 border-primary/60 bg-surface text-[11px] font-extrabold shadow-sm ${SHAPE[t.shape] || SHAPE.square}`} title={`${t.name} · ${t.seats} seats`}>
                  {t.name}
                  <span className="absolute -bottom-1.5 right-[-6px] rounded-full bg-primary px-1 text-[9px] font-bold text-white">{t.seats}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SummaryCard({ data, catalog }) {
  const outlets = data.outlets || [];
  const tables = outlets.reduce((a, o) => a + (o.areas || []).reduce((s, x) => s + (x.tables || []).length, 0), 0);
  const seats = outlets.reduce((a, o) => a + (Number(o.seats) || 0), 0);
  const menuN = data.menu?.source === 'template' ? catalog?.menu_templates.find((t) => t.id === data.menu.template)?.count || 0 : (data.menu?.items || []).length;
  const rows = [
    [Store, 'Outlets', outlets.length, `${fmtNum(seats, data.org?.currency)} seats`],
    [LayoutGrid, 'Tables', tables, `${new Set(outlets.flatMap((o) => (o.areas || []).map((a) => a.name))).size} area types`],
    [UtensilsCrossed, 'Menu items', menuN, data.menu?.source === 'template' ? 'from template' : data.menu?.source === 'csv' ? 'imported' : 'custom'],
    [Users, 'Team invites', (data.team?.invites || []).length, 'plus rostered staff'],
    data.modules ? [Boxes, 'Modules', data.modules.length, 'enabled'] : [Boxes, 'Modules', (catalog?.business_types.find((b) => b.id === data.profile?.business_type)?.modules || []).length, 'recommended'],
    [Plug, 'Integrations', (data.integrations || []).length, 'to connect'],
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {rows.map(([Icon, l, v, s]) => (
        <div key={l} className="rounded-xl border border-line bg-surface p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted"><Icon size={13} />{l}</div>
          <div className="mt-0.5 text-xl font-extrabold tnum">{v}</div>
          <div className="text-[10.5px] text-muted">{s}</div>
        </div>
      ))}
    </div>
  );
}
