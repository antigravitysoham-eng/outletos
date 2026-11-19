// Telegram bot: each OutletOS user links their own private chat with a one-time code, then asks for reports, alerts and
// live status in Telegram. Every message is answered as that user: same role permissions, same branch scope, same audit
// trail as the web app. Works with long polling (no public URL needed) or a webhook (production).
import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { db, getSetting, setSetting } from './db.js';
import { principal, alertAllowed, eventVisible } from './policy.js';
import { runTool } from './agents/tools.js';
import { runChat } from './agents/engine.js';
import { subscribe } from './bus.js';
import { fmtMoney, INSTANCE } from './instance.js';

db.exec(`
CREATE TABLE IF NOT EXISTS telegram_links (chat_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, tg_username TEXT, tg_name TEXT, branch TEXT, notify INTEGER DEFAULT 1, linked_at INTEGER, last_seen INTEGER);
CREATE TABLE IF NOT EXISTS telegram_codes (code TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER);
CREATE TABLE IF NOT EXISTS telegram_log (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, chat_id TEXT, user_id TEXT, command TEXT, ok INTEGER);
`);

const CODE_TTL = 10 * 60_000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const err = (status, message) => Object.assign(new Error(message), { status });
const cfg = () => getSetting('telegram', {}) || {};
const apiBase = (c = cfg()) => String(c.api_base || process.env.TELEGRAM_API_BASE || 'https://api.telegram.org').replace(/\/$/, '');
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pct = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${Number(v).toFixed(1)}%`);
let lastError = null, polling = false, offset = 0, gen = 0; // gen: each (re)start owns one poll loop

async function tg(method, body = {}, token = cfg().token, base = apiBase()) {
  if (!token) throw err(400, 'The Telegram bot is not configured');
  const r = await fetch(`${base}/bot${token}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    signal: AbortSignal.timeout(method === 'getUpdates' ? 40_000 : 15_000),
  });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) throw err(502, `Telegram: ${j.description || `HTTP ${r.status}`}`);
  return j.result;
}
const send = (chat_id, text, extra = {}) => tg('sendMessage', { chat_id, text: text.slice(0, 4000), parse_mode: 'HTML', disable_web_page_preview: true, ...extra })
  .catch((e) => { lastError = e.message; });

// ---------- configuration (integrations.manage) ----------
const mask = (t) => (t ? `${t.slice(0, 4)}…${t.slice(-4)}` : null);
export function status(p) {
  const c = cfg();
  const mine = db.prepare('SELECT chat_id, tg_username, tg_name, branch, notify, linked_at, last_seen FROM telegram_links WHERE user_id = ?').all(p.id);
  const out = { configured: !!c.token, enabled: !!c.enabled, bot_username: c.bot_username || null, mode: c.mode || 'polling', linked: mine };
  if (p.perms.has('integrations.manage')) {
    Object.assign(out, {
      token: mask(c.token), api_base: c.api_base || null, public_url: c.public_url || null, last_error: lastError, polling,
      links: db.prepare(`SELECT l.chat_id, l.tg_username, l.tg_name, l.notify, l.linked_at, l.last_seen, u.name, u.username, u.role FROM telegram_links l JOIN users u ON u.id = l.user_id ORDER BY l.linked_at DESC`).all(),
      messages_24h: db.prepare('SELECT COUNT(*) n FROM telegram_log WHERE ts > ?').get(Date.now() - 86_400_000).n,
    });
  }
  return out;
}

