// Captures the product screenshots used by the training guide and marketing documents.
//   node marketing/capture.mjs            (all shots; the global, India and new-workspace instances must be running)
//   node marketing/capture.mjs pos        (only shots whose file name contains "pos")
// Drives headless Chrome over the DevTools protocol (Node's built-in WebSocket), 1280×665 viewport, JPEG.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const DIR = resolve(dirname(fileURLToPath(import.meta.url)), 'shots');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find(existsSync);
const PW = process.env.DEMO_PASSWORD || 'demo1234';
const G = 'http://localhost:8787', IN = 'http://localhost:8788', NEW = 'http://localhost:8789';
const only = process.argv.slice(2).find((a) => !a.startsWith('--'));
const DAYTIME = process.argv.includes('--daytime'); // live-sales screens: capture during trading hours only
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// [file, base, user, path, options]  options: { theme, scroll, wait, run (JS in page before capture), height }
const SHOTS = [
  ['~01-dashboard.jpg', G, 'owner', '/', { wait: 6000 }],
  ['~02-sales-mix.jpg', G, 'owner', '/', { scroll: 640 }],
  ['~03-week-heatmap.jpg', G, 'owner', '/', { scroll: 1290 }],
  ['~04-branches.jpg', G, 'owner', '/', { scroll: 1900 }],
  ['~05-staffing.jpg', G, 'owner', '/', { scroll: 2480 }],
  ['~06-kitchen.jpg', G, 'chef.r1', '/kitchen'],
  ['07-vision.jpg', G, 'owner', '/vision', { branch: 'r1' }],
  ['08-vision-midnight.jpg', G, 'owner', '/vision', { branch: 'r1', theme: 'midnight' }],
  ['~09-guests.jpg', G, 'host.r1', '/guests'],
  ['~10-workforce.jpg', G, 'manager.r1', '/staff'],
  ['11-safety.jpg', G, 'chef.r1', '/safety'],
  ['12-alerts.jpg', G, 'owner', '/alerts'],
  ['13-access.jpg', G, 'owner', '/team'],
  ['15-themes.jpg', G, 'owner', '/', { run: `document.querySelector('[aria-label="Theme"],[aria-label*="theme" i]')?.click()`, wait: 900 }],
  ['16-login.jpg', G, null, '/'],
  ['~17-cook.jpg', G, 'cook.r1', '/kitchen'],
  ['~18-host.jpg', G, 'host.r1', '/guests'],
  ['22-agents.jpg', G, 'owner', '/agents', { wait: 2500 }],
  ['14-integrations-safe.jpg', G, 'it.admin', '/integrations', { wait: 3500 }],
  ['~19-guest-profile.jpg', G, 'host.r1', '/guests', { wait: 3500, run: `[...document.querySelectorAll('main li button')].find(b=>/visits/.test(b.innerText))?.click()`, wait2: 1500 }],
  ['20-access-add.jpg', G, 'owner', '/team', { wait: 3000 }],
  ['~21-workforce-roster.jpg', G, 'manager.r1', '/staff', { wait: 3500, run: `[...document.querySelectorAll('h2,h3')].find(h=>/people$/.test(h.innerText.trim()))?.scrollIntoView()`, offset: -90 }],
  ['~23-agent-approval.jpg', G, 'owner', '/', { wait: 4500, run: `(async()=>{[...document.querySelectorAll('button')].find(b=>/Ask Ma/.test(b.innerText))?.click(); await new Promise(r=>setTimeout(r,900)); const t=document.querySelector('textarea'); const set=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set; set.call(t,'Acknowledge the open speed alerts'); t.dispatchEvent(new Event('input',{bubbles:true})); await new Promise(r=>setTimeout(r,200)); t.closest('form').requestSubmit();})()`, after: `new Promise(r=>setTimeout(r,10))`, afterWait: 5000 }],
  // new modules (India instance: INR, GST, Indian menu)
  ['30-pos-tables.jpg', IN, 'manager.r1', '/pos'],
  ['31-pos-order.jpg', IN, 'manager.r1', '/pos', { run: `[...document.querySelectorAll('button')].find(b=>/^T\\d+/.test(b.innerText.trim()) && !/₹/.test(b.innerText))?.click()`, wait: 1500, after: `(async()=>{const items=[...document.querySelectorAll('main button, section button')].filter(b=>/₹/.test(b.innerText)&&b.closest('section'));for(const i of [0,3,3,8,12]){items[i]?.click();await new Promise(r=>setTimeout(r,350));}})()`, afterWait: 2500 }],
  ['32-inventory.jpg', IN, 'manager.r1', '/inventory'],
  ['33-inventory-po.jpg', IN, 'manager.r1', '/inventory', { run: `[...document.querySelectorAll('[role=tab]')].find(b=>b.innerText.includes('Purchasing'))?.click()`, wait: 1200 }],
  ['34-menu-86.jpg', IN, 'manager.r1', '/inventory', { run: `[...document.querySelectorAll('[role=tab]')].find(b=>b.innerText.includes('Menu'))?.click()`, wait: 1200 }],
  ['35-reservations.jpg', IN, 'manager.r1', '/reservations', { wait: 6000 }],
  ['36-finance-dayend.jpg', IN, 'manager.r1', '/finance', { wait: 6000 }],
  ['37-finance-recon.jpg', IN, 'owner', '/finance', { wait: 5000, run: `[...document.querySelectorAll('[role=tab]')].find(b=>b.innerText.includes('Aggregator'))?.click()`, wait: 1500 }],
  ['38-finance-leakage.jpg', IN, 'owner', '/finance', { wait: 5000, run: `[...document.querySelectorAll('[role=tab]')].find(b=>b.innerText.includes('Leakage'))?.click()`, wait: 1500 }],
  ['39-reports.jpg', IN, 'owner', '/reports', { wait: 7000 }],
  ['40-reports-kri.jpg', IN, 'owner', '/reports', { wait: 7000, run: `[...document.querySelectorAll('h2')].find(h=>h.innerText==='Key risk indicators')?.scrollIntoView()`, offset: -90 }],
  ['41-reports-forecast.jpg', IN, 'owner', '/reports', { wait: 7000, run: `[...document.querySelectorAll('h2')].find(h=>h.innerText==='Forecast')?.scrollIntoView()`, offset: -90 }],
  ['42-integrations.jpg', IN, 'it.admin', '/integrations', { wait: 5000, run: `[...document.querySelectorAll('h2')].find(h=>h.innerText==='Connector marketplace')?.scrollIntoView()`, offset: -90 }],
  ['43-vision-metrics.jpg', IN, 'owner', '/vision', { branch: 'r1' }],
  ['44-nav-rail.jpg', IN, 'owner', '/reports', { wait: 2000, rail: true }],
  // Telegram assistant: needs `node server/scripts/telegram-demo.mjs` running (local stand-in for the Bot API)
  ['45-telegram-admin.jpg', IN, 'it.admin', '/integrations', { wait: 4000, run: `[...document.querySelectorAll('h2')].find(h=>h.innerText.includes('Telegram assistant'))?.scrollIntoView()`, offset: -90 }],
  ['46-telegram-connect.jpg', IN, 'owner', '/', { wait: 4000, run: `document.querySelector('button[title="Telegram assistant"]')?.click()`, wait2: 1500 }],
];
const ONBOARD = [
  ['50-onb-signup.jpg', null],
  ['51-onb-business.jpg', 'business'], ['52-onb-country.jpg', 'compliance', 780], ['53-onb-outlets.jpg', 'outlets'], ['54-onb-tables.jpg', 'tables'],
  ['55-onb-menu.jpg', 'menu'], ['56-onb-team.jpg', 'team'], ['57-onb-modules.jpg', 'modules'], ['58-onb-integrations.jpg', 'integrations'], ['59-onb-review.jpg', 'review'],
];
const DRAFT = {
  profile: { business_type: 'casual', outlet_band: '2-5', goals: ['food_cost', 'safety', 'visibility'], current_pos: 'petpooja' },
  org: { group: 'Saffron Table Group', legal_name: 'Saffron Table Foods Pvt. Ltd.', country: 'IN', currency: { code: 'INR', symbol: '₹', locale: 'en-IN' }, timezone: 'Asia/Kolkata', fiscal: 4, service_pct: 0, brands: ['Saffron Table', 'Tandoor Co.'], business_type: 'casual',
    tax: { name: 'GST', rate: 0.05, inclusive: false, sac: '9963', split: [['CGST', 0.025], ['SGST', 0.025]] }, ids: {} },
  outlets: [
    { key: 'k1', name: 'Saffron Bandra', city: 'Mumbai', address: 'Linking Road, Bandra West', type: 'casual', seats: 96, hours: { open: '11:00', close: '23:30' }, ids: { gstin: '27AABCS1234F1Z5', fssai: '11524998000123' }, daily_target: 250000,
      areas: [{ name: 'AC Hall', count: 10, seats: 4, shape: 'square', prefix: 'T', tables: Array.from({ length: 10 }, (_, i) => ({ name: `T${i + 1}`, seats: 4, shape: 'square' })) }, { name: 'Family', count: 6, seats: 6, shape: 'rect', prefix: 'T', tables: Array.from({ length: 6 }, (_, i) => ({ name: `T${i + 11}`, seats: 6, shape: 'rect' })) }, { name: 'Terrace', count: 6, seats: 4, shape: 'round', prefix: 'P', tables: Array.from({ length: 6 }, (_, i) => ({ name: `P${i + 1}`, seats: 4, shape: 'round' })) }] },
    { key: 'k2', name: 'Saffron Connaught Place', city: 'New Delhi', address: 'Block A, Connaught Place', type: 'fine_dine', seats: 140, hours: { open: '11:00', close: '23:30' }, ids: { gstin: '07AABCS1234F1Z9' }, daily_target: 320000, areas: [] },
    { key: 'k3', name: 'Tandoor Co. Cloud Kitchen', city: 'Bengaluru', address: 'HSR Layout', type: 'cloud', seats: 0, hours: { open: '11:00', close: '02:00' }, ids: {}, daily_target: 120000, areas: [] },
  ],
  menu: { source: 'template', template: 'indian' },
  team: { invites: [{ name: 'Kavya Rao', email: 'kavya@example.test', role: 'area_manager', outlets: [] }, { name: 'Rohan Mehta', email: 'rohan@example.test', role: 'branch_manager', outlets: ['k1'] }, { name: 'Suresh Pillai', email: 'suresh@example.test', role: 'head_chef', outlets: ['k1'] }] },
  modules: ['pos', 'kds', 'inventory', 'reservations', 'guests', 'workforce', 'safety', 'vision', 'reports', 'finance', 'agents'],
  targets: { food: 0.3, labour: 0.26 },
  integrations: [{ catalog_id: 'urbanpiper', outlet: 'all' }, { catalog_id: 'zomato', outlet: 'all' }, { catalog_id: 'swiggy', outlet: 'all' }, { catalog_id: 'razorpay', outlet: 'all' }, { catalog_id: 'tally', outlet: 'all' }, { catalog_id: 'essl', outlet: 'all' }, { catalog_id: 'cpplus', outlet: 'all' }],
  sample: true,
};

