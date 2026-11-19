import { LOGO, diagram, box, zone, edge, label, dot, diamond, store, entity, pipeline, sequence, esc } from './lib.mjs';

export const CSS = `
:root{
  --paper:#F6F4F3; --card:#FFFFFF; --ink:#16100F; --ink-2:#3F3638; --ink-3:#6E6366;
  --rule:#E7E0DE; --rule-2:#D3C9C7;
  --accent:#C42B37; --accent-soft:rgba(196,43,55,.075);
  --live:#0C7566; --live-soft:rgba(12,117,102,.085);
  --risk:#B54708; --risk-soft:rgba(181,71,8,.08);
  --f-display:'Plus Jakarta Sans','Helvetica Neue',Helvetica,Arial,sans-serif;
  --f-mono:'JetBrains Mono',ui-monospace,'Cascadia Code',Consolas,monospace;
  --f-body:'Plus Jakarta Sans',system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;
  --shadow:0 1px 2px rgba(22,16,15,.05),0 8px 24px -12px rgba(22,16,15,.14);
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --paper:#0A0607; --card:#140D0F; --ink:#F2EAEB; --ink-2:#B9AAAD; --ink-3:#8A7B7E;
  --rule:rgba(255,255,255,.085); --rule-2:rgba(255,255,255,.17);
  --accent:#FF6B76; --accent-soft:rgba(255,107,118,.10); --live:#38E1CE; --live-soft:rgba(56,225,206,.10);
  --risk:#FFA45C; --risk-soft:rgba(255,164,92,.10); --shadow:0 1px 2px rgba(0,0,0,.4);}}
:root[data-theme="dark"]{
  --paper:#0A0607; --card:#140D0F; --ink:#F2EAEB; --ink-2:#B9AAAD; --ink-3:#8A7B7E;
  --rule:rgba(255,255,255,.085); --rule-2:rgba(255,255,255,.17);
  --accent:#FF6B76; --accent-soft:rgba(255,107,118,.10); --live:#38E1CE; --live-soft:rgba(56,225,206,.10);
  --risk:#FFA45C; --risk-soft:rgba(255,164,92,.10); --shadow:0 1px 2px rgba(0,0,0,.4);}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--f-body);line-height:1.62;-webkit-font-smoothing:antialiased}
.shell{display:grid;grid-template-columns:260px minmax(0,1fr);max-width:1400px;margin-inline:auto}
@media(max-width:980px){.shell{grid-template-columns:1fr}}
nav.toc{position:sticky;top:0;align-self:start;height:100vh;overflow-y:auto;padding:34px 24px 40px;border-right:1px solid var(--rule)}
@media(max-width:980px){nav.toc{position:static;height:auto;border-right:0;border-bottom:1px solid var(--rule)}}
nav.toc .mark{display:flex;align-items:center;gap:10px;font-family:var(--f-display);font-weight:800;font-size:1rem;letter-spacing:-.02em;margin-bottom:4px}
nav.toc .mark svg{width:24px;height:24px}
nav.toc .sub{font-family:var(--f-mono);font-size:.6rem;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-3);margin-bottom:26px}
nav.toc a{display:block;color:var(--ink-2);text-decoration:none;font-size:.83rem;padding:5px 0 5px 12px;border-left:2px solid transparent;line-height:1.4;border-bottom:0}
nav.toc a.lv3{font-size:.77rem;padding-left:24px;color:var(--ink-3)}
nav.toc a:hover{color:var(--accent);border-left-color:var(--rule-2)}
nav.toc a.on{color:var(--accent);border-left-color:var(--accent);font-weight:600}
article{padding:clamp(30px,4.5vw,64px) clamp(20px,4vw,60px) 120px;min-width:0}
header.doc{border-bottom:2px solid var(--ink);padding-bottom:26px;margin-bottom:34px}
.eyebrow{font-family:var(--f-mono);font-size:.66rem;letter-spacing:.26em;text-transform:uppercase;color:var(--accent);margin:0 0 16px}
h1{font-family:var(--f-display);font-weight:800;font-size:clamp(2rem,4.6vw,3.3rem);letter-spacing:-.038em;line-height:1.03;margin:0;text-wrap:balance}
.standfirst{color:var(--ink-2);font-size:clamp(1rem,1.4vw,1.16rem);max-width:66ch;margin:18px 0 0}
.docmeta{display:flex;flex-wrap:wrap;gap:10px 28px;margin-top:24px;font-family:var(--f-mono);font-size:.68rem;color:var(--ink-3)}
.docmeta b{color:var(--ink-2);font-weight:400}
h2{font-family:var(--f-display);font-weight:800;font-size:clamp(1.4rem,2.5vw,2rem);letter-spacing:-.03em;margin:64px 0 6px;scroll-margin-top:24px;text-wrap:balance}
h2[data-n]::before{content:attr(data-n);display:block;font-family:var(--f-mono);font-size:.64rem;letter-spacing:.2em;color:var(--accent);margin-bottom:10px;font-weight:400;text-transform:uppercase}
h3{font-family:var(--f-display);font-weight:700;font-size:1.16rem;letter-spacing:-.02em;margin:34px 0 8px;scroll-margin-top:24px}
p{margin:14px 0;max-width:72ch;color:var(--ink-2)}
article ul,article ol{max-width:72ch;color:var(--ink-2);padding-left:1.25em}
article li{margin:7px 0}
strong{color:var(--ink);font-weight:650}
a{color:var(--accent);text-decoration:none;border-bottom:1px solid color-mix(in srgb,var(--accent) 35%,transparent)}
code{font-family:var(--f-mono);font-size:.84em;background:var(--accent-soft);padding:1px 5px;border-radius:4px;color:var(--ink)}
pre{overflow-x:auto;background:var(--card);border:1px solid var(--rule-2);border-radius:12px;padding:16px 18px;margin:22px 0;box-shadow:var(--shadow)}
pre code{background:none;padding:0;font-size:.78rem;line-height:1.6;display:block}
.box{border:1px solid var(--rule-2);border-radius:12px;padding:20px 24px;margin:26px 0;background:var(--card);box-shadow:var(--shadow);max-width:76ch}
.box.key{border-left:3px solid var(--accent);background:var(--accent-soft);box-shadow:none}
.box.warn{border-left:3px solid var(--risk);background:var(--risk-soft);box-shadow:none}
.box.good{border-left:3px solid var(--live);background:var(--live-soft);box-shadow:none}
.box .lbl{font-family:var(--f-mono);font-size:.62rem;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-3);margin-bottom:8px}
.box.key .lbl{color:var(--accent)} .box.warn .lbl{color:var(--risk)} .box.good .lbl{color:var(--live)}
.box p{margin:6px 0;max-width:none} .box p:first-of-type{margin-top:0} .box p:last-child{margin-bottom:0}
.tw{overflow-x:auto;margin:24px 0;border:1px solid var(--rule-2);border-radius:12px;background:var(--card)}
table{border-collapse:collapse;width:100%;font-size:.84rem}
th,td{text-align:left;padding:10px 13px;border-bottom:1px solid var(--rule);vertical-align:top}
th{font-family:var(--f-mono);font-size:.6rem;letter-spacing:.13em;text-transform:uppercase;color:var(--ink-3);font-weight:400;background:var(--accent-soft);white-space:nowrap}
td{color:var(--ink-2)} td strong{color:var(--ink)} tbody tr:last-child td{border-bottom:0}
td.c,th.c{text-align:center}
.tag{font-family:var(--f-mono);font-size:.6rem;padding:2px 7px;border-radius:20px;border:1px solid;white-space:nowrap;display:inline-block;line-height:1.5}
.t-ok{color:var(--live);border-color:color-mix(in srgb,var(--live) 40%,transparent);background:var(--live-soft)}
.t-no{color:var(--risk);border-color:color-mix(in srgb,var(--risk) 35%,transparent);background:var(--risk-soft)}
.t-n{color:var(--ink-3);border-color:var(--rule-2)}
.yes{color:var(--live);font-weight:700} .no{color:var(--rule-2)}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:28px 0}
.tile{border:1px solid var(--rule-2);border-radius:12px;background:var(--card);padding:16px 18px;box-shadow:var(--shadow)}
.tile .k{font-family:var(--f-mono);font-size:.58rem;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-3);margin-bottom:8px}
.tile .v{font-family:var(--f-display);font-weight:800;font-size:1.7rem;letter-spacing:-.03em;color:var(--ink);font-variant-numeric:tabular-nums;line-height:1}
.tile .n{font-size:.74rem;color:var(--ink-3);margin-top:6px}
hr{border:0;border-top:1px solid var(--rule);margin:44px 0}
.foot{font-size:.8rem;color:var(--ink-3);max-width:72ch;margin-top:60px;border-top:1px solid var(--rule);padding-top:18px}
figure.dg{margin:30px 0;padding:0}
.dg-scroll{overflow-x:auto;border:1px solid var(--rule-2);border-radius:12px;background:var(--card);padding:18px 20px;box-shadow:var(--shadow)}
figure.dg svg{display:block;width:100%;min-width:620px;height:auto}
figure.dg figcaption{font-size:.84rem;color:var(--ink-3);margin-top:12px;max-width:76ch;line-height:1.6}
figure.dg figcaption b{color:var(--ink-2);font-weight:650}
.dg-box{fill:var(--paper);stroke:var(--rule-2);stroke-width:1.2}
.dg-box.accent{stroke:var(--accent);stroke-width:1.8}
.dg-box.live{stroke:color-mix(in srgb,var(--live) 60%,transparent);stroke-width:1.4}
.dg-box.risk{stroke:color-mix(in srgb,var(--risk) 60%,transparent);stroke-width:1.4}
.dg-box.out{stroke:var(--rule-2);fill:var(--accent-soft)}
.dg-box.ext{fill:var(--card);stroke:var(--ink-3);stroke-width:1.2;stroke-dasharray:none}
.dg-box.dec{fill:var(--paper);stroke:var(--accent);stroke-width:1.4}
.dg-store{fill:none;stroke:var(--ink-3);stroke-width:1.3}
.dg-t{fill:var(--ink);font-family:var(--f-body);font-size:13px;font-weight:650;text-anchor:middle}
.dg-s{fill:var(--ink-3);font-family:var(--f-mono);font-size:10.8px;text-anchor:middle}
.dg-e{fill:var(--ink-3);font-family:var(--f-mono);font-size:10.5px}
.dg-z{fill:var(--ink-3);font-family:var(--f-mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase}
.dg-zone{fill:none;stroke:var(--rule-2);stroke-width:1;stroke-dasharray:5 4}
.dg-zone.local{stroke:color-mix(in srgb,var(--live) 60%,transparent);stroke-dasharray:none;stroke-width:1.6}
.dg-zone.cloud{stroke:color-mix(in srgb,var(--accent) 55%,transparent)}
.dg-edge{stroke:var(--ink-3);stroke-width:1.4;fill:none}
.dg-edge.soft{opacity:.75} .dg-edge.dash{stroke-dasharray:5 4}
.dg-life{stroke:var(--rule-2);stroke-width:1;stroke-dasharray:3 5}
.dg-frame{fill:none;stroke:var(--rule-2);stroke-width:1;stroke-dasharray:4 4}
.dg-head{fill:var(--ink-3)} .dg-head-soft{fill:var(--ink-3);opacity:.75}
.cover{display:none}
@media print{
  @page{size:A4;margin:16mm 14mm 16mm}
  body{background:#fff;font-size:10.5pt}
  nav.toc{display:none} .shell{display:block} article{padding:0}
  .box,.tw,.tile,pre,.dg-scroll{box-shadow:none}
  h2{margin-top:34px;break-after:avoid;break-inside:avoid} h3{break-after:avoid;break-inside:avoid} p{orphans:3;widows:3}
  figure.dg,.box,.tiles{break-inside:avoid} .tw{overflow:visible} tr{break-inside:avoid} thead{display:table-header-group} th,td{padding:7px 11px}
  figure.dg svg{min-width:0} .dg-scroll{padding:10px 8px}
  .cover{display:flex;flex-direction:column;justify-content:space-between;height:265mm;break-after:page;
    background:linear-gradient(140deg,#D92D3A 0%,#7A1A22 58%,#F97316 135%);color:#fff;border-radius:0;padding:22mm 18mm;
    -webkit-print-color-adjust:exact;print-color-adjust:exact;margin:-16mm -14mm 0}
  .cover .cm{display:flex;align-items:center;gap:12px;font-family:var(--f-display);font-weight:800;font-size:18pt}
  .cover .cm svg{width:38px;height:38px;border-radius:11px;box-shadow:0 0 0 3px rgba(255,255,255,.9)}
  .cover h1{color:#fff;font-size:40pt;margin:0 0 10px}
  .cover p{color:#fff} .cover .cs{font-size:13pt;opacity:.92;max-width:150mm}
  .cover .cmeta{font-family:var(--f-mono);font-size:8.5pt;letter-spacing:.14em;text-transform:uppercase;opacity:.85;display:flex;gap:24px}
  header.doc{display:none}
  th{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .box.key,.box.good,.box.warn,.tag{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}`;