export async function configure(p, body = {}) {
  if (body.clear) { await stopTransport(); setSetting('telegram', {}); db.exec('DELETE FROM telegram_links; DELETE FROM telegram_codes;'); return status(p); }
  const c = { ...cfg() };
  if (body.api_base !== undefined) c.api_base = body.api_base ? String(body.api_base).trim() : null; // self-hosted Bot API server
  if (body.token) {
    const token = String(body.token).trim();
    if (!/^\d{5,}:[A-Za-z0-9_-]{30,}$/.test(token)) throw err(400, 'That does not look like a bot token from @BotFather (123456:ABC…)');
    const me = await tg('getMe', {}, token, apiBase(c)).catch((e) => { throw err(400, `Telegram rejected the token: ${e.message.replace('Telegram: ', '')}`); });
    Object.assign(c, { token, bot_username: me.username, bot_name: me.first_name });
  }
  if (!c.token) throw err(400, 'Paste the bot token from @BotFather first');
  if (body.mode) c.mode = body.mode === 'webhook' ? 'webhook' : 'polling';
  if (body.public_url !== undefined) c.public_url = body.public_url ? String(body.public_url).trim().replace(/\/$/, '') : null;
  if (body.enabled !== undefined) c.enabled = !!body.enabled;
  // Validate before saving, so a rejected change never leaves a half-applied config behind.
  if (c.enabled && c.mode === 'webhook' && !c.public_url) throw err(400, 'Webhook mode needs the public HTTPS address of this server. On localhost, choose Long polling.');
  c.secret ||= randomBytes(16).toString('hex');
  c.header_secret ||= randomBytes(24).toString('hex');
  await stopTransport();
  setSetting('telegram', c);
  if (c.enabled) {
    if (c.mode === 'webhook') {
      await tg('setWebhook', { url: `${c.public_url}/api/telegram/webhook/${c.secret}`, secret_token: c.header_secret, allowed_updates: ['message', 'callback_query'] });
    } else { await tg('deleteWebhook', {}).catch(() => {}); startTelegram(); }
    await tg('setMyCommands', { commands: COMMANDS.map((x) => ({ command: x.cmd, description: x.desc })) }).catch(() => {});
  }
  lastError = null;
  return status(p);
}
async function stopTransport() { gen++; polling = false; }

export async function testBot(p) {
  const me = await tg('getMe');
  return { ok: true, bot_username: me.username, bot_name: me.first_name, ...status(p) };
}

// ---------- linking ----------
export function linkCode(p) {
  if (!cfg().token || !cfg().enabled) throw err(400, 'Your administrator has not switched on the Telegram bot yet');
  db.prepare('DELETE FROM telegram_codes WHERE user_id = ? OR expires_at < ?').run(p.id, Date.now());
  const code = Array.from({ length: 8 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)]).join('');
  db.prepare('INSERT INTO telegram_codes(code, user_id, expires_at) VALUES (?,?,?)').run(code, p.id, Date.now() + CODE_TTL);
  return { code, expires_at: Date.now() + CODE_TTL, bot_username: cfg().bot_username, deep_link: cfg().bot_username ? `https://t.me/${cfg().bot_username}?start=${code}` : null };
}
export function unlink(p, chatId) {
  const admin = p.perms.has('integrations.manage');
  const r = chatId
    ? db.prepare(`DELETE FROM telegram_links WHERE chat_id = ? ${admin ? '' : 'AND user_id = ?'}`).run(...(admin ? [String(chatId)] : [String(chatId), p.id]))
    : db.prepare('DELETE FROM telegram_links WHERE user_id = ?').run(p.id);
  return { ok: true, removed: r.changes };
}

// ---------- commands ----------
const COMMANDS = [
  { cmd: 'sales', desc: "Today's sales vs yesterday, by branch", perm: 'sales.view', tool: 'sales_overview' },
  { cmd: 'report', desc: 'KPI report: /report today | yesterday | 7d | 14d', any: ['sales.view', 'kitchen.view', 'vision.view', 'safety.view', 'staff.view', 'reviews.view'], tool: 'kpi_scorecard' },
  { cmd: 'forecast', desc: 'Today projection and next 7 days', perm: 'sales.view', tool: 'sales_forecast' },
  { cmd: 'alerts', desc: 'Open alerts (approve acknowledgement here)', perm: 'alerts.view', tool: 'open_alerts' },
  { cmd: 'kitchen', desc: 'Ticket times and slow stations', perm: 'kitchen.view', tool: 'kitchen_status' },
  { cmd: 'staff', desc: 'On shift, late and absent', perm: 'staff.view', tool: 'attendance_status' },
  { cmd: 'safety', desc: 'Fridges and freezers out of range', perm: 'safety.view', tool: 'cold_chain_status' },
  { cmd: 'health', desc: 'Outlet Health Score by branch', perm: 'dashboard.view', tool: 'branch_health' },
  { cmd: 'branch', desc: 'Choose a branch: /branch r1 or /branch all' },
  { cmd: 'notify', desc: 'High-alert push: /notify on | off' },
  { cmd: 'whoami', desc: 'Your role and what you can see' },
  { cmd: 'unlink', desc: 'Disconnect this chat from OutletOS' },
  { cmd: 'help', desc: 'What you can ask' },
];
const allowed = (p, c) => (c.perm ? p.perms.has(c.perm) : c.any ? c.any.some((x) => p.perms.has(x)) : true);

