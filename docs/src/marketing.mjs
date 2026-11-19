import { LOGO, icon } from './lib.mjs';
import { frame, doc } from './pages.mjs';

const W = (name, size = 18, color = '#D92D3A') => icon(name, { size, color, stroke: 2.2 });

// ======================= ONE-PAGER =======================
const ONE_CSS = `
.hero{position:relative;height:104mm;padding:12mm 14mm;color:#fff;background:radial-gradient(90% 90% at 95% 0%,#F97316 0%,transparent 55%),linear-gradient(150deg,#D92D3A 0%,#7A1A22 58%,#1A0B0E 100%)}
.hero .b{display:flex;align-items:center;gap:9px;font-weight:800;font-size:13pt}.hero .b svg{width:28px;height:28px}
.hero .k{font-family:var(--m);font-size:7.5pt;letter-spacing:.24em;text-transform:uppercase;opacity:.8;margin-top:8mm}
.hero h1{font-size:34pt;font-weight:800;letter-spacing:-.045em;line-height:1;margin-top:3mm;max-width:92mm}
.hero p{font-size:10.2pt;line-height:1.45;opacity:.9;margin-top:4mm;max-width:88mm}
.hero .shotw{position:absolute;right:-16mm;top:16mm;width:112mm;transform:rotate(-3deg)}
.hero .shotw .shot{margin:0;border:0}
.badge{position:absolute;background:#fff;color:var(--ink);border-radius:10px;padding:2.4mm 3.2mm;box-shadow:0 12px 26px -10px rgba(0,0,0,.45);display:flex;gap:8px;align-items:center;font-size:7.5pt;z-index:3}
.badge b{display:block;font-size:11.5pt;font-weight:800;letter-spacing:-.02em;line-height:1.1}.badge span{color:var(--ink3)}
.badge .i{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;background:var(--soft)}
.ps{display:grid;grid-template-columns:1fr 1fr;gap:5mm;margin:6mm 14mm 0}
.ps .c{border-radius:12px;padding:4mm 5mm}
.ps .bad{background:#F7F3F2}.ps .good{background:linear-gradient(135deg,#FDF0F1,#FFF4EC)}
.ps h3{font-family:var(--m);font-size:7pt;letter-spacing:.2em;text-transform:uppercase;font-weight:600;margin-bottom:2mm}
.ps .bad h3{color:var(--ink3)}.ps .good h3{color:var(--crimson)}
.ps li{list-style:none;display:flex;gap:7px;font-size:8.8pt;line-height:1.4;margin:1.6mm 0;color:var(--ink2)}
.ps li svg{flex:none;margin-top:1px}
.pillars{display:grid;grid-template-columns:repeat(3,1fr);gap:3.5mm;margin:4.5mm 14mm 0}
.pl{border:1px solid var(--rule);border-radius:12px;padding:3.2mm 3.8mm;background:#fff}
.pl .i{width:30px;height:30px;border-radius:9px;background:var(--soft);display:grid;place-items:center}
.pl b{display:block;font-size:10pt;margin-top:2.2mm;letter-spacing:-.01em}.pl span{display:block;font-size:8.2pt;color:var(--ink2);line-height:1.42;margin-top:1mm}
.measure{margin:5mm 14mm 0;display:flex;flex-wrap:wrap;gap:5px;align-items:center}
.measure .lbl{font-family:var(--m);font-size:7pt;letter-spacing:.18em;text-transform:uppercase;color:var(--ink3);margin-right:4px}
.measure span.m{font-size:7.8pt;font-weight:600;padding:3px 9px;border-radius:20px;background:#F3EFEE;color:var(--ink)}
.how{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm;margin:4.5mm 14mm 5mm}
.how>div{display:flex;gap:9px;align-items:flex-start}
.how .s{flex:none;width:26px;height:26px;border-radius:50%;background:var(--ink);color:#fff;font-weight:800;font-size:9pt;display:grid;place-items:center}
.how b{font-size:9.5pt;display:block;margin-bottom:.6mm}.how span{display:block;font-size:8.2pt;color:var(--ink2);line-height:1.38}
.cta{margin:auto 14mm 9mm;border-radius:14px;padding:5mm 6mm;display:flex;justify-content:space-between;align-items:center;background:var(--deep);color:#fff}
.cta b{font-size:13pt;letter-spacing:-.02em}.cta span{font-size:8.2pt;opacity:.75;display:block;margin-top:1mm}
.cta .btn{background:linear-gradient(135deg,#D92D3A,#F97316);padding:3mm 6mm;border-radius:30px;font-weight:700;font-size:10pt;white-space:nowrap}`;