// ---------- diagrams ----------
const D_CONTEXT = diagram(980, 520, 'Context diagram: eight external systems feed OutletOS; OutletOS returns role-filtered views to users.', (id) => {
  const L = [['POS / billing', 'orders · payments'], ['Delivery platforms', 'online orders'], ['Kitchen display', 'ticket fired / ready'], ['Attendance devices', 'clock in / out']];
  const R = [['CCTV + edge agent', 'vision events, no video'], ['IoT sensors', 'temperature readings'], ['Loyalty / reservations', 'guest check-ins'], ['Review platforms', 'ratings · reviews']];
  let s = '';
  L.forEach(([t, sub], i) => { const y = 30 + i * 84; s += box(30, y, 220, 56, t, sub, 'ext') + edge(id, [[250, y + 28], [320, y + 28]], { head: false }); });
  R.forEach(([t, sub], i) => { const y = 30 + i * 84; s += box(730, y, 220, 56, t, sub, 'ext') + edge(id, [[730, y + 28], [660, y + 28]], { head: false }); });
  s += `<line x1="320" y1="58" x2="320" y2="310" class="dg-edge"/><line x1="660" y1="58" x2="660" y2="310" class="dg-edge"/>`;
  s += edge(id, [[320, 184], [390, 184]]) + edge(id, [[660, 184], [590, 184]]);
  s += box(390, 140, 200, 96, 'OutletOS', 'ingest · rules · analytics', 'accent');
  s += box(330, 420, 320, 60, 'Users by role', 'Owner → Line Cook · 8 roles', 'live');
  s += edge(id, [[460, 236], [460, 420]]) + edge(id, [[520, 420], [520, 236]]);
  s += label(452, 330, 'role-filtered dashboards,', 'end') + label(452, 343, 'alerts, suggestions', 'end');
  s += label(528, 330, 'sign-in, actions,', 'start') + label(528, 343, 'acknowledgements', 'start');
  return s;
}, '<b>Everything enters through one door.</b> Eight kinds of restaurant system push data in; the only thing that comes out is a view filtered for the person looking at it. Cameras send detections, never footage.');

const D_ARCH = diagram(980, 600, 'High-level architecture: restaurant systems and the edge agent feed the ingest API inside a single OutletOS server process, which stores events, distributes them live and serves role-filtered read models to the React dashboard and, through the Telegram gateway, to linked Telegram chats.', (id) => {
  let s = zone(20, 30, 230, 380, 'Restaurant systems') + zone(20, 430, 230, 150, 'Inside each restaurant', 'local') + zone(290, 30, 480, 550, 'OutletOS server · one Node process', 'cloud') + zone(790, 200, 175, 380, 'Users');
  ['POS / billing', 'Delivery apps', 'Kitchen display', 'Attendance', 'IoT gateways', 'Loyalty'].forEach((t, i) => { const y = 60 + i * 56; s += box(40, y, 190, 40, t) + edge(id, [[230, y + 20], [262, y + 20]], { head: false }); });
  s += `<line x1="262" y1="80" x2="262" y2="360" class="dg-edge"/>` + edge(id, [[262, 85], [310, 85]]);
  s += box(40, 460, 190, 40, 'IP cameras · RTSP') + edge(id, [[135, 500], [135, 520]]) + box(40, 520, 190, 46, 'Edge vision agent', 'YOLO · on-premise', 'live');
  s += edge(id, [[230, 543], [278, 543], [278, 100], [310, 100]], { soft: true }) + label(236, 534, 'events only', 'start');
  s += box(310, 60, 200, 50, 'Ingest API v1', 'API key · connectors') + box(540, 60, 200, 50, 'Webhook mapper', 'vendor JSON → canonical');
  s += box(310, 145, 290, 56, 'Canonical ingest + rules', 'validate · enrich · escalate', 'accent') + box(620, 145, 120, 56, 'Event bus', 'SSE fan-out');
  s += edge(id, [[410, 110], [410, 145]]) + edge(id, [[580, 110], [580, 145]]) + edge(id, [[600, 173], [620, 173]]);
  s += box(310, 240, 430, 56, 'Event store', 'SQLite · WAL · 17 tables', 'out') + edge(id, [[455, 201], [455, 240]]);
  s += box(310, 335, 190, 56, 'Policy engine', 'RBAC + ABAC', 'accent') + box(520, 335, 220, 56, 'Analytics', 'KPIs · scores · staffing');
  s += box(310, 430, 190, 56, 'Simulator', 'demo data, same path') + box(520, 430, 220, 56, 'Guest intelligence', 'profiles · suggestions');
  s += edge(id, [[630, 296], [630, 335]]) + edge(id, [[740, 268], [758, 268], [758, 458], [740, 458]]) + edge(id, [[500, 363], [520, 363]]) + edge(id, [[500, 380], [510, 380], [510, 450], [520, 450]]);
  s += edge(id, [[310, 458], [300, 458], [300, 185], [310, 185]], { soft: true }) + label(304, 520, 'same write path', 'start');
  s += box(805, 330, 150, 56, 'React dashboard', 'role-adaptive', 'live') + box(805, 420, 150, 50, '8 roles', 'Owner → Line Cook');
  s += edge(id, [[740, 173], [880, 173], [880, 330]]) + label(810, 165, 'live events (SSE)') + edge(id, [[805, 358], [740, 358]], { both: true }) + label(772, 350, 'REST') + edge(id, [[880, 420], [880, 386]]);
  s += box(520, 508, 220, 56, 'Telegram gateway', 'same tools + policy', 'accent') + edge(id, [[630, 486], [630, 508]], { soft: true });
  s += box(805, 508, 150, 56, 'Telegram app', 'private chats', 'live') + edge(id, [[805, 536], [740, 536]], { both: true }) + label(772, 528, 'Bot API');
  return s;
}, '<b>One process, one write path.</b> Integrations, the edge agent and the simulator all call the same canonical ingest functions, so a demo and a production rollout exercise identical code. The policy engine sits in front of every read model and every live event, including answers sent through the Telegram gateway.');

const D_MODULES = diagram(980, 600, 'Low-level module map of the web client and the server, showing which modules call which.', (id) => {
  let s = zone(20, 20, 940, 200, 'web/src · React client') + zone(20, 250, 940, 330, 'server/src · Node API', 'cloud');
  s += box(40, 64, 130, 56, 'main.jsx', 'router · auth') + box(200, 64, 150, 56, 'App.jsx', 'shell · guards') + box(380, 64, 160, 56, 'pages/*', '10 screens') + box(570, 64, 170, 56, 'components/*', 'ui · charts · feeds');
  s += box(780, 44, 160, 50, 'lib/auth.jsx', 'session · scope') + box(780, 124, 160, 56, 'lib/api.js', 'fetch · SSE · useLive', 'accent');
  s += edge(id, [[170, 92], [200, 92]]) + edge(id, [[350, 92], [380, 92]]) + edge(id, [[540, 92], [570, 92]]);
  s += edge(id, [[300, 64], [300, 36], [860, 36], [860, 44]]) + label(580, 30, 'session');
  s += edge(id, [[275, 120], [275, 196], [860, 196], [860, 180]], { head: true }) + edge(id, [[460, 120], [460, 196]], { head: false }) + label(560, 190, 'data + live stream');
  s += edge(id, [[940, 152], [952, 152], [952, 266], [490, 266], [490, 282]]) + label(720, 260, 'HTTPS JSON · SSE (token)');
  s += box(390, 282, 200, 56, 'index.js', 'routes · middleware', 'accent');
  s += `<line x1="120" y1="360" x2="870" y2="360" class="dg-edge"/>` + edge(id, [[490, 338], [490, 360]], { head: false }) + dot(490, 360);
  const r2 = [[40, 160, 'policy.js', 'RBAC · ABAC · tokens'], [230, 170, 'ingest.js', 'the only write path'], [430, 170, 'metrics.js', 'scoped read models'], [630, 150, 'integrations.js', 'mapper · CSV'], [800, 140, 'simulator.js', 'demo data']];
  r2.forEach(([x, w, t, sub]) => { s += box(x, 380, w, 56, t, sub, t === 'ingest.js' ? 'accent' : '') + edge(id, [[x + w / 2, 360], [x + w / 2, 380]]); });
  s += box(110, 490, 150, 56, 'bus.js', 'pub/sub · SSE') + box(330, 490, 150, 56, 'guests.js', 'suggestions') + box(530, 490, 150, 56, 'db.js', 'schema · tx', 'out') + box(730, 490, 150, 56, 'seed.js', 'reference data');
  s += edge(id, [[290, 436], [290, 463], [185, 463], [185, 490]]) + edge(id, [[370, 436], [370, 490]]) + edge(id, [[480, 436], [480, 463], [420, 463], [420, 490]]) + edge(id, [[560, 436], [560, 490]]);
  s += edge(id, [[150, 490], [150, 463], [120, 463], [120, 436]]) + edge(id, [[730, 518], [680, 518]]) + edge(id, [[250, 436], [250, 566], [605, 566], [605, 546]]);
  s += label(612, 560, 'persist', 'start') + label(705, 510, 'seeds');
  return s;
}, '<b>Reads and writes never share a module.</b> <code>ingest.js</code> is the only code that writes events; <code>metrics.js</code> only reads, always through a principal from <code>policy.js</code>. The bus asks the same policy module before it writes a single live event to a socket.');

const D_SIGNIN = diagram(980, 650, 'Sign-in and role routing flow.', (id) => {
  let s = box(390, 20, 200, 44, 'Open OutletOS') + edge(id, [[490, 64], [490, 86]]) + diamond(490, 118, 110, 32, 'Signed in?', 'valid token');
  s += edge(id, [[380, 118], [170, 118], [170, 170]]) + label(280, 110, 'no') + box(60, 170, 220, 56, 'Sign-in screen', 'username + password');
  s += edge(id, [[170, 226], [170, 262]]) + box(60, 262, 220, 56, 'Token issued', 'HMAC-signed · 12 h', 'live') + edge(id, [[280, 290], [400, 290]]);
  s += edge(id, [[490, 150], [490, 262]]) + label(498, 210, 'yes', 'start');
  s += box(400, 262, 180, 56, 'Load profile', '/api/me · role · branches') + edge(id, [[490, 318], [490, 350]]) + box(370, 350, 240, 52, 'Route to role home', 'only permitted pages exist', 'accent');
  s += `<line x1="110" y1="430" x2="870" y2="430" class="dg-edge"/>` + edge(id, [[490, 402], [490, 430]], { head: false });
  const dests = [['Dashboard', 'Owner · Mgrs · Chef'], ['Kitchen', 'Line Cook'], ['Guest Intelligence', 'Host'], ['Vision Intelligence', 'Auditor'], ['Integrations', 'IT Admin']];
  dests.forEach(([t, sub], i) => { const x = 30 + i * 190; s += edge(id, [[x + 80, 430], [x + 80, 460]]) + box(x, 460, 160, 56, t, sub) + edge(id, [[x + 80, 516], [x + 80, 552]], { head: false }); });
  s += `<line x1="110" y1="552" x2="870" y2="552" class="dg-edge"/>` + edge(id, [[490, 552], [490, 580]]) + box(340, 580, 300, 52, 'Live stream opens', 'events filtered for this user', 'live');
  return s;
}, '<b>Pages a role cannot use are never rendered.</b> The client registers only permitted routes, and the server re-checks every request anyway. The live stream is opened per user and filtered with the same rules.');

const D_DFD1 = diagram(980, 570, 'Level 1 data flow diagram with seven processes and nine data stores.', (id) => {
  let s = box(40, 30, 220, 56, 'External sources', 'POS · apps · devices · cameras', 'ext') + box(700, 30, 220, 56, 'Users', '8 roles', 'ext');
  s += box(40, 130, 220, 56, '7.0 Integration mgmt', 'connectors · mappings', 'accent') + box(40, 230, 220, 56, '1.0 Ingest & validate', 'canonical events', 'accent') + box(40, 330, 220, 56, '2.0 Rules & escalation', 'alerts', 'accent') + box(40, 430, 220, 56, '6.0 Realtime distribution', 'SSE per user', 'accent');
  s += box(700, 150, 220, 56, '3.0 Access control', 'principal: role · scope', 'accent') + box(700, 270, 220, 56, '4.0 Analytics & scoring', 'KPIs · score · staffing', 'accent') + box(700, 390, 220, 56, '5.0 Guest intelligence', 'profiles · suggestions', 'accent');
  s += store(380, 40, 220, 32, 'D8', 'Users & settings') + store(380, 100, 220, 32, 'D9', 'Connectors');
  ['Orders & items', 'Kitchen tickets', 'Staff & attendance', 'Vision events', 'Sensors & readings', 'Guests & visits'].forEach((n, i) => { s += store(380, 190 + i * 36, 220, 32, `D${i + 1}`, n); });
  s += store(380, 430, 220, 32, 'D7', 'Alerts');
  s += edge(id, [[40, 58], [25, 58], [25, 258], [40, 258]]) + '<text transform="rotate(-90 17 158)" x="17" y="158" class="dg-e" text-anchor="middle">raw payloads</text>';
  s += edge(id, [[380, 116], [320, 116], [320, 158], [260, 158]]) + label(325, 110, 'mappings', 'start') + edge(id, [[150, 186], [150, 230]]) + label(158, 212, 'field rules', 'start');
  s += edge(id, [[260, 258], [340, 258]], { head: false }) + `<line x1="340" y1="206" x2="340" y2="386" class="dg-edge"/>`;
  [206, 242, 278, 314, 350, 386].forEach((y) => { s += edge(id, [[340, y], [380, y]]); });
  s += label(300, 250, 'persist');
  s += edge(id, [[150, 286], [150, 330]]) + label(158, 312, 'canonical events', 'start') + edge(id, [[150, 386], [150, 430]]) + label(158, 412, 'events + alerts', 'start');
  s += edge(id, [[260, 358], [310, 358], [310, 446], [380, 446]]) + label(316, 404, 'alerts', 'start');
  [206, 242, 278, 314, 350, 386, 446].forEach((y) => { s += `<line x1="600" y1="${y}" x2="640" y2="${y}" class="dg-edge"/>`; });
  s += `<line x1="640" y1="206" x2="640" y2="446" class="dg-edge"/>` + edge(id, [[640, 298], [700, 298]]) + edge(id, [[640, 418], [700, 418]]) + label(646, 290, 'read', 'start');
  s += edge(id, [[600, 56], [660, 56], [660, 178], [700, 178]]) + label(666, 120, 'accounts', 'start');
  s += edge(id, [[810, 86], [810, 150]]) + label(818, 122, 'token', 'start') + edge(id, [[810, 206], [810, 270]]) + label(818, 242, 'principal', 'start');
  s += edge(id, [[920, 418], [945, 418], [945, 58], [920, 58]]) + edge(id, [[920, 298], [945, 298]], { head: false }) + dot(945, 298) + '<text transform="rotate(-90 956 238)" x="956" y="238" class="dg-e" text-anchor="middle">dashboards · suggestions</text>';
  s += edge(id, [[150, 486], [150, 540], [972, 540], [972, 44], [920, 44]]) + label(560, 533, 'live events, filtered by 3.0 per user');
  return s;
}, '<b>Writes flow down the left, reads flow up the right.</b> Processes 1.0 and 2.0 are the only writers of the event stores; 4.0 and 5.0 only read them, and only after 3.0 has turned a token into a principal. 3.0 also filters every event that 6.0 pushes to a browser.');

