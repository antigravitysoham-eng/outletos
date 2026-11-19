import { Fragment, useEffect, useRef, useState } from 'react';
import { Sparkles, TrendingUp, ChefHat, ScanEye, HeartHandshake, Users, ThermometerSnowflake, Siren, Send, Check, Loader2, ChevronDown, ShieldCheck, X, CornerDownRight } from 'lucide-react';
import { api, getToken } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

export const AGENT_ICONS = { Sparkles, TrendingUp, ChefHat, ScanEye, HeartHandshake, Users, ThermometerSnowflake, Siren };

export function AgentAvatar({ agent, size = 34 }) {
  const Icon = AGENT_ICONS[agent?.icon] || Sparkles;
  const maitre = !agent || agent.id === 'maitre';
  return (
    <span className={`grid shrink-0 place-items-center rounded-xl text-white ${maitre ? 'grad-primary' : ''}`}
      style={{ width: size, height: size, background: maitre ? undefined : agent.color }}>
      <Icon size={size * 0.5} strokeWidth={2.2} />
    </span>
  );
}

/** Minimal, safe markdown: ### headings, - bullets, **bold**, *italic*. Built as React nodes (no innerHTML). */
function inline(text) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0, m, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    out.push(t.startsWith('**') ? <strong key={i++} className="font-bold text-ink">{t.slice(2, -2)}</strong> : <em key={i++} className="text-muted not-italic">{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
export function Markdown({ text }) {
  const blocks = String(text || '').split(/\n{2,}/);
  return (
    <div className="space-y-2.5 text-[13.5px] leading-relaxed text-ink/90">
      {blocks.map((b, i) => {
        const lines = b.split('\n');
        if (lines[0].startsWith('### ')) {
          return (
            <Fragment key={i}>
              <h4 className="pt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">{lines[0].slice(4)}</h4>
              {lines.length > 1 && <Markdown text={lines.slice(1).join('\n')} />}
            </Fragment>
          );
        }
        // group consecutive "- " lines into one list; everything else is a paragraph line
        const groups = [];
        lines.forEach((l) => {
          const bullet = l.startsWith('- ');
          const last = groups.at(-1);
          if (last && last.bullet === bullet) last.lines.push(l); else groups.push({ bullet, lines: [l] });
        });
        return (
          <Fragment key={i}>
            {groups.map((g, k) => g.bullet
              ? <ul key={k} className="space-y-1.5">{g.lines.map((l, j) => <li key={j} className="relative pl-4 before:absolute before:left-0 before:top-[9px] before:h-1.5 before:w-1.5 before:rounded-full before:bg-primary/70">{inline(l.slice(2))}</li>)}</ul>
              : <p key={k}>{g.lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{inline(l)}</Fragment>)}</p>)}
          </Fragment>
        );
      })}
    </div>
  );
}

/** Live view of the hand-offs: Maître → specialists → tools. */
function Trace({ steps, roster, done }) {
  const [open, setOpen] = useState(!done);
  useEffect(() => { if (done) setOpen(false); }, [done]);
  const agents = Object.values(steps);
  if (!agents.length) return null;
  const byId = (id) => roster?.specialists.find((s) => s.id === id);
  return (
    <div className="mb-3 rounded-xl border border-line bg-surface-2/60">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-semibold text-muted">
        {done ? <Check size={14} className="text-ok" /> : <Loader2 size={14} className="animate-spin text-primary" />}
        <span className="flex-1">{done ? `${agents.length} agent${agents.length > 1 ? 's' : ''} worked on this` : 'Maître is briefing the team…'}</span>
        <span className="flex -space-x-1.5">{agents.slice(0, 7).map((a) => <span key={a.id} className="rounded-lg ring-2 ring-surface"><AgentAvatar agent={byId(a.id)} size={20} /></span>)}</span>
        <ChevronDown size={14} className={`transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ol className="space-y-1.5 border-t border-line px-3 py-2.5">
          {agents.map((a) => (
            <li key={a.id} className="flex items-start gap-2 text-[12px]">
              <CornerDownRight size={13} className="mt-0.5 shrink-0 text-faint" />
              <AgentAvatar agent={byId(a.id)} size={18} />
              <div className="min-w-0 flex-1">
                <span className="font-semibold">{byId(a.id)?.name ?? a.id}</span>
                {a.tools.length > 0 && <span className="ml-1.5 inline-flex flex-wrap gap-1 align-middle">{a.tools.map((t) => <code key={t} className="rounded bg-surface px-1.5 py-px font-mono text-[10.5px] text-muted ring-1 ring-line">{t}</code>)}</span>}
              </div>
              {a.status === 'done' ? <Check size={13} className="mt-0.5 text-ok" /> : a.status === 'error' ? <X size={13} className="mt-0.5 text-bad" /> : <Loader2 size={13} className="mt-0.5 animate-spin text-primary" />}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ActionCard({ action, onDone }) {
  const [state, setState] = useState('idle');
  if (action.kind !== 'ack_alerts') return null;
  const approve = async () => {
    setState('busy');
    try { for (const id of action.ids) await api(`/alerts/${id}/ack`, { method: 'POST' }); setState('done'); onDone?.(); } catch { setState('error'); }
  };
  return (
    <div className="mt-3 rounded-xl border border-warn/40 bg-warn-soft p-3.5">
      <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-warn"><ShieldCheck size={14} />Needs your approval</div>
      <p className="mt-1.5 text-[13px] font-semibold">Acknowledge {action.ids.length} alert{action.ids.length > 1 ? 's' : ''}</p>
      <ul className="mt-1 space-y-0.5 text-[12px] text-muted">{action.titles.slice(0, 5).map((t, i) => <li key={i}>· {t}</li>)}</ul>
      <div className="mt-3 flex gap-2">
        {state === 'done' ? <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ok"><Check size={15} />Acknowledged</span>
          : state === 'dismissed' ? <span className="text-[13px] text-muted">Dismissed. Nothing changed.</span>
          : <>
            <button onClick={approve} disabled={state === 'busy'} className="rounded-lg bg-primary px-3 py-1.5 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-60">{state === 'busy' ? 'Working…' : 'Approve'}</button>
            <button onClick={() => setState('dismissed')} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] font-semibold hover:bg-surface-2">Dismiss</button>
            {state === 'error' && <span className="self-center text-[12px] text-bad">Could not acknowledge. Try again.</span>}
          </>}
      </div>
    </div>
  );
}

export async function streamChat(body, onEvent) {
  const res = await fetch('/api/agents/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
  const reader = res.body.getReader(), dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (line) onEvent(JSON.parse(line)); }
  }
}

/** The chat itself; used full-page on /agents and in the drawer on every other page. */
export default function AgentChat({ roster, agentId = 'maitre', compact = false, seed, onSeedUsed }) {
  const { branch } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  const agent = agentId === 'maitre' ? roster?.maitre : roster?.specialists.find((s) => s.id === agentId);

  useEffect(() => { setMessages([]); }, [agentId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages]);
  useEffect(() => { if (seed) { send(seed); onSeedUsed?.(); } }, [seed]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send(text) {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput('');
    const history = messages.filter((m) => m.text).map((m) => ({ role: m.role, content: m.text }));
    const id = Date.now();
    setMessages((m) => [...m, { role: 'user', text: q, id: id - 1 }, { role: 'assistant', id, steps: {}, pending: true }]);
    setBusy(true);
    const patch = (fn) => setMessages((all) => all.map((m) => (m.id === id ? fn(m) : m)));
    try {
      await streamChat({ message: q, agent: agentId, history, branch }, (e) => {
        if (e.type === 'plan') patch((m) => ({ ...m, steps: { ...m.steps, ...Object.fromEntries(e.agents.filter((a) => !m.steps[a]).map((a) => [a, { id: a, status: 'queued', tools: [] }])) } }));
        if (e.type === 'step') patch((m) => {
          const cur = m.steps[e.agent] || { id: e.agent, status: 'queued', tools: [] };
          return { ...m, steps: { ...m.steps, [e.agent]: { ...cur, status: e.status === 'run' ? 'start' : e.status, tools: e.tool && !cur.tools.includes(e.tool) ? [...cur.tools, e.tool] : cur.tools } } };
        });
        if (e.type === 'notice') patch((m) => ({ ...m, notice: e.text }));
        if (e.type === 'answer') patch((m) => ({ ...m, pending: false, text: e.text, actions: e.actions, followups: e.followups, meta: e }));
      });
    } catch (err) {
      patch((m) => ({ ...m, pending: false, text: `Sorry, that failed: ${err.message}` }));
    } finally { setBusy(false); }
  }

  const suggestions = agent?.questions || [];
  return (
    <div className={`flex min-h-0 flex-1 flex-col ${compact ? '' : 'rounded-2xl border border-line bg-surface shadow-card'}`}>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        {!messages.length && (
          <div className="mx-auto flex max-w-md flex-col items-center py-6 text-center">
            <AgentAvatar agent={agent} size={54} />
            <h3 className="mt-4 text-lg font-extrabold tracking-tight">{agent?.name ?? 'Maître'}</h3>
            <p className="mt-1 text-[13px] text-muted">{agent?.blurb}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {suggestions.map((s) => <button key={s} onClick={() => send(s)} className="rounded-full border border-line bg-surface px-3 py-1.5 text-[12.5px] font-semibold hover:border-primary hover:text-primary">{s}</button>)}
            </div>
          </div>
        )}
        <div className="space-y-5">
          {messages.map((m) => m.role === 'user' ? (
            <div key={m.id} className="flex justify-end"><div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[13.5px] font-medium text-white">{m.text}</div></div>
          ) : (
            <div key={m.id} className="flex gap-3 slide-in">
              <AgentAvatar agent={agent} size={compact ? 28 : 32} />
              <div className="min-w-0 flex-1">
                <Trace steps={m.steps} roster={roster} done={!m.pending} />
                {m.notice && <p className="mb-2 text-[12px] text-warn">{m.notice}</p>}
                {m.pending && !Object.keys(m.steps).length && <p className="flex items-center gap-2 text-[13px] text-muted"><Loader2 size={14} className="animate-spin" />Thinking…</p>}
                {m.text && <Markdown text={m.text} />}
                {m.actions?.map((a, i) => <ActionCard key={i} action={a} />)}
                {m.followups?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {m.followups.map((f) => <button key={f} onClick={() => send(f)} disabled={busy} className="rounded-full bg-surface-2 px-2.5 py-1 text-[12px] font-semibold text-muted hover:text-primary disabled:opacity-50">{f}</button>)}
                  </div>
                )}
                {m.meta && <p className="mt-2.5 font-mono text-[10.5px] text-faint">{m.meta.engine === 'claude' ? roster?.model : m.meta.engine} · {m.meta.agents.length} agent{m.meta.agents.length === 1 ? '' : 's'} · {m.meta.tools.length} tool{m.meta.tools.length === 1 ? '' : 's'} · {(m.meta.ms / 1000).toFixed(1)}s</p>}
              </div>
            </div>
          ))}
        </div>
        <div ref={endRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="border-t border-line p-3">
        <div className="flex items-end gap-2 rounded-xl border border-line bg-bg px-3 py-2 focus-within:border-primary">
          <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={1} maxLength={2000}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={`Ask ${agent?.name ?? 'Maître'} anything about your restaurants…`} aria-label="Message"
            className="max-h-32 min-h-[24px] flex-1 resize-none bg-transparent text-[13.5px] outline-none placeholder:text-faint" />
          <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-white disabled:opacity-40"><Send size={15} /></button>
        </div>
        <p className="mt-1.5 px-1 text-[10.5px] text-faint">Agents only see what your role can see. Actions always wait for your approval.</p>
      </form>
    </div>
  );
}
