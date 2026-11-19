// OutletOS Telegram Bot Guide: setup for administrators, everyday use for every role, security and troubleshooting.
// Chat examples are real replies captured by `node server/scripts/telegram-demo.mjs` (docs/src/telegram-transcript.json).
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOGO, shot, esc } from './lib.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const T = existsSync(resolve(DIR, 'telegram-transcript.json')) ? JSON.parse(readFileSync(resolve(DIR, 'telegram-transcript.json'), 'utf8')) : { roles: [], transcripts: [] };

const CMDS = [
  ['/sales', "Today's sales against the same time yesterday, channels and a branch league", ['sales.view']],
  ['/report 7d', 'Management report: KPIs off target, risk indicators, executive summary (today, yesterday, 7d, 14d)', ['sales.view', 'kitchen.view', 'vision.view', 'safety.view', 'staff.view', 'reviews.view']],
  ['/forecast', "Today's projected close with the chance of hitting budget, next 7 days with an 80% range", ['sales.view']],
  ['/alerts', 'Open alerts, newest first, with an Acknowledge button for roles that may acknowledge', ['alerts.view']],
  ['/kitchen', 'Tickets in the last hour, on-time rate, oldest open ticket, dishes running slow', ['kitchen.view']],
  ['/staff', 'On shift, late and absent people', ['staff.view']],
  ['/safety', 'Fridges and freezers out of their safe range and units drifting', ['safety.view']],
  ['/health', 'Outlet Health Score per branch and the weakest pillar', ['dashboard.view']],
  ['/branch r1', 'Focus every answer on one of your branches; /branch all to reset', []],
  ['/notify on | off', 'Turn high-severity alert push on or off for this chat', []],
  ['/whoami', 'Your role, branches and current scope', []],
  ['/unlink', 'Disconnect this chat from OutletOS', []],
  ['/help', 'Commands available to your role', []],
];
const allowedFor = (r, perms) => !perms.length || perms.some((x) => r.perms.includes(x));