const D_INGEST = diagram(980, 270, 'Level 2 decomposition of process 1.0 Ingest and validate.', (id) => {
  let s = box(20, 10, 124, 34, 'Source system', '', 'ext') + edge(id, [[82, 44], [82, 70]]);
  s += pipeline(id, [
    { t: '1.1 Authenticate', s: 'key / connector' }, { t: '1.2 Map fields', s: 'paths · units' },
    { t: '1.3 Validate', s: 'referenced ids', down: { t: 'Rejected', s: '400 + reason', cls: 'risk', lbl: 'invalid' } },
    { t: '1.4 Enrich', s: 'price · cost' }, { t: '1.5 Persist', s: 'D1 – D6', cls: 'accent', down: { t: 'Event stores', s: 'D1 – D6' } },
    { t: '1.6 Evaluate rules', s: 'thresholds', down: { t: 'D7 Alerts', s: 'deduplicated' } }, { t: '1.7 Publish', s: 'bus.publish()', down: { t: 'Realtime 6.0', s: 'filtered', cls: 'live' } },
  ]);
  return s;
}, '<b>Bad data stops at 1.3, with a reason.</b> Unknown outlets, staff, sensors or menu items are rejected with a 400 that names the field, so an integrator sees the problem on the first test call rather than in a dashboard a week later.');

const D_ACCESS = diagram(980, 260, 'Access control decision chain for every request.', (id) => pipeline(id, [
  { t: 'Request', s: 'Bearer token', cls: 'ext' }, { t: '3.1 Verify', s: 'HMAC + expiry', down: { t: '401', s: 'Please sign in', cls: 'risk' } },
  { t: '3.2 Principal', s: 'role · branches' }, { t: '3.3 RBAC', s: 'route permission', down: { t: '403', s: 'role cannot access', cls: 'risk' } },
  { t: '3.4 ABAC', s: 'branch · station', down: { t: '403', s: 'no access to branch', cls: 'risk' } }, { t: '3.5 Field filter', s: 'strip · mask', cls: 'accent' },
  { t: 'Response', s: 'permitted only', cls: 'live' },
], { y: 20 }), '<b>Every refusal happens before a query runs.</b> RBAC answers “may this role call this route”; ABAC answers “on which branches, stations and teams”; field filtering removes what is left — finance, pay rates, full phone numbers — before the JSON is serialised.');

const S_READ = sequence([{ t: 'Browser' }, { t: 'Express' }, { t: 'policy.js', cls: 'accent' }, { t: 'metrics.js' }, { t: 'SQLite', cls: 'out' }], [
  { f: 0, t: 1, l: 'GET /api/dashboard?branch=r1' }, { f: 1, t: 2, l: 'requireAuth: verify token' }, { f: 2, t: 4, l: 'load user (active)' },
  { f: 2, t: 1, l: 'principal', d: 1 }, { f: 1, t: 3, l: 'dashboard(principal, r1)' }, { f: 3, t: 2, l: 'scopeBranches()' },
  { frame: 'alt · branch in scope', rows: 3, span: [0, 4] }, { f: 3, t: 4, l: 'aggregates: sales, mix, items, week' }, { self: 3, l: 'drop blocks the role may not see' }, { f: 3, t: 0, l: 'JSON with permitted fields only', d: 1 },
]);
const D_READ = diagram(980, S_READ.h, 'Sequence of an authenticated dashboard request.', S_READ.body, '<b>The principal is rebuilt on every request</b>, so disabling a user or changing their branches takes effect immediately, with no token revocation list to maintain.');

const S_WRITE = sequence([{ t: 'POS / platform', cls: 'ext' }, { t: 'Webhook' }, { t: 'Mapper' }, { t: 'recordOrder', cls: 'accent' }, { t: 'SQLite', cls: 'out' }, { t: 'Bus' }, { t: 'Browsers', cls: 'live' }], [
  { f: 0, t: 1, l: 'POST vendor JSON' }, { f: 1, t: 2, l: 'applyMapping()' }, { f: 2, t: 1, l: 'canonical order', d: 1 }, { f: 1, t: 3, l: 'recordOrder()' },
  { f: 3, t: 4, l: 'INSERT order + items' }, { f: 3, t: 5, l: 'publish("order")' }, { frame: 'loop · each connected user', rows: 2, span: [5, 6] },
  { self: 5, l: 'eventVisible(user)?' }, { f: 5, t: 6, l: 'event (sales roles in scope)', d: 1 }, { f: 1, t: 0, l: '200 {accepted}', d: 1 },
]);
const D_WRITE = diagram(980, S_WRITE.h, 'Sequence from a POS webhook to live dashboards.', S_WRITE.body, '<b>The stream is access-controlled per socket.</b> An order event reaches an owner and a branch manager in that branch, and nobody else; a head chef never learns that a sale happened.');

const S_VISION = sequence([{ t: 'IP camera', cls: 'ext' }, { t: 'Edge agent', cls: 'live' }, { t: '/api/v1/vision' }, { t: 'Rules', cls: 'accent' }, { t: 'Alerts', cls: 'out' }, { t: 'Head Chef' }], [
  { f: 0, t: 1, l: 'RTSP sub-stream (local)' }, { self: 1, l: 'YOLO · zone · throttle' }, { f: 1, t: 2, l: 'POST {gloves, ok:false}' }, { f: 2, t: 3, l: 'store + count in 15 min' },
  { frame: 'alt · 2 high / 3 medium breaches', rows: 2, span: [3, 5] }, { f: 3, t: 4, l: 'raiseAlert(hygiene)' }, { f: 4, t: 5, l: 'live alert', d: 1 },
]);
const D_VISION = diagram(980, S_VISION.h, 'Sequence of the vision pipeline from camera to alert.', S_VISION.body, '<b>Single detections never page anyone.</b> One missed glove is stored as evidence; two inside fifteen minutes on the same camera becomes an alert. Video never leaves the edge box.');

const S_GUEST = sequence([{ t: 'Entrance / QR', cls: 'ext' }, { t: 'recordGuestVisit', cls: 'accent' }, { t: 'guests.js' }, { t: 'SQLite', cls: 'out' }, { t: 'Host screen', cls: 'live' }], [
  { f: 0, t: 1, l: '{guest, method}' }, { f: 1, t: 3, l: 'face? require consent_face' }, { f: 1, t: 3, l: 'INSERT guest_visit' }, { f: 1, t: 2, l: 'guestProfile()' },
  { f: 2, t: 3, l: 'visits · spend · favourites' }, { self: 2, l: 'rank suggestions' }, { f: 1, t: 4, l: 'arrival card (phone masked)', d: 1 },
]);
const D_GUEST = diagram(980, S_GUEST.h, 'Sequence of returning-guest recognition.', S_GUEST.body, '<b>Consent is checked in the write path, not the UI.</b> A face match for a guest who has not opted in is rejected by the API before anything is stored.');

const D_ERD = diagram(980, 400, 'Core data model for the sales path.', (id) => {
  let s = entity(30, 30, 190, 'OUTLETS', ['id  PK', 'name · city · region', 'seats · daily_target', 'platforms']);
  s += entity(30, 220, 190, 'GUESTS', ['id  PK', 'name · phone', 'allergies · favorites', 'consent_face'], 'live');
  s += entity(300, 110, 200, 'ORDERS', ['id  PK', 'outlet_id  FK', 'guest_id  FK', 'channel · platform', 'payment · total', 'food_cost · closed_at'], 'accent');
  s += entity(580, 30, 180, 'ORDER_ITEMS', ['order_id  FK', 'item_id  FK', 'qty · price · ts']);
  s += entity(800, 30, 160, 'MENU_ITEMS', ['id  PK', 'category · price', 'cost · station', 'prep_sec · tags']);
  s += entity(580, 230, 180, 'TICKETS', ['order_id  FK', 'item · station', 'target_sec', 'fired_at · ready_at']);
  s += entity(800, 230, 160, 'GUEST_VISITS', ['guest_id  FK', 'outlet_id  FK', 'method · ts']);
  s += edge(id, [[220, 80], [260, 80], [260, 160], [300, 160]]) + label(266, 120, '1 — n', 'start');
  s += edge(id, [[220, 270], [260, 270], [260, 210], [300, 210]]) + label(266, 250, '1 — n', 'start');
  s += edge(id, [[500, 150], [540, 150], [540, 70], [580, 70]]) + label(546, 110, '1 — n', 'start');
  s += edge(id, [[800, 70], [760, 70]]) + label(780, 62, 'n — 1');
  s += edge(id, [[500, 230], [540, 230], [540, 270], [580, 270]]) + label(546, 262, '1 — n', 'start');
  s += edge(id, [[125, 316], [125, 370], [880, 370], [880, 307]], { soft: true }) + label(500, 364, 'a guest’s visits power the arrival card');
  return s;
}, '<b>Revenue is reconstructed from line items, not trusted from totals.</b> When a source sends items, the order total and theoretical food cost are computed from <code>menu_items</code>, which keeps prime cost honest across every POS.');

const D_EDGE = diagram(980, 420, 'Real-time vision pipeline on the edge box, and the simulator twin that runs the same rules.', (id) => {
  let s = zone(20, 20, 940, 200, 'Edge box in the restaurant · Python', 'local');
  const top = [['IP cameras', 'RTSP sub-stream', 'ext'], ['go2rtc', 're-stream'], ['Frame reader', 'latest · 2 fps'], ['Detector', 'ONNX INT8', 'accent'], ['Tracker', 'ByteTrack ids'], ['Zones', 'foot point'], ['rules.py', 'rules.json', 'accent']];
  top.forEach(([t, sub, cls], i) => { s += box(36 + i * 132, 60, 116, 54, t, sub, cls || ''); if (i < top.length - 1) s += edge(id, [[152 + i * 132, 87], [168 + i * 132, 87]]); });
  s += box(696, 150, 116, 50, 'OCR on trigger', 'labels · displays') + box(828, 150, 116, 50, 'Outbox', 'SQLite · retry', 'live');
  s += edge(id, [[886, 114], [886, 150]]) + edge(id, [[754, 114], [754, 150]], { soft: true }) + edge(id, [[812, 175], [828, 175]]);
  s += label(240, 140, 'live view on demand (WebRTC) — never uploaded', 'middle') + edge(id, [[226, 114], [226, 130]], { soft: true, head: false });
  s += box(600, 250, 360, 56, 'POST /api/v1/vision', '{ events, heartbeats } · one contract', 'accent');
  s += edge(id, [[886, 200], [886, 250]]);
  s += zone(20, 250, 540, 150, 'Simulator twin · Node', 'cloud');
  s += box(36, 294, 150, 54, 'VirtualCamera', 'scene + detector noise') + box(206, 294, 150, 54, 'rules.js', 'same rules.json', 'accent') + box(376, 294, 160, 54, 'Virtual edge agent', 'batch + heartbeats', 'live');
  s += edge(id, [[186, 321], [206, 321]]) + edge(id, [[356, 321], [376, 321]]) + edge(id, [[536, 321], [570, 321], [570, 278], [600, 278]]);
  s += label(286, 382, 'npm run test:parity · identical events from rules.js and rules.py');
  s += box(600, 340, 170, 56, 'Ingest rules', 'escalate on repetition') + box(790, 340, 170, 56, 'Alerts · SSE · agents', 'role-filtered', 'out');
  s += edge(id, [[685, 306], [685, 340]]) + edge(id, [[770, 368], [790, 368]]);
  return s;
}, '<b>The simulator is the edge agent with a synthetic camera.</b> Both run the same rule engine from one <code>rules.json</code>, emit the same event contract with track ids, zones and durations, send heartbeats, and post through the same ingest path. A parity test replays a recorded scene through the JavaScript and Python engines and requires identical output.');

const D_DEPLOY = diagram(980, 470, 'Current single-node deployment and production target topology.', (id) => {
  let s = zone(20, 30, 360, 420, 'Today · single node', 'local') + zone(420, 30, 540, 420, 'Production target', 'cloud');
  s += box(60, 70, 280, 48, 'Browsers', 'http :8787', 'ext') + box(60, 170, 280, 64, 'Node process', 'Express · SSE · simulator', 'accent');
  s += box(60, 290, 130, 56, 'SQLite file', 'WAL mode', 'out') + box(210, 290, 130, 56, 'web/dist', 'static build') + box(60, 380, 280, 46, 'Edge agents', 'API key');
  s += edge(id, [[200, 118], [200, 170]]) + edge(id, [[125, 234], [125, 290]]) + edge(id, [[275, 234], [275, 290]]) + edge(id, [[340, 403], [356, 403], [356, 202], [340, 202]]);
  s += box(440, 70, 150, 56, 'Edge box', 'agent + MediaMTX', 'live') + box(440, 150, 150, 50, 'POS & delivery', 'webhooks', 'ext');
  s += box(630, 105, 150, 56, 'Load balancer', 'TLS · WAF', 'accent') + box(815, 60, 125, 46, 'API node 1') + box(815, 130, 125, 46, 'API node N');
  s += box(630, 240, 150, 50, 'Redis', 'cross-node pub/sub') + box(815, 230, 125, 64, 'PostgreSQL', '+ TimescaleDB · RLS', 'out');
  s += box(440, 330, 150, 52, 'Object storage', 'blurred snapshots') + box(630, 330, 150, 52, 'Job worker', 'pulls · retention');
  s += edge(id, [[590, 98], [610, 98], [610, 125], [630, 125]]) + edge(id, [[590, 175], [610, 175], [610, 145], [630, 145]]) + edge(id, [[780, 120], [798, 120], [798, 83], [815, 83]]) + edge(id, [[780, 140], [798, 140], [798, 153], [815, 153]]);
  s += edge(id, [[877, 176], [877, 230]]) + edge(id, [[815, 160], [705, 160], [705, 240]], { both: true }) + edge(id, [[780, 356], [877, 356], [877, 294]]) + edge(id, [[815, 106], [515, 106], [515, 126]], { soft: true, head: false }) + edge(id, [[630, 356], [590, 356]]);
  return s;
}, '<b>The production shape changes the stores, not the code paths.</b> SQLite becomes PostgreSQL with row-level security per tenant, the in-process bus becomes Redis pub/sub so any API node can serve a live stream, and video is only ever re-streamed on demand from the edge box.');