export function onePager() {
  const page = `<section class="page">
  <div class="hero"><div class="b">${LOGO} OutletOS</div>
    <div class="k">For multi-location restaurant groups</div>
    <h1>Every branch. One screen.</h1>
    <p>Sales, kitchen speed, CCTV intelligence, guests, staffing and food safety from the systems you already own, live for every role, with AI agents that answer in plain English.</p>
    <div class="shotw">${frame('01-dashboard.jpg')}</div>
    <div class="badge" style="right:62mm;top:76mm"><span class="i">${W('trending-up', 15)}</span><div><b>Live</b><span>sales vs yesterday</span></div></div>
    <div class="badge" style="right:12mm;top:86mm"><span class="i">${W('sparkles', 15)}</span><div><b>8 AI agents</b><span>within each role’s access</span></div></div>
  </div>
  <div class="ps">
    <div class="c bad"><h3>Today</h3><ul>
      ${['POS, apps, rotas, CCTV and fridge logs in separate tools', 'Answers need a spreadsheet, after the shift', 'Regulars treated like strangers', 'Everyone sees everything, or nothing'].map((t) => `<li>${W('circle-x', 14, '#9A8E91')}${t}</li>`).join('')}</ul></div>
    <div class="c good"><h3>With OutletOS</h3><ul>
      ${['One live view across every branch and channel', 'Ask “why is a branch behind?” and agents find the cause', 'Every regular recognised, with their usual order', 'Access by role, branch and station, on the server'].map((t) => `<li>${W('circle-check', 14)}${t}</li>`).join('')}</ul></div>
  </div>
  <div class="pillars">
    ${[['monitor-smartphone', 'POS to profit', 'GST/VAT billing, KOTs, recipe-based inventory, Tally export and aggregator reconciliation.'], ['chef-hat', 'Kitchen & food safety', 'Live tickets timed per dish, and a HACCP log that writes itself.'], ['cctv', 'Vision you can trust', 'Station coverage, queues, pass waits and after-hours access from existing CCTV, measured honestly.'],
      ['file-bar-chart', 'KPIs, KRIs & forecasts', 'A management report with risk thresholds, branch league tables and a 7-day plan.'], ['globe', 'Set up anywhere', 'Guided onboarding with 20 country packs and 67 connectors, India first.'], ['sparkles', 'AI agent team', 'Maître and seven specialist agents answer in the app or on Telegram, explain and flag issues, and every action waits for approval.']]
      .map(([ic, t, d]) => `<div class="pl"><span class="i">${W(ic, 16)}</span><b>${t}</b><span>${d}</span></div>`).join('')}
  </div>
  <div class="measure"><span class="lbl">Measure from day one</span>${['Net sales vs yesterday', 'Online share', 'Prime cost', 'TPPH', 'Kitchen on-time', 'Station coverage', 'Cold chain', 'Branch score'].map((m) => `<span class="m">${m}</span>`).join('')}</div>
  <div class="how">
    <div><span class="s">1</span><div><b>Connect</b><span>Any POS, delivery app, attendance device, camera or sensor. No code.</span></div></div>
    <div><span class="s">2</span><div><b>See</b><span>One live screen per role, from owner to line cook.</span></div></div>
    <div><span class="s">3</span><div><b>Ask &amp; act</b><span>AI agents, smart alerts and guest suggestions turn data into the next move.</span></div></div>
  </div>
  <div class="cta"><div><b>See your restaurants on one screen in 20 minutes.</b><span>Built for owners, area and branch managers, chefs, hosts and auditors.</span></div><span class="btn">Book a demo →</span></div>
  </section>`;
  return doc('OutletOS · Value Proposition', ONE_CSS, [page]);
}