const FORMAT = {
  sales(d) {
    const lines = [`💰 <b>Sales today</b> · ${esc(d.scope.join(', '))} · ${esc(d.time)}`, `<b>${fmtMoney(d.today.sales)}</b> ${pct(d.change_vs_yesterday_pct)} vs ${fmtMoney(d.same_time_yesterday.sales)} at this time yesterday`,
      `${d.today.orders} orders · avg ${fmtMoney(d.today.aov)} · online ${d.today.online_share_pct}%`];
    if (d.channels?.length) lines.push('', '<b>Channels</b>', ...d.channels.slice(0, 6).map((c) => `• ${esc(c.source)}: ${fmtMoney(c.sales)} (${c.orders})`));
    if (d.branches?.length > 1) lines.push('', '<b>Branches</b>', ...d.branches.map((b) => `• ${esc(b.name)}: ${fmtMoney(b.sales)} ${pct(b.yesterday ? ((b.sales - b.yesterday) / b.yesterday) * 100 : null)}`));
    return lines.join('\n');
  },
  report(d) {
    if (d.error) return esc(d.error);
    const dot = { green: '🟢', amber: '🟠', red: '🔴', none: '⚪' };
    const off = d.kpis.filter((k) => k.status === 'red' || k.status === 'amber');
    const kris = d.kris.filter((k) => k.status !== 'green');
    return [`📊 <b>Management report · ${esc(d.period)}</b>`, `${esc(d.branches.join(', '))} · vs ${esc(d.compared_with)}`, '',
      ...d.summary.map((s) => `• ${esc(s)}`), '',
      `<b>KPIs off target (${off.length}/${d.kpis.length})</b>`, ...(off.length ? off.slice(0, 8).map((k) => `${dot[k.status]} ${esc(k.label)}`) : ['All KPIs on target ✅']),
      ...(kris.length ? ['', '<b>Risk indicators</b>', ...kris.slice(0, 6).map((k) => `${k.status === 'red' ? '🔴' : '🟠'} ${esc(k.label)}${k.breaches?.length ? ` · ${esc(k.breaches.join(', '))}` : ''}`)] : []),
      '', 'Full report: Reports & Analytics in OutletOS.'].join('\n');
  },
  forecast(f) {
    if (!f) return 'No forecast available yet: it needs a few days of sales history.';
    return [`🔮 <b>Forecast</b>`, `Today projected close: <b>${fmtMoney(f.today_projection)}</b> (${Math.round((f.chance_hit_budget_today || 0) * 100)}% chance of hitting budget)`,
      `Next 7 days: <b>${fmtMoney(f.next_7_days)}</b> (80% range ${fmtMoney(f.range[0])}–${fmtMoney(f.range[1])})${f.budget ? ` vs budget ${fmtMoney(f.budget)}` : ''}`,
      f.backtest_mape != null ? `Model error last week: ${(f.backtest_mape * 100).toFixed(1)}% MAPE` : '',
      ...(f.by_branch?.length > 1 ? ['', ...f.by_branch.map((b) => `• ${esc(b.branch)}: ${fmtMoney(b.week)}${b.gap != null ? ` (gap ${fmtMoney(b.gap)})` : ''}`)] : [])].filter((x) => x !== '').join('\n');
  },
  alerts(a) {
    if (!a.open) return '✅ No open alerts. Nice.';
    const sev = { high: '🔴', medium: '🟠', low: '🟡' };
    return [`🚨 <b>${a.open} open alerts</b> · ${a.high} high`, ...a.latest.slice(0, 8).map((x) => `${sev[x.severity] || '•'} ${esc(x.title)}\n    ${esc(x.branch)}${x.station ? ` · ${esc(x.station)}` : ''} · ${x.minutes_ago} min ago`)].join('\n');
  },
  kitchen(k) {
    return [`👨‍🍳 <b>Kitchen</b> · ${esc(k.station_filter)}`, `Last hour: ${k.last_hour.tickets_done} tickets · avg ${k.last_hour.avg_ticket_min} min · ${k.last_hour.on_time_pct ?? '—'}% on time`,
      `Open now: ${k.open_tickets}${k.oldest_open ? ` · oldest ${esc(k.oldest_open.item)} (${esc(k.oldest_open.station)}) waiting ${k.oldest_open.waiting_min} min` : ''}`,
      ...(k.slowest_dishes?.some((s) => s.over_by_pct > 0) ? ['', '<b>Running slow</b>', ...k.slowest_dishes.filter((s) => s.over_by_pct > 0).slice(0, 5).map((s) => `• ${esc(s.dish)} · ${s.avg_min} min vs ${s.target_min} (${pct(s.over_by_pct)})`)] : [])].join('\n');
  },
  staff(s) {
    const who = (r) => `${esc(r.name)} (${esc(r.role)}${r.late_min ? `, ${r.late_min} min late` : ''})`;
    return [`🧑‍🤝‍🧑 <b>Workforce</b>`, `${s.on_shift} on shift of ${s.rostered} rostered · ${s.finished} finished`,
      s.late_today.length ? `Late: ${s.late_today.slice(0, 8).map(who).join(', ')}` : 'Nobody late today',
      s.absent.length ? `Absent: ${s.absent.slice(0, 8).map(who).join(', ')}` : '', s.due_now.length ? `Due now: ${s.due_now.slice(0, 8).map(who).join(', ')}` : ''].filter(Boolean).join('\n');
  },
  safety(s) {
    return [`🌡️ <b>Cold chain</b> · ${s.in_range}/${s.sensors} in range`,
      ...(s.out_of_range_now.length ? s.out_of_range_now.map((x) => `🔴 ${esc(x.sensor)} · ${esc(x.branch)}: ${x.value}${esc(x.unit)} (safe ${esc(x.safe_range)}), ${x.minutes_out_last_2h} min out`) : ['✅ Every unit in its safe range']),
      ...(s.drifting.length ? ['', '<b>Drifting</b>', ...s.drifting.map((x) => `🟠 ${esc(x.sensor)} · ${esc(x.branch)}: ${x.minutes_out_last_2h} min out in 2h`)] : [])].join('\n');
  },
  health(h) {
    return [`❤️ <b>Outlet Health Score</b>${h.group_score != null ? ` · group ${h.group_score}` : ''}`, ...h.branches.map((b) => {
      const worst = Object.entries(b.pillars).sort((x, y) => x[1] - y[1])[0];
      return `• ${esc(b.branch)}: <b>${b.score}</b>${worst ? ` · weakest: ${esc(worst[0])}` : ''}`;
    })].join('\n');
  },
};

