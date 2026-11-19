import { useMemo, useState } from 'react';
import { Check, CheckCheck, ChefHat, ShieldAlert, Thermometer, Users, HeartHandshake } from 'lucide-react';
import { useLive, api, clock, ago } from '../lib/api.js';
import { useAuth, useBranchQuery } from '../lib/auth.jsx';
import { Card, PageHeader, Badge, Select, Button, Empty, Loading, ErrorNote, SEVERITY_TONE } from '../components/ui.jsx';

const CAT = { speed: ['Kitchen speed', ChefHat, 'var(--offline)'], hygiene: ['Camera & access', ShieldAlert, 'var(--bad)'], safety: ['Food safety', Thermometer, 'var(--info)'], people: ['Staff', Users, 'var(--primary)'], guest: ['Guests', HeartHandshake, 'var(--online)'] };

export default function Alerts() {
  const { can } = useAuth();
  const q = useBranchQuery();
  const [status, setStatus] = useState('open');
  const [cat, setCat] = useState('all');
  const [sev, setSev] = useState('all');
  const { data, error, reload } = useLive(`/alerts?status=${status}&limit=300&${q}`, { types: ['alert'] });
  const rows = useMemo(() => (data || []).filter((a) => (cat === 'all' || a.category === cat) && (sev === 'all' || a.severity === sev)), [data, cat, sev]);
  const canAck = can('alerts.ack');
  const ack = async (id) => { await api(`/alerts/${id}/ack`, { method: 'POST' }); reload(); };
  const ackAll = async () => { await api(`/alerts/ack-all?${q}`, { method: 'POST' }); reload(); };
  if (error) return <ErrorNote>{error}</ErrorNote>;

  return (
    <>
      <PageHeader title="Alerts & Incidents" subtitle={`Only the alerts your role handles are shown${canAck ? '' : ' (read-only for your role)'}. Repeated problems escalate; one-off blips are filtered out.`}
        right={canAck && <Button onClick={ackAll}><CheckCheck size={15} /> Acknowledge all</Button>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={status} onChange={setStatus} options={[{ value: 'open', label: 'Open' }, { value: 'all', label: 'All (24h)' }]} />
        <Select value={cat} onChange={setCat} options={[{ value: 'all', label: 'All types' }, ...Object.entries(CAT).map(([v, [l]]) => ({ value: v, label: l }))]} />
        <Select value={sev} onChange={setSev} options={[{ value: 'all', label: 'Any priority' }, { value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }]} />
      </div>
      {!data ? <Loading /> : (
        <Card pad={false}>
          {rows.length === 0 ? <Empty>No alerts match. All calm.</Empty> : (
            <ul className="divide-y divide-line">
              {rows.map((a) => {
                const [label, Icon, color] = CAT[a.category] || [a.category, ShieldAlert, 'var(--muted)'];
                return (
                  <li key={a.id} className={`flex flex-wrap items-center gap-3 px-5 py-3.5 ${a.ack ? 'opacity-55' : ''}`}>
                    <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}><Icon size={17} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2"><span className="text-[14px] font-bold">{a.title}</span><Badge tone={SEVERITY_TONE[a.severity]} className="capitalize">{a.severity}</Badge></div>
                      <div className="mt-0.5 text-xs text-muted">{a.branch} · {label} · {a.detail}{a.ack_by ? ` · acknowledged by ${a.ack_by}` : ''}</div>
                    </div>
                    <span className="text-xs text-muted" title={new Date(a.ts).toLocaleString()}>{clock(a.ts)} · {ago(a.ts)}</span>
                    {canAck && !a.ack && <Button variant="ghost" onClick={() => ack(a.id)}><Check size={15} /> Done</Button>}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}
    </>
  );
}