// ======================= CASE STUDY =======================
const CS_CSS = `
.cs-hero{padding:13mm 14mm 10mm;background:linear-gradient(150deg,#1A0B0E 0%,#3A1117 60%,#7A1A22 100%);color:#fff;position:relative}
.cs-hero .top{display:flex;justify-content:space-between;align-items:center}
.cs-hero .b{display:flex;align-items:center;gap:8px;font-weight:800;font-size:11pt}.cs-hero .b svg{width:24px;height:24px}
.illu{font-family:var(--m);font-size:6.8pt;letter-spacing:.16em;text-transform:uppercase;border:1px solid rgba(255,255,255,.35);border-radius:20px;padding:3px 9px;opacity:.9}
.cs-hero .k{font-family:var(--m);font-size:7.5pt;letter-spacing:.22em;text-transform:uppercase;color:#FF9AA2;margin-top:9mm}
.cs-hero h1{font-size:27pt;font-weight:800;letter-spacing:-.04em;line-height:1.05;margin-top:3mm;max-width:150mm}
.cs-hero p{font-size:10pt;opacity:.82;margin-top:3mm;max-width:150mm;line-height:1.5}
.facts{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;margin-top:7mm}
.facts div{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:3mm 3.5mm}
.facts b{display:block;font-size:15pt;font-weight:800;letter-spacing:-.03em}.facts span{font-size:7.5pt;opacity:.75}
.cols{display:grid;grid-template-columns:1.05fr 1fr;gap:7mm;padding:8mm 14mm 0}
.sh{font-family:var(--m);font-size:7pt;letter-spacing:.2em;text-transform:uppercase;color:var(--crimson);font-weight:600;margin-bottom:2.5mm;display:flex;gap:6px;align-items:center}
.cols p{font-size:9.2pt;color:var(--ink2);line-height:1.55;margin-bottom:2.5mm}
.pain li,.mods li{list-style:none;display:flex;gap:8px;font-size:8.8pt;color:var(--ink2);line-height:1.42;margin:2mm 0}
.mods{display:grid;grid-template-columns:1fr 1fr;gap:2.5mm}
.mods li{margin:0;padding:2.6mm 3mm;border:1px solid var(--rule);border-radius:9px;background:var(--paper);align-items:center}
.mods li b{color:var(--ink);font-size:8.6pt}
.tl{margin:7mm 14mm 0;display:grid;grid-template-columns:repeat(4,1fr);gap:0;position:relative}
.tl:before{content:'';position:absolute;left:4%;right:4%;top:11px;height:2px;background:linear-gradient(90deg,#D92D3A,#F97316)}
.tl div{position:relative;padding-top:8mm;padding-right:4mm}
.tl i{position:absolute;top:2px;left:0;width:20px;height:20px;border-radius:50%;background:#fff;border:3px solid var(--crimson)}
.tl b{display:block;font-size:9.5pt}.tl em{font-style:normal;font-family:var(--m);font-size:6.8pt;letter-spacing:.14em;color:var(--crimson);text-transform:uppercase}
.tl span{display:block;font-size:8.2pt;color:var(--ink2);line-height:1.42;margin-top:1mm}
.quote{margin:7mm 14mm 0;border-left:3px solid var(--crimson);padding:2mm 0 2mm 5mm}
.quote p{font-size:12.5pt;font-weight:600;letter-spacing:-.015em;line-height:1.45}
.quote span{display:block;margin-top:2mm;font-size:8pt;color:var(--ink3)}
.score{display:grid;grid-template-columns:repeat(3,1fr);gap:3.5mm;margin:5mm 14mm 0}
.score>div{border-radius:12px;padding:3.3mm 4mm;border:1px solid var(--rule);background:#fff}
.score b{display:block;font-size:22pt;font-weight:800;letter-spacing:-.04em;line-height:1;color:var(--crimson)}
.score em{font-style:normal;font-size:9.4pt;font-weight:700;display:block;margin-top:2mm}
.score span{display:block;font-size:8pt;color:var(--ink2);line-height:1.42;margin-top:1mm}
.score .f{font-family:var(--m);font-size:6.5pt;letter-spacing:.14em;text-transform:uppercase;color:var(--teal);margin-top:2mm}
.targets{margin:6mm 14mm 0;border:1px solid var(--rule);border-radius:12px;overflow:hidden}
.targets table{width:100%;border-collapse:collapse;font-size:8.6pt}
.targets th{background:var(--soft);color:var(--wine);font-family:var(--m);font-size:6.6pt;letter-spacing:.14em;text-transform:uppercase;text-align:left;padding:2.6mm 3.4mm;font-weight:600}
.targets td{padding:2.5mm 3.4mm;border-top:1px solid var(--rule);color:var(--ink2)}.targets td b{color:var(--ink)}
.shots2{display:grid;grid-template-columns:1fr 1fr;gap:5mm;margin:6mm 14mm 0}
.shots2 .shot{margin:0}.shots2 .cap{font-size:7.8pt;color:var(--ink3);margin-top:2mm}
.note{margin:5mm 14mm 0;font-size:7.4pt;color:var(--ink3);line-height:1.5;border-top:1px solid var(--rule);padding-top:3mm}
.cs-cta{margin:auto 14mm 10mm;border-radius:14px;padding:5mm 6mm;display:flex;justify-content:space-between;align-items:center;background:linear-gradient(135deg,#D92D3A,#F97316);color:#fff}
.cs-cta b{font-size:12.5pt}.cs-cta span{font-size:8.2pt;opacity:.9;display:block;margin-top:1mm}.cs-cta .btn{background:#fff;color:var(--crimson);padding:3mm 6mm;border-radius:30px;font-weight:800;font-size:9.5pt;white-space:nowrap}`;