// Approvals proposed in a chat wait here until the same user taps Approve or Dismiss
const pending = new Map();
const proposeAck = (chatId, userId, ids) => {
  const key = randomBytes(6).toString('hex');
  pending.set(key, { chatId: String(chatId), userId, ids, exp: Date.now() + 30 * 60_000 });
  return { inline_keyboard: [[{ text: `✅ Acknowledge ${ids.length}`, callback_data: `ack:${key}` }, { text: 'Dismiss', callback_data: `no:${key}` }]] };
};

const rate = new Map();
const limited = (chatId) => { const now = Date.now(); const a = (rate.get(chatId) || []).filter((t) => now - t < 60_000); a.push(now); rate.set(chatId, a); return a.length > 20; };
const log = (chatId, userId, command, ok = 1) => db.prepare('INSERT INTO telegram_log(ts, chat_id, user_id, command, ok) VALUES (?,?,?,?,?)').run(Date.now(), String(chatId), userId || null, String(command).slice(0, 60), ok);

function principalFor(link) {
  const user = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(link.user_id);
  return user ? principal(user) : null;
}
const scopeOf = (p, link) => (link.branch && link.branch !== 'all' && p.branches.includes(link.branch) ? link.branch : undefined);
const helpText = (p) => [`Hi ${esc(p.name.split(' ')[0])}. Ask me anything about your restaurants in plain words, or use a command:`, '',
  ...COMMANDS.filter((c) => allowed(p, c)).map((c) => `/${c.cmd} · ${esc(c.desc)}`), '', `You see what your role sees in OutletOS (${esc(p.roleLabel)}).`].join('\n');

