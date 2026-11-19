import { useMemo, useState } from 'react';
import { Search, X, ExternalLink, ShieldCheck, Lock, FileSpreadsheet, Webhook, RefreshCw, Cpu, Radio, Upload, Plus, Store, Bike, Calculator, CreditCard, Cctv, Fingerprint, Thermometer } from 'lucide-react';
import { api } from '../lib/api.js';
import { Badge, Button } from './ui.jsx';

export const CAT_ICON = { pos: Store, aggregator: Bike, accounting: Calculator, payments: CreditCard, cctv: Cctv, attendance: Fingerprint, iot: Thermometer };
export const MODE = {
  webhook: { label: 'Webhook', icon: Webhook, help: 'The vendor pushes events to your OutletOS webhook URL in real time.' },
  poll: { label: 'Scheduled sync', icon: RefreshCw, help: 'OutletOS polls the vendor API every 5–15 minutes.' },
  agent: { label: 'Edge agent', icon: Cpu, help: 'The OutletOS edge box at the outlet reads the device on the LAN and forwards events.' },
  device: { label: 'Device push', icon: Radio, help: 'The device calls OutletOS directly (ADMS / PUSH protocol).' },
  csv: { label: 'CSV / SFTP', icon: FileSpreadsheet, help: 'Scheduled report export imported as CSV.' },
  export: { label: 'Outbound sync', icon: Upload, help: 'OutletOS sends day-end data to this system.' },
};
const ACCESS = {
  public: { label: 'Public API', tone: 'ok', icon: ShieldCheck }, partner: { label: 'Partner access', tone: 'warn', icon: Lock },
  partial: { label: 'Limited docs', tone: 'info', icon: Lock }, csv: { label: 'Export only', tone: 'muted', icon: FileSpreadsheet },
};
const CONF = { verified: 'Checked against vendor docs (Nov 2026)', known: 'From vendor developer portal; re-check before go-live', uncertain: 'Partner-gated or thinly documented; confirm with the vendor', design: 'OutletOS design' };