export function caseStudy() {
  const p1 = `<section class="page">
  <div class="cs-hero"><div class="top"><div class="b">${LOGO} OutletOS</div><span class="illu">Illustrative case study</span></div>
    <div class="k">Multi-location casual dining</div>
    <h1>How a six-restaurant group replaced five dashboards with one live view</h1>
    <p>An illustrative rollout of OutletOS at a group running six restaurants across four countries, from the first POS connection to every role working from one screen in four weeks.</p>
    <div class="facts"><div><b>6</b><span>restaurants</span></div><div><b>4</b><span>countries</span></div><div><b>108</b><span>team members</span></div><div><b>9</b><span>delivery channels</span></div></div>
  </div>
  <div class="cols">
    <div><div class="sh">${W('triangle-alert', 13)}The challenge</div>
      <p>The group was growing fast, but every answer lived in a different tool: sales in two POS systems, delivery in five partner portals, rotas in spreadsheets, fridge temperatures on paper, and CCTV that nobody had time to watch.</p>
      <ul class="pain">${['Owners learnt about a bad night the next morning', 'Area managers spent hours stitching reports together', 'Hygiene and cold-chain checks depended on memory', 'Regular guests were never recognised across branches'].map((t) => `<li>${W('circle-x', 14, '#9A8E91')}${t}</li>`).join('')}</ul>
    </div>
    <div><div class="sh">${W('sparkles', 13)}The solution</div>
      <p>OutletOS connected to the systems already in place, gave every role its own live workspace, and added a team of AI agents that answer questions within each role’s access.</p>
      <ul class="mods">${[['monitor-smartphone', 'POS & billing'], ['boxes', 'Inventory & menu'], ['chef-hat', 'Kitchen operations'], ['cctv', 'Vision intelligence'], ['file-bar-chart', 'Reports, KRIs, forecasts'], ['landmark', 'Finance & compliance'], ['sparkles', 'AI agents, alerts & Telegram'], ['shield-check', 'Role-based access']].map(([ic, t]) => `<li>${W(ic, 15)}<b>${t}</b></li>`).join('')}</ul>
    </div>
  </div>
  <div class="tl">
    ${[['Week 1', 'Connect sales', 'POS and delivery webhooks mapped without code; 7-day history visible.'], ['Week 2', 'People & cold chain', 'Face and fingerprint clock-ins; fridge sensors logging every minute.'], ['Week 3', 'Vision on CCTV', 'Edge box per restaurant on existing cameras; station coverage and access alerts live, PPE in audit.'], ['Week 4', 'Roles, agents, training', '8 roles by branch and station; managers ask Maître in the app or on Telegram instead of building reports.']]
      .map(([w, t, d]) => `<div><i></i><em>${w}</em><b>${t}</b><span>${d}</span></div>`).join('')}
  </div>
  <div class="quote"><p>“For the first time I can see every kitchen, every channel and every regular from one screen, and my chefs only see what they need to cook.”</p><span>Illustrative persona · Group Operations Director</span></div>
  <div class="pf" style="margin-top:auto"><span>OutletOS · Case study (illustrative)</span><span class="pn">01</span></div>
  </section>`;

  const p2 = `<section class="page">
  <div class="ph" style="padding-top:11mm"><div class="mod"><span class="num">RESULTS</span><span class="sec">What changed</span></div><div class="brand">${LOGO} OutletOS</div></div>
  <h1 class="t" style="margin:5mm 14mm 0">From five tools to one live view</h1>
  <div class="score">
    ${[['5 → 1', 'Screens to check each morning', 'POS, delivery portals, rota, temperature log and CCTV in one place.', 'Platform capability'], ['7 → 1', 'Modules checked per “why?”', 'Maître asks every specialist agent and returns one answer with the likely cause.', 'Platform capability'], ['1,440', 'Readings per fridge per day', 'Every sensor logs each minute; excursions are captured automatically.', 'Platform capability'],
      ['8', 'Roles, scoped by branch', 'Owners see everything; a line cook sees only their station.', 'Platform capability'], ['24 / 7', 'Station coverage & access', 'Staffed stations, queues, pass waits and after-hours entry on existing cameras; PPE sampled for audit.', 'Platform capability'], ['100%', 'Regulars flagged at arrival', 'Every recognised guest arrives with allergies and their usual order.', 'For opted-in & checked-in guests']]
      .map(([b, e, s, f]) => `<div><b>${b}</b><em>${e}</em><span>${s}</span><div class="f">${f}</div></div>`).join('')}
  </div>
  <div class="targets"><table><thead><tr><th>Pilot KPI</th><th>How OutletOS measures it</th><th>Where to see it</th></tr></thead><tbody>
    ${[['Prime cost %', 'Food cost from menu costs + labour from clock-ins, ÷ sales', 'Dashboard · Prime cost gauge'], ['TPPH', 'Orders ÷ labour hours, hour by hour, against target', 'Workforce · Staffing & productivity'], ['Kitchen on-time %', 'Dishes ready within their own target time', 'Kitchen Operations'], ['Camera compliance', 'Passed reliable camera checks (coverage, access, queue, pass) per branch', 'Vision Intelligence'], ['Returning-guest share', 'Dine-in orders linked to a known guest', 'Guest Intelligence'], ['Agent adoption', 'Questions answered by agents, by role, in the app and on Telegram; every run logged', 'AI Agents · agent_runs log']]
      .map(([a, b, c]) => `<tr><td><b>${a}</b></td><td>${b}</td><td>${c}</td></tr>`).join('')}</tbody></table></div>
  <div class="shots2">
    <div>${frame('04-branches.jpg', [], { crop: [60, 410] })}<div class="cap">Every branch ranked with a live score and today’s sales trend.</div></div>
    <div>${frame('08-vision-midnight.jpg', [], { crop: [60, 440] })}<div class="cap">Vision intelligence on existing CCTV, shown in Midnight mode.</div></div>
  </div>
  <p class="note">This is an illustrative case study. The customer, persona and quote are representative, not a named client. Results marked “platform capability” describe how OutletOS behaves, verified in the product demo environment; pilot KPIs should be baselined in week one and reported from live data.</p>
  <div class="cs-cta"><div><b>Run a four-week pilot in your restaurants.</b><span>Connect one branch in a day. Every role live in four weeks.</span></div><span class="btn">Book a pilot →</span></div>
  </section>`;
  return doc('OutletOS · Case Study', CS_CSS, [p1, p2]);
}