export async function handleUpdate(u) {
  if (u.callback_query) return handleCallback(u.callback_query);
  const m = u.message;
  if (!m?.chat || typeof m.text !== 'string') return;
  const chatId = String(m.chat.id), text = m.text.trim();
  if (m.chat.type !== 'private') return send(chatId, 'For privacy OutletOS only answers in a private chat with the bot. Open a direct chat with me instead.');
  if (limited(chatId)) return send(chatId, 'Slow down a little: try again in a minute.');
  const [rawCmd, ...args] = text.split(/\s+/);
  const cmd = rawCmd.startsWith('/') ? rawCmd.slice(1).split('@')[0].toLowerCase() : null;
  let link = db.prepare('SELECT * FROM telegram_links WHERE chat_id = ?').get(chatId);

  if (cmd === 'start' && args[0]) {
    const code = args[0].toUpperCase();
    const row = db.prepare('SELECT * FROM telegram_codes WHERE code = ?').get(code);
    if (!row || row.expires_at < Date.now()) { log(chatId, null, 'start:bad-code', 0); return send(chatId, 'That link code is invalid or has expired. In OutletOS open <b>Telegram</b> in the top bar to get a new one.'); }
    db.prepare('DELETE FROM telegram_codes WHERE code = ?').run(code);
    db.prepare(`INSERT INTO telegram_links(chat_id, user_id, tg_username, tg_name, branch, notify, linked_at, last_seen) VALUES (?,?,?,?,?,1,?,?)
      ON CONFLICT(chat_id) DO UPDATE SET user_id = excluded.user_id, tg_username = excluded.tg_username, tg_name = excluded.tg_name, linked_at = excluded.linked_at, branch = NULL`)
      .run(chatId, row.user_id, m.from?.username || null, [m.from?.first_name, m.from?.last_name].filter(Boolean).join(' ') || null, null, Date.now(), Date.now());
    link = db.prepare('SELECT * FROM telegram_links WHERE chat_id = ?').get(chatId);
    const p = principalFor(link);
    log(chatId, row.user_id, 'start:linked');
    return send(chatId, `✅ <b>Linked to OutletOS</b> as ${esc(p.name)} · ${esc(p.roleLabel)} · ${p.branches.length} branch${p.branches.length === 1 ? '' : 'es'}.\n\n${helpText(p)}`);
  }
  if (!link) {
    log(chatId, null, cmd || 'text:unlinked', 0);
    return send(chatId, `👋 This is the ${esc(INSTANCE.group || 'OutletOS')} assistant. To connect, open OutletOS, click <b>Telegram</b> in the top bar and follow the link, or send <code>/start YOURCODE</code> here.`);
  }
  const p = principalFor(link);
  if (!p) { db.prepare('DELETE FROM telegram_links WHERE chat_id = ?').run(chatId); return send(chatId, 'Your OutletOS account is no longer active, so this chat has been disconnected.'); }
  db.prepare('UPDATE telegram_links SET last_seen = ? WHERE chat_id = ?').run(Date.now(), chatId);
  const branch = scopeOf(p, link);

  if (cmd === 'help' || cmd === 'start') { log(chatId, p.id, 'help'); return send(chatId, helpText(p)); }
  if (cmd === 'whoami') {
    log(chatId, p.id, 'whoami');
    return send(chatId, `<b>${esc(p.name)}</b> · ${esc(p.roleLabel)}\nBranches: ${esc(p.branches.join(', '))}\nCurrent scope: ${branch || 'all your branches'}\nHigh-alert push: ${link.notify ? 'on' : 'off'}`);
  }
  if (cmd === 'unlink') { db.prepare('DELETE FROM telegram_links WHERE chat_id = ?').run(chatId); log(chatId, p.id, 'unlink'); return send(chatId, 'Disconnected. Nothing more will be sent to this chat.'); }
  if (cmd === 'notify') {
    const on = !/^off$/i.test(args[0] || 'on');
    db.prepare('UPDATE telegram_links SET notify = ? WHERE chat_id = ?').run(on ? 1 : 0, chatId); log(chatId, p.id, `notify:${on}`);
    return send(chatId, on ? '🔔 You will get high-severity alerts for your branches here.' : '🔕 Alert push is off. Ask /alerts any time.');
  }
  if (cmd === 'branch') {
    const want = (args[0] || '').toLowerCase();
    const names = db.prepare(`SELECT id, name, city FROM outlets WHERE id IN (${p.branches.map(() => '?').join(',') || "''"}) ORDER BY id`).all(...p.branches);
    if (!want) return send(chatId, ['Your branches:', ...names.map((b) => `• <code>${b.id}</code> ${esc(b.name)} · ${esc(b.city)}`), '', 'Send /branch r1 to focus on one, /branch all for everything.'].join('\n'));
    if (want !== 'all' && !p.branches.includes(want)) { log(chatId, p.id, `branch:${want}`, 0); return send(chatId, `You don't have access to "${esc(want)}". Send /branch to see yours.`); }
    db.prepare('UPDATE telegram_links SET branch = ? WHERE chat_id = ?').run(want === 'all' ? null : want, chatId); log(chatId, p.id, `branch:${want}`);
    return send(chatId, `Scope set to ${want === 'all' ? 'all your branches' : esc(names.find((b) => b.id === want)?.name || want)}.`);
  }
  const c = cmd && COMMANDS.find((x) => x.cmd === cmd && x.tool);
  if (c) {
    if (!allowed(p, c)) { log(chatId, p.id, cmd, 0); return send(chatId, `🔒 Your role (${esc(p.roleLabel)}) doesn't include /${cmd}. Send /help to see what you can ask.`); }
    const input = { branch };
    if (cmd === 'report') input.period = ['today', 'yesterday', '7d', '14d'].includes((args[0] || '').toLowerCase()) ? args[0].toLowerCase() : '7d';
    const data = runTool(p, c.tool, input);
    log(chatId, p.id, cmd);
    const extra = cmd === 'alerts' && p.perms.has('alerts.ack') && data.latest?.length ? { reply_markup: proposeAck(chatId, p.id, data.latest.slice(0, 8).map((x) => x.id)) } : {};
    return send(chatId, FORMAT[cmd](data), extra);
  }
  if (cmd) return send(chatId, `I don't know /${esc(cmd)}. Send /help for the list.`);

  // Plain question: the same AI agents as the web app, with this user's permissions
  await tg('sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => {});
  let answer = null;
  await runChat(p, { message: text.slice(0, 2000), agent: 'maitre', history: [], branch }, (e) => { if (e.type === 'answer') answer = e; });
  log(chatId, p.id, 'ask');
  const html = esc(answer?.text || 'Sorry, I could not answer that.').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^- /gm, '• ');
  const ack = (answer?.actions || []).find((a) => a.kind === 'ack_alerts');
  return send(chatId, html, ack ? { reply_markup: proposeAck(chatId, p.id, ack.ids) } : {});
}