function Detail({ x, categories, branches, onClose, onInstalled }) {
  const [cfg, setCfg] = useState({ outlet: branches[0]?.id || 'r1' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const M = MODE[x.mode] || MODE.webhook, A = ACCESS[x.access] || ACCESS.public, Icon = CAT_ICON[x.category];
  const install = async () => {
    setBusy(true); setErr(null);
    try { await api('/integrations', { method: 'POST', body: { catalog_id: x.id, config: cfg, name: `${x.name}${branches.length > 1 ? ` · ${branches.find((b) => b.id === cfg.outlet)?.name || ''}` : ''}` } }); onInstalled(); onClose(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={x.name}>
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-surface shadow-xl">
        <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-line bg-surface px-6 py-5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><Icon size={20} /></span>
          <div className="min-w-0 flex-1">
            <div className="text-lg font-extrabold leading-tight">{x.name}</div>
            <div className="text-xs text-muted">{x.vendor} · {categories[x.category].label}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {x.india && <Badge tone="primary">India</Badge>}
              <Badge tone={A.tone}><A.icon size={11} />{A.label}</Badge>
              <Badge tone="info"><M.icon size={11} />{M.label}</Badge>
              {x.webhooks && <Badge tone="muted">Webhooks</Badge>}
              {x.signing && <Badge tone="ok">Signed payloads</Badge>}
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-muted hover:bg-surface-2" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="space-y-5 px-6 py-5 text-sm">
          <p className="text-muted">{x.market}</p>
          <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-[13px]">
            <dt className="font-semibold text-muted">How it connects</dt><dd>{x.method}<div className="text-[11.5px] text-muted">{M.help}</div></dd>
            <dt className="font-semibold text-muted">Authentication</dt><dd>{x.auth}</dd>
            <dt className="font-semibold text-muted">Data</dt><dd className="flex flex-wrap gap-1">{x.objects.map((o) => <span key={o} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11.5px]">{o}</span>)}</dd>
            <dt className="font-semibold text-muted">Lands in</dt><dd><code className="font-mono text-xs">{categories[x.category].target === 'export' ? 'outbound (day-end sales)' : `/api/v1/${categories[x.category].target}`}</code></dd>
            <dt className="font-semibold text-muted">Docs</dt><dd>{x.docs ? <a href={x.docs} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">Developer documentation <ExternalLink size={12} /></a> : <span className="text-muted">Not public: request from the vendor</span>}</dd>
            <dt className="font-semibold text-muted">Confidence</dt><dd className="text-[12px] text-muted">{CONF[x.conf]}</dd>
          </dl>
          {x.notes && <p className="rounded-xl bg-info-soft px-3 py-2 text-[12.5px] text-info">{x.notes}</p>}
          <div>
            <div className="mb-2 text-[11px] font-bold tracking-widest text-muted uppercase">Setup</div>
            <ol className="list-decimal space-y-1.5 pl-5 text-[13px]">{x.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          </div>
          <div>
            <div className="mb-2 text-[11px] font-bold tracking-widest text-muted uppercase">Configuration</div>
            <div className="grid gap-3">
              {branches.length > 1 && (
                <label className="grid gap-1 text-[13px] font-semibold">Branch
                  <select value={cfg.outlet} onChange={(e) => setCfg({ ...cfg, outlet: e.target.value })} className="rounded-xl border border-line bg-surface px-3 py-2 text-sm font-normal outline-none focus:border-primary">
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name} · {b.city}</option>)}
                  </select>
                </label>
              )}
              {x.fields.map((f) => (
                <label key={f.key} className="grid gap-1 text-[13px] font-semibold">{f.label}
                  <input type={f.secret ? 'password' : 'text'} autoComplete="off" value={cfg[f.key] || ''} placeholder={f.placeholder || ''} onChange={(e) => setCfg({ ...cfg, [f.key]: e.target.value })}
                    className="rounded-xl border border-line bg-surface px-3 py-2 font-mono text-[12.5px] font-normal outline-none focus:border-primary" />
                </label>
              ))}
              <p className="text-[11.5px] text-muted">Secrets are stored server-side and only shown masked afterwards. You can save now and add credentials later.</p>
            </div>
          </div>
          {err && <p className="text-xs text-bad">{err}</p>}
        </div>
        <div className="sticky bottom-0 mt-auto flex justify-end gap-2 border-t border-line bg-surface px-6 py-4">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={install} disabled={busy}><Plus size={15} />{busy ? 'Adding…' : 'Add connector'}</Button>
        </div>
      </div>
    </div>
  );
}

export default function ConnectorMarketplace({ catalog, categories, installed, branches, onInstalled }) {
  const [cat, setCat] = useState('all');
  const [region, setRegion] = useState('india');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const list = useMemo(() => catalog
    .filter((x) => (cat === 'all' || x.category === cat) && (region === 'all' || (region === 'india' ? x.india : !x.india)))
    .filter((x) => !q || `${x.name} ${x.vendor} ${x.market} ${x.objects.join(' ')}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(b.india) - Number(a.india)), [catalog, cat, region, q]);
  const count = (c) => catalog.filter((x) => (c === 'all' || x.category === c) && (region === 'all' || (region === 'india' ? x.india : !x.india))).length;
  const installedIds = new Set(installed.map((c) => c.catalog_id));

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl border border-line bg-surface p-1" role="tablist" aria-label="Region">
          {[['india', 'India'], ['global', 'Global'], ['all', 'All']].map(([id, l]) => (
            <button key={id} role="tab" aria-selected={region === id} onClick={() => setRegion(id)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${region === id ? 'grad-primary text-white' : 'text-muted hover:text-ink'}`}>{l}</button>
          ))}
        </div>
        <label className="relative min-w-56 flex-1">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Petpooja, Zomato, Tally, Hikvision, eSSL…" className="w-full rounded-xl border border-line bg-surface py-2 pr-3 pl-9 text-sm outline-none focus:border-primary" />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {[['all', 'All'], ...Object.entries(categories).map(([k, v]) => [k, v.label])].map(([k, l]) => {
          const I = CAT_ICON[k];
          return (
            <button key={k} onClick={() => setCat(k)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${cat === k ? 'border-primary bg-primary-soft text-primary' : 'border-line text-muted hover:text-ink'}`}>
              {I && <I size={13} />}{l}<span className="tnum opacity-70">{count(k)}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {list.map((x) => {
          const I = CAT_ICON[x.category], A = ACCESS[x.access] || ACCESS.public, Mo = MODE[x.mode] || MODE.webhook;
          return (
            <button key={x.id} onClick={() => setOpen(x)} className="group flex flex-col rounded-2xl border border-line bg-surface p-4 text-left shadow-card transition hover:-translate-y-0.5 hover:border-primary/50">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-primary"><I size={18} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 font-bold leading-tight">{x.name}{installedIds.has(x.id) && <Badge tone="ok">Added</Badge>}</div>
                  <div className="truncate text-[11.5px] text-muted">{categories[x.category].label}</div>
                </div>
              </div>
              <p className="mt-2 line-clamp-2 flex-1 text-[12px] leading-snug text-muted">{x.market}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {x.india && <Badge tone="primary">India</Badge>}
                <Badge tone={A.tone}>{A.label}</Badge>
                <Badge tone="muted"><Mo.icon size={11} />{Mo.label}</Badge>
              </div>
            </button>
          );
        })}
        {list.length === 0 && <p className="col-span-full py-6 text-center text-sm text-muted">No connector matches. The generic webhook, CSV and ONVIF connectors cover anything else.</p>}
      </div>
      {open && <Detail x={open} categories={categories} branches={branches} onClose={() => setOpen(null)} onInstalled={onInstalled} />}
    </>
  );
}