// ---------- AI agents ----------
const D_AGENTS = diagram(980, 470, 'Agent architecture: Maître orchestrates seven specialists over a permission-checked tool registry.', (id) => {
  let s = box(20, 40, 150, 56, 'Browser', 'chat · Ask Maître', 'ext') + box(210, 40, 180, 56, '/api/agents/chat', 'auth · NDJSON stream');
  s += box(430, 30, 180, 76, 'Maître', 'orchestrator agent', 'accent');
  s += box(650, 22, 150, 44, 'Claude engine', 'Opus 5.5 · tool use', 'live') + box(650, 74, 150, 44, 'Local engine', 'router · composers');
  s += store(830, 48, 130, 44, 'D8', 'agent_runs');
  s += edge(id, [[170, 68], [210, 68]]) + edge(id, [[390, 68], [430, 68]]);
  s += edge(id, [[610, 44], [650, 44]], { soft: true, head: false }) + edge(id, [[610, 96], [650, 96]], { soft: true, head: false }) + edge(id, [[800, 70], [830, 70]], { soft: true });
  const xs = [81, 219, 357, 495, 633, 771, 909];
  s += edge(id, [[520, 106], [520, 142]], { head: false }) + edge(id, [[81, 142], [909, 142]], { head: false });
  xs.forEach((x) => { s += edge(id, [[x, 142], [x, 170]]); });
  s += label(700, 135, 'parallel delegation · one level deep');
  [['Revenue', 'sales · prime cost'], ['Kitchen Ops', 'tickets · stations'], ['Vision', 'camera AI'], ['Guest Exp.', 'regulars · reviews'], ['Workforce', 'TPPH · attendance'], ['Food Safety', 'cold chain · HACCP'], ['Incidents', 'alerts · health']]
    .forEach(([t, sub], i) => { s += box(20 + i * 138, 170, 122, 56, t, sub); s += edge(id, [[xs[i], 226], [xs[i], 270]]); });
  s += box(20, 270, 940, 56, 'Tool registry · 17 tools', 'one permission per tool · runs as the signed-in user · results are data, never instructions', 'accent');
  s += box(20, 370, 210, 56, 'policy.js', 'RBAC · ABAC · masking') + box(260, 370, 210, 56, 'metrics.js', 'same read models as the UI') + box(500, 370, 210, 56, 'knowledge.js', 'playbook · BM25 search') + box(740, 370, 220, 56, 'SQLite', 'live operational data', 'out');
  s += edge(id, [[125, 326], [125, 370]]) + edge(id, [[365, 326], [365, 370]]) + edge(id, [[605, 326], [605, 370]]) + edge(id, [[365, 426], [365, 448], [850, 448], [850, 426]]);
  return s;
}, '<b>Agents never get their own database access.</b> Every specialist reads through the same tool registry, and every tool calls the same read models as the dashboard with the signed-in user’s principal, so an agent can never see more than its user. Maître itself reads no data: it plans, delegates and synthesises.');

const S_AGENT = sequence([{ t: 'Browser' }, { t: 'Express' }, { t: 'Maître', cls: 'accent' }, { t: 'Revenue' }, { t: 'Workforce' }, { t: 'Tool registry', cls: 'accent' }, { t: 'SQLite', cls: 'out' }], [
  { f: 0, t: 1, l: 'POST /api/agents/chat' }, { f: 1, t: 2, l: 'runChat(principal, q)' }, { self: 2, l: 'plan: revenue + workforce' }, { f: 2, t: 0, l: 'plan · step events (NDJSON)', d: 1 },
  { frame: 'par · specialists run in parallel', rows: 6, span: [2, 6] }, { f: 2, t: 3, l: 'ask_revenue(task)' }, { f: 2, t: 4, l: 'ask_workforce(task)' }, { f: 3, t: 5, l: 'sales_overview' }, { f: 4, t: 5, l: 'staffing_productivity' },
  { f: 5, t: 6, l: 'scoped queries (principal)' }, { f: 6, t: 5, l: 'rows in scope only', d: 1 },
  { f: 3, t: 2, l: 'short report', d: 1 }, { f: 4, t: 2, l: 'short report', d: 1 }, { self: 2, l: 'synthesise · rank · dedupe' }, { f: 2, t: 0, l: 'answer · follow-ups · approval cards', d: 1 },
]);
const D_AGENT_SEQ = diagram(980, S_AGENT.h, 'Sequence of a multi-agent question.', S_AGENT.body, '<b>The user watches the hand-offs live.</b> Plan and step events stream to the browser as NDJSON while the specialists work, then the synthesised answer arrives with any proposed actions. The whole run is written to <code>agent_runs</code>.');

