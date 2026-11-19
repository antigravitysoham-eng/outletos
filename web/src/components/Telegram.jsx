import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Send, Check, Copy, X, Unlink, Bot, ShieldCheck, RefreshCw, Smartphone, Webhook, Radio } from 'lucide-react';
import { api, ago } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Card, Badge, Button } from './ui.jsx';

const COMMANDS = [
  ['/sales', "Today's sales vs yesterday", 'sales.view'], ['/report 7d', 'KPI report: today, yesterday, 7d, 14d', null], ['/forecast', 'Today projection and next 7 days', 'sales.view'],
  ['/alerts', 'Open alerts, approve acknowledgement', 'alerts.view'], ['/kitchen', 'Ticket times, slow stations', 'kitchen.view'], ['/staff', 'On shift, late, absent', 'staff.view'],
  ['/safety', 'Fridges and freezers out of range', 'safety.view'], ['/health', 'Outlet Health Score', 'dashboard.view'], ['/branch r1', 'Focus on one branch', null],
];

/** Top-bar button: lets any signed-in user link their own Telegram chat (only shown once an admin has switched the bot on). */
export function TelegramButton() {
  const [st, setSt] = useState(null);
  const [open, setOpen] = useState(false);
  const load = () => api('/telegram/status').then(setSt).catch(() => setSt(null));
  useEffect(() => { load(); }, []);
  if (!st?.configured || !st.enabled) return null;
  const linked = st.linked.length > 0;
  return (
    <>
      <button onClick={() => setOpen(true)} className="relative hidden items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold hover:bg-surface-2 sm:inline-flex" title="Telegram assistant">
        <Send size={15} className="text-[#229ED9]" />Telegram{linked && <span className="h-2 w-2 rounded-full bg-ok" aria-label="linked" />}
      </button>
      {open && createPortal(<TelegramConnect st={st} onClose={() => { setOpen(false); load(); }} />, document.body) /* portal: the blurred top bar would trap a fixed dialog */}
    </>
  );
}

