import { useState } from 'react';
import { Copy, Check, Trash2, Play, Pause, RotateCcw, Plus, FlaskConical, Upload, Save, ChevronDown } from 'lucide-react';
import ConnectorMarketplace, { MODE } from '../components/ConnectorMarketplace.jsx';
import { TelegramAdmin } from '../components/Telegram.jsx';
import { useAuth } from '../lib/auth.jsx';
import { useLive, api, ago } from '../lib/api.js';
import { Card, PageHeader, Badge, Button, Select, Loading, ErrorNote } from '../components/ui.jsx';

function CopyText({ text }) {
  const [done, setDone] = useState(false);
  return <button className="text-muted hover:text-ink" aria-label="Copy" onClick={() => { navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 1200); }}>{done ? <Check size={14} /> : <Copy size={14} />}</button>;
}
const Code = ({ children }) => <pre className="overflow-x-auto rounded-xl bg-side p-3 font-mono text-[11.5px] leading-relaxed text-[#dfe3f3]">{children}</pre>;
const SOURCES = [
  ['POS & billing', 'Webhook mapping, REST push or CSV export from any POS.'], ['Delivery platforms', 'Uber Eats, DoorDash, Deliveroo, Swiggy, Zomato, Talabat, GrabFood via aggregator webhooks.'],
  ['Kitchen display', 'Ticket fired / ready timestamps.'], ['Attendance', 'Face or fingerprint terminals, geofenced mobile check-in, HR systems.'],
  ['CCTV', 'Edge agent on RTSP/ONVIF cameras, or events from your camera system.'], ['Sensors & loyalty', 'Temperature gateways (MQTT/HTTP) and loyalty or reservation check-ins.'],
];