// ---------- content ----------
const T = (head, rows) => `<div class="tw"><table><thead><tr>${head.map((h) => `<th${h.startsWith('!') ? ' class="c"' : ''}>${h.replace('!', '')}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td${String(c).startsWith('§') ? ' class="c"' : ''}>${String(c).replace(/^§/, '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const Y = '§<span class="yes">●</span>', N = '§<span class="no">—</span>';

const SECTIONS = [
  ['1-overview', 'Overview', [['principles', 'Design principles'], ['at-a-glance', 'At a glance']]],
  ['2-architecture', 'Architecture', [['module-map', 'Low-level module map'], ['module-responsibilities', 'Module responsibilities']]],
  ['3-user-flows', 'User flows', [['sign-in', 'Sign-in & routing'], ['role-journeys', 'Role journeys']]],
  ['4-data-flow', 'Data flow (DFD)', [['dfd-0', 'Level 0 · context'], ['dfd-1', 'Level 1 · system'], ['dfd-2', 'Level 2 · ingest'], ['data-dictionary', 'Data dictionary']]],
  ['5-runtime', 'Runtime sequences', [['seq-read', 'Authenticated read'], ['seq-write', 'Webhook to live'], ['seq-vision', 'Vision pipeline'], ['seq-guest', 'Guest recognition']]],
  ['6-security', 'Security model', [['authn', 'Authentication'], ['rbac', 'RBAC matrix'], ['abac', 'ABAC rules'], ['threats', 'Threat model']]],
  ['7-data-model', 'Data model', []],
  ['8-api', 'API reference', [['api-session', 'Session'], ['api-read', 'Read models'], ['api-ingest', 'Ingest v1']]],
  ['9-metrics', 'Metrics & formulas', []],
  ['10-agents', 'AI agents', [['agent-team', 'Agent team'], ['agent-flow', 'Request flow'], ['agent-guardrails', 'Guardrails'], ['agent-engines', 'Engines & configuration']]],
  ['11-vision', 'Vision & edge', [['vision-tiers', 'What CCTV can measure'], ['vision-models', 'Model stack'], ['vision-hardware', 'Edge hardware'], ['vision-realtime', 'Real-time transport'], ['vision-rules', 'Shared rules']]],
  ['12-backoffice', 'Operations back office', [['bo-pos', 'Point of sale'], ['bo-inventory', 'Inventory & menu'], ['bo-reservations', 'Reservations'], ['bo-finance', 'Finance & compliance']]],
  ['13-reports', 'Reporting & forecasting', [['rep-kpi', 'KPI scorecard'], ['rep-kri', 'Key risk indicators'], ['rep-compare', 'Comparisons'], ['rep-forecast', 'Forecasting']]],
  ['14-connectors', 'Integrations & connectors', [['con-catalog', 'Connector catalog'], ['con-modes', 'Connection modes'], ['con-security', 'Webhook security & devices'], ['con-telegram', 'Telegram assistant']]],
  ['15-onboarding', 'Instances & onboarding', [['onb-instances', 'Instances'], ['onb-country', 'Country packs'], ['onb-flow', 'Onboarding flow'], ['onb-provision', 'What launch creates']]],
  ['16-deployment', 'Deployment', []],
  ['17-privacy', 'Privacy & compliance', []],
  ['18-sbom', 'Software bill of materials', []],
  ['19-roadmap', 'Limitations & roadmap', []],
];

export function technicalDoc() {
  const toc = SECTIONS.map(([id, t, subs]) => `<a class="lv2" href="#${id}">${t}</a>${subs.map(([sid, st]) => `<a class="lv3" href="#${sid}">${st}</a>`).join('')}`).join('');
  const h2 = (i, cls = '') => { const [id, t] = SECTIONS[i]; return `<h2 id="${id}" data-n="Section ${i + 1}" class="${cls}">${t}</h2>`; };
  const body = `
${h2(0)}
<p>OutletOS is a centralized operations platform for restaurant groups. It pulls sales, kitchen, staffing, camera, sensor and guest data from the systems a restaurant already runs, then turns it into one live, role-aware screen for everyone from the owner to a line cook.</p>
<h3 id="principles">Design principles</h3>
${T(['Principle', 'How it holds'], [
  ['<strong>Works with any vendor</strong>', 'One canonical event model. Every source is mapped into it by REST, a no-code webhook mapping or CSV, so there is no POS or hardware lock-in.'],
  ['<strong>Lightweight</strong>', 'One Node process, the SQLite engine built into Node, and two production server dependencies (<code>express</code>, plus the Anthropic SDK used only when an API key is set). Runs on a laptop or a small VM.'],
  ['<strong>Real-time by default</strong>', 'Every write publishes an event; dashboards update over Server-Sent Events within seconds.'],
  ['<strong>Secure by construction</strong>', 'RBAC and ABAC are evaluated on the server for every request <em>and</em> every live event. Hidden fields are never computed, let alone sent.'],
  ['<strong>Privacy-first vision</strong>', 'Video is processed on-premise; only structured events leave the restaurant. Guest face matching requires explicit consent.'],
  ['<strong>Agents inherit access</strong>', 'AI agents read only through permission-checked tools that run as the signed-in user, and every action waits for human approval.'],
  ['<strong>Demo equals production</strong>', 'The simulator writes through the same ingest functions as real integrations, so what a prospect sees is what the code does.'],
])}
<h3 id="at-a-glance">At a glance</h3>
<div class="tiles">
  <div class="tile"><div class="k">Modules</div><div class="v">10</div><div class="n">screens in the app</div></div>
  <div class="tile"><div class="k">Roles</div><div class="v">8</div><div class="n">Owner → Line Cook</div></div>
  <div class="tile"><div class="k">Permissions</div><div class="v">16</div><div class="n">fine-grained RBAC</div></div>
  <div class="tile"><div class="k">AI agents</div><div class="v">8</div><div class="n">Maître + 7 specialists</div></div>
  <div class="tile"><div class="k">Ingest endpoints</div><div class="v">9</div><div class="n">REST · webhook · CSV</div></div>
  <div class="tile"><div class="k">Server deps</div><div class="v">2</div><div class="n">express · Anthropic SDK</div></div>
</div>

${h2(1, 'pb')}
<p>A single server process hosts the ingest API, the rules, the event store, the live event bus, the policy engine and the read models. The React client is served from the same process.</p>
${D_ARCH}
<h3 id="module-map">Low-level module map</h3>
${D_MODULES}
<h3 id="module-responsibilities">Module responsibilities</h3>
${T(['Module', 'Responsibility'], [
  ['<code>index.js</code>', 'HTTP routing, auth middleware, the machine-to-machine ingest router (mounted before the authenticated router), static hosting of the built client.'],
  ['<code>policy.js</code>', 'Roles → permissions, principal building, branch scope resolution, alert and live-event visibility, scrypt password checks, HMAC token issue and verify, route guards.'],
  ['<code>ingest.js</code>', 'The only write path: <code>recordOrder</code>, <code>fireTicket</code>/<code>readyTicket</code>, <code>recordAttendance</code>, <code>recordVision</code>, <code>recordReading</code>, <code>recordReview</code>, <code>recordGuestVisit</code>, <code>raiseAlert</code>. Validates, enriches, persists, evaluates rules, publishes.'],
  ['<code>metrics.js</code>', 'Scoped read models built per request: dashboard, kitchen, vision, guests, people, staffing, safety, alerts, reviews. Blocks a role may not see are skipped entirely.'],
  ['<code>guests.js</code>', 'Builds a guest profile from order history and ranks explainable suggestions; masks phone numbers for roles without <code>guests.pii</code>.'],
  ['<code>bus.js</code>', 'In-process publish/subscribe, per-user filtered SSE writes, and a 150-event ring buffer that gives a freshly opened screen context.'],
  ['<code>integrations.js</code>', 'Canonical schemas, starter mapping templates, the JSON field mapper and a dependency-free CSV parser.'],
  ['<code>simulator.js</code>', 'Demand-curve-driven orders across four channels, kitchen tickets, shifts, sensors, reviews and guest arrivals; rebuilds 7 days of history on start.'],
  ['<code>vision/</code>', '<code>rules.js</code> (twin of the edge agent’s <code>rules.py</code>, both reading <code>edge-agent/rules.json</code>), <code>scene.js</code> (synthetic cameras with detector noise) and <code>edge-sim.js</code> (virtual edge agent: batches events and heartbeats through the ingest contract).'],
  ['<code>agents/</code>', '<code>engine.js</code> runs Maître and the specialists (Claude or local engine) and logs every run; <code>agents.js</code> defines the team, scans and grounded composers; <code>tools.js</code> is the permission-checked tool registry; <code>knowledge.js</code> holds the playbook search.'],
  ['<code>db.js</code> · <code>seed.js</code>', 'Schema, indexes, settings and transactions; reference data for 6 branches, 26 menu items, 18 staff per branch, 6 cameras and 6 sensors per branch, 9 demo users and 600 guests.'],
])}

${h2(2, 'pb')}
<h3 id="sign-in">Sign-in & role routing</h3>
${D_SIGNIN}
<h3 id="role-journeys">Role journeys</h3>
${T(['Role', 'Lands on', 'Daily loop', 'Never sees'], [
  ['<strong>Owner</strong>', 'Dashboard · all branches', 'Group sales vs yesterday → weakest branch → root cause → team & access', '—'],
  ['<strong>Area Manager</strong>', 'Dashboard · own region', 'Compare branches, prime cost, staffing gaps', 'Branches outside the region'],
  ['<strong>Branch Manager</strong>', 'Dashboard · one branch', 'Clock-ins → sales → alerts → kitchen → regulars in house', 'Other branches'],
  ['<strong>Head Chef</strong>', 'Dashboard · ops only', 'Station on-time %, slow dishes, hygiene, cold chain, kitchen team', 'Sales, costs, pay rates'],
  ['<strong>Line Cook</strong>', 'Kitchen · own station', 'Clear tickets before the timer turns red', 'Everything outside the station'],
  ['<strong>Host</strong>', 'Guest Intelligence', 'Greet regulars with their usual order, allergies and offers', 'Sales, staff, full phone numbers'],
  ['<strong>Food Safety Auditor</strong>', 'Vision Intelligence', 'Compliance by control and branch, HACCP log', 'Sales; cannot resolve alerts'],
  ['<strong>IT / Integrations</strong>', 'Integrations', 'Keys, connectors, mapping tests, camera streams', 'All business data'],
])}

${h2(3, 'pb')}
<p>Notation: rectangles with a grey outline are external entities, crimson boxes are processes, and open-ended boxes are data stores (Gane–Sarson).</p>
<h3 id="dfd-0">Level 0 · context</h3>
${D_CONTEXT}
<h3 id="dfd-1">Level 1 · system</h3>
${D_DFD1}
<h3 id="dfd-2">Level 2 · process 1.0 ingest</h3>
${D_INGEST}
<h3 id="data-dictionary">Data dictionary</h3>
${T(['Flow', 'From → to', 'Key fields'], [
  ['Order', 'POS / platform → 1.0', '<code>outlet_id, channel, platform, payment, items[item_id, qty, price], covers, guest_id, closed_at</code>'],
  ['Ticket', 'KDS → 1.0', '<code>outlet_id, item, station, channel, target_sec, fired_at, ready_at</code>'],
  ['Attendance', 'Device → 1.0', '<code>staff_id | external_id, action, method, ts</code>'],
  ['Vision event', 'Edge agent → 1.0', '<code>outlet_id, camera_id, type, ok, confidence, people</code>'],
  ['Reading', 'IoT gateway → 1.0', '<code>sensor_id, value, ts</code>'],
  ['Guest visit', 'Loyalty / camera → 1.0', '<code>outlet_id, guest_id | phone, method, table_no, covers</code>'],
  ['Principal', '3.0 → 4.0 · 5.0 · 6.0', '<code>role, perms, branches, station, attrs</code>'],
])}

${h2(4, 'pb')}
<h3 id="seq-read">Authenticated read</h3>${D_READ}
<h3 id="seq-write">Webhook to live dashboards</h3>${D_WRITE}
<h3 id="seq-vision">Vision pipeline</h3>${D_VISION}
<h3 id="seq-guest">Guest recognition</h3>${D_GUEST}

${h2(5, 'pb')}
${D_ACCESS}
<h3 id="authn">Authentication</h3>
${T(['Mechanism', 'Detail'], [
  ['<strong>Passwords</strong>', '<code>scrypt</code>, per-user 16-byte salt, 32-byte key; compared with <code>timingSafeEqual</code>.'],
  ['<strong>Session tokens</strong>', '<code>base64url({uid, exp})</code> + HMAC-SHA256, 12-hour expiry. The user is re-read on every request, so disabling an account locks it out immediately.'],
  ['<strong>Machine clients</strong>', '<code>x-api-key</code> on <code>/api/v1/*</code>. Webhooks authenticate with an unguessable connector id in the URL, because many POS systems cannot set headers.'],
  ['<strong>Live stream</strong>', 'Token passed as a query parameter (EventSource cannot set headers); the socket keeps its principal for filtering.'],
])}
<h3 id="rbac">RBAC matrix</h3>
${T(['Permission', '!Owner', '!Area', '!Branch', '!Head Chef', '!Cook', '!Host', '!Auditor', '!IT'], [
  ['dashboard.view', Y, Y, Y, Y, N, N, N, N], ['sales.view', Y, Y, Y, N, N, N, N, N], ['finance.view', Y, Y, Y, N, N, N, N, N],
  ['kitchen.view', Y, Y, Y, Y, Y, N, N, N], ['vision.view', Y, Y, Y, Y, N, N, Y, N], ['safety.view', Y, Y, Y, Y, Y, N, Y, N],
  ['staff.view', Y, Y, Y, Y, N, N, N, N], ['staff.pay', Y, Y, Y, N, N, N, N, N], ['guests.view', Y, Y, Y, N, N, Y, N, N],
  ['guests.pii', Y, Y, Y, N, N, N, N, N], ['reviews.view', Y, Y, Y, N, N, Y, N, N], ['alerts.view', Y, Y, Y, Y, Y, Y, Y, N],
  ['alerts.ack', Y, Y, Y, Y, N, Y, N, N], ['users.view', Y, Y, N, N, N, N, N, Y], ['users.manage', Y, N, N, N, N, N, N, N], ['integrations.manage', Y, N, N, N, N, N, N, Y],
].map((r) => [`<code>${r[0]}</code>`, ...r.slice(1)]))}
<h3 id="abac">ABAC rules</h3>
${T(['Attribute', 'Rule', 'Enforced in'], [
  ['<strong>Branch scope</strong>', '<code>scope: all</code> roles see every branch; others only <code>users.branches</code>. Any <code>?branch=</code> outside scope → 403.', '<code>scopeBranches</code>, every read model, <code>eventVisible</code>'],
  ['<strong>Station</strong>', 'Line Cook sees tickets and speed alerts for their station only.', '<code>kitchen()</code>, <code>alertAllowed</code>'],
  ['<strong>Department</strong>', 'Head Chef sees Kitchen staff only — roster and productivity.', '<code>people()</code>, <code>staffing()</code>'],
  ['<strong>Alert category</strong>', 'Chef: speed, hygiene, safety, people · Cook: speed, safety · Host: guest · Auditor: hygiene, safety.', '<code>alertAllowed</code>'],
  ['<strong>Field level</strong>', 'Sales and finance blocks omitted without permission; pay without <code>staff.pay</code>; phone masked without <code>guests.pii</code>.', 'read models'],
  ['<strong>Escalation</strong>', 'Only <code>users.manage</code> creates users, within the creator’s own branches; nobody edits their own access.', '<code>/api/team</code>'],
])}
<h3 id="threats">Threat model</h3>
${T(['Threat', 'Mitigation', 'Status'], [
  ['Stolen session token', '12 h expiry; account re-checked per request; disable user to revoke', '<span class="tag t-ok">in place</span>'],
  ['Cross-branch data access', 'Server-side scope on every query and live event', '<span class="tag t-ok">in place</span>'],
  ['Forged ingest data', 'API key or secret connector URL; strict validation of referenced ids', '<span class="tag t-ok">in place</span>'],
  ['Credential stuffing', 'Rate limiting and lockout', '<span class="tag t-no">roadmap</span>'],
  ['Traffic interception', 'TLS termination at the load balancer', '<span class="tag t-no">roadmap</span>'],
  ['Prompt injection via ingested text', 'Tool results treated as data; read-only tools; actions need user approval', '<span class="tag t-ok">in place</span>'],
  ['Agent privilege escalation', 'Agent tools filtered by the user’s permissions and run with their principal', '<span class="tag t-ok">in place</span>'],
  ['Biometric misuse', 'Opt-in face matching enforced in the write path; no staff face recognition from CCTV', '<span class="tag t-ok">in place</span>'],
])}

${h2(6, 'pb')}
${D_ERD}
${T(['Group', 'Tables'], [
  ['Reference', '<code>outlets</code>, <code>menu_items</code>, <code>staff</code>, <code>cameras</code>, <code>sensors</code>, <code>users</code>, <code>connectors</code>, <code>settings</code>'],
  ['Events', '<code>orders</code>, <code>order_items</code>, <code>tickets</code>, <code>attendance</code>, <code>vision_events</code>, <code>readings</code>, <code>reviews</code>, <code>alerts</code>, <code>guest_visits</code>'],
  ['Guests', '<code>guests</code> (preferences, allergies, consent flag)'],
  ['Governance', '<code>agent_runs</code> (who asked which agent what, agents and tools used, engine, duration)'],
])}
<p>Thirteen indexes cover the hot paths: time-range scans per outlet, open-ticket lookup, per-camera history, alert de-duplication and guest history.</p>

${h2(7, 'pb')}
<h3 id="api-session">Session</h3>
${T(['Method', 'Path', 'Purpose'], [
  ['POST', '<code>/api/auth/login</code>', '<code>{username, password}</code> → <code>{token, user}</code>'],
  ['GET', '<code>/api/me</code>', 'User, permissions, branches in scope'],
  ['GET', '<code>/api/stream?token=</code>', 'Server-Sent Events, filtered per user'],
  ['GET', '<code>/api/feed</code>', 'Recent visible events for a fresh screen'],
])}
<h3 id="api-read">Read models</h3>
${T(['Path', 'Permission', 'Returns'], [
  ['<code>/api/dashboard</code>', 'any (blocks vary)', 'sales, hourly, sources, payments, top items, week, heatmap, board, finance, ops, staffing, scores'],
  ['<code>/api/kitchen</code>', 'kitchen.view', 'open/done tickets, station stats, 30-min series, slowest dishes'],
  ['<code>/api/vision</code>', 'vision.view', 'cameras with last event, compliance by control and branch, exceptions'],
  ['<code>/api/guests</code> · <code>/:id</code>', 'guests.view', 'arrivals with ranked suggestions, KPIs, top guests, profile'],
  ['<code>/api/people</code> · <code>/api/staffing</code>', 'staff.view', 'roster with status; TPPH, LHPO, SPLH, hourly staffing'],
  ['<code>/api/safety</code>', 'safety.view', 'sensors with two hours of readings'],
  ['<code>/api/alerts</code>', 'alerts.view', 'scope-, category- and station-filtered alerts'],
  ['<code>/api/agents</code>', 'any', 'agent roster for this role, engine and model'],
  ['<code>/api/agents/briefing</code>', 'any', 'findings from every available specialist’s scan, ranked'],
  ['<code>POST /api/agents/chat</code>', 'any (tools filtered)', '<code>{message, agent, history, branch}</code> → NDJSON: plan, step, notice, answer'],
  ['<code>/api/agents/runs</code>', 'any (own runs; all for owner/IT)', 'audit log of agent runs'],
  ['<code>/api/team</code>', 'users.view / manage', 'users, roles, matrix; create; enable or disable'],
  ['<code>/api/integrations</code>', 'integrations.manage', 'API key, schemas, templates, connectors, cameras'],
])}
<h3 id="api-ingest">Ingest v1</h3>
<p>Every endpoint accepts one object or an array and authenticates with <code>x-api-key</code>, except webhooks, which use the connector id.</p>
${T(['Path', 'Key fields'], [
  ['<code>/api/v1/orders</code>', 'outlet_id, items[] or total, channel, platform, payment, covers, guest_id'],
  ['<code>/api/v1/tickets</code>', 'outlet_id, item_id, station, fired_at — or {id, ready_at}'],
  ['<code>/api/v1/attendance</code>', 'staff_id | external_id, action, method, ts'],
  ['<code>/api/v1/vision</code>', 'array of events, or {events, heartbeats}; event: outlet_id, camera_id, type, ok, confidence, people, zone, track_id, duration_s, text'],
  ['<code>/api/v1/vision/heartbeat</code>', 'camera_id, fps, latency_ms, model, agent, status'],
  ['<code>/api/v1/readings</code>', 'sensor_id, value, ts'],
  ['<code>/api/v1/guest-visits</code>', 'outlet_id, guest_id | phone, method, table_no'],
  ['<code>/api/v1/reviews</code>', 'outlet_id, rating, platform, author, text'],
  ['<code>/api/v1/import/orders</code>', 'CSV with a header row of canonical fields'],
  ['<code>/api/v1/webhooks/:connector</code>', 'any vendor JSON, mapped by the connector'],
])}
<pre><code>{ "_each": "orders",
  "outlet_id": { "path": "location.code", "map": { "NYC-01": "r1" } },
  "total":     { "path": "totals.grand_cents", "multiply": 0.01 },
  "closed_at": { "path": "closed_at", "date": true },
  "platform":  "=Uber Eats" }</code></pre>

${h2(8, 'pb')}
${T(['Metric', 'Definition'], [
  ['<strong>Net sales · vs yesterday</strong>', 'Σ order totals since local midnight, compared with the same window 24 h earlier'],
  ['<strong>Online share</strong>', 'Sales from delivery and web ÷ net sales'],
  ['<strong>Food cost %</strong>', 'Σ theoretical food cost from menu item costs ÷ net sales'],
  ['<strong>Labour cost</strong>', 'Σ hours on shift × fully loaded hourly rate'],
  ['<strong>Prime cost %</strong>', '(food + labour) ÷ net sales · target ≤ 60%'],
  ['<strong>Kitchen on time</strong>', 'Share of dishes with ready − fired ≤ the dish’s target, last hour'],
  ['<strong>Hygiene</strong>', 'Share of passed vision checks, last 2 h (excluding person counts)'],
  ['<strong>TPPH</strong>', 'Orders ÷ labour hours · target 3.0 (kitchen view 4.8) · <code>TARGET_TPPH</code> overrides'],
  ['<strong>LHPO · SPLH</strong>', 'Labour hours per order · sales per labour hour (sales roles only)'],
  ['<strong>Recommended staff</strong>', 'ceil(orders in hour ÷ target TPPH), minimum 2; over/under at 75% / 125% of target'],
  ['<strong>Branch score</strong>', '20 sales pace · 20 speed · 20 hygiene · 15 staffing · 15 cold chain · 10 reviews'],
])}

${h2(9, 'pb')}
<p>OutletOS includes a team of AI agents. <strong>Maître</strong>, the orchestrator, takes a question in plain English, delegates it to the right <strong>specialist agents</strong> (one per module), and merges their reports into one short answer with the figures behind it. Specialists also run a proactive scan every minute, which feeds the live briefing.</p>
${D_AGENTS}
<h3 id="agent-team">Agent team</h3>
${T(['Agent', 'Owns', 'Tools', 'Available to'], [
  ['<strong>Maître</strong>', 'Planning, delegation, synthesis', '<code>ask_*</code> per available specialist · <code>search_playbook</code>', 'Any role with at least one specialist'],
  ['<strong>Revenue Analyst</strong>', 'Sales pace, channels, menu mix, prime cost', '<code>sales_overview</code> <code>sales_trend</code> <code>menu_performance</code> <code>prime_cost</code>', 'sales.view (prime cost: finance.view)'],
  ['<strong>Kitchen Ops</strong>', 'Ticket times, station bottlenecks', '<code>kitchen_status</code>', 'kitchen.view (cooks: own station)'],
  ['<strong>Vision &amp; Operations</strong>', 'Station coverage, queues, pass waits, access; PPE as audit', '<code>vision_compliance</code>', 'vision.view'],
  ['<strong>Guest Experience</strong>', 'Regulars, allergies, suggestions, reviews', '<code>guest_insights</code> <code>guest_lookup</code> <code>reviews_summary</code>', 'guests.view · reviews.view (phones masked without guests.pii)'],
  ['<strong>Workforce Planner</strong>', 'TPPH, over/under-staffing, lateness', '<code>staffing_productivity</code> <code>attendance_status</code>', 'staff.view (pay: staff.pay)'],
  ['<strong>Food Safety (HACCP)</strong>', 'Cold chain and corrective actions', '<code>cold_chain_status</code>', 'safety.view'],
  ['<strong>Incident Manager</strong>', 'Alert triage, health scores, acknowledgement', '<code>open_alerts</code> <code>branch_health</code> <code>propose_acknowledge_alerts</code>', 'alerts.view · dashboard.view (proposals: alerts.ack)'],
])}
<p>Every specialist can also call <code>search_playbook</code>, a keyword-ranked (BM25-style) search over the group’s SOPs: HACCP limits, speed targets, TPPH rules, escalation and review-response standards. Replace <code>server/src/agents/knowledge.js</code> with your own playbook; no vector database is needed.</p>
<h3 id="agent-flow">Request flow</h3>
${D_AGENT_SEQ}
${T(['Question type', 'What Maître does'], [
  ['<strong>One domain</strong> · “Which station is slowest?”', 'Delegates to one specialist and returns its answer.'],
  ['<strong>Several domains</strong> · “Sales and staffing?”', 'Delegates in parallel, then leads with a one-line synthesis.'],
  ['<strong>Root cause</strong> · “Why is Restaurant 4 behind?”', 'Finds the branch (or the weakest one), asks the owning specialist, then has every other specialist scan that branch for contributing factors.'],
  ['<strong>Briefing</strong> · “What needs my attention?”', 'Runs every available specialist’s scan and ranks findings high → medium → info.'],
  ['<strong>Action</strong> · “Acknowledge the speed alerts”', 'Incident Manager proposes the action; the browser shows an approval card; only the user’s click calls the normal acknowledge endpoint.'],
])}
<h3 id="agent-guardrails">Guardrails</h3>
${T(['Risk', 'Control'], [
  ['<strong>Agent sees too much</strong>', 'Specialists only receive tools whose permission the user holds; every tool runs with the user’s principal through <code>scopeBranches</code>, station and department filters and field masking.'],
  ['<strong>Agent changes data</strong>', 'All data tools are read-only. The one action tool only <em>proposes</em>; the user approves in the UI and the existing <code>POST /api/alerts/:id/ack</code> route re-checks permission.'],
  ['<strong>Prompt injection</strong>', 'Review text and other ingested strings reach the model only inside tool results, which the system prompt treats as data. No tool can send messages, call URLs or write records.'],
  ['<strong>Made-up numbers</strong>', 'Prompts require every figure to come from a tool result with its baseline; the local engine composes answers only from tool output.'],
  ['<strong>Out-of-scope questions</strong>', 'Questions about another branch or a hidden domain get an explicit “not available to your role” answer, never a guess.'],
  ['<strong>Accountability</strong>', 'Every run is stored in <code>agent_runs</code>: user, role, question, agents, tools, engine, duration, success. Owners and IT see all runs; others see their own.'],
  ['<strong>Model refusal or outage</strong>', 'Refusals use server-side fallback; API errors fall back to the local engine with a visible notice.'],
])}
<h3 id="agent-engines">Engines &amp; configuration</h3>
${T(['Engine', 'When it runs', 'How it reasons', 'Data leaves the server?'], [
  ['<strong>Claude</strong>', '<code>ANTHROPIC_API_KEY</code> is set', 'Maître and specialists are separate Claude tool-use loops (<code>claude-opus-5-5</code>; effort medium for Maître, low for specialists), with prompt caching and server-side refusal fallback.', 'Tool results for that question are sent to the Anthropic API'],
  ['<strong>Local</strong>', 'No key, or <code>OUTLETOS_AGENT_ENGINE=local</code>', 'Keyword router picks specialists; each composes a grounded answer from its tools and the playbook.', 'No. Everything stays on the server'],
])}
${T(['Variable', 'Default', 'Effect'], [
  ['<code>ANTHROPIC_API_KEY</code>', 'unset', 'Enables the Claude engine'],
  ['<code>OUTLETOS_AGENT_MODEL</code>', '<code>claude-opus-5-5</code>', 'Model for Maître and the specialists'],
  ['<code>OUTLETOS_AGENT_ENGINE</code>', 'auto', '<code>local</code> forces the local engine even with a key'],
])}

${h2(10, 'pb')}
<p>Cameras are the richest and cheapest sensor in a restaurant, but only if video is turned into a few structured events <em>inside</em> the building. OutletOS reuses the existing CCTV, runs small open-licence models on a low-cost edge box, and sends only JSON.</p>
${D_EDGE}
<h3 id="vision-tiers">What CCTV can measure</h3>
<p>Reliability depends on pixels on the target. A 1080p camera 4 m away gives about 200 px/m, but a nano detector sees the frame at 384–640 px, which leaves about 40–65 px/m. At that density a gloved hand is about 6×13 px, a head covering about 11 px, and use-by text under 1 px. Reliable small-object detection needs about 32 px, and OCR needs 10–20 px per character. So every check sits in one of four tiers (<code>VISION_CHECKS.tier</code> in <code>ingest.js</code>, evidence in <code>docs/research/cctv-metrics.md</code>):</p>
${T(['Tier', 'Checks', 'Behaviour'], [
  ['<strong>Real-time</strong>', 'Station staffed (coverage %), after-hours cold-store entry, walk-in door > 3 min, unattended counter, queue wait (Little’s law), dishes waiting at the pass, zone occupancy, camera health', 'Alerts on repetition. Counted in camera compliance.'],
  ['<strong>KPI</strong>', 'Time to first staff approach (proximity, not a “greeting”), first table visit, uniform %', 'Reported as aggregates (p50/p90, %). Alerts only once <code>vision_validated</code> is set for the site.'],
  ['<strong>Audit</strong>', 'Hair covering, gloves, phone use (aggregate, opt-in), sink visit after raw handling', 'Sent to a supervisor review queue. Never alerted automatically, never ranked per person. Real-time only where a camera passes the pixel-density test (≥ 125 px/m at the head, ≥ 250 px/m at the hands).'],
  ['<strong>Dropped</strong>', 'Use-by label OCR, clear-liquid spills', 'Accepted on the API for compatibility, never scored. Labels move to a scan workflow; spills need thermal cameras or manual checks.'],
])}
<p><strong>Validation before alerts go live:</strong> each site runs in shadow mode for two weeks. Ground truth is sampled by camera × daypart × lighting. Real-time alerts must reach ≥ 90% precision and ≥ 80% recall; KPIs must be within 5% daily error. Drift is audited monthly with 50 snapshots per camera.</p>
<p><strong>Privacy:</strong> staff metrics stay at station or shift level, in line with the DPDP Act, GDPR and the EU AI Act.</p>
<h3 id="vision-models">Model stack</h3>
${T(['Job', 'Recommended model', 'Licence', 'Why'], [
  ['<strong>People, phones</strong>', 'RF-DETR-Nano or D-FINE-N / DEIM-N (COCO), exported to ONNX, INT8', 'Apache-2.0', 'Real-time accuracy at nano size without the AGPL obligations of Ultralytics YOLO11/YOLO26, which needs an Enterprise licence to ship closed-source.'],
  ['<strong>PPE, spills, labels</strong>', 'Same detector fine-tuned on 3–5k frames from your own kitchens (hairnet / no_hairnet, gloves / no_gloves, apron / no_apron, spill, label)', 'Apache-2.0', 'Public kitchen-PPE sets (Roboflow Universe, CC BY 4.0) bootstrap it; own footage handles steam, lighting and uniforms.'],
  ['<strong>Tracking</strong>', 'ByteTrack-style tracker (built in); BoT-SORT / OC-SORT from Roboflow <code>trackers</code> for busy scenes', 'Apache-2.0', 'Stable anonymous ids make time rules possible: 20 s at the sink, phone held 5 s, PPE majority over 6 s.'],
  ['<strong>Hand-wash</strong>', 'Sink-zone dwell on tracked people after a raw-food or door trigger; pose (RTMPose, Apache-2.0) only if step-level scoring is needed', '—', 'Zone + dwell is cheap and explainable; per-step hand-wash scoring needs a dedicated sink camera.'],
  ['<strong>Use-by labels, tickets</strong>', 'PaddleOCR PP-OCRv5 mobile at a <em>prep-station scan point</em> (tablet or fixed close-up camera), not ceiling CCTV', 'Apache-2.0', 'Best accuracy-per-millisecond of the open OCR engines on printed text. Ceiling CCTV cannot resolve label text, so this check runs as a scan workflow.'],
  ['<strong>Fridge / oven displays</strong>', 'ssocr on a fixed crop (separate process), PaddleOCR fallback', 'GPL tool · Apache', 'Purpose-built for 7-segment digits; turns legacy equipment into a temperature sensor without wiring.'],
  ['<strong>Number plates</strong> (drive-thru, delivery bay)', 'fast-alpr + fast-plate-ocr (ONNX)', 'MIT', 'Small, multi-backend (CUDA, OpenVINO, CPU), trained on plates from 65+ countries.'],
  ['<strong>Second opinion</strong> (optional)', 'Qwen3-VL-2B/4B on the edge box, or a cloud model on a blurred snapshot', 'Apache-2.0', 'Low-frequency check of a high-severity event before it pages anyone; never on every frame.'],
])}
<h3 id="vision-hardware">Edge hardware tiers</h3>
${T(['Tier', 'Box', 'Approx. cost', 'Cameras at 2 fps'], [
  ['<strong>Small café</strong>', 'Raspberry Pi 5 + Hailo-8L AI HAT+ (model compiled to .hef)', '≈ $200–250', '2–4'],
  ['<strong>Standard restaurant</strong>', 'Intel N100 mini-PC, OpenVINO on the iGPU, INT8', '≈ $150–250', '4–8 (decode is the limit)'],
  ['<strong>Flagship / many cameras</strong>', 'NVIDIA Jetson Orin Nano Super 8 GB, TensorRT, NVDEC decode', '≈ $249 kit (street price higher)', '8–12'],
])}
<p>Sizing rule: 1–2 fps per camera is enough for compliance; use the camera’s low-resolution sub-stream (Hikvision <code>/Streaming/Channels/102</code>, Dahua <code>subtype=1</code>) and measure on your own model before buying at scale.</p>
<h3 id="vision-realtime">Real-time transport</h3>
${T(['Path', 'Technology', 'Latency'], [
  ['Camera → edge', 'RTSP sub-stream re-streamed by go2rtc or MediaMTX, so analytics and live view share one camera connection', 'local'],
  ['Edge → cloud (events)', 'HTTPS batches from a SQLite store-and-forward outbox (MQTT QoS 1 is a drop-in alternative)', '≈ 1–5 s'],
  ['Cloud → screens', 'Server-Sent Events, filtered per user by RBAC/ABAC', '< 1 s'],
  ['Live video (on demand)', 'WebRTC from go2rtc/MediaMTX on the edge box via a tunnel; never stored in the cloud', '≈ 0.1–0.3 s'],
  ['Health', 'Heartbeat per camera every 60 s; no heartbeat for 3 min marks the camera offline and raises one alert', '60 s'],
  ['Existing VMS analytics', 'Hikvision ISAPI <code>httpHosts</code> push or Dahua event API into a webhook connector, instead of running our own model', 'vendor-dependent'],
])}
<h3 id="vision-rules">Rules (shared by edge agent and simulator)</h3>
${T(['Check', 'Signal', 'Fires when', 'Escalates after'], [
  ['Station staffed', 'tracked staff in the station zone', 'no one there for 90 s', '2 in 15 min'],
  ['Hair cover · apron · gloves', 'PPE attributes per track', '≥ 60% of ≥ 5 observations bad within 6 s', '2–3 in 15 min'],
  ['Phone on the line', 'phone box inside a staff box', 'held for 5 s', '3 in 15 min'],
  ['Hand-wash', 'sink-zone dwell after raw food or the door', 'back at the station 45 s later without 20 s at the sink', '2 in 15 min'],

  ['Cold-store access', 'person in storage', 'between 23:00 and 07:00', '2 in 15 min'],
  ['Queue · pass · door · counter', 'zone occupancy and dwell (new real-time metrics)', 'wait > 5 min · dish > 2 min · door > 3 min · guest alone 30 s', '3 in 15 min'],
  ['Guest greeted · table attended', 'guest tracks vs staff in host / table zones', 'waiting 60 s · 5 min', '3 in 15 min'],
])}

${h2(11, 'pb')}
<p>OutletOS runs the restaurant as well as watching it. The back office covers the same ground as India's leading restaurant POS (Petpooja) and its competitors, and every sensitive action feeds the same audit trail, reports and AI agents. The full feature gap analysis is in <code>docs/research/petpooja-gap.md</code>.</p>
<h3 id="bo-pos">Point of sale</h3>
${T(['Capability', 'How it works'], [
  ['<strong>Tables & areas</strong>', 'Areas such as AC hall, family and terrace, each with its own numbered tables. Each table shows a live status: free, reserved, ordering, running or billed, plus elapsed time and running total. Takeaway and delivery orders sit alongside tables.'],
  ['<strong>KOT</strong>', 'Only new quantities are fired, routed by station (Tandoor, Curry, Bar…) and shown on the kitchen display. Cooks bump a ticket to mark it ready. Cancelling an item after its KOT requires a reason and is logged.'],
  ['<strong>Discounts & NC</strong>', 'Preset percentages with a required reason. Discounts above 25% and complimentary (NC) bills need a manager. All are logged to <code>audit_log</code>.'],
  ['<strong>Bill & tender</strong>', 'Tax invoice with GSTIN, FSSAI number, SAC 9963 and a CGST/SGST split for India. Totals round to the rupee. Bills are numbered per financial year (<code>R1/26-27/000001</code>). Split tender across UPI, card, cash, wallet and credit. Reprints and edits made after printing are logged.'],
  ['<strong>Settlement</strong>', 'Writes a canonical order through <code>recordOrder</code> (net + tax), so the POS feeds sales, GST, day end, reports and agents exactly like any external POS.'],
])}
<h3 id="bo-inventory">Inventory & menu</h3>
${T(['Capability', 'How it works'], [
  ['<strong>Recipes (BOM)</strong>', 'Each dish has a per-portion bill of materials. Quantities are scaled so the recipe cost equals the dish\'s standard cost, which keeps theoretical food cost consistent with sales.'],
  ['<strong>Theoretical stock</strong>', 'On hand = last physical count + purchases − wastage − Σ(items sold × recipe qty) since the count. It is computed in SQL on request, so it never drifts.'],
  ['<strong>Reorder</strong>', 'Average daily usage over 14 days. Reorder point = usage × (vendor lead time + 1). Par = usage × (lead time + 2). Suggested POs are grouped by vendor.'],
  ['<strong>Purchasing</strong>', 'Raise a PO, then receive it (GRN), which adds a purchase stock move.'],
  ['<strong>Wastage & counts</strong>', 'Wastage is logged with a reason. Each physical count records the variance between actual and theoretical stock: shortage value by ingredient points to theft, over-portioning or unrecorded waste.'],
  ['<strong>Menu & 86</strong>', 'Group-wide prices with a margin guard (a price must clear food cost × 1.25). Availability (86) is set per branch and respected by the POS and by simulated delivery orders.'],
])}
<h3 id="bo-reservations">Reservations</h3>
<p>Bookings from phone, walk-in and dining platforms, with deposits, notes and no-show tracking. A waitlist covers walk-ins. Seating a booking assigns a table and opens the order on the POS. Each booking is linked to a guest profile by phone.</p>
<h3 id="bo-finance">Finance & compliance</h3>
${T(['Capability', 'How it works'], [
  ['<strong>Day end</strong>', 'For each branch and business date it summarises net sales, tax and its split, tender mix, channels, discounts, NC, cancellations, reprints and wastage. The day closes with a declared cash amount, and the variance is stored. Closing is refused while tables are still open.'],
  ['<strong>Tax register</strong>', 'Taxable value, CGST/SGST (or VAT) and invoice value by branch and day, showing GSTIN and state. It feeds GSTR-1 (B2C) and GSTR-3B.'],
  ['<strong>Tally XML</strong>', 'One sales voucher per branch per day, loaded via Import Data → Vouchers. Ledgers: Sales - Restaurant, Output CGST / SGST, UPI / Card / Cash collections, Aggregator Receivable, Round Off.'],
  ['<strong>Aggregator reconciliation</strong>', 'Expected payout per order = gross − commission − 18% GST on commission − 0.5% TCS. Orders missing from the payout or short-paid are listed for dispute. In the demo, payout lines are simulated deterministically.'],
  ['<strong>Leakage & staff risk</strong>', 'Sensitive actions per 100 bills and as a percentage of sales, by branch. Each staff member gets a risk score: a z-score against peers of cancels, edits after print, reprints and discount value. It is a prompt to review CCTV and bills, not proof.'],
])}

${h2(12, 'pb')}
<p>Reports & Analytics is one management report per period: today, yesterday, 7 days or 14 days. Each period is compared with the prior equivalent; today is compared with the same time last week. The report reads the same fact tables as the dashboard. Closed days come from a cached daily rollup, so only today is recomputed on each request; a 14-day report takes about 0.5 seconds. Fields a role may not see are never computed. The report exports to CSV and prints to an A4 PDF.</p>
<h3 id="rep-kpi">KPI scorecard</h3>
${T(['Group', 'KPIs (target)'], [
  ['Revenue', 'Net sales (budget, phased by weekday), sales vs budget, orders, covers, average order value, spend per cover, online share, sales per seat per day'],
  ['Profitability', 'Food cost % (30%), labour cost % (28%), prime cost % (60%), contribution after prime cost. Targets come from onboarding.'],
  ['Productivity', 'Sales per labour hour, orders per labour hour (2.2 TPPH)'],
  ['Operations', 'Average ticket time, tickets on time (90%)'],
  ['Quality & compliance', 'Hygiene compliance (95%), hand-wash compliance (92%), cold chain in range (99%)'],
  ['People', 'Shift attendance (95%), on-time clock-ins (90%)'],
  ['Guests', 'Average rating (4.4★), returning-guest share (15%)'],
])}
<p>Status uses RAG bands: on target, watch (within the KPI's tolerance) or off target. Each KPI carries its definition, prior value, change and a 15-day trend.</p>
<h3 id="rep-kri">Key risk indicators</h3>
${T(['KRI', 'Amber / red', 'Owner'], [
  ['Prime cost overrun', '62% / 66%', 'Branch Manager'], ['Food cost drift', '31% / 33%', 'Head Chef'], ['Labour cost overrun', '30% / 34%', 'Branch Manager'],
  ['Revenue shortfall vs budget', '−5% / −10%', 'Area Manager'], ['Late kitchen tickets', '12% / 20%', 'Head Chef'], ['Hygiene non-compliance', '5% / 8%', 'Head Chef'],
  ['Critical breaches per 1,000 checks', '15 / 30', 'Food Safety Lead'], ['Cold-chain excursions', '0.5% / 1.5%', 'Head Chef'], ['Absenteeism · late clock-ins', '6% / 10% · 12% / 18%', 'Branch Manager'],
  ['Negative reviews (≤ 2★)', '8% / 15%', 'Branch Manager'], ['Delivery-platform dependency', '45% / 55%', 'Area Manager'], ['Cameras offline · high alerts unresolved > 30 min', '1 / 3 · 2 / 5 (live)', 'IT · Branch Manager'],
  ['Next-7-day forecast vs budget', '−3% / −8% (forward-looking)', 'Area Manager'],
])}
<h3 id="rep-compare">Comparisons</h3>
<p>The comparisons are:</p>
<ul>
<li><strong>Branch league table</strong>: ranked by share of KPIs on target, then by sales, with cells coloured against each target.</li>
<li><strong>Daily or hourly sales</strong> against the prior period and budget.</li>
<li><strong>Channel mix</strong> and <strong>dayparts</strong>, compared with the prior period.</li>
<li><strong>Menu engineering</strong> (Kasavana–Smith): each item is classed as Star, Plowhorse, Puzzle or Dog by menu mix (against 70% of fair share) and by contribution margin (against the weighted average).</li>
</ul>
<h3 id="rep-forecast">Forecasting</h3>
<p><strong>Method:</strong></p>
<ul>
<li>Holt's linear trend is fitted to weekday-adjusted daily sales over 28 days. Weekday indices come from each day's ratio to its own week.</li>
<li>The 80% prediction interval comes from recent one-step errors and widens with the horizon.</li>
<li>Today's close = actual so far + forecast × (1 − usual share of the day already done). The chance of hitting budget comes from the same error model.</li>
</ul>
<p><strong>Outputs:</strong> the 7-day plan converts forecast orders into labour hours needed at the TPPH target and compares them with rostered hours, and converts forecast sales into a food purchase at trailing food cost.</p>
<p><strong>Accuracy:</strong> every report backtests last week from the weeks before it and shows the MAPE and interval coverage. On the demo data the MAPE is about 5%.</p>

${h2(13, 'pb')}
<h3 id="con-catalog">Connector catalog</h3>
<p>The Integrations page has a marketplace of 67 pre-built connectors, India first: 38 are relevant in India. Each entry records:</p>
<ul>
<li>the connection mode and authentication fields</li>
<li>whether the vendor API is public, partner-gated or export-only</li>
<li>the data objects, webhook support and a link to the docs</li>
<li>a confidence level: verified against vendor docs (November 2026), known, or uncertain</li>
<li>generated setup steps</li>
</ul>
${T(['Category', 'India', 'Global'], [
  ['POS & billing', 'Petpooja, Restroworks (POSist), Rista, DotPe, Gofrugal, LimeTray, inresto, eZee Optimus, any India POS via CSV/SFTP (GST columns)', 'Toast, Square, Lightspeed, Oracle Simphony, NCR Aloha, Clover, Revel, Foodics, Loyverse, TouchBistro, iiko'],
  ['Delivery & aggregators', 'UrbanPiper (recommended: one connection for Zomato, Swiggy and ONDC), Zomato, Swiggy, ONDC', 'Uber Eats, DoorDash, Deliveroo, Talabat/foodpanda, GrabFood, Deliverect, Otter'],
  ['Accounting & tax', 'TallyPrime (XML), Zoho Books, GST e-invoicing (IRP)', 'QuickBooks Online, Xero'],
  ['Payments', 'Razorpay, Paytm, PhonePe, Pine Labs', 'Stripe, Adyen'],
  ['CCTV / NVR / VMS', 'CP Plus, Hikvision, Prama, Dahua, Matrix SATATYA, Uniview, Godrej/Honeywell, any ONVIF/RTSP camera', 'Axis, Hanwha, Milestone, Genetec, Verkada, Eagle Eye'],
  ['Attendance & HR', 'eSSL, ZKTeco, Matrix COSEC, greytHR, Keka, Zoho People', 'Deputy, 7shifts'],
  ['IoT', 'Any MQTT gateway, Testo Saveris', 'Monnit'],
])}
<h3 id="con-modes">Connection modes</h3>
${T(['Mode', 'Path into OutletOS'], [
  ['Webhook', 'Vendor → <code>POST /api/v1/webhooks/:connector</code> → field mapping (editable JSON, tested against a pasted sample) → canonical event'],
  ['Scheduled sync', 'A worker or the edge agent polls the vendor API every 5–15 minutes → <code>/api/v1/orders</code>'],
  ['Edge agent', 'On-premise devices (NVRs, on-prem POS, MQTT brokers). For cameras, RTSP sub-stream URLs are generated per channel for <code>edge-agent/config.json</code>.'],
  ['Device push', 'Biometric terminals call <code>/iclock/cdata</code> (ADMS/PUSH protocol) directly'],
  ['CSV / SFTP', '<code>POST /api/v1/import/orders</code> for export-only POS systems'],
  ['Outbound', 'Day-end sales to Tally, Zoho Books, QuickBooks, Xero; attendance swipes to greytHR'],
])}
<h3 id="con-security">Webhook security & devices</h3>
<p><strong>Webhooks:</strong> where the vendor signs payloads (Square, Uber Eats, Razorpay), OutletOS checks the HMAC over the raw body using the configured secret. Unsigned or wrongly signed calls get a 401 and the connector records the error. Secrets are stored server-side and only ever returned masked.</p>
<p><strong>Devices:</strong> ADMS accepts only device serial numbers registered on an eSSL or ZKTeco connector. It maps each device PIN to the staff employee code.</p>
<p><strong>Starter mappings</strong> deliberately use generic paths. Always confirm them against a real vendor payload before going live.</p>
<h3 id="con-telegram">Telegram assistant</h3>
<p>A Telegram bot is a second front door to the same server (<code>server/src/telegram.js</code>). It holds no data of its own and makes no access decisions of its own:</p>
<ul>
<li><strong>Linking:</strong> a user requests a single-use code (8 characters, 10-minute expiry) and sends <code>/start CODE</code>. The chat id is then bound to that user in <code>telegram_links</code>.</li>
<li><strong>Authorisation per message:</strong> each update re-loads the user (inactive users are unlinked) and builds the same principal as a web session. Commands call the agent tools (<code>runTool</code>), which enforce the permission and branch scope; free text goes to <code>runChat</code>, the same orchestrator as Ask Maître.</li>
<li><strong>Approvals:</strong> acknowledgements are proposed as inline buttons bound to the chat and user, expire after 30 minutes, and re-check <code>alerts.ack</code> and <code>alertAllowed</code> before writing.</li>
<li><strong>Push:</strong> a bus subscriber sends high-severity alerts to linked users for whom <code>eventVisible</code> and <code>alertAllowed</code> hold, capped at 12 per chat per hour.</li>
<li><strong>Transport:</strong> long polling (outbound only) or webhook at <code>/api/telegram/webhook/:secret</code> with Telegram's secret-token header; both secrets are compared in constant time. Group chats are refused; 20 messages per minute per chat.</li>
</ul>
${T(['Command', 'Tool', 'Permission'], [
  ['/sales', 'sales_overview', 'sales.view'], ['/report [period]', 'kpi_scorecard', 'any reporting permission'], ['/forecast', 'sales_forecast', 'sales.view'],
  ['/alerts', 'open_alerts (+ ack approval)', 'alerts.view (alerts.ack to approve)'], ['/kitchen', 'kitchen_status', 'kitchen.view'], ['/staff', 'attendance_status', 'staff.view'],
  ['/safety', 'cold_chain_status', 'safety.view'], ['/health', 'branch_health', 'dashboard.view'], ['free text', 'runChat (Maître + specialists)', 'per tool'],
])}
<p>Messages to bot chats pass through Telegram's servers and are not end-to-end encrypted; the bot is off until an administrator connects it. The full setup and user guide is the separate <em>Telegram Bot Guide</em>.</p>

${h2(14, 'pb')}
<h3 id="onb-instances">Instances</h3>
${T(['Instance', 'Start command', 'Port · database', 'Purpose'], [
  ['Global demo', '<code>npm start</code>', '8787 · outletos-v2.db', 'Six restaurants in New York, London, Paris, Dubai, Mumbai and Singapore; USD'],
  ['India demo', '<code>npm run start:india</code>', '8788 · outletos-india.db', 'Six restaurants in Mumbai, New Delhi, Bengaluru, Hyderabad, Pune and Kolkata. INR with lakh/crore formatting, GST 5% (CGST + SGST), GSTIN and FSSAI, Indian menu and recipes, wages, Swiggy/Zomato/ONDC/Magicpin, UPI-first payments, Asia/Kolkata time'],
  ['New workspace', '<code>npm run start:new</code>', '8789 · outletos-new.db', 'Empty. The owner signs up and configures everything in onboarding.'],
])}
<p>One codebase serves all three. <code>server/src/instance.js</code> holds the profiles. At runtime the organisation configured in onboarding (currency, tax, time zone, payments, platforms) overrides the profile through <code>applyOrg()</code>.</p>
<h3 id="onb-country">Country packs</h3>
<p><code>server/src/countries.js</code> covers 20 countries. For each it holds:</p>
<ul>
<li>currency and locale</li>
<li>time zones and fiscal-year start</li>
<li>the restaurant tax rate, whether prices include tax by default, and any split</li>
<li>legal IDs with validation patterns and their scope (organisation or outlet)</li>
<li>service-charge norms with the legal note</li>
<li>cash rounding</li>
<li>the local delivery platforms, payment methods and cities</li>
</ul>
<p>Examples: India (GST 5%, CGST/SGST, GSTIN and FSSAI on bills, service charge optional under the CCPA guidelines), UAE (VAT 5%, prices must include tax), Saudi Arabia (VAT 15%, ZATCA QR code), UK (VAT 20%), Germany (7% on restaurant food from 2026), US (sales tax set per outlet). Every value can be edited during setup.</p>
<h3 id="onb-flow">Onboarding flow</h3>
<p>The design is based on research into Toast, Square, Lightspeed, Foodics, Petpooja, 7shifts, Deputy and R365, with Stripe, Shopify and Gusto as SaaS benchmarks (<code>docs/research/onboarding.md</code>).</p>
<p>Sign-up creates the owner, then nine steps follow, each with a live preview:</p>
${T(['Step', 'What it collects', 'Smart defaults'], [
  ['1 · Business', 'Business type, outlet count, current POS, top-3 goals', 'Type sets floor plan vs counter service, staffing template and recommended modules'],
  ['2 · Country & tax', 'Business and legal name, brands, country, time zone, fiscal year, tax name and rate, inclusive/exclusive, service charge, organisation tax IDs', 'Everything filled from the country pack and shown as one review card. The live receipt shows tax lines, IDs and rounding.'],
  ['3 · Outlets', 'Name, city, type, address, seats, hours, daily budget, outlet IDs (GSTIN, FSSAI…), local tax rate', 'New outlets clone the previous one. Same-hours toggle. Card view or spreadsheet grid. Paste rows from Excel. Live ID validation.'],
  ['4 · Floors & tables', 'Areas with table count, seats, shape and prefix; per-table names and seats', 'Templates, generate from seats, copy to all outlets. Live floor-plan preview. Seat reconciliation against declared seats.'],
  ['5 · Menu', 'Template (Indian or International, costed with recipes), CSV import into a review grid, or build manually', 'Template prices converted into the local currency and rounded'],
  ['6 · Team & roles', 'Roster level per outlet (lean, standard, generous); invitations with role and outlet scope', 'Rosters built from service model × seats, with labour hours and cost per day'],
  ['7 · Modules & targets', 'Module toggles, food and labour targets', 'Recommended modules from type + goals; targets from business-type benchmarks'],
  ['8 · Integrations', 'Systems in use, by category', 'Recommendations from country and current POS'],
  ['9 · Review & launch', 'Readiness checklist (required vs recommended); sample activity or a clean start', 'Launch is blocked only by the required items'],
])}
<p>The draft saves automatically after every change (<code>PUT /api/setup/draft</code>) and resumes at the same step. Every step after country can be skipped.</p>
<h3 id="onb-provision">What launch creates</h3>
<p><code>POST /api/setup/complete</code> runs in a single transaction and creates:</p>
<ul>
<li>outlets, with type, hours and a legal profile</li>
<li>dining tables per area</li>
<li>menu items</li>
<li>a roster per outlet, scaled by seats, with local loaded wages</li>
<li>user accounts with temporary passwords, shown once</li>
<li>cameras and sensors for the enabled Vision and Food safety modules</li>
<li>connectors awaiting credentials</li>
<li>organisation settings, modules, targets and setup status</li>
</ul>
<p>It then optionally builds four weeks of sample activity for exactly these outlets, menu and team. The navigation shows only enabled modules.</p>

${h2(15, 'pb')}
${D_DEPLOY}
${T(['Concern', 'Today', 'Production'], [
  ['Database', 'SQLite file', 'PostgreSQL + TimescaleDB, partitioned events, row-level security per tenant'],
  ['Live fan-out', 'In-process bus', 'Redis pub/sub across API nodes'],
  ['Identity', 'Local accounts', 'SSO (OIDC / SAML), MFA, audit log'],
  ['Video', 'Simulated tiles or a direct MP4 URL', 'MediaMTX re-streams RTSP to WebRTC / HLS on demand'],
  ['Observability', 'Console logs', 'OpenTelemetry traces and metrics, ingest-lag alerts'],
])}
<h3>Front-end performance</h3>
<ul>
<li><strong>Code splitting:</strong> each page is a separate chunk loaded on demand and prefetched when the browser is idle. The first load ships only the app shell: 297 KB (95 KB gzipped) instead of 1.96 MB.</li>
<li><strong>One live connection per browser:</strong> browsers allow six HTTP/1.1 connections per host across all tabs, so one Server-Sent Events stream per tab starved page loads once several tabs were open. One tab now wins a Web Lock and holds the only stream; it relays events and connection status to the other tabs over a BroadcastChannel scoped to the session. When that tab closes, another takes over automatically. Behind an HTTP/2 proxy the limit disappears, but the sharing still saves server connections.</li>
<li><strong>Motion:</strong> sidebar width, group expand/collapse and the phone drawer animate with one easing curve; all motion is disabled for users who set "reduce motion".</li>
</ul>

${h2(16)}
<div class="box good"><div class="lbl">Built in</div>
<p><strong>Video stays on-premise.</strong> Only structured events leave the restaurant.</p>
<p><strong>Face matching is opt-in.</strong> The API rejects <code>method: face</code> for any guest without <code>consent_face</code>.</p>
<p><strong>Least privilege.</strong> Phone numbers are masked, pay rates hidden and branches scoped by default.</p>
<p><strong>Tamper-evident HACCP.</strong> Readings are timestamped by the server and never edited.</p></div>
<div class="box warn"><div class="lbl">Before go-live</div><p>Signage and staff notices for CCTV analytics, retention schedules, data-subject request handling, and a DPIA aligned with India’s DPDP Act 2023 and GDPR for EU branches.</p></div>

${h2(17)}
${T(['Package', 'Version', 'Used for'], [
  ['express', '5.3.0', 'HTTP server'], ['@anthropic-ai/sdk', '1.10.0', 'Claude engine for the AI agents (optional at runtime)'], ['react · react-dom', '19.3.1', 'UI'], ['react-router-dom', '7.18.5', 'routing'],
  ['recharts', '3.11.0', 'charts'], ['lucide-react', '1.74.0', 'icons'], ['tailwindcss · @tailwindcss/vite', '4.3.5', 'styling'], ['vite · @vitejs/plugin-react', '8.3.8 · 6.3.0', 'build'],
  ['@tensorflow/tfjs · coco-ssd', '4.22.0 · 2.2.3', 'browser vision lab (lazy-loaded)'], ['concurrently', '10.0.7', 'dev runner'],
  ['opencv-python-headless · numpy · onnxruntime', '≥ 4.10 · ≥ 1.26 · ≥ 1.20', 'edge agent (Apache-2.0 / BSD / MIT)'], ['paddleocr · fast-alpr (optional)', '≥ 3.0 · ≥ 0.3', 'edge OCR (Apache-2.0 · MIT)'], ['Node.js built-ins', 'node:sqlite · node:crypto', 'storage · auth'],
])}

${h2(18)}
${T(['Area', 'Today', 'Next'], [
  ['Tenancy', 'Single group', 'Tenant id on every table + row-level security'],
  ['Identity', 'Demo accounts, password login', 'SSO, MFA, password reset, session revocation'],
  ['Transport', 'HTTP on localhost', 'TLS everywhere, rate limiting'],
  ['Vision', 'Edge agent and simulator share one rule engine (parity-tested); edge agent verified end-to-end with stub detections', 'Field pilot on RTSP cameras, PPE/spill/label model training, Hailo .hef backend'],
  ['Integrations', '67-connector catalog with modes, auth, signing and starter mappings; ADMS device push; Tally XML', 'Certified, partner-approved connectors (Petpooja, UrbanPiper, Zomato/Swiggy via middleware); live payout files for reconciliation'],
  ['Back office', 'POS with GST invoices, KOT, NC, split tender; recipe inventory, POs, counts; reservations; day end, tax register, leakage', 'Offline billing, printer and KDS hardware drivers, captain app, QR ordering, e-invoice IRN generation, payroll'],
  ['Onboarding', 'Nine-step wizard with 20 country packs, sample activity, module gating', 'Menu OCR import, logo upload, per-outlet go-live with test order, delegated tasks, forced password change for invited users'],
  ['Intelligence', 'Maître + 7 specialist agents with KPI scorecard and forecast tools; Holt forecasts with backtest; KRI register', 'More approval-gated actions (rota changes, 86-ing dishes, POs), agent evals, scheduled digests'],
])}
<p class="foot">OutletOS Technical Product Document · v1.0 · rendered ${new Date().toISOString().slice(0, 10)} · Source: <code>docs/src/technical.mjs</code></p>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>OutletOS — Technical Product Document</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
<style>${CSS}</style></head><body>
<div class="shell">
<nav class="toc"><div class="mark">${LOGO} OutletOS</div><div class="sub">Technical Product Document</div>${toc}</nav>
<article>
  <section class="cover"><div class="cm">${LOGO} OutletOS</div><div><p class="eyebrow" style="color:#fff;opacity:.8">Technical Product Document</p><h1>How OutletOS works</h1><p class="cs">Architecture, data flows, user flows, AI agents, security model, data model and APIs of a centralized operations platform for multi-location restaurants.</p></div><div class="cmeta"><span>Version 1.0</span><span>November 2026</span><span>19 sections</span></div></section>
  <header class="doc"><p class="eyebrow">Technical Product Document</p><h1>How OutletOS works</h1>
  <p class="standfirst">The architecture, data flows, user flows, security model and interfaces of a centralized operations platform for restaurant groups — written for the engineers, integrators and reviewers who need to trust it before it runs a kitchen.</p>
  <div class="docmeta"><span><b>Version</b> 1.0</span><span><b>Rendered</b> ${new Date().toISOString().slice(0, 10)}</span><span><b>Sections</b> 19</span><span><b>Diagrams</b> 16</span></div></header>
  <div class="box key"><p><strong>OutletOS</strong> connects to the POS, delivery apps, kitchen screens, attendance devices, cameras and sensors a restaurant group already owns, and turns them into <strong>one live screen per role</strong> — sales and costs for owners, station tickets for cooks, regulars and allergies for hosts — <strong>with access enforced on the server for every request and every live update.</strong> A team of AI agents answers questions over the same permission-checked data.</p></div>
  ${body}
</article></div>
<script>
const links=[...document.querySelectorAll('nav.toc a')];const map=new Map(links.map(a=>[a.getAttribute('href').slice(1),a]));
const io=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting){links.forEach(l=>l.classList.remove('on'));map.get(e.target.id)?.classList.add('on');}})},{rootMargin:'0px 0px -75% 0px'});
document.querySelectorAll('h2[id],h3[id]').forEach(h=>io.observe(h));
</script></body></html>`;
}
