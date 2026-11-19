// Telegram demo without a real bot: runs a local stand-in for the Telegram Bot API, points an OutletOS instance at it,
// links demo users and plays a conversation through the real webhook. Saves the bot's actual replies to
// docs/src/telegram-transcript.json (used by the Telegram Bot Guide). Leaves the bot connected to the stand-in
// while running so the UI can be explored; press Ctrl+C (or pass --once) to disconnect and exit.
//   node server/scripts/telegram-demo.mjs [baseUrl] [--once]
import { createServer } from 'node:http';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.argv[2]?.startsWith('http') ? process.argv[2] : 'http://localhost:8788';
const ONCE = process.argv.includes('--once');
const PW = process.env.DEMO_PASSWORD || 'demo1234';
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/src/telegram-transcript.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const sent = [], calls = [];
const fake = createServer((rq, rs) => {
  let b = ''; rq.on('data', (c) => { b += c; });
  rq.on('end', () => {
    const method = rq.url.split('/').pop(); const body = b ? JSON.parse(b) : {}; calls.push({ method, body });
    if (method === 'sendMessage') sent.push(body);
    const result = method === 'getMe' ? { id: 1, is_bot: true, username: 'spiceroute_ops_bot', first_name: 'Spice Route Ops' } : method === 'sendMessage' ? { message_id: sent.length } : true;
    rs.setHeader('content-type', 'application/json'); rs.end(JSON.stringify({ ok: true, result }));
  });
});
await new Promise((r) => fake.listen(0, '127.0.0.1', r));
const api_base = `http://127.0.0.1:${fake.address().port}`;

const j = async (method, path, token, body, headers = {}) => {
  const r = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  return r.json().catch(() => ({}));
};
const login = async (u) => (await j('POST', '/api/auth/login', null, { username: u, password: PW })).token;
const admin = await login('it.admin');
const cfg = await j('POST', '/api/telegram/config', admin, { token: `700000001:${'D'.repeat(35)}`, api_base, mode: 'webhook', public_url: 'https://outletos.example.test', enabled: true });
if (!cfg.bot_username) { console.error('could not configure bot:', cfg); process.exit(1); }
const sw = calls.find((c) => c.method === 'setWebhook').body;
const hook = { path: new URL(sw.url).pathname, header: sw.secret_token };

let uid = 1;
const say = async (chat, from, text) => {
  const n = sent.filter((x) => x.chat_id === String(chat) || x.chat_id === chat).length;
  await fetch(BASE + hook.path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': hook.header }, body: JSON.stringify({ update_id: uid++, message: { message_id: uid, chat: { id: chat, type: 'private' }, from: { id: chat, first_name: from, username: from.toLowerCase() }, text } }) });
  for (let i = 0; i < 80; i++) { const m = sent.filter((x) => String(x.chat_id) === String(chat)).slice(n); if (m.length) return m[m.length - 1]; await sleep(100); }
  return null;
};

const transcripts = [];
for (const [user, chat, name, script] of [
  ['owner', 81001, 'Vikram', ['/sales', '/report 7d', 'Which branch needs attention today?']],
  ['manager.r1', 81002, 'Priya', ['/kitchen', '/branch r2', '/alerts']],
  ['cook.r1', 81003, 'Ravi', ['/sales', '/kitchen']],
]) {
  const token = await login(user);
  const code = (await j('POST', '/api/telegram/link-code', token)).code;
  const turns = [];
  const link = await say(chat, name, `/start ${code}`);
  turns.push({ me: `/start ${code}`, bot: link?.text });
  for (const msg of script) { const r = await say(chat, name, msg); turns.push({ me: msg, bot: r?.text, buttons: r?.reply_markup?.inline_keyboard?.flat().map((b) => b.text) }); }
  transcripts.push({ user, name, turns });
  console.log(`✓ ${user}: ${turns.length} turns`);
}
const team = await j('GET', '/api/team', await login('owner'));
const roles = team.roles.map((r) => ({ id: r.id, label: r.label, scope: r.scope, perms: r.perms }));
writeFileSync(OUT, JSON.stringify({ bot: cfg.bot_username, base: BASE, ran: new Date().toISOString(), roles, transcripts }, null, 2));
console.log('saved', OUT);

const stop = async () => { await j('POST', '/api/telegram/config', admin, { clear: true }); fake.close(); console.log('bot disconnected'); process.exit(0); };
if (ONCE) await stop();
else { console.log(`Bot @${cfg.bot_username} is connected to a local stand-in. Explore Integrations → Telegram assistant. Ctrl+C to disconnect.`); process.on('SIGINT', stop); process.on('SIGTERM', stop); }