async function handleCallback(q) {
  const [kind, key] = String(q.data || '').split(':');
  const item = pending.get(key);
  const chatId = String(q.message?.chat?.id || '');
  const done = (text) => tg('answerCallbackQuery', { callback_query_id: q.id, text }).catch(() => {});
  if (!item || item.exp < Date.now() || item.chatId !== chatId) return done('This request has expired.');
  const link = db.prepare('SELECT * FROM telegram_links WHERE chat_id = ?').get(chatId);
  const p = link && link.user_id === item.userId ? principalFor(link) : null;
  if (!p) return done('This chat is not linked any more.');
  pending.delete(key);
  if (kind !== 'ack') { await tg('editMessageReplyMarkup', { chat_id: chatId, message_id: q.message.message_id, reply_markup: { inline_keyboard: [] } }).catch(() => {}); return done('Dismissed'); }
  if (!p.perms.has('alerts.ack')) return done('Your role cannot acknowledge alerts.');
  let n = 0;
  for (const id of item.ids) {
    const a = db.prepare('SELECT * FROM alerts WHERE id = ? AND ack = 0').get(id);
    if (a && alertAllowed(p, a)) { db.prepare('UPDATE alerts SET ack = 1, ack_by = ? WHERE id = ?').run(`${p.name} (Telegram)`, id); n++; }
  }
  log(chatId, p.id, `approve:ack:${n}`);
  await tg('editMessageReplyMarkup', { chat_id: chatId, message_id: q.message.message_id, reply_markup: { inline_keyboard: [] } }).catch(() => {});
  await send(chatId, `✅ Acknowledged ${n} alert${n === 1 ? '' : 's'} as ${esc(p.name)}. Logged in the audit trail.`);
  return done(`Acknowledged ${n}`);
}