function InstalledConnector({ c, origin, onChange }) {
  const [open, setOpen] = useState(false);
  const [mapping, setMapping] = useState(() => JSON.stringify(c.mapping, null, 2));
  const [sample, setSample] = useState('');
  const [preview, setPreview] = useState(null);
  const [msg, setMsg] = useState(null);
  const url = `${origin}/api/v1/webhooks/${c.id}`;
  const mode = c.catalog ? MODE[c.catalog.mode] : MODE.webhook;
  const save = async () => {
    try { await api(`/integrations/${c.id}`, { method: 'PATCH', body: { mapping: JSON.parse(mapping) } }); setMsg('Mapping saved'); onChange(); }
    catch (e) { setMsg(e instanceof SyntaxError ? 'Mapping is not valid JSON' : e.message); }
  };
  const test = async () => {
    try { setPreview(null); const body = sample.trim() ? JSON.parse(sample) : {}; const r = await api(`/integrations/${c.id}/test`, { method: 'POST', body }); setPreview(r.mapped); setMsg(null); }
    catch (e) { setMsg(e instanceof SyntaxError ? 'Sample payload is not valid JSON' : e.message); }
  };
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setOpen(!open)} className="inline-flex items-center gap-1.5 font-bold" aria-expanded={open}><ChevronDown size={15} className={`transition ${open ? '' : '-rotate-90'}`} />{c.name}</button>
        <Badge tone="primary">{c.target}</Badge>
        {mode && <Badge tone="info"><mode.icon size={11} />{mode.label}</Badge>}
        {c.catalog?.signing && <Badge tone="ok">Signature check</Badge>}
        <Badge tone={c.last_seen ? 'ok' : 'muted'}>{c.last_seen ? `${c.received} received · ${ago(c.last_seen)}` : 'Waiting for first event'}</Badge>
        {c.last_error && <Badge tone="bad">{c.last_error}</Badge>}
        <span className="flex-1" />
        <Button variant="ghost" onClick={async () => { await api(`/integrations/${c.id}`, { method: 'DELETE' }); onChange(); }} aria-label="Delete"><Trash2 size={15} /></Button>
      </div>
      {(!c.catalog || ['webhook'].includes(c.catalog.mode)) && <div className="mt-1.5 flex items-center gap-2 font-mono text-[11.5px] text-muted"><span className="truncate">POST {url}</span><CopyText text={url} /></div>}
      {open && (
        <div className="mt-3 grid gap-4 rounded-xl border border-line bg-surface-2/40 p-4 lg:grid-cols-2">
          <div className="space-y-3">
            {c.steps && <div><div className="mb-1 text-[11px] font-bold tracking-widest text-muted uppercase">Setup</div><ol className="list-decimal space-y-1 pl-5 text-[12.5px]">{c.steps.map((s2, i) => <li key={i}>{s2}</li>)}</ol></div>}
            {c.config && Object.keys(c.config).length > 0 && <div><div className="mb-1 text-[11px] font-bold tracking-widest text-muted uppercase">Configuration</div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11.5px]">{Object.entries(c.config).map(([k, v]) => <span key={k}><span className="text-muted">{k}</span> {v || '—'}</span>)}</div></div>}
            {c.cameras && <div><div className="mb-1 text-[11px] font-bold tracking-widest text-muted uppercase">edge-agent/config.json cameras</div><Code>{JSON.stringify(c.cameras, null, 2)}</Code></div>}
            {c.catalog?.mode === 'device' && <p className="text-[12px] text-muted">Device server: <code className="font-mono">{origin.replace(/^https?:\/\//, '')}</code> · path <code className="font-mono">/iclock/cdata</code>. Only the serial numbers configured here are accepted.</p>}
          </div>
          {(!c.catalog || ['webhook', 'poll'].includes(c.catalog.mode)) && (
            <div className="space-y-2">
              <div className="text-[11px] font-bold tracking-widest text-muted uppercase">Field mapping (vendor JSON → OutletOS)</div>
              <textarea value={mapping} onChange={(e) => setMapping(e.target.value)} rows={8} spellCheck={false} className="w-full rounded-xl border border-line bg-surface p-2.5 font-mono text-[11.5px] outline-none focus:border-primary" />
              <textarea value={sample} onChange={(e) => setSample(e.target.value)} rows={4} spellCheck={false} placeholder="Paste one real sample payload from the vendor, then Test" className="w-full rounded-xl border border-line bg-surface p-2.5 font-mono text-[11.5px] outline-none focus:border-primary" />
              <div className="flex items-center gap-2"><Button onClick={test}><FlaskConical size={15} />Test</Button><Button variant="primary" onClick={save}><Save size={15} />Save mapping</Button>{msg && <span className="text-xs text-muted">{msg}</span>}</div>
              {preview && <Code>{JSON.stringify(preview, null, 2)}</Code>}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function CameraStreams({ cameras }) {
  const [urls, setUrls] = useState(() => Object.fromEntries(cameras.map((c) => [c.id, c.stream_url || ''])));
  const [saved, setSaved] = useState(null);
  const save = async (id) => { await api(`/cameras/${id}`, { method: 'PUT', body: { stream_url: urls[id] } }); setSaved(id); setTimeout(() => setSaved(null), 1500); };
  return (
    <Card className="mt-4" title="Camera streams" subtitle="Paste an MP4/WebM or MJPEG URL to show real footage on a camera tile. Leave empty to use the simulated view." pad={false}>
      <div className="max-h-96 overflow-y-auto px-5 pb-4">
        <table className="w-full min-w-[640px] text-sm">
          <thead><tr className="text-left text-xs font-semibold text-muted"><th className="py-2">Camera</th><th>Branch</th><th>Stream URL</th><th /></tr></thead>
          <tbody>
            {cameras.map((c) => (
              <tr key={c.id} className="border-t border-line">
                <td className="py-2 font-semibold">{c.name}</td><td className="text-muted">{c.branch}</td>
                <td className="pr-2"><input value={urls[c.id]} onChange={(e) => setUrls({ ...urls, [c.id]: e.target.value })} placeholder="https://…/kitchen.mp4"
                  className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 font-mono text-xs outline-none focus:border-primary" /></td>
                <td><Button variant="ghost" onClick={() => save(c.id)}>{saved === c.id ? <Check size={14} /> : <Save size={14} />}</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function Integrations() {
  const { branches } = useAuth();
  const { data, error, reload } = useLive('/integrations', { types: [], interval: 20000 });
  const { data: sim, reload: reloadSim } = useLive('/simulator', { types: [], interval: 10000 });
  const [tpl, setTpl] = useState(0);
  const [name, setName] = useState('');
  const [csv, setCsv] = useState('outlet_id,total,covers,channel,platform,payment\nr1,84.50,2,dine-in,POS,card\nr5,"1,260",4,delivery,Swiggy,prepaid');
  const [csvResult, setCsvResult] = useState(null);
  const [busy, setBusy] = useState(false);
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <><PageHeader title="Integrations" /><Loading /></>;
  const origin = window.location.origin;
  const key = data.api_key;

  const create = async () => { const t = data.templates[tpl]; await api('/integrations', { method: 'POST', body: { name: name || t.name, target: t.target, mapping: t.mapping } }); setName(''); reload(); };
  const simAction = async (action) => { setBusy(true); try { await api('/simulator', { method: 'POST', body: { action } }); await reloadSim(); } finally { setBusy(false); } };
  const importCsv = async () => {
    try { setCsvResult(await api('/v1/import/orders', { method: 'POST', body: csv, headers: { 'Content-Type': 'text/csv', 'x-api-key': key } })); }
    catch (e) { setCsvResult({ error: e.message }); }
  };

  return (
    <>
      <PageHeader title="Integrations" subtitle="One standard event format. Any POS, delivery platform, attendance device, camera, sensor or loyalty system connects by REST, a no-code webhook mapping, or CSV." />
      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="API key" subtitle={`Send as x-api-key · base URL ${origin}/api/v1`} className="xl:col-span-2">
          <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2.5 font-mono text-[12.5px]"><span className="flex-1 truncate">{key}</span><CopyText text={key} /></div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {SOURCES.map(([t, d]) => <div key={t} className="rounded-xl border border-line p-3"><div className="text-[13px] font-bold">{t}</div><div className="mt-0.5 text-[11.5px] leading-snug text-muted">{d}</div></div>)}
          </div>
        </Card>
        <Card title="Demo simulator">
          <div className="flex items-center gap-2 text-sm"><span className={`h-2 w-2 rounded-full ${sim?.running ? 'live-dot bg-ok' : 'bg-faint'}`} />{sim?.running ? 'Generating live activity for 6 branches' : 'Paused. Only real integrations feed the app.'}</div>
          <div className="mt-4 flex flex-wrap gap-2">
            {sim?.running ? <Button onClick={() => simAction('pause')} disabled={busy}><Pause size={15} /> Pause</Button> : <Button variant="primary" onClick={() => simAction('resume')} disabled={busy}><Play size={15} /> Resume</Button>}
            <Button onClick={() => simAction('reset')} disabled={busy}><RotateCcw size={15} /> {busy ? 'Rebuilding…' : 'Rebuild demo data'}</Button>
          </div>
          <p className="mt-3 text-xs text-muted">The simulator uses the same API as real systems. Going live means pointing your POS, devices and cameras here.</p>
        </Card>
      </div>

      <TelegramAdmin />
      <Card className="mt-4" title="Connector marketplace" subtitle={`${data.catalog.length} pre-built connectors for POS, delivery, accounting, payments, CCTV, attendance and IoT, India first. Pick one, add credentials, and follow its setup steps.`}>
        <ConnectorMarketplace catalog={data.catalog} categories={data.categories} installed={data.connectors} branches={branches} onInstalled={reload} />
      </Card>

      <Card className="mt-4" title="Your connectors" subtitle="Connectors you have added, plus custom webhook mappings for any other system">
        <div className="flex flex-wrap items-end gap-2">
          <span className="text-xs font-semibold text-muted">Custom webhook:</span>
          <Select value={tpl} onChange={(v) => setTpl(Number(v))} options={data.templates.map((t, i) => ({ value: i, label: `${t.name} → ${t.target}` }))} />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Connector name, e.g. Restaurant 1 POS" className="min-w-60 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-primary" />
          <Button variant="primary" onClick={create}><Plus size={15} /> Create connector</Button>
        </div>
        <details className="mt-3 text-xs"><summary className="cursor-pointer font-semibold text-muted">View mapping</summary><Code>{JSON.stringify(data.templates[tpl].mapping, null, 2)}</Code></details>
        <ul className="mt-4 divide-y divide-line">
          {data.connectors.length === 0 && <li className="py-4 text-sm text-muted">No connectors yet. Add one from the marketplace above, or create a custom webhook mapping.</li>}
          {data.connectors.map((c) => <InstalledConnector key={c.id} c={c} origin={origin} onChange={reload} />)}
        </ul>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title="REST endpoints">
          <div className="space-y-4">
            {Object.entries(data.schemas).map(([k, s]) => (
              <div key={k}>
                <div className="mb-1 flex items-center justify-between"><code className="font-mono text-[12.5px] font-semibold">{s.endpoint}</code>
                  <CopyText text={`curl -X ${s.endpoint.replace(' ', ` ${origin}`)} -H "x-api-key: ${key}" -H "Content-Type: application/json" -d '${JSON.stringify(s.example)}'`} /></div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] text-muted">{Object.entries(s.fields).map(([f, t]) => <span key={f}><span className="font-mono text-ink">{f}</span> {t}</span>)}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="CSV import · orders">
          <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={6} spellCheck={false} className="w-full rounded-xl border border-line bg-surface-2 p-3 font-mono text-[12px] outline-none focus:border-primary" />
          <div className="mt-2 flex items-center gap-3">
            <Button variant="primary" onClick={importCsv}><Upload size={15} /> Import</Button>
            {csvResult && (csvResult.error ? <span className="text-xs text-bad">{csvResult.error}</span>
              : <span className="text-xs text-muted">{csvResult.imported} imported{csvResult.errors.length ? `, ${csvResult.errors.length} errors: ${csvResult.errors.join('; ')}` : ''}</span>)}
          </div>
        </Card>
      </div>
      <CameraStreams cameras={data.cameras} />
    </>
  );
}