// Telegram's HTML subset → safe HTML for the chat mock-ups
const tgHtml = (s) => String(s || '').split(/(<\/?b>|<\/?code>)/g).map((part) => (/^<\/?(b|code)>$/.test(part) ? part : esc(part.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&')))).join('').replace(/\n/g, '<br/>');
const chat = (t, title) => `<div class="phone"><div class="ph-top"><span class="ph-av">OS</span><div><b>@${esc(T.bot || 'your_bot')}</b><span>${esc(title)}</span></div></div><div class="ph-body">
${t.turns.map((u) => `<div class="me">${esc(u.me.replace(/^\/start \w+$/, '/start ABCD2345'))}</div><div class="bot">${tgHtml(u.bot)}${u.buttons?.length ? `<div class="btns">${u.buttons.map((b) => `<span>${esc(b)}</span>`).join('')}</div>` : ''}</div>`).join('')}</div></div>`;
const trans = (user) => T.transcripts.find((x) => x.user === user);

export function telegramDoc() {
  const roles = T.roles.filter((r) => r.id !== 'it_admin');
  const owner = trans('owner'), mgr = trans('manager.r1'), cook = trans('cook.r1');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>OutletOS Telegram Bot Guide</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet"/>
<style>
:root{--ink:#16100F;--ink2:#4A4044;--ink3:#7A6F72;--rule:#ECE3E0;--soft:#FBF3F1;--crimson:#D92D3A;--tg:#229ED9;--tgs:#E8F5FC;--ok:#12805C;--okb:#E3F5EC;--bad:#B42318;--badb:#FDE8E7}
*{box-sizing:border-box}body{margin:0;font-family:'Plus Jakarta Sans',sans-serif;color:var(--ink);background:#fff;font-size:10.2pt;line-height:1.55}
.cover{background:radial-gradient(110% 80% at 90% 0%,#4FC3F7 0%,transparent 50%),linear-gradient(150deg,#229ED9 0%,#1B6FA8 45%,#7A1A22 100%);color:#fff;padding:18mm 16mm;min-height:150mm;display:flex;flex-direction:column;page-break-after:always}
.cover .top{display:flex;gap:10px;align-items:center;font-weight:800;font-size:15pt}.cover svg{width:32px;height:32px}
.cover h1{font-size:44pt;letter-spacing:-.04em;line-height:.98;margin:auto 0 5mm}.cover p{opacity:.92;max-width:150mm;font-size:12.5pt;margin:0}.cover .meta{margin-top:8mm;font-size:9pt;opacity:.8}
.wrap{padding:8mm 16mm}h2{font-size:19pt;letter-spacing:-.025em;margin:10mm 0 2mm;page-break-after:avoid}h2 small{display:block;font-size:8pt;letter-spacing:.16em;text-transform:uppercase;color:var(--tg);font-family:'JetBrains Mono',monospace;margin-bottom:1mm}
h3{font-size:12.5pt;margin:6mm 0 2mm;page-break-after:avoid}p{margin:1.5mm 0}.lead{font-size:11pt;color:var(--ink2)}
.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:4mm;margin:5mm 0}.tiles div{border:1px solid var(--rule);border-radius:12px;padding:4mm;background:var(--tgs)}.tiles b{display:block;font-size:20pt;letter-spacing:-.02em;color:#0E5E8A}.tiles span{font-size:8.5pt;color:var(--ink2)}
.flow{display:flex;align-items:stretch;gap:2mm;margin:4mm 0;flex-wrap:nowrap}.flow div{flex:1;border:1px solid var(--rule);border-radius:10px;padding:3mm;background:#fff;font-size:8.4pt}.flow b{display:block;font-size:9.2pt;margin-bottom:.6mm}.flow i{align-self:center;color:var(--tg);font-style:normal;font-weight:800}
.steps{counter-reset:s;list-style:none;padding:0;margin:3mm 0}.steps>li{counter-increment:s;position:relative;padding:0 0 4mm 12mm;page-break-inside:avoid}.steps>li:before{content:counter(s);position:absolute;left:0;top:0;width:8mm;height:8mm;border-radius:50%;background:var(--tg);color:#fff;font-weight:800;display:grid;place-items:center;font-size:10pt}
.steps>li b.t{display:block;font-size:11pt;margin-bottom:.5mm}
code{font-family:'JetBrains Mono',monospace;font-size:8.6pt;background:var(--soft);padding:.3mm 1.4mm;border-radius:4px}
table{width:100%;border-collapse:separate;border-spacing:0;border:1px solid var(--rule);border-radius:10px;overflow:hidden;font-size:8.8pt;margin:2mm 0 3mm;page-break-inside:auto}
th{background:var(--tgs);color:#0E5E8A;text-align:left;font-family:'JetBrains Mono',monospace;font-size:6.8pt;letter-spacing:.12em;text-transform:uppercase;padding:2.2mm 3mm}td{padding:2mm 3mm;border-top:1px solid var(--rule);vertical-align:top}tr{page-break-inside:avoid}
td.c{text-align:center}.y{color:var(--ok);font-weight:800}.n{color:#C9BFC1}
.shot{border:1px solid var(--rule);border-radius:12px;overflow:hidden;margin:3mm 0;page-break-inside:avoid}.shot img{display:block;width:100%}.shot figcaption{font-size:8.4pt;color:var(--ink3);padding:2mm 3mm;background:var(--soft)}
.chats{display:grid;grid-template-columns:1fr 1fr;gap:5mm;margin:3mm 0}.phone{border:1px solid #D7E6EF;border-radius:18px;overflow:hidden;background:#DCE9F2;page-break-inside:avoid;font-size:8.3pt}
.ph-top{display:flex;gap:2.5mm;align-items:center;background:var(--tg);color:#fff;padding:3mm}.ph-top b{display:block;font-size:9pt}.ph-top span{font-size:7.6pt;opacity:.85}.ph-av{width:8mm;height:8mm;border-radius:50%;background:#fff;color:var(--tg);display:grid!important;place-items:center;font-weight:800;font-size:8pt;opacity:1!important}
.ph-body{padding:3mm;display:flex;flex-direction:column;gap:2mm}.me{align-self:flex-end;background:#EFFDDE;border-radius:10px 10px 2px 10px;padding:1.6mm 2.6mm;font-family:'JetBrains Mono',monospace;font-size:7.8pt;max-width:85%}
.bot{align-self:flex-start;background:#fff;border-radius:10px 10px 10px 2px;padding:2.2mm 2.8mm;max-width:94%;line-height:1.45}.bot code{font-size:7.6pt}.btns{display:flex;gap:1.5mm;margin-top:2mm}.btns span{flex:1;text-align:center;background:var(--tgs);color:#0E5E8A;font-weight:700;border-radius:6px;padding:1.2mm}
.note{border-left:3px solid var(--tg);background:var(--tgs);padding:3mm 4mm;border-radius:0 10px 10px 0;margin:3mm 0;font-size:9.3pt}.warn{border-color:#F79009;background:#FEF3E2}
.two{display:grid;grid-template-columns:1fr 1fr;gap:5mm}.card{border:1px solid var(--rule);border-radius:12px;padding:4mm}.card b{display:block;margin-bottom:1mm}
ul{margin:1mm 0 0 4mm;padding:0}li{margin:.8mm 0}.pb{page-break-before:always}
@page{size:A4;margin:10mm 0}@media print{.cover{min-height:257mm}}
</style></head><body>
<section class="cover"><div class="top">${LOGO} OutletOS</div>
<h1>Telegram<br/>Bot Guide</h1>
<p>Ask OutletOS for sales, reports, alerts and live kitchen status from Telegram. Every person links their own chat, and every answer follows their role and branches, exactly as in the web app.</p>
<div class="meta">Version 2.1 · November 2026 · For owners, managers, chefs, hosts and IT administrators</div></section>

<div class="wrap">
<div class="tiles"><div><b>${CMDS.length}</b><span>commands, plus plain-language questions</span></div><div><b>${T.roles.length || 9}</b><span>roles, each sees only its own data</span></div><div><b>2 min</b><span>to link a chat with a one-time code</span></div><div><b>16</b><span>automated tests on every release</span></div></div>

<h2><small>Overview</small>How it works</h2>
<p class="lead">The bot is a second front door to the same OutletOS server. It never has its own copy of your data and never decides access on its own.</p>
<div class="flow"><div><b>You</b>Send /sales or a question in a private chat</div><i>→</i><div><b>Telegram</b>Delivers it to your bot</div><i>→</i><div><b>OutletOS</b>Finds the person linked to this chat</div><i>→</i><div><b>Access check</b>Role permissions and branch scope, per message</div><i>→</i><div><b>Answer</b>Same tools and AI agents as the web app</div></div>
<div class="two"><div class="card"><b>What people use it for</b><ul><li>Owners: the day's numbers between meetings, the weekly report on a Monday morning.</li><li>Branch managers: alerts and kitchen speed during service, acknowledging from the floor.</li><li>Chefs: their station's ticket times, cold-chain warnings.</li></ul></div>
<div class="card"><b>What it will not do</b><ul><li>Answer in group chats (refused for privacy).</li><li>Show anything the person cannot see in the web app.</li><li>Change data without an explicit Approve tap.</li><li>Work for people whose OutletOS account is deactivated.</li></ul></div></div>

<h2 class="pb"><small>Part A · Administrators</small>Set up the bot (10 minutes)</h2>
<p>Done once by the owner or IT administrator (anyone with the <code>integrations.manage</code> permission).</p>
<ol class="steps">
<li><b class="t">Create the bot in Telegram</b>Open a chat with <b>@BotFather</b> (the official bot with the blue tick). Send <code>/newbot</code>, choose a display name (for example “Spice Route Ops”) and a username ending in <code>bot</code> (for example <code>spiceroute_ops_bot</code>). BotFather replies with a token like <code>123456789:AAH…</code>. Treat it like a password.
<div class="note">Optional polish in BotFather: <code>/setuserpic</code> for your logo, <code>/setdescription</code> for the text people see before they press Start, <code>/setjoingroups</code> → Disable so the bot cannot be added to groups.</div></li>
<li><b class="t">Connect it in OutletOS</b>Go to <b>Administration → Integrations → Telegram assistant</b>. Paste the token, choose how messages arrive (next step) and click <b>Connect bot</b>. OutletOS checks the token with Telegram, registers the command menu and shows <b>Live · @yourbot</b>.
<figure class="shot"><img src="${shot('45-telegram-admin.jpg')}" alt="Telegram assistant card on the Integrations page"/><figcaption>Integrations → Telegram assistant: token (stored on the server, shown masked), delivery mode, and the people who have linked their chats.</figcaption></figure></li>
<li><b class="t">Choose long polling or webhook</b>
<table><thead><tr><th>Mode</th><th>Use when</th><th>What you need</th></tr></thead><tbody>
<tr><td><b>Long polling</b> (default)</td><td>One server, pilots, servers behind a firewall or on a private network</td><td>Outbound internet access to api.telegram.org. Nothing to open inbound.</td></tr>
<tr><td><b>Webhook</b></td><td>Production, several servers behind a load balancer</td><td>A public HTTPS address for OutletOS (for example https://ops.yourcompany.com). OutletOS registers <code>/api/telegram/webhook/&lt;secret&gt;</code> with a second secret header, so forged calls are rejected.</td></tr>
</tbody></table></li>
<li><b class="t">Tell your team</b>Ask people to click <b>Telegram</b> in the OutletOS top bar and follow the three steps (Part B). They appear under <b>Linked people</b> as they connect.</li>
</ol>
<h3>Day-to-day administration</h3>
<table><thead><tr><th>Task</th><th>How</th></tr></thead><tbody>
<tr><td>Disconnect a person</td><td>Integrations → Telegram assistant → the unlink icon next to their name. Deactivating their OutletOS account also disconnects them automatically on their next message.</td></tr>
<tr><td>Pause the bot</td><td><b>Pause</b> stops answering everyone; links are kept. <b>Save &amp; reconnect</b> resumes.</td></tr>
<tr><td>Rotate the token</td><td>In BotFather send <code>/revoke</code>, pick the bot, then paste the new token and click <b>Save &amp; reconnect</b>. Links survive the rotation.</td></tr>
<tr><td>See usage</td><td>The card shows requests in the last 24 hours and each person's last activity. Every command is written to the <code>telegram_log</code> table; AI answers are also in the agent run log.</td></tr>
</tbody></table>

<h2 class="pb"><small>Part B · Everyone</small>Link your chat (2 minutes)</h2>
<div class="two"><div>
<ol class="steps">
<li><b class="t">Open the Telegram window</b>Click <b>Telegram</b> in the OutletOS top bar. (No button? Your administrator has not switched the bot on yet.)</li>
<li><b class="t">Open the bot</b>Tap <b>Open @yourbot</b>: on a phone it opens Telegram straight into the chat. Tap <b>Start</b>.</li>
<li><b class="t">Or send the code</b>On another device, send <code>/start ABCD2345</code> with the code shown. Codes work once and expire after 10 minutes.</li>
<li><b class="t">Done</b>The window turns green and the bot greets you with your name, role and the commands you can use.</li>
</ol>
<div class="note">Change phones or Telegram accounts? Click <b>Disconnect Telegram</b> in the same window, then link again.</div>
</div><figure class="shot" style="margin:0"><img src="${shot('46-telegram-connect.jpg')}" alt="Connect Telegram window"/><figcaption>The Telegram window: open the bot, or send the one-time code. Commands outside your role are greyed out.</figcaption></figure></div>

<h3>Commands</h3>
<table><thead><tr><th>Command</th><th>What you get</th></tr></thead><tbody>
${CMDS.map(([c, d]) => `<tr><td><code>${esc(c)}</code></td><td>${esc(d)}</td></tr>`).join('')}
</tbody></table>
<p>Anything else you type is answered by the same AI agents as <b>Ask Maître</b> in the web app, for example “Which branch needs attention today?” or “Why is food cost up this week?”.</p>

<h2 class="pb"><small>Examples</small>Real conversations</h2>
<p>Captured from the India demo with each role. Notice how the same bot answers differently depending on who is asking.</p>
<div class="chats">${owner ? chat({ turns: owner.turns.slice(1, 3) }, 'Vikram · Owner · 6 branches') : ''}${mgr ? chat({ turns: mgr.turns.slice(1) }, 'Priya · Branch Manager · Restaurant 1') : ''}</div>
<div class="chats">${cook ? chat({ turns: cook.turns }, 'Ravi · Line Cook · Tandoor station') : ''}${owner ? chat({ turns: owner.turns.slice(3) }, 'Vikram · plain-language question') : ''}</div>

<h2 class="pb"><small>Access</small>What each role can ask</h2>
<p>Generated from the live role definitions. A tick means the command works for that role; otherwise the bot explains that the role does not include it. Branch scope applies on top: a branch manager only ever sees their own branch.</p>
<table><thead><tr><th>Command</th>${roles.map((r) => `<th style="text-align:center">${esc(r.label)}</th>`).join('')}</tr></thead><tbody>
${CMDS.filter((c) => c[2].length).map(([c, , perms]) => `<tr><td><code>${esc(c.split(' ')[0])}</code></td>${roles.map((r) => `<td class="c">${allowedFor(r, perms) ? '<span class="y">✓</span>' : '<span class="n">–</span>'}</td>`).join('')}</tr>`).join('')}
<tr><td>Acknowledge alerts</td>${roles.map((r) => `<td class="c">${r.perms.includes('alerts.ack') ? '<span class="y">✓</span>' : '<span class="n">–</span>'}</td>`).join('')}</tr>
</tbody></table>
<p style="font-size:8.6pt;color:var(--ink3)">The IT / Integrations role sets the bot up but has no operational data access, so it only gets /help, /whoami and /unlink.</p>

<h3>Approvals</h3>
<p>The bot never changes data on its own. When you ask for /alerts (or ask the agent to clear alerts), it shows <b>✅ Acknowledge</b> and <b>Dismiss</b> buttons. Tapping Acknowledge checks your permission again, acknowledges only alerts you may see, records “Your name (Telegram)” on each alert and confirms how many were cleared. Buttons expire after 30 minutes and only work in the chat they were sent to.</p>
<h3>Push alerts</h3>
<p>High-severity alerts (for example a walk-in door left open, a freezer out of range, a station unattended) are pushed to linked people who can see that alert, with an Acknowledge button. At most 12 pushes per person per hour. Send <code>/notify off</code> to stop them, <code>/notify on</code> to resume.</p>

<h2 class="pb"><small>Trust</small>Security and privacy</h2>
<table><thead><tr><th>Control</th><th>How it works</th></tr></thead><tbody>
<tr><td>Identity</td><td>A chat is linked to one OutletOS user with a single-use code that expires in 10 minutes. Codes are 8 characters from a 32-character alphabet (about 10<sup>12</sup> combinations).</td></tr>
<tr><td>Authorisation</td><td>Every message re-loads the user and their role. Permissions, branch scope and station filters are the same code paths as the web app and API.</td></tr>
<tr><td>Deactivation</td><td>A deactivated user's chat is disconnected on its next message and receives nothing further.</td></tr>
<tr><td>Private chats only</td><td>Group and channel messages are refused, so numbers never land in a shared group by accident.</td></tr>
<tr><td>Token</td><td>Stored on the OutletOS server, never returned to the browser in full (shown masked). Rotate with BotFather <code>/revoke</code>.</td></tr>
<tr><td>Webhook protection</td><td>A secret URL path and Telegram's secret-token header are both checked with constant-time comparison.</td></tr>
<tr><td>Abuse limits</td><td>20 messages per minute per chat; 12 push alerts per hour per chat.</td></tr>
<tr><td>Audit</td><td>Every command, link, unlink and approval is logged with time, chat and user.</td></tr>
</tbody></table>
<div class="note warn"><b>Know what leaves your server.</b> Bot messages travel through Telegram's servers and, unlike Telegram secret chats, are not end-to-end encrypted. Answers contain the same business figures people see in the app (sales, alerts, rosters). Pay rates and guest phone numbers are only included for roles allowed to see them in OutletOS. If your policy forbids business data on third-party messengers, leave the bot switched off: OutletOS works fully without it.</div>

<h2><small>Help</small>Troubleshooting</h2>
<table><thead><tr><th>Symptom</th><th>Cause and fix</th></tr></thead><tbody>
<tr><td>No Telegram button in the top bar</td><td>The bot is not connected or is paused. An administrator connects it in Integrations.</td></tr>
<tr><td>“That link code is invalid or has expired”</td><td>Codes work once, for 10 minutes. Open the Telegram window again for a fresh code.</td></tr>
<tr><td>“This chat isn't linked”</td><td>The chat was disconnected (by you, an administrator, or because your account was deactivated). Link again.</td></tr>
<tr><td>“Your role doesn't include /sales”</td><td>Working as designed: the command needs a permission your role does not have. Ask your owner if you need it.</td></tr>
<tr><td>“Webhook mode needs the public HTTPS address of this server”</td><td>You chose <b>Webhook</b> without a public address. On a laptop or any server without a public HTTPS name, choose <b>Long polling</b> and click Connect again. Nothing is saved until the setup is valid.</td></tr>
<tr><td>Bot does not answer at all</td><td>Check the card on Integrations for <b>Last error</b>. In polling mode the server needs outbound access to api.telegram.org; in webhook mode the public address must be HTTPS and reachable.</td></tr>
<tr><td>“For privacy OutletOS only answers in a private chat”</td><td>You messaged it from a group. Open a direct chat with the bot.</td></tr>
</tbody></table>

<h2><small>Reference</small>For developers</h2>
<table><tbody>
<tr><td>Server module</td><td><code>server/src/telegram.js</code>: linking, commands, approvals, push, polling and webhook transport</td></tr>
<tr><td>API</td><td><code>GET /api/telegram/status</code> · <code>POST /api/telegram/link-code</code> · <code>DELETE /api/telegram/link</code> · admin: <code>POST /api/telegram/config</code>, <code>POST /api/telegram/test</code>, <code>DELETE /api/telegram/links/:chat</code> · Telegram: <code>POST /api/telegram/webhook/:secret</code></td></tr>
<tr><td>Tables</td><td><code>telegram_links</code>, <code>telegram_codes</code>, <code>telegram_log</code></td></tr>
<tr><td>Self-hosted Bot API</td><td>Set <code>api_base</code> in the config call or the <code>TELEGRAM_API_BASE</code> environment variable</td></tr>
<tr><td>Tests</td><td>TG01–TG16 in <code>server/scripts/e2e.mjs</code> run against a local stand-in for the Bot API, so no real bot or internet is needed</td></tr>
<tr><td>Demo</td><td><code>node server/scripts/telegram-demo.mjs</code> connects the instance to a local stand-in, links three demo users, records a conversation and leaves the UI explorable until Ctrl+C</td></tr>
</tbody></table>
<p style="margin-top:8mm;color:var(--ink3);font-size:8pt">OutletOS Telegram Bot Guide · generated ${new Date().toISOString().slice(0, 10)} · source <code>docs/src/telegram.mjs</code></p>
</div></body></html>`;
}