async function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map(); const events = [];
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } else events.push(d); };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  return { send, close: () => ws.close() };
}

async function main() {
  if (!CHROME) throw new Error('Chrome or Edge not found');
  mkdirSync(DIR, { recursive: true });
  const profile = resolve(tmpdir(), `outletos-capture-${Date.now()}`);
  const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=9333', `--user-data-dir=${profile}`, '--hide-scrollbars', '--window-size=1280,665', '--force-device-scale-factor=1', 'about:blank'], { stdio: 'ignore' });
  let target;
  for (let i = 0; i < 40 && !target; i++) { await sleep(250); try { target = (await (await fetch('http://127.0.0.1:9333/json/list')).json()).find((t) => t.type === 'page'); } catch { /* starting */ } }
  const page = await cdp(target.webSocketDebuggerUrl);
  await page.send('Page.enable'); await page.send('Runtime.enable');
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 665, deviceScaleFactor: 1, mobile: false });
  const evalJs = (expression) => page.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  const go = async (url, wait = 2200) => { await page.send('Page.navigate', { url }); await sleep(wait); };
  const shoot = async (file) => {
    await evalJs(`document.querySelectorAll('div,span,code,pre').forEach((e) => { if (e.children.length === 0 && /ok_live_[0-9a-f]{6}/.test(e.textContent)) e.style.filter = 'blur(6px)'; })`); const r = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 86, captureBeyondViewport: false }); writeFileSync(resolve(DIR, file), Buffer.from(r.result.data, 'base64')); console.log('shot', file); };
  const tokens = {};
  const token = async (base, user) => { const k = `${base}|${user}`; if (!tokens[k]) tokens[k] = (await (await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: user, password: PW }) })).json()).token; return tokens[k]; };

  for (const [raw, base, user, path, o = {}] of SHOTS) {
    const file = raw.replace('~', '');
    if (raw.startsWith('~') && !DAYTIME) continue;
    if (only && !file.includes(only)) continue;
    try { await fetch(base + '/api/setup/status'); } catch { console.log('skip (instance down)', file); continue; }
    await go(base + '/', 600);
    const t = user ? await token(base, user) : null;
    await evalJs(`localStorage.clear(); ${t ? `localStorage.setItem('outletos_token', ${JSON.stringify(t)});` : ''} localStorage.setItem('branch', ${JSON.stringify(o.branch || 'all')}); localStorage.setItem('report-period', '"7d"'.slice(1,-1)); localStorage.setItem('nav-rail', '${o.rail ? 'true' : 'false'}'); ${o.theme ? `localStorage.setItem('theme', ${JSON.stringify(o.theme)}); localStorage.setItem('outletos-theme', ${JSON.stringify(o.theme)});` : ''}`);
    await go(base + path, o.wait || 2600);
    if (o.run) { await evalJs(o.run); await sleep(o.after ? 900 : 1200); }
    if (o.after) { await evalJs(o.after); await sleep(o.afterWait || 1500); }
    if (o.offset) await evalJs(`window.scrollBy(0, ${o.offset})`);
    if (o.scroll) { await evalJs(`window.scrollTo(0, ${o.scroll})`); await sleep(900); }
    await shoot(file);
  }

  // onboarding screens on the new-workspace instance (requires a fresh workspace)
  if (!only || only.includes('onb')) {
    try {
      const st = await (await fetch(NEW + '/api/setup/status')).json();
      if (st.needs_owner) {
        await go(NEW + '/', 600); await evalJs('localStorage.clear()'); await go(NEW + '/', 2000); await shoot(ONBOARD[0][0]);
        const owner = await (await fetch(NEW + '/api/setup/owner', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Ananya Sharma', email: 'owner@example.test', username: 'ananya', password: `${PW}-owner`, company: 'Saffron Table Group' }) })).json();
        for (const [file, step, scroll] of ONBOARD.slice(1)) {
          await fetch(NEW + '/api/setup/draft', { method: 'PUT', headers: { 'content-type': 'application/json', authorization: `Bearer ${owner.token}` }, body: JSON.stringify({ step, data: DRAFT }) });
          await go(NEW + '/', 400); await evalJs(`localStorage.setItem('outletos_token', ${JSON.stringify(owner.token)})`); await go(NEW + '/', 2600);
          if (scroll) { await evalJs(`window.scrollTo(0, ${scroll})`); await sleep(600); }
          await shoot(file);
        }
      } else console.log('onboarding shots skipped: workspace already has an owner (delete server/data/outletos-new.db and restart npm run start:new)');
    } catch (e) { console.log('onboarding shots skipped:', e.message); }
  }
  page.close(); chrome.kill();
  await sleep(500); try { rmSync(profile, { recursive: true, force: true }); } catch { /* locked */ }
}
main().catch((e) => { console.error(e); process.exit(1); });
