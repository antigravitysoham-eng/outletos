// OutletOS Test Plan & Results: automated results are read from docs/test-results-*.json, written by
// `node server/scripts/e2e.mjs` (main suite) and `node server/scripts/e2e.mjs <new-workspace-url> --onboarding`.
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOGO } from './lib.mjs';

const DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const load = (n) => { const f = resolve(DIR, `test-results-${n}.json`); return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null; };
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Browser (UI) scenarios. "Passed" only where actually executed in a browser during this release.
const MANUAL = [
  ['U01', 'Onboarding', 'New workspace: sign-up → 9 steps → launch with sample activity (India, 3 outlets, 92 tables)', 'Passed'],
  ['U02', 'Onboarding', 'Country change re-configures currency, tax, IDs and the live receipt (India → lakh format, CGST/SGST, FSSAI)', 'Passed'],
  ['U03', 'Onboarding', 'GSTIN format validation shows a green shield; missing IDs flagged "to complete"', 'Passed'],
  ['U04', 'Onboarding', 'Floor plan templates and "generate from seats" redraw the live preview per outlet', 'Passed'],
  ['U05', 'Onboarding', 'Close the tab mid-setup and reopen: resumes at the same step with data', 'Passed (API + UI reload)'],
  ['U06', 'Navigation', 'Sidebar groups fold and unfold; state remembered after reload', 'Passed'],
  ['U07', 'Navigation', 'Collapse to icon rail and back: width glides, labels fade, groups animate open and shut; label flyout on hover and focus', 'Passed'],
  ['U08', 'Navigation', 'Pages for disabled modules are hidden from the menu (new tenant)', 'Passed (API: modules gating)'],
  ['U09', 'POS', 'Open table → add dishes → GST lines and rupee round-off update → Send KOT modal by station', 'Passed'],
  ['U10', 'POS', 'Discount, NC and void reason pickers; settle with split tender; bill slip preview', 'Passed (void reason picker, UPI settle, numbered GST invoice)'],
  ['U11', 'Reports', 'Cover, executive summary, KPI scorecard, KRIs, comparisons, forecast and menu engineering render', 'Passed'],
  ['U12', 'Reports', 'Export CSV downloads the scorecard, KRIs, league, forecast and menu tables', 'Passed (6 sections, 92 lines)'],
  ['U13', 'Reports', 'Print / PDF produces a clean A4 document without sidebar or top bar', 'Passed (Chrome print pipeline, 9 pages)'],
  ['U14', 'Inventory', 'Stock, purchasing, menu & 86 tabs render with INR values', 'Passed'],
  ['U15', 'Reservations', 'Day sheet, stats and booking form render; seat opens POS order', 'Render passed; seating covered by API (V05)'],
  ['U16', 'Finance', 'Day end, reconciliation and leakage tabs render', 'Passed'],
  ['U17', 'Vision', 'Measured metrics (coverage, queue, pass, door, counter), tier badges, audit queue and measurability table', 'Passed'],
  ['U18', 'Integrations', 'Marketplace filters (India/Global, category, search); API key blurred in captures', 'Passed'],
  ['U19', 'Kitchen', 'Bump · ready removes a ticket from the live board', 'Passed'],
  ['U20', 'Accessibility', 'Keyboard navigation, skip-to-content link and focus ring across pages', 'Passed'],
  ['U21', 'Responsive', 'Phone width (390 px): all 15 pages without horizontal scroll', 'Passed'],
  ['U23', 'Performance', 'First load ships only the app shell (297 KB, 95 KB gzipped); pages load on demand and prefetch when idle', 'Passed'],
  ['U24', 'Performance', 'Eight tabs open at once: one shared live connection, every tab "Live", pages load in 0.5–1.7 s', 'Passed'],
  ['U25', 'Performance', 'Close the tab holding the live connection: another tab takes over and live updates continue', 'Passed'],
  ['U26', 'POS', 'Order panel fits the screen: Send KOT, Bill and Settle visible without scrolling on a 747 px-high window', 'Passed'],
  ['U27', 'Finance', 'Single-branch day end shows a close checklist (open tables, exceptions, cash count) and sales by channel', 'Passed'],
  ['U28', 'Onboarding', 'Fields line up across rows; GSTIN/FSSAI placeholders fit; draft resumes at the same step after reload', 'Passed'],
  ['U29', 'Dashboard', 'Hovering the sales chart shows the hour vs yesterday, in-store/online, orders, average order, covers, top dish and day-so-far', 'Passed'],
  ['U30', 'Telegram', 'Admin connects the bot on Integrations; token shown masked; linked people listed with unlink', 'Passed (local Bot API stand-in)'],
  ['U31', 'Telegram', 'Top-bar Telegram window: one-time code with expiry, open-bot link, role-aware command list, confirms when linked, disconnect', 'Passed (local Bot API stand-in)'],
  ['U22', 'Themes', 'Dark and Midnight modes on POS, Finance, Inventory and Reports', 'Passed'],
];

