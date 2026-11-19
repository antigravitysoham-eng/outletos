import { useState } from 'react';
import { Lock, Cpu, ShieldCheck, Radar, RefreshCw } from 'lucide-react';
import { useLive } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { PageHeader, Loading, ErrorNote } from '../components/ui.jsx';
import AgentChat, { AgentAvatar } from '../components/AgentChat.jsx';

const SEV = { high: 'bg-bad', medium: 'bg-warn', info: 'bg-ok' };

function Roster({ roster, active, onPick }) {
  const row = (a, lead = false) => (
    <button key={a.id} onClick={() => a.available && onPick(a.id)} disabled={!a.available} title={a.blurb}
      className={`flex w-full items-start gap-3 rounded-xl p-2.5 text-left transition ${active === a.id ? 'bg-primary-soft ring-1 ring-primary/30' : a.available ? 'hover:bg-surface-2' : 'opacity-45'}`}>
      <AgentAvatar agent={a} size={lead ? 38 : 32} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 pt-0.5 text-[13.5px] font-bold">{a.name}{!a.available && <Lock size={12} className="text-muted" />}</div>
        <div className={`text-[11.5px] leading-snug text-muted ${lead || !a.available ? '' : 'xl:hidden 2xl:block'}`}>{a.available ? a.blurb : 'Not part of your role'}</div>
      </div>
    </button>
  );
  return (
    <div className="rounded-2xl border border-line bg-surface p-3 shadow-card">
      <div className="px-1.5 pb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Orchestrator</div>
      {row({ ...roster.maitre, id: 'maitre' }, true)}
      <div className="px-1.5 pt-4 pb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Specialists</div>
      <div className="space-y-0.5">{roster.specialists.map((s) => row(s))}</div>
    </div>
  );
}

function Briefing({ onAsk }) {
  const { branch } = useAuth();
  const { data, error, reload } = useLive(`/agents/briefing${branch !== 'all' ? `?branch=${branch}` : ''}`, { interval: 60000 });
  return (
    <div className="rounded-2xl border border-line bg-surface shadow-card">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2"><Radar size={16} className="text-primary" /><h2 className="text-[14px] font-bold">Live briefing</h2></div>
        <button onClick={reload} className="rounded-lg p-1.5 text-muted hover:bg-surface-2" aria-label="Refresh briefing"><RefreshCw size={14} /></button>
      </div>
      <p className="px-4 text-[11.5px] text-muted">What each agent flags on its own, every minute.</p>
      <div className="space-y-1 p-2">
        {error && <ErrorNote>{error}</ErrorNote>}
        {!data && !error && <Loading />}
        {data?.findings.length === 0 && <p className="p-3 text-[13px] text-muted">Nothing to flag. All clear.</p>}
        {data?.findings.slice(0, 9).map((f, i) => (
          <button key={i} onClick={() => onAsk(f.ask)} className="flex w-full gap-2.5 rounded-xl p-2.5 text-left hover:bg-surface-2">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${SEV[f.severity]}`} />
            <span className="min-w-0">
              <span className="block text-[12.5px] font-semibold leading-snug">{f.title}</span>
              <span className="mt-0.5 block text-[11.5px] leading-snug text-muted">{f.detail}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Agents() {
  const { data: roster, error } = useLive('/agents', { interval: 120000 });
  const [active, setActive] = useState('maitre');
  const [seed, setSeed] = useState(null);
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!roster) return <Loading />;
  const anyAvailable = roster.specialists.some((s) => s.available);
  const ask = (q) => { setActive('maitre'); setSeed(q); };

  return (
    <div>
      <PageHeader title="AI Agents" subtitle="Maître orchestrates seven specialist agents. Each one reads live data through the same access rules as you, so answers never include anything your role cannot see."
        right={(
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-[12px] font-semibold"><Cpu size={14} className="text-primary" />{roster.engine === 'claude' ? roster.model : 'Local reasoning engine'}</span>
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-[12px] font-semibold"><ShieldCheck size={14} className="text-ok" />Role-aware · approval for actions</span>
          </div>
        )} />
      {!anyAvailable ? (
        <div className="rounded-2xl border border-line bg-surface p-8 text-center text-sm text-muted shadow-card">Your role has no business data, so no agents are available. Ask the owner if you need access.</div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[236px_minmax(0,1fr)_280px] 2xl:grid-cols-[270px_minmax(0,1fr)_320px]">
          <div className="xl:sticky xl:top-24 xl:self-start"><Roster roster={roster} active={active} onPick={setActive} /></div>
          <div className="flex h-[calc(100vh-190px)] min-h-[520px]">
            <AgentChat roster={roster} agentId={active} seed={seed} onSeedUsed={() => setSeed(null)} />
          </div>
          <div className="xl:sticky xl:top-24 xl:self-start"><Briefing onAsk={ask} /></div>
        </div>
      )}
    </div>
  );
}