function TelegramConnect({ st, onClose }) {
  const { can } = useAuth();
  const [code, setCode] = useState(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState(null);
  const [linked, setLinked] = useState(st.linked);
  const [left, setLeft] = useState(0);
  const getCode = async () => { setErr(null); try { setCode(await api('/telegram/link-code', { method: 'POST' })); } catch (e) { setErr(e.message); } };
  useEffect(() => { if (!linked.length) getCode(); }, []);
  useEffect(() => { if (!code) return; const t = setInterval(() => setLeft(Math.max(0, Math.round((code.expires_at - Date.now()) / 1000))), 1000); return () => clearInterval(t); }, [code]);
  // While the code is showing, watch for the link to complete
  useEffect(() => { if (!code || linked.length) return; const t = setInterval(async () => { const s = await api('/telegram/status').catch(() => null); if (s?.linked.length) { setLinked(s.linked); setCode(null); } }, 3000); return () => clearInterval(t); }, [code, linked.length]);
  const unlinkAll = async () => { await api('/telegram/link', { method: 'DELETE' }); setLinked([]); getCode(); };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label="Connect Telegram">
      <div className="fade-in absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-surface shadow-xl">
        <div className="flex items-center gap-3 bg-[#229ED9] px-5 py-4 text-white">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-white/20"><Send size={19} /></span>
          <div className="min-w-0 flex-1"><div className="font-bold">OutletOS on Telegram</div><div className="truncate text-xs text-white/80">@{st.bot_username} · answers with your role's access only</div></div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/15" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="p-5">
          {linked.length ? (
            <>
              <div className="flex items-center gap-2 rounded-xl bg-ok-soft px-3 py-2.5 text-sm font-semibold text-ok"><Check size={16} />Linked{linked[0].tg_username ? ` to @${linked[0].tg_username}` : ''} · {ago(linked[0].linked_at)}</div>
              <p className="mt-3 text-sm text-muted">Open the chat and ask in plain words, or use a command:</p>
            </>
          ) : (
            <>
              <ol className="space-y-3 text-sm">
                <li className="flex gap-3"><Step n={1} /><div>Open the bot on your phone or desktop{code?.deep_link && <a href={code.deep_link} target="_blank" rel="noreferrer" className="mt-2 flex w-fit items-center gap-2 rounded-xl bg-[#229ED9] px-3.5 py-2 text-sm font-semibold text-white hover:opacity-90"><Smartphone size={15} />Open @{st.bot_username}</a>}</div></li>
                <li className="flex gap-3"><Step n={2} /><div className="min-w-0 flex-1">Tap <b>Start</b>, or send this code:
                  {code && <div className="mt-2 flex items-center gap-2"><code className="rounded-lg bg-surface-2 px-3 py-2 font-mono text-base font-bold tracking-[.2em]">/start {code.code}</code>
                    <button onClick={() => { navigator.clipboard?.writeText(`/start ${code.code}`); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="rounded-lg p-2 text-muted hover:bg-surface-2" aria-label="Copy">{copied ? <Check size={15} className="text-ok" /> : <Copy size={15} />}</button></div>}
                  {code && <div className="mt-1 text-xs text-muted">{left > 0 ? `Expires in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} · single use` : <button onClick={getCode} className="inline-flex items-center gap-1 font-semibold text-primary"><RefreshCw size={12} />Get a new code</button>}</div>}
                </div></li>
                <li className="flex gap-3"><Step n={3} /><div>This window confirms as soon as the bot links your chat.</div></li>
              </ol>
              {err && <div className="mt-3 rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">{err}</div>}
            </>
          )}
          <div className="mt-4 grid gap-1.5 rounded-xl border border-line p-3">
            {COMMANDS.map(([c, d, perm]) => (
              <div key={c} className={`flex items-center justify-between gap-3 text-[12.5px] ${perm && !can(perm) ? 'opacity-40' : ''}`}><code className="font-mono font-semibold">{c}</code><span className="truncate text-right text-muted">{perm && !can(perm) ? 'not in your role' : d}</span></div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11.5px] text-muted"><ShieldCheck size={13} className="shrink-0 text-ok" />Private chats only. Every request is checked against your role and logged.</div>
          {linked.length > 0 && <Button onClick={unlinkAll} className="mt-4 w-full justify-center"><Unlink size={14} />Disconnect Telegram</Button>}
        </div>
      </div>
    </div>
  );
}
const Step = ({ n }) => <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary">{n}</span>;

/** Integrations page: connect the bot (IT admin / owner). */
export function TelegramAdmin() {
  const [st, setSt] = useState(null);
  const [form, setForm] = useState({ token: '', mode: 'polling', public_url: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const load = () => api('/telegram/status').then((s) => { setSt(s); setForm((f) => ({ ...f, mode: s.mode || 'polling', public_url: s.public_url || '' })); });
  useEffect(() => { load(); }, []);
  const save = async (extra = {}) => {
    setBusy(true); setMsg(null);
    try { const s = await api('/telegram/config', { method: 'POST', body: { ...(form.token ? { token: form.token } : {}), mode: form.mode, public_url: form.public_url || null, enabled: true, ...extra } }); setSt(s); setForm((f) => ({ ...f, token: '' })); setMsg({ ok: true, text: extra.enabled === false ? 'Bot paused.' : `Connected to @${s.bot_username}.` }); }
    catch (e) { setMsg({ ok: false, text: e.message }); }
    setBusy(false);
  };
  const remove = async (chat) => { await api(`/telegram/links/${encodeURIComponent(chat)}`, { method: 'DELETE' }); load(); };
  if (!st) return null;
  const on = st.configured && st.enabled;
  return (
    <Card className="mt-4" title={<span className="inline-flex items-center gap-2"><Send size={16} className="text-[#229ED9]" />Telegram assistant</span>}
      subtitle="Your team asks for sales, reports, alerts and live status in Telegram. Each person links their own chat; answers follow their role and branches."
      action={on ? <Badge tone="ok">Live · @{st.bot_username}</Badge> : st.configured ? <Badge tone="warn">Paused</Badge> : <Badge>Not connected</Badge>}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div>
          <ol className="mb-4 space-y-2 text-[13px] text-muted">
            <li><b className="text-ink">1.</b> In Telegram, open <b className="text-ink">@BotFather</b>, send <code className="rounded bg-surface-2 px-1">/newbot</code>, pick a name and a username ending in “bot”.</li>
            <li><b className="text-ink">2.</b> Paste the token it gives you below and choose how messages arrive.</li>
            <li><b className="text-ink">3.</b> Each person clicks <b className="text-ink">Telegram</b> in the top bar to link their chat.</li>
          </ol>
          <label className="grid gap-1.5 text-[12.5px] font-semibold">Bot token
            <input type="password" autoComplete="off" value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })} placeholder={st.token ? `Saved (${st.token}) · paste to replace` : '123456789:AA…'} className="h-[42px] rounded-xl border border-line bg-surface px-3.5 font-mono text-sm outline-none focus:border-primary" />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[['polling', Radio, 'Long polling', 'No public address needed. Best for a single server.'], ['webhook', Webhook, 'Webhook', 'Telegram calls your HTTPS address. Best for production.']].map(([id, I, l, d]) => (
              <button key={id} type="button" onClick={() => setForm({ ...form, mode: id })} className={`rounded-xl border p-3 text-left transition ${form.mode === id ? 'border-primary bg-primary-soft' : 'border-line hover:bg-surface-2'}`}>
                <div className="flex items-center gap-2 text-[13px] font-bold"><I size={14} />{l}</div><div className="mt-0.5 text-[11.5px] text-muted">{d}</div>
              </button>
            ))}
          </div>
          {form.mode === 'webhook' && <input value={form.public_url} onChange={(e) => setForm({ ...form, public_url: e.target.value })} placeholder="https://outletos.yourcompany.com" className="mt-2 h-[42px] w-full rounded-xl border border-line bg-surface px-3.5 text-sm outline-none focus:border-primary" />}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={() => save()} disabled={busy || (!form.token && !st.configured)}><Bot size={14} />{st.configured ? 'Save & reconnect' : 'Connect bot'}</Button>
            {on && <Button onClick={() => save({ enabled: false })} disabled={busy}>Pause</Button>}
            {msg && <span className={`text-sm ${msg.ok ? 'text-ok' : 'text-bad'}`}>{msg.text}</span>}
          </div>
          {st.last_error && <div className="mt-2 text-xs text-bad">Last error: {st.last_error}</div>}
          <p className="mt-3 text-[11.5px] text-muted">The token stays on this server and is never shown again. Only private chats are answered; group chats are refused. Sends nothing to Telegram until people link their own chat.</p>
        </div>
        <div className="min-w-0">
          <div className="mb-2 flex items-center justify-between text-[11px] font-bold tracking-widest text-muted uppercase"><span>Linked people · {st.links?.length || 0}</span><span className="normal-case tracking-normal">{st.messages_24h || 0} requests in 24h</span></div>
          {st.links?.length ? (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {st.links.map((l) => (
                <li key={l.chat_id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#229ED9]/15 text-[#229ED9]"><Send size={14} /></span>
                  <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-semibold">{l.name} <span className="font-normal text-muted">· {l.role.replace('_', ' ')}</span></div><div className="truncate text-[11.5px] text-muted">{l.tg_username ? `@${l.tg_username} · ` : ''}last active {ago(l.last_seen)}{l.notify ? ' · alerts on' : ''}</div></div>
                  <button onClick={() => remove(l.chat_id)} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-bad" aria-label={`Disconnect ${l.name}`}><Unlink size={15} /></button>
                </li>
              ))}
            </ul>
          ) : <div className="grid h-32 place-items-center rounded-xl border border-dashed border-line text-center text-sm text-muted">Nobody has linked a chat yet.</div>}
        </div>
      </div>
    </Card>
  );
}