// ---------- transport ----------
export function verifyWebhook(secret, header) {
  const c = cfg();
  if (!c.enabled || c.mode !== 'webhook' || !c.secret) return false;
  const eq = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
  return eq(secret, c.secret) && eq(header, c.header_secret);
}

async function pollLoop() {
  const mine = ++gen;
  polling = true;
  while (mine === gen && cfg().enabled && cfg().mode !== 'webhook' && cfg().token) {
    try {
      const ups = await tg('getUpdates', { offset, timeout: 25, allowed_updates: ['message', 'callback_query'] });
      for (const u of ups) { offset = u.update_id + 1; await handleUpdate(u).catch((e) => { lastError = e.message; }); }
      lastError = null;
    } catch (e) { lastError = e.message; await sleep(5000); }
  }
  if (mine === gen) polling = false;
}
export function startTelegram() { const c = cfg(); if (c.enabled && c.mode !== 'webhook' && c.token) pollLoop(); }

// High-severity alerts go to every linked user who may see them (same rule as the live feed), at most 12 per hour per chat
const pushed = new Map();
subscribe((type, evt) => {
  if (type !== 'alert' || !cfg().enabled || evt.alert?.severity !== 'high') return;
  for (const link of db.prepare('SELECT * FROM telegram_links WHERE notify = 1').all()) {
    const p = principalFor(link);
    if (!p || !eventVisible(p, 'alert', evt) || !alertAllowed(p, evt.alert)) continue;
    const recent = (pushed.get(link.chat_id) || []).filter((t) => Date.now() - t < 3_600_000);
    if (recent.length >= 12) continue;
    pushed.set(link.chat_id, [...recent, Date.now()]);
    const a = evt.alert;
    const branch = db.prepare('SELECT name FROM outlets WHERE id = ?').get(a.outlet_id)?.name || a.outlet_id;
    send(link.chat_id, `🔴 <b>${esc(a.title)}</b>\n${esc(branch)}${a.station ? ` · ${esc(a.station)}` : ''}\n${esc(a.detail || '')}`,
      p.perms.has('alerts.ack') && a.id ? { reply_markup: proposeAck(link.chat_id, p.id, [a.id]) } : {});
    log(link.chat_id, p.id, 'push:alert');
  }
});