export function testPlanDoc() {
  const main = load('main'), onb = load('onboarding');
  const all = [...(main?.results || []), ...(onb?.results || [])];
  const pass = all.filter((r) => r.ok).length;
  const sections = [];
  for (const r of all) { const k = r.section || 'Other'; let g = sections.find((x) => x.k === k); if (!g) sections.push(g = { k, rows: [] }); g.rows.push(r); }
  const badge = (ok) => `<span class="b ${ok ? 'ok' : 'bad'}">${ok ? 'Pass' : 'Fail'}</span>`;
  const mBadge = (s) => `<span class="b ${s.startsWith('Passed') ? 'ok' : s.startsWith('Covered') || s.startsWith('Render') ? 'info' : 'muted'}">${esc(s)}</span>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>OutletOS Test Plan & Results</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet"/>
<style>
:root{--ink:#16100F;--ink2:#4A4044;--ink3:#7A6F72;--rule:#ECE3E0;--soft:#FBF3F1;--crimson:#D92D3A;--ok:#12805C;--okb:#E3F5EC;--bad:#B42318;--badb:#FDE8E7;--info:#0B6FA4;--infob:#E3F1FA}
*{box-sizing:border-box}body{margin:0;font-family:'Plus Jakarta Sans',sans-serif;color:var(--ink);background:#fff;font-size:10pt;line-height:1.5}
.cover{background:radial-gradient(120% 80% at 85% 0%,#F97316 0%,transparent 55%),linear-gradient(150deg,#D92D3A 0%,#7A1A22 55%,#1A0B0E 100%);color:#fff;padding:18mm 16mm;min-height:120mm;display:flex;flex-direction:column}
.cover .top{display:flex;gap:10px;align-items:center;font-weight:800;font-size:15pt}.cover svg{width:32px;height:32px}
.cover h1{font-size:38pt;letter-spacing:-.04em;line-height:1;margin:auto 0 4mm}.cover p{opacity:.88;max-width:150mm;font-size:12pt}
.wrap{padding:10mm 16mm}h2{font-size:17pt;letter-spacing:-.02em;margin:9mm 0 2mm}h3{font-size:12pt;margin:6mm 0 2mm;color:var(--crimson)}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:4mm;margin:5mm 0}.kpis div{border:1px solid var(--rule);border-radius:12px;padding:4mm;background:var(--soft)}.kpis b{display:block;font-size:20pt;letter-spacing:-.02em}.kpis span{font-size:8.5pt;color:var(--ink3)}
table{width:100%;border-collapse:separate;border-spacing:0;border:1px solid var(--rule);border-radius:10px;overflow:hidden;font-size:8.6pt;margin-top:2mm;page-break-inside:auto}
th{background:var(--soft);color:#7A1A22;text-align:left;font-family:'JetBrains Mono',monospace;font-size:6.8pt;letter-spacing:.12em;text-transform:uppercase;padding:2.2mm 3mm}td{padding:2mm 3mm;border-top:1px solid var(--rule);vertical-align:top}tr{page-break-inside:avoid}
td.id{font-family:'JetBrains Mono',monospace;font-size:8pt;color:var(--ink3);white-space:nowrap}.b{display:inline-block;padding:.4mm 2mm;border-radius:10px;font-size:7.6pt;font-weight:700}.ok{background:var(--okb);color:var(--ok)}.bad{background:var(--badb);color:var(--bad)}.info{background:var(--infob);color:var(--info)}.muted{background:#F1EEEC;color:var(--ink3)}
code{font-family:'JetBrains Mono',monospace;font-size:8.4pt;background:var(--soft);padding:.3mm 1.4mm;border-radius:4px}ul{margin:1mm 0 0 4mm;padding:0}li{margin:.8mm 0}
@page{size:A4;margin:10mm 0}@media print{.cover{min-height:auto}}
</style></head><body>
<section class="cover"><div class="top">${LOGO} OutletOS</div><h1>Test plan<br/>& results</h1><p>Every module, every role, happy paths and failure paths: ${all.length} automated API scenarios plus ${MANUAL.length} browser scenarios, run against the global, India and new-workspace instances.</p></section>
<div class="wrap">
<div class="kpis"><div><b>${all.length}</b><span>automated scenarios</span></div><div><b>${pass}/${all.length}</b><span>passed on the latest run</span></div><div><b>${MANUAL.length}</b><span>browser scenarios (${MANUAL.filter((m) => m[3].startsWith('Passed')).length} executed)</span></div><div><b>3</b><span>instances: global · India · new workspace</span></div></div>
<h2>Approach</h2>
<ul>
<li><strong>Automated end-to-end suite</strong> (<code>server/scripts/e2e.mjs</code>): real HTTP calls against a running instance. It covers authentication, RBAC/ABAC for all nine roles, dashboards, reports and forecasts, POS (including GST, rounding, KOT, discounts, NC, split tender), kitchen display, menu and 86, inventory and purchasing, reservations, finance, connectors (webhook HMAC, ADMS devices, RTSP generation), the ingest API, alerts, AI agents and team management. Test data is created and cleaned up by the suite.</li>
<li><strong>Onboarding suite</strong> (<code>--onboarding</code>): builds a UAE tenant (AED, VAT 5% inclusive) with varied outlets, tables, team and modules on a fresh workspace. It verifies currency and tax application, module gating, scoped logins and VAT-inclusive billing.</li>
<li><strong>Telegram bot</strong> (TG01–TG16, part of the main suite): a stand-in for the Telegram Bot API runs inside the test, and updates are posted to the real webhook route. Covers linking, single-use codes, group refusal, role-based command refusal, branch scope, approvals that acknowledge alerts, AI answers and unlinking.</li>
<li><strong>Vision parity</strong> (<code>npm run test:parity</code>): the JavaScript and Python rule engines produce identical events from the same 43,200 frames.</li>
<li><strong>Browser scenarios</strong>: walked through in Chrome. A scenario is marked passed only where it was actually executed.</li>
</ul>
<h3>How to run</h3>
<table><tbody>
<tr><td>Main suite (India demo)</td><td><code>npm run start:india</code> then <code>node server/scripts/e2e.mjs</code></td></tr>
<tr><td>Main suite (global demo)</td><td><code>npm start</code> then <code>node server/scripts/e2e.mjs http://localhost:8787</code></td></tr>
<tr><td>Onboarding suite</td><td>Delete <code>server/data/outletos-new.db</code>, run <code>npm run start:new</code>, then <code>node server/scripts/e2e.mjs http://localhost:8789 --onboarding</code></td></tr>
<tr><td>Vision parity</td><td><code>npm run test:parity</code></td></tr>
</tbody></table>
<h2>Automated results</h2>
<p>Main suite: ${main ? `${main.passed}/${main.total} passed · ${esc(main.base)} · ${esc(main.ran.slice(0, 16).replace('T', ' '))} UTC` : 'not run'} · Onboarding suite: ${onb ? `${onb.passed}/${onb.total} passed · ${esc(onb.ran.slice(0, 16).replace('T', ' '))} UTC` : 'not run'}</p>
${sections.map((g) => `<h3>${esc(g.k)} · ${g.rows.filter((r) => r.ok).length}/${g.rows.length}</h3><table><thead><tr><th>ID</th><th>Scenario</th><th>Result</th></tr></thead><tbody>${g.rows.map((r) => `<tr><td class="id">${esc(r.id)}</td><td>${esc(r.name)}${r.error ? `<br/><span style="color:var(--bad)">${esc(r.error)}</span>` : ''}</td><td>${badge(r.ok)}</td></tr>`).join('')}</tbody></table>`).join('')}
<h2>Browser scenarios</h2>
<table><thead><tr><th>ID</th><th>Area</th><th>Scenario</th><th>Status</th></tr></thead><tbody>${MANUAL.map(([id, a, sc, st]) => `<tr><td class="id">${id}</td><td>${esc(a)}</td><td>${esc(sc)}</td><td>${mBadge(st)}</td></tr>`).join('')}</tbody></table>
<h2>Defects found and fixed during this release</h2>
<table><thead><tr><th>Defect</th><th>Found by</th><th>Fix</th></tr></thead><tbody>
<tr><td>Fresh databases failed to seed (positional inserts after new columns)</td><td>India instance first start</td><td>Explicit column lists on every seed insert</td></tr>
<tr><td>New users could not be created ("username already exists")</td><td>T05</td><td>Explicit columns on user inserts after the <code>email</code> migration</td></tr>
<tr><td>Webhook orders without a store id were rejected</td><td>C07</td><td>Mapping wildcard applies to missing values; connector's install branch is the fallback outlet</td></tr>
<tr><td>VAT-inclusive countries added VAT on top of menu prices</td><td>O18</td><td>Inclusive tax is extracted in the POS bill and in order ingest; net sales exclude tax</td></tr>
<tr><td>Sample history crashed for outlets with few front-of-house staff</td><td>Onboarding API run (US tenant)</td><td>Audit seeding falls back to any staff at the outlet</td></tr>
<tr><td>"+Infinity% vs budget" when an outlet has no budget</td><td>Onboarding API run</td><td>Budget comparisons are hidden when no budget is set</td></tr>
<tr><td>Cameras/sensors not created when modules were left at defaults</td><td>Onboarding UI walk-through</td><td>Effective module set computed before provisioning devices</td></tr>
<tr><td>Pages stalled for 20–40 s on reload when several OutletOS tabs were open (each tab held a live stream; browsers allow 6 connections per host)</td><td>Browser walk-through</td><td>One live connection per browser, shared by all tabs (Web Locks + BroadcastChannel) with automatic hand-over</td></tr>
<tr><td>First load downloaded the whole app (1.96 MB)</td><td>Production build review</td><td>Pages split into on-demand chunks with idle prefetch; first load 297 KB</td></tr>
<tr><td>Top bar overflowed on phones (483 px wide in a 390 px screen)</td><td>U21</td><td>Branch picker truncates; spacing tightened</td></tr>
<tr><td>POS Settle button below the fold on laptop screens</td><td>U26</td><td>Order panel sized to the visible screen</td></tr>
<tr><td>Dashboard tile, alert category and agent still said "Hygiene" for camera checks that measure stations, access and counters</td><td>Copy review against the vision tiers</td><td>Renamed to "Camera checks", "Camera &amp; access" and "Vision &amp; Operations"</td></tr>
<tr><td>Report figures wrapped ("₹32.88 / L"), chart axis labels wrapped in print, CSV numbers had 4 decimals</td><td>U11, U12, U13</td><td>No-wrap numeric cells, wider money axes, 2-decimal money in CSV</td></tr>
<tr><td>Onboarding: misaligned fields, clipped placeholders, "Modules 0 enabled" before the modules step</td><td>U28</td><td>Shared field height and top alignment; shorter placeholders; summary shows the recommended count</td></tr>
<tr><td>Telegram window was clipped inside the top bar (the bar's blur made it the containing block for fixed elements)</td><td>U31</td><td>Dialog rendered in a portal on the page body</td></tr>
<tr><td>Bot token check used the saved API address, not the one being configured</td><td>TG03</td><td>Token is validated against the address in the same request</td></tr>
<tr><td>Kitchen "running slow" list in Telegram included dishes under target</td><td>Telegram demo transcript review</td><td>Only dishes over target are listed</td></tr>
<tr><td>Success screen claimed a forced password change that does not exist</td><td>Review of onboarding copy</td><td>Copy corrected; forced change listed on the roadmap</td></tr>
</tbody></table>
<h2>Known limitations</h2>
<ul><li>Accessibility was checked for keyboard use and focus; a full screen-reader (WCAG 2.2 AA) audit has not been done.</li><li>Vision accuracy targets (≥ 90% precision for real-time alerts) must be validated per site in shadow mode; the demo uses a synthetic detector.</li><li>Aggregator payout lines are simulated in the demo; real reconciliation needs the platform payout files.</li><li>No load or soak testing has been done yet: the suite checks correctness, not throughput.</li></ul>
<p style="margin-top:8mm;color:var(--ink3);font-size:8pt">OutletOS Test Plan & Results · generated ${new Date().toISOString().slice(0, 10)} · source <code>docs/src/testplan.mjs</code></p>
</div></body></html>`;
}
