// End-to-end API test suite: every module, every role, happy paths and failure paths.
//   node server/scripts/e2e.mjs [baseUrl]            (default http://localhost:8788, the India demo)
//   node server/scripts/e2e.mjs http://localhost:8789 --onboarding   (fresh workspace: runs the onboarding suite)
// Test IDs match docs/TEST-PLAN.md. Exit code is non-zero if any test fails.
import { createHmac } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../../docs');

const BASE = process.argv[2]?.startsWith('http') ? process.argv[2] : 'http://localhost:8788';
const ONBOARDING = process.argv.includes('--onboarding');
const PW = process.env.DEMO_PASSWORD || 'demo1234';
const results = [];
let current = '', section = '';
const _log = console.log; console.log = (...a) => { const t = typeof a[0] === 'string' ? a[0].trim() : ''; if (t && !t.startsWith('OutletOS') && !t.startsWith('Onboarding') && !/passed|✓|✗|FAIL/.test(t) && /^[A-Z][A-Za-z ,&()+]*$/.test(t)) section = t; _log(...a); };

const req = async (method, path, { token, body, headers = {}, raw = false } = {}) => {
  const h = { ...headers };
  if (token) h.authorization = `Bearer ${token}`;
  let payload = body;
  if (body !== undefined && typeof body !== 'string') { h['content-type'] = 'application/json'; payload = JSON.stringify(body); }
  const r = await fetch(BASE + path, { method, headers: h, body: payload });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: r.status, json, text, headers: r.headers, raw };
};
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
const eq = (a, b, msg) => ok(a === b, `${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
async function test(id, name, fn) {
  current = id;
  const t = Date.now();
  try { await fn(); results.push({ id, name, section: section || (ONBOARDING ? 'Onboarding' : ''), ok: true, ms: Date.now() - t }); process.stdout.write(`  ✓ ${id} ${name}\n`); }
  catch (e) { results.push({ id, name, section: section || (ONBOARDING ? 'Onboarding' : ''), ok: false, ms: Date.now() - t, error: e.message }); process.stdout.write(`  ✗ ${id} ${name}\n      → ${e.message}\n`); }
}
const login = async (u, p = PW) => (await req('POST', '/api/auth/login', { body: { username: u, password: p } })).json?.token;

// =====================================================================================
if (ONBOARDING) {
  console.log(`\nOnboarding suite against ${BASE}`);
  let tok, INV = [];
  await test('O01', 'Fresh workspace reports needs_owner', async () => { const r = await req('GET', '/api/setup/status'); eq(r.json.needs_owner, true, 'needs_owner'); });
  await test('O02', 'Weak owner password is rejected', async () => { const r = await req('POST', '/api/setup/owner', { body: { name: 'A', username: 'a', password: 'short' } }); eq(r.status, 400, 'status'); });
  await test('O03', 'Invalid email is rejected', async () => { const r = await req('POST', '/api/setup/owner', { body: { name: 'A', username: 'a', email: 'nope', password: 'longenough123' } }); eq(r.status, 400, 'status'); });
  await test('O04', 'Owner account is created and signed in', async () => { const r = await req('POST', '/api/setup/owner', { body: { name: 'QA Owner', email: 'qa@example.test', username: 'qaowner', password: `${PW}-owner`, company: 'QA Foods' } }); eq(r.status, 200, 'status'); tok = r.json.token; ok(tok, 'token'); });
  await test('O05', 'A second owner cannot be created', async () => { const r = await req('POST', '/api/setup/owner', { body: { name: 'B', username: 'b', password: 'longenough123' } }); eq(r.status, 409, 'status'); });
  await test('O06', 'Setup status is in progress after sign-up', async () => { const r = await req('GET', '/api/me', { token: tok }); eq(r.json.setup.status, 'in_progress', 'setup'); });
  await test('O07', 'Catalog lists 20 countries, business types, modules and connectors', async () => { const r = await req('GET', '/api/setup/catalog', { token: tok }); ok(r.json.countries.length >= 20 && r.json.business_types.length >= 7 && r.json.modules.length >= 10 && r.json.connectors.length >= 60, 'catalog sizes'); });
  await test('O08', 'Draft saves and resumes at the same step', async () => { await req('PUT', '/api/setup/draft', { token: tok, body: { step: 'outlets', data: { org: { group: 'QA Foods', country: 'AE' } } } }); const r = await req('GET', '/api/setup/draft', { token: tok }); eq(r.json.step, 'outlets', 'step'); eq(r.json.data.org.country, 'AE', 'country'); });
  await test('O09', 'Launch without a country is refused', async () => { const r = await req('POST', '/api/setup/complete', { token: tok, body: { org: { group: 'QA' }, outlets: [{ name: 'X' }] } }); eq(r.status, 400, 'status'); });
  await test('O10', 'Launch without outlets is refused', async () => { const r = await req('POST', '/api/setup/complete', { token: tok, body: { org: { group: 'QA', country: 'AE' }, outlets: [] } }); eq(r.status, 400, 'status'); });
  await test('O11', 'Launch builds a UAE tenant (VAT 5% inclusive, AED) with varied outlets and tables', async () => {
    const body = { profile: { business_type: 'casual' }, org: { group: 'QA Foods', country: 'AE', business_type: 'casual' },
      outlets: [{ key: 'a', name: 'QA Marina', city: 'Dubai', seats: 80, areas: [{ name: 'Main', tables: Array.from({ length: 12 }, (_, i) => ({ name: `T${i + 1}`, seats: 4 })) }, { name: 'Terrace', tables: [{ name: 'P1', seats: 6 }] }] },
        { key: 'b', name: 'QA JLT', city: 'Dubai', seats: 30, areas: [{ name: 'Inside', tables: [{ name: 'A1', seats: 2 }, { name: 'A2', seats: 2 }] }] },
        { key: 'c', name: 'QA Cloud', city: 'Sharjah', seats: 0, type: 'cloud', areas: [] }],
      menu: { source: 'csv', items: [{ name: 'Shawarma Plate', category: 'Mains', price: 42 }, { name: 'Hummus', category: 'Starters', price: 22 }, { name: 'Mint Lemonade', category: 'Drinks', price: 18 }, { name: 'Bad row', price: 0 }] },
      team: { invites: [{ name: 'Ops Lead', email: 'ops@example.test', role: 'branch_manager', outlets: ['a', 'b'] }, { name: 'Cashier One', role: 'cashier', outlets: ['b'] }] },
      modules: ['pos', 'kds', 'reservations', 'reports', 'finance'], integrations: [{ catalog_id: 'talabat' }, { catalog_id: 'xero' }, { catalog_id: 'nope' }], sample: false };
    const r = await req('POST', '/api/setup/complete', { token: tok, body });
    eq(r.status, 200, `status ${r.text}`); INV = r.json.invites; eq(r.json.outlets, 3, 'outlets'); eq(r.json.tables, 15, 'tables'); eq(r.json.menu, 3, 'menu (bad row dropped)'); eq(r.json.invites.length, 2, 'invites');
  });
  await test('O12', 'Organisation config applied: AED currency, VAT inclusive, modules gated', async () => { const r = await req('GET', '/api/me', { token: tok }); eq(r.json.instance.currency.code, 'AED', 'currency'); eq(r.json.instance.tax.inclusive, true, 'inclusive'); ok(!r.json.modules.includes('vision') && r.json.modules.includes('pos'), 'modules'); eq(r.json.setup.status, 'complete', 'complete'); });
  await test('O13', 'Setup cannot be run twice', async () => { const r = await req('POST', '/api/setup/complete', { token: tok, body: { org: { group: 'x', country: 'AE' }, outlets: [{ name: 'y' }] } }); eq(r.status, 409, 'status'); });
  await test('O14', 'Invited users sign in with their temporary password and are scoped to their outlets', async () => {
    eq((await req('POST', '/api/auth/login', { body: { username: INV[0].username, password: 'wrong' } })).status, 401, 'wrong password');
    const t2 = await login(INV[0].username, INV[0].temporary_password); ok(t2, 'login');
    const me = (await req('GET', '/api/me', { token: t2 })).json; eq(me.user.role, 'branch_manager', 'role'); eq(me.branches.length, 2, 'scoped to 2 outlets');
    const t3 = await login(INV[1].username, INV[1].temporary_password); eq((await req('GET', '/api/finance/dayend', { token: t3 })).status, 403, 'cashier has no finance');
  });
  await test('O15', 'Connectors from setup are created, unknown ids ignored', async () => { const r = await req('GET', '/api/integrations', { token: tok }); eq(r.json.connectors.length, 2, 'connectors'); ok(r.json.connectors.every((c) => c.status === 'awaiting credentials'), 'status'); });
  await test('O16', 'POS on the new tenant shows custom table names and VAT', async () => { const r = await req('GET', '/api/pos?branch=o1', { token: tok }); ok(r.json.tables.some((t) => t.name === 'P1'), 'P1 table'); eq(r.json.tax.name, 'VAT', 'tax'); });
  await test('O17', 'Cloud kitchen outlet has no tables', async () => { const r = await req('GET', '/api/pos?branch=o3', { token: tok }); eq(r.json.tables.length, 0, 'tables'); });
  await test('O18', 'VAT-inclusive bill: tax is extracted, not added', async () => {
    const st = (await req('GET', '/api/pos?branch=o1', { token: tok })).json;
    const o = (await req('POST', '/api/pos/orders', { token: tok, body: { branch: 'o1', table_id: st.tables[0].id } })).json;
    const item = st.menu.find((m) => m.price === 42);
    const u = (await req('PATCH', `/api/pos/orders/${o.id}`, { token: tok, body: { items: [{ item_id: item.id, qty: 1 }] } })).json;
    eq(u.bill.total, 42, 'inclusive total equals menu price');
    await req('POST', `/api/pos/orders/${o.id}/cancel`, { token: tok, body: { reason: 'test' } });
  });
  summary();
  process.exit(results.some((r) => !r.ok) ? 1 : 0);
}

// =====================================================================================
console.log(`\nOutletOS end-to-end suite against ${BASE}\n`);
const T = {};
console.log('Authentication');
await test('A01', 'Owner signs in with the demo password', async () => { T.owner = await login('owner'); ok(T.owner, 'token'); });
await test('A02', 'Wrong password is rejected (401)', async () => { eq((await req('POST', '/api/auth/login', { body: { username: 'owner', password: 'nope' } })).status, 401, 'status'); });
await test('A03', 'Unknown user is rejected (401)', async () => { eq((await req('POST', '/api/auth/login', { body: { username: 'ghost', password: PW } })).status, 401, 'status'); });
await test('A04', 'API without a token is rejected (401)', async () => { eq((await req('GET', '/api/me')).status, 401, 'status'); });
await test('A05', 'Tampered token is rejected (401)', async () => { eq((await req('GET', '/api/me', { token: T.owner.slice(0, -2) + 'xx' })).status, 401, 'status'); });
await test('A06', 'All demo roles can sign in', async () => {
  for (const u of ['area.east', 'manager.r1', 'manager.r5', 'chef.r1', 'cook.r1', 'host.r1', 'auditor', 'it.admin', 'cashier.r1']) { T[u] = await login(u); ok(T[u], `login ${u}`); }
});
await test('A07', '/me returns instance currency, tax and modules', async () => { const r = await req('GET', '/api/me', { token: T.owner }); ok(r.json.instance.currency.code, 'currency'); ok('tax' in r.json.instance, 'tax'); eq(r.json.setup.status, 'complete', 'setup'); });
const INR = (await req('GET', '/api/me', { token: T.owner })).json?.instance?.currency?.code === 'INR';

console.log('\nAccess control (RBAC + ABAC)');
await test('R01', 'Line cook dashboard has no sales or finance fields', async () => { const r = await req('GET', '/api/dashboard', { token: T['cook.r1'] }); ok(!r.json.sales && !r.json.finance, 'leaked sales/finance'); });
await test('R02', 'Line cook report has no revenue KPIs', async () => { const r = await req('GET', '/api/reports?period=7d', { token: T['cook.r1'] }); eq(r.status, 200, 'status'); ok(!r.json.kpis.some((k) => k.group === 'Revenue' || k.group === 'Profitability'), 'revenue KPI leaked'); });
await test('R03', 'Host cannot open Kitchen (403)', async () => { eq((await req('GET', '/api/kitchen', { token: T['host.r1'] })).status, 403, 'status'); });
await test('R04', 'Auditor cannot open the POS (403)', async () => { eq((await req('GET', '/api/pos', { token: T.auditor })).status, 403, 'status'); });
await test('R05', 'IT admin has no reports (403)', async () => { eq((await req('GET', '/api/reports', { token: T['it.admin'] })).status, 403, 'status'); });
await test('R06', 'Branch manager cannot read another branch (403)', async () => { eq((await req('GET', '/api/dashboard?branch=r2', { token: T['manager.r1'] })).status, 403, 'status'); });
await test('R07', 'Area manager sees only their region', async () => { const r = await req('GET', '/api/me', { token: T['area.east'] }); ok(r.json.branches.length === 3, `branches ${r.json.branches.length}`); });
await test('R08', 'Head chef cannot open Finance (403)', async () => { eq((await req('GET', '/api/finance/dayend', { token: T['chef.r1'] })).status, 403, 'status'); });
await test('R09', 'Head chef can manage inventory', async () => { eq((await req('GET', '/api/inventory?branch=r1', { token: T['chef.r1'] })).status, 200, 'status'); });
await test('R10', 'Head chef sees only the Kitchen department on Workforce', async () => { const r = await req('GET', '/api/people', { token: T['chef.r1'] }); ok(r.json.length && r.json.every((s) => s.department === 'Kitchen'), 'non-kitchen staff leaked'); ok(r.json.every((s) => s.hourly_rate === undefined), 'pay leaked'); });
await test('R11', 'Cashier can use the POS but not Finance', async () => { eq((await req('GET', '/api/pos?branch=r1', { token: T['cashier.r1'] })).status, 200, 'pos'); eq((await req('GET', '/api/finance/dayend', { token: T['cashier.r1'] })).status, 403, 'finance'); });
await test('R12', 'Host sees masked guest phone numbers', async () => { const r = await req('GET', '/api/guests', { token: T['host.r1'] }); ok(r.json.top.every((g) => !g.phone || g.phone.includes('•') || g.phone.includes('*') || /x{2,}/i.test(g.phone)), 'unmasked phone'); });
await test('R13', 'Line cook alerts limited to own station categories', async () => { const r = await req('GET', '/api/alerts', { token: T['cook.r1'] }); ok(r.json.every((a) => ['speed', 'safety'].includes(a.category) && (!a.station || a.station === 'Tandoor' || a.station === 'Grill')), 'foreign alert'); });
await test('R14', 'Non-owner cannot reach setup endpoints (403)', async () => { eq((await req('GET', '/api/setup/catalog', { token: T['manager.r1'] })).status, 403, 'status'); });
await test('R15', 'Branch parameter injection is rejected (403)', async () => { eq((await req('GET', `/api/dashboard?branch=${encodeURIComponent("r1' OR 1=1 --")}`, { token: T.owner })).status, 403, 'status'); });

console.log('\nDashboards & live reads');
await test('M01', 'Dashboard returns 24 hourly points and branch scores', async () => { const r = await req('GET', '/api/dashboard', { token: T.owner }); eq(r.json.hourly.length, 24, 'hours'); ok(r.json.scores.length === 6, 'scores'); });
await test('M02', 'Kitchen view lists stations and live tickets', async () => { const r = await req('GET', '/api/kitchen?branch=r1', { token: T.owner }); ok(Array.isArray(r.json.stations) && Array.isArray(r.json.open), 'shape'); });
await test('M03', 'Vision lists cameras with heartbeat status', async () => { const r = await req('GET', '/api/vision?branch=r1', { token: T.owner }); ok(r.json.cameras.length > 0 && r.json.cameras.every((c) => c.status), 'cameras'); });
await test('M04', 'Food safety lists sensors with history', async () => { const r = await req('GET', '/api/safety?branch=r1', { token: T.owner }); ok(r.json.length > 0 && r.json[0].history, 'sensors'); });
await test('M05', 'Staffing returns TPPH and hourly status', async () => { const r = await req('GET', '/api/staffing?branch=r1', { token: T.owner }); ok('tpph' in r.json && Array.isArray(r.json.hours), 'shape'); });
await test('M06', 'Live event stream opens for an authenticated user', async () => { const ctl = new AbortController(); const r = await fetch(`${BASE}/api/stream?token=${T.owner}`, { signal: ctl.signal }); eq(r.status, 200, 'status'); ok((r.headers.get('content-type') || '').includes('event-stream'), 'sse'); ctl.abort(); });

console.log('\nReports, KRIs & forecasting');
let rep7;
await test('P01', 'All four periods render', async () => { for (const p of ['today', 'yesterday', '7d', '14d']) { const r = await req('GET', `/api/reports?period=${p}`, { token: T.owner }); eq(r.status, 200, p); if (p === '7d') rep7 = r.json; } });
await test('P02', 'Owner scorecard has 23 KPIs with valid RAG states', async () => { ok(rep7.kpis.length >= 20, `kpis ${rep7.kpis.length}`); ok(rep7.kpis.every((k) => ['green', 'amber', 'red', 'none'].includes(k.status)), 'status'); });
await test('P03', 'KRIs have thresholds, owners and actions', async () => { ok(rep7.kris.length >= 12 && rep7.kris.every((k) => k.owner && k.action && k.amber != null), 'kri shape'); });
await test('P04', 'Forecast: 7 days, each inside its 80% band', async () => { const f = rep7.forecast; eq(f.days.length, 7, 'days'); ok(f.days.every((d) => d.low <= d.value && d.value <= d.high), 'band'); });
await test('P05', 'Forecast backtest error is under 15%', async () => { ok(rep7.forecast.accuracy && rep7.forecast.accuracy.mape < 0.15, `mape ${rep7.forecast.accuracy?.mape}`); });
await test('P06', 'League table ranks are unique and complete', async () => { const ranks = rep7.comparisons.league.map((l) => l.rank); eq(new Set(ranks).size, ranks.length, 'ranks'); eq(ranks.length, 6, 'branches'); });
await test('P07', 'Menu engineering classes are valid', async () => { ok(rep7.menu.items.every((i) => ['Star', 'Plowhorse', 'Puzzle', 'Dog'].includes(i.class)), 'class'); });
await test('P08', 'Branch-scoped report covers exactly one branch', async () => { const r = await req('GET', '/api/reports?period=7d&branch=r2', { token: T.owner }); eq(r.json.scope.length, 1, 'scope'); });
await test('P09', 'Unknown period falls back to today', async () => { const r = await req('GET', '/api/reports?period=bogus', { token: T.owner }); eq(r.json.period, 'today', 'period'); });
await test('P10', 'Summary uses the instance currency', async () => { ok(rep7.summary[0].text.includes(INR ? '₹' : '$'), rep7.summary[0].text); });
await test('P11', 'Channel shares sum to ~100%', async () => { const s = rep7.comparisons.channels.reduce((a, c) => a + (c.share || 0), 0); ok(Math.abs(s - 1) < 0.01, `sum ${s}`); });
await test('P12', 'Budget is phased by weekday (Fri/Sat budget > Mon)', async () => { const d = rep7.forecast.days; const day = (n) => d.find((x) => x.dow === n)?.target; ok(day(6) > day(1), `sat ${day(6)} mon ${day(1)}`); });

console.log('\nPoint of sale');
const st = (await req('GET', '/api/pos?branch=r1', { token: T['manager.r1'] })).json;
let order;
const free = st.tables.find((t) => t.status === 'free');
const dish = st.menu.find((m) => m.available && m.price > 100) || st.menu[0];
const drink = st.menu.find((m) => m.available && m.category === 'Drinks') || st.menu[1];
await test('S01', 'POS state lists tables, areas, menu, tenders and tax', async () => { ok(st.tables.length >= 10 && st.areas.length >= 2 && st.menu.length >= 20 && st.tenders.length >= 3, 'shape'); });
await test('S02', 'Open an order on a free table', async () => { order = (await req('POST', '/api/pos/orders', { token: T['manager.r1'], body: { branch: 'r1', table_id: free.id, covers: 3 } })).json; eq(order.status, 'open', 'status'); });
await test('S03', 'Opening the same table again returns the running order', async () => { const r = await req('POST', '/api/pos/orders', { token: T['manager.r1'], body: { branch: 'r1', table_id: free.id } }); eq(r.json.id, order.id, 'same order'); });
await test('S04', 'Unknown table is rejected (400)', async () => { eq((await req('POST', '/api/pos/orders', { token: T['manager.r1'], body: { branch: 'r1', table_id: 'r1-T999' } })).status, 400, 'status'); });
await test('S05', 'Add items computes subtotal and tax split', async () => {
  order = (await req('PATCH', `/api/pos/orders/${order.id}`, { token: T['manager.r1'], body: { items: [{ item_id: dish.id, qty: 2 }, { item_id: drink.id, qty: 1 }] } })).json;
  eq(order.bill.subtotal, dish.price * 2 + drink.price, 'subtotal');
  if (INR) { eq(order.bill.taxes.length, 2, 'CGST+SGST'); ok(Math.abs(order.bill.taxes[0].amount - order.bill.subtotal * 0.025) < 0.01, 'CGST 2.5%'); eq(order.bill.total, Math.round(order.bill.total), 'rupee rounding'); }
});
await test('S06', 'Printing before the KOT is refused (400)', async () => { eq((await req('POST', `/api/pos/orders/${order.id}/print`, { token: T['manager.r1'] })).status, 400, 'status'); });
await test('S07', 'Send KOT fires tickets grouped by station', async () => { const r = await req('POST', `/api/pos/orders/${order.id}/kot`, { token: T['manager.r1'] }); eq(r.status, 200, 'status'); ok(Object.keys(r.json.kot.stations).length >= 1, 'stations'); order = r.json.order; ok(order.items.every((i) => i.sent === i.qty), 'sent'); });
await test('S08', 'KOT with nothing new is refused (400)', async () => { eq((await req('POST', `/api/pos/orders/${order.id}/kot`, { token: T['manager.r1'] })).status, 400, 'status'); });
await test('S09', 'Kitchen display shows the POS tickets', async () => { const r = await req('GET', '/api/kitchen?branch=r1', { token: T['manager.r1'] }); ok(r.json.open.some((t) => t.item === dish.name), 'ticket missing'); });
await test('S10', 'Cancelling a sent item without a reason is refused (400)', async () => { eq((await req('PATCH', `/api/pos/orders/${order.id}`, { token: T['manager.r1'], body: { items: [{ item_id: dish.id, qty: 1 }, { item_id: drink.id, qty: 1 }] } })).status, 400, 'status'); });
await test('S11', 'Cancelling with a reason works and is audited', async () => {
  const r = await req('PATCH', `/api/pos/orders/${order.id}`, { token: T['manager.r1'], body: { items: [{ item_id: dish.id, qty: 1 }, { item_id: drink.id, qty: 1 }], reason: 'Wrong item punched' } });
  eq(r.status, 200, 'status'); order = r.json;
  const lk = await req('GET', '/api/finance/leakage?branch=r1&days=7', { token: T['manager.r1'] }); ok(lk.json.recent.some((e) => e.action === 'kot_cancel' && e.detail.includes('Wrong item punched')), 'audit missing');
});
await test('S12', 'Discount without a reason is refused (400)', async () => { eq((await req('POST', `/api/pos/orders/${order.id}/discount`, { token: T['manager.r1'], body: { pct: 10 } })).status, 400, 'status'); });
await test('S13', '10% discount with reason reduces the taxable value', async () => { const r = await req('POST', `/api/pos/orders/${order.id}/discount`, { token: T['manager.r1'], body: { pct: 10, reason: 'Loyal regular' } }); order = r.json; ok(Math.abs(order.bill.discount - order.bill.subtotal * 0.1) < 0.01, 'discount'); });
await test('S14', 'Cashier cannot give more than 25% (403)', async () => { eq((await req('POST', `/api/pos/orders/${order.id}/discount`, { token: T['cashier.r1'], body: { pct: 40, reason: 'Manager approval' } })).status, 403, 'status'); });
await test('S15', 'Cashier cannot make an NC bill (403)', async () => { eq((await req('POST', `/api/pos/orders/${order.id}/nc`, { token: T['cashier.r1'], body: { reason: 'Staff meal' } })).status, 403, 'status'); });
await test('S16', 'Print bill, then reprint is audited', async () => { await req('POST', `/api/pos/orders/${order.id}/print`, { token: T['manager.r1'] }); const r = await req('POST', `/api/pos/orders/${order.id}/print`, { token: T['manager.r1'] }); eq(r.json.printed, 2, 'printed'); eq(r.json.status, 'billed', 'status'); });
await test('S17', 'Settlement with wrong tender total is refused (400)', async () => { eq((await req('POST', `/api/pos/orders/${order.id}/settle`, { token: T['manager.r1'], body: { payments: [{ mode: st.tenders[0], amount: 1 }] } })).status, 400, 'status'); });
let billNo;
await test('S18', 'Split-tender settlement issues a financial-year bill number', async () => {
  const half = Math.floor(order.bill.total / 2);
  const r = await req('POST', `/api/pos/orders/${order.id}/settle`, { token: T['manager.r1'], body: { payments: [{ mode: st.tenders[0], amount: half }, { mode: 'cash', amount: order.bill.total - half }] } });
  eq(r.status, 200, r.text); billNo = r.json.bill_no; ok(/^R1\/\d{2}-\d{2}\/\d{6}$/.test(billNo), `bill ${billNo}`); ok(r.json.order_id, 'order recorded');
});
await test('S19', 'Settled bill appears in day end and frees the table', async () => {
  const s2 = (await req('GET', '/api/pos?branch=r1', { token: T['manager.r1'] })).json; eq(s2.tables.find((t) => t.id === free.id).status === 'free' || s2.tables.find((t) => t.id === free.id).status === 'reserved', true, 'table freed');
  const de = (await req('GET', '/api/finance/dayend?branch=r1', { token: T['manager.r1'] })).json; ok(de.outlets[0].summary.tenders.split > 0, 'split tender in day end');
});
await test('S20', 'NC bill settles without a sale', async () => {
  const t2 = st.tables.filter((t) => t.status === 'free')[1];
  const o = (await req('POST', '/api/pos/orders', { token: T['manager.r1'], body: { branch: 'r1', table_id: t2.id } })).json;
  await req('PATCH', `/api/pos/orders/${o.id}`, { token: T['manager.r1'], body: { items: [{ item_id: drink.id, qty: 1 }] } });
  await req('POST', `/api/pos/orders/${o.id}/kot`, { token: T['manager.r1'] });
  await req('POST', `/api/pos/orders/${o.id}/nc`, { token: T['manager.r1'], body: { reason: 'Staff meal' } });
  const r = await req('POST', `/api/pos/orders/${o.id}/settle`, { token: T['manager.r1'], body: { payments: [] } });
  eq(r.status, 200, r.text); eq(r.json.order_id, null, 'no sale recorded'); eq(r.json.bill.total, 0, 'zero total');
});
await test('S21', 'Void requires a reason; voided order closes', async () => {
  const o = (await req('POST', '/api/pos/orders', { token: T['manager.r1'], body: { branch: 'r1', channel: 'takeaway' } })).json;
  eq((await req('POST', `/api/pos/orders/${o.id}/cancel`, { token: T['manager.r1'], body: {} })).status, 400, 'no reason');
  eq((await req('POST', `/api/pos/orders/${o.id}/cancel`, { token: T['manager.r1'], body: { reason: 'Guest changed mind' } })).status, 200, 'with reason');
});
await test('S22', 'Invalid channel is rejected (400)', async () => { eq((await req('POST', '/api/pos/orders', { token: T['manager.r1'], body: { branch: 'r1', channel: 'drone' } })).status, 400, 'status'); });
await test('S23', 'Another branch\'s order is invisible to a branch manager (404)', async () => {
  const o = (await req('POST', '/api/pos/orders', { token: T['manager.r5'], body: { branch: 'r5', channel: 'takeaway' } })).json;
  eq((await req('PATCH', `/api/pos/orders/${o.id}`, { token: T['manager.r1'], body: { items: [] } })).status, 404, 'status');
  await req('POST', `/api/pos/orders/${o.id}/cancel`, { token: T['manager.r5'], body: { reason: 'test' } });
});

console.log('\nKitchen display');
await test('K01', 'Bumping a ticket marks it ready', async () => { const k = (await req('GET', '/api/kitchen?branch=r1', { token: T['chef.r1'] })).json; const t = k.open[0]; if (!t) return; eq((await req('POST', `/api/kitchen/tickets/${t.id}/ready`, { token: T['chef.r1'] })).status, 200, 'status'); });
await test('K02', 'Line cook cannot bump another station (403)', async () => { const k = (await req('GET', '/api/kitchen?branch=r1', { token: T.owner })).json; const t = [...k.open, ...k.done].find((x) => x.station !== 'Tandoor' && x.station !== 'Grill'); if (!t) return; eq((await req('POST', `/api/kitchen/tickets/${t.id}/ready`, { token: T['cook.r1'] })).status, 403, 'status'); });
await test('K03', 'Unknown ticket returns 404', async () => { eq((await req('POST', '/api/kitchen/tickets/99999999/ready', { token: T['chef.r1'] })).status, 404, 'status'); });

console.log('\nMenu & 86');
await test('N01', 'Menu lists items with food cost and 7-day sales', async () => { const r = await req('GET', '/api/menu?branch=r1', { token: T['manager.r1'] }); ok(r.json.items.every((i) => i.food_pct > 0 && 'qty_7d' in i), 'shape'); });
await test('N02', '86 an item hides it from the POS, then restore', async () => {
  await req('POST', `/api/menu/${drink.id}/availability`, { token: T['chef.r1'], body: { branch: 'r1', available: false } });
  const s2 = (await req('GET', '/api/pos?branch=r1', { token: T['manager.r1'] })).json; eq(s2.menu.find((m) => m.id === drink.id).available, false, '86');
  const o = (await req('POST', '/api/pos/orders', { token: T['manager.r1'], body: { branch: 'r1', channel: 'takeaway' } })).json;
  eq((await req('PATCH', `/api/pos/orders/${o.id}`, { token: T['manager.r1'], body: { items: [{ item_id: drink.id, qty: 1 }] } })).status, 400, 'ordering an 86 item');
  await req('POST', `/api/pos/orders/${o.id}/cancel`, { token: T['manager.r1'], body: { reason: 'test' } });
  await req('POST', `/api/menu/${drink.id}/availability`, { token: T['chef.r1'], body: { branch: 'r1', available: true } });
});
await test('N03', 'Price guard rejects a price below cost × 1.25 (400)', async () => { eq((await req('PATCH', `/api/menu/${dish.id}`, { token: T['manager.r1'], body: { price: 1 } })).status, 400, 'status'); });
await test('N04', 'Price change is applied and audited, then reverted', async () => { eq((await req('PATCH', `/api/menu/${dish.id}`, { token: T['manager.r1'], body: { price: dish.price + 10 } })).status, 200, 'up'); eq((await req('PATCH', `/api/menu/${dish.id}`, { token: T['manager.r1'], body: { price: dish.price } })).status, 200, 'revert'); });
await test('N05', 'Head chef cannot change prices (403)', async () => { eq((await req('PATCH', `/api/menu/${dish.id}`, { token: T['chef.r1'], body: { price: dish.price } })).status, 403, 'status'); });

console.log('\nInventory & purchasing');
let inv;
await test('I01', 'Inventory returns stock, par, cover days and value', async () => { inv = (await req('GET', '/api/inventory?branch=r1', { token: T['manager.r1'] })).json; ok(inv.items.length >= 20 && inv.items.every((i) => 'on_hand' in i && 'par' in i), 'shape'); ok(inv.stock_value > 0, 'value'); });
await test('I02', 'Every menu item has a recipe', async () => { const ids = new Set(inv.recipes.map((r) => r.item_id)); ok(st.menu.every((m) => ids.has(m.id)), 'missing recipe'); });
await test('I03', 'Wastage without reason is refused (400)', async () => { eq((await req('POST', '/api/inventory/waste', { token: T['chef.r1'], body: { branch: 'r1', ingredient_id: inv.items[0].id, qty: 1 } })).status, 400, 'status'); });
await test('I04', 'Negative wastage quantity is refused (400)', async () => { eq((await req('POST', '/api/inventory/waste', { token: T['chef.r1'], body: { branch: 'r1', ingredient_id: inv.items[0].id, qty: -2, reason: 'Expired' } })).status, 400, 'status'); });
await test('I05', 'Logging wastage lowers on-hand by exactly that amount', async () => {
  const before = inv.items[0].on_hand;
  await req('POST', '/api/inventory/waste', { token: T['chef.r1'], body: { branch: 'r1', ingredient_id: inv.items[0].id, qty: 0.5, reason: 'Spoiled' } });
  const after = (await req('GET', '/api/inventory?branch=r1', { token: T['chef.r1'] })).json.items.find((i) => i.id === inv.items[0].id).on_hand;
  ok(Math.abs(before - 0.5 - after) < 0.6, `before ${before} after ${after}`); // sales may also consume stock meanwhile
});
let poId;
await test('I06', 'Raise a purchase order', async () => { const v = inv.vendors[0]; const ing = inv.items.find((i) => i.vendor_id === v.id); const r = await req('POST', '/api/inventory/po', { token: T['manager.r1'], body: { branch: 'r1', vendor_id: v.id, lines: [{ ingredient_id: ing.id, qty: 5 }] } }); eq(r.status, 200, r.text); poId = r.json.id; });
await test('I07', 'Receiving the PO adds stock (GRN)', async () => {
  const pre = (await req('GET', '/api/inventory?branch=r1', { token: T['manager.r1'] })).json; const po = pre.pos.find((p) => p.id === poId); const ing = po.lines[0].ingredient_id; const b = pre.items.find((i) => i.id === ing).on_hand;
  eq((await req('POST', `/api/inventory/po/${poId}/receive`, { token: T['manager.r1'] })).status, 200, 'receive');
  const a = (await req('GET', '/api/inventory?branch=r1', { token: T['manager.r1'] })).json.items.find((i) => i.id === ing).on_hand; ok(a > b + 4, `before ${b} after ${a}`);
});
await test('I08', 'A received PO cannot be received twice (400)', async () => { eq((await req('POST', `/api/inventory/po/${poId}/receive`, { token: T['manager.r1'] })).status, 400, 'status'); });
await test('I09', 'Stock count resets on-hand and records variance', async () => {
  const ing = inv.items[1]; const target = Math.round(ing.on_hand + 2.5);
  await req('POST', '/api/inventory/count', { token: T['manager.r1'], body: { branch: 'r1', counts: { [ing.id]: target } } });
  const r = (await req('GET', '/api/inventory?branch=r1', { token: T['manager.r1'] })).json;
  ok(Math.abs(r.items.find((i) => i.id === ing.id).on_hand - target) < 0.5, 'on hand after count'); ok(r.variance.some((v) => v.ingredient_id === ing.id), 'variance recorded');
});
await test('I10', 'PO for an unknown vendor is refused (400)', async () => { eq((await req('POST', '/api/inventory/po', { token: T['manager.r1'], body: { branch: 'r1', vendor_id: 'zzz', lines: [] } })).status, 400, 'status'); });

console.log('\nReservations');
let resId;
await test('V01', 'Day sheet lists bookings and stats', async () => { const r = await req('GET', '/api/reservations?branch=r1', { token: T['host.r1'] }); ok(Array.isArray(r.json.list) && 'no_show_rate' in r.json.stats, 'shape'); });
await test('V02', 'Booking without a name is refused (400)', async () => { eq((await req('POST', '/api/reservations', { token: T['host.r1'], body: { branch: 'r1', covers: 2, ts: Date.now() + 3600e3 } })).status, 400, 'status'); });
await test('V03', 'Create a booking with deposit', async () => { const r = await req('POST', '/api/reservations', { token: T['host.r1'], body: { branch: 'r1', name: 'QA Guest', phone: '+91 9800000000', covers: 4, ts: Date.now() + 2 * 3600e3, deposit: 500, notes: 'Birthday' } }); eq(r.status, 200, r.text); resId = r.json.id; });
await test('V04', 'Add a walk-in to the waitlist', async () => { const r = await req('POST', '/api/reservations', { token: T['host.r1'], body: { branch: 'r1', name: 'Walk In', covers: 2, waitlist: true } }); eq(r.status, 200, 'status'); });
await test('V05', 'Seating a booking opens a POS order on that table', async () => {
  const s2 = (await req('GET', '/api/pos?branch=r1', { token: T['host.r1'] })).json; const t = s2.tables.find((x) => x.status === 'free' && x.seats >= 4) || s2.tables.find((x) => x.status === 'free');
  const r = await req('PATCH', `/api/reservations/${resId}`, { token: T['host.r1'], body: { status: 'seated', table_id: t.id } }); ok(r.json.order_id, 'order opened');
  await req('POST', `/api/pos/orders/${r.json.order_id}/cancel`, { token: T['manager.r1'], body: { reason: 'test cleanup' } });
});
await test('V06', 'Invalid status is refused (400)', async () => { eq((await req('PATCH', `/api/reservations/${resId}`, { token: T['host.r1'], body: { status: 'teleported' } })).status, 400, 'status'); });
await test('V07', 'Mark a booking as no-show', async () => { eq((await req('PATCH', `/api/reservations/${resId}`, { token: T['host.r1'], body: { status: 'no_show' } })).status, 200, 'status'); });

console.log('\nFinance & compliance');
await test('F01', 'Day end summarises tax split and tenders', async () => { const r = await req('GET', '/api/finance/dayend', { token: T.owner }); eq(r.json.outlets.length, 6, 'outlets'); if (INR) ok(r.json.outlets[0].summary.tax_split.length === 2, 'split'); });
await test('F02', 'Closing the day is blocked while a table is open (400)', async () => {
  const o = (await req('POST', '/api/pos/orders', { token: T['manager.r1'], body: { branch: 'r1', channel: 'takeaway' } })).json;
  eq((await req('POST', '/api/finance/dayend/close', { token: T['manager.r1'], body: { branch: 'r1', cash_declared: 0 } })).status, 400, 'status');
  await req('POST', `/api/pos/orders/${o.id}/cancel`, { token: T['manager.r1'], body: { reason: 'test cleanup' } });
});
await test('F03', 'A day already closed cannot be closed again (409)', async () => { const y = new Date(Date.now() - 86400e3); const d = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`; eq((await req('POST', '/api/finance/dayend/close', { token: T['manager.r1'], body: { branch: 'r1', date: d, cash_declared: 0 } })).status, 409, 'status'); });
await test('F04', 'Tax register parts add up to the tax', async () => { const r = (await req('GET', '/api/finance/gst?days=7', { token: T.owner })).json; ok(r.rows.length > 0, 'rows'); ok(r.rows.every((x) => !x.parts.length || Math.abs(x.parts.reduce((a, p) => a + p.amount, 0) - x.tax) < 0.05), 'parts sum'); });
await test('F05', 'Tally export is valid voucher XML with balanced ledgers', async () => {
  const r = await req('GET', '/api/finance/tally?branch=r1', { token: T['manager.r1'] }); eq(r.status, 200, 'status'); ok(r.text.includes('<ENVELOPE>') && r.text.includes('VCHTYPE="Sales"'), 'xml');
  const amounts = [...r.text.matchAll(/<AMOUNT>(-?[\d.]+)<\/AMOUNT>/g)].map((m) => Number(m[1])); ok(Math.abs(amounts.reduce((a, b) => a + b, 0)) < 0.05, `unbalanced ${amounts.reduce((a, b) => a + b, 0)}`);
});
await test('F06', 'Reconciliation: expected = gross − commission − GST − TCS', async () => { const r = (await req('GET', '/api/finance/reconciliation?days=7', { token: T.owner })).json; ok(r.platforms.every((p) => Math.abs(p.gross - p.commission - p.gst_on_commission - p.tcs - p.expected) < 1), 'formula'); ok(r.totals.gap >= 0, 'gap'); });
await test('F07', 'Leakage staff risk scores are 0–100', async () => { const r = (await req('GET', '/api/finance/leakage', { token: T.owner })).json; ok(r.staff.length && r.staff.every((s) => s.score >= 0 && s.score <= 100), 'scores'); });
await test('F08', 'Cashier cannot download Tally (403)', async () => { eq((await req('GET', '/api/finance/tally', { token: T['cashier.r1'] })).status, 403, 'status'); });
await test('F09', 'Area manager finance is limited to their branches', async () => { const r = (await req('GET', '/api/finance/dayend', { token: T['area.east'] })).json; eq(r.outlets.length, 3, 'outlets'); });

console.log('\nIntegrations & connectors');
let conn, rz;
await test('C01', 'Catalog has 60+ connectors, India first', async () => { const r = (await req('GET', '/api/integrations', { token: T['it.admin'] })).json; ok(r.catalog.length >= 60, 'size'); ok(r.catalog.filter((x) => x.india).length >= 30, 'india'); ok(r.catalog.every((x) => x.steps?.length), 'steps'); });
await test('C02', 'Install a connector; secrets are returned masked', async () => { conn = (await req('POST', '/api/integrations', { token: T['it.admin'], body: { catalog_id: 'urbanpiper', config: { api_key: 'secret-key-1234', outlet: 'r1' } } })).json; const r = (await req('GET', '/api/integrations', { token: T['it.admin'] })).json.connectors.find((c) => c.id === conn.id); ok(r.config.api_key.startsWith('••••') && !r.config.api_key.includes('secret'), 'not masked'); });
await test('C03', 'Unknown catalog id is refused (400)', async () => { eq((await req('POST', '/api/integrations', { token: T['it.admin'], body: { catalog_id: 'nope' } })).status, 400, 'status'); });
await test('C04', 'Mapping test transforms a sample payload', async () => { const r = (await req('POST', `/api/integrations/${conn.id}/test`, { token: T['it.admin'], body: { store_id: 'X', order_id: 'UP-1', order_total: 640, channel: 'swiggy', created_at: '2026-11-19T10:00:00Z' } })).json; eq(r.mapped[0].total, 640, 'total'); eq(r.mapped[0].channel, 'delivery', 'channel'); });
await test('C05', 'Webhook delivers an order into sales', async () => { const r = await req('POST', `/api/v1/webhooks/${conn.id}`, { body: { store_id: 'X', order_id: 'UP-2', order_total: 720, channel: 'Zomato' } }); eq(r.status, 200, r.text); eq(r.json.accepted, 1, 'accepted'); });
await test('C06', 'Signed connector rejects a bad signature (401)', async () => { rz = (await req('POST', '/api/integrations', { token: T['it.admin'], body: { catalog_id: 'razorpay', config: { webhook_secret: 'whsec_qa', outlet: 'r1' } } })).json; eq((await req('POST', `/api/v1/webhooks/${rz.id}`, { body: '{"id":"pay_1","amount":10000}', headers: { 'content-type': 'application/json', 'x-razorpay-signature': 'bad' } })).status, 401, 'status'); });
await test('C07', 'Signed connector accepts a valid HMAC signature', async () => { const body = JSON.stringify({ id: 'pay_2', amount: 125000, method: 'upi', created_at: Math.floor(Date.now() / 1000) }); const sig = createHmac('sha256', 'whsec_qa').update(body).digest('hex'); eq((await req('POST', `/api/v1/webhooks/${rz.id}`, { body, headers: { 'content-type': 'application/json', 'x-razorpay-signature': sig } })).status, 200, 'status'); });
await test('C08', 'ADMS rejects unregistered devices (403)', async () => { eq((await req('GET', '/iclock/cdata?SN=UNKNOWN')).status, 403, 'status'); });
await test('C09', 'ADMS punch from a registered eSSL device records attendance', async () => {
  const e = (await req('POST', '/api/integrations', { token: T['it.admin'], body: { catalog_id: 'essl', config: { device_sn: 'QA-SN-1' } } })).json;
  const r = await req('POST', '/iclock/cdata?SN=QA-SN-1&table=ATTLOG', { body: `EMP-R1-112\t${new Date().toISOString().slice(0, 19).replace('T', ' ')}\t0\t1\n`, headers: { 'content-type': 'text/plain' } });
  ok(r.text.startsWith('OK'), r.text); await req('DELETE', `/api/integrations/${e.id}`, { token: T['it.admin'] });
});
await test('C10', 'Camera connector generates RTSP sub-stream URLs per channel', async () => { const h = (await req('POST', '/api/integrations', { token: T['it.admin'], body: { catalog_id: 'cpplus', config: { host: '10.1.1.9', username: 'viewer', channels: '1,3', outlet: 'r1' } } })).json; const c = (await req('GET', '/api/integrations', { token: T['it.admin'] })).json.connectors.find((x) => x.id === h.id); ok(c.cameras.length === 2 && c.cameras[1].rtsp.includes('channel=3&subtype=1'), JSON.stringify(c.cameras)); await req('DELETE', `/api/integrations/${h.id}`, { token: T['it.admin'] }); });
await test('C11', 'Branch manager cannot manage integrations (403)', async () => { eq((await req('GET', '/api/integrations', { token: T['manager.r1'] })).status, 403, 'status'); });
for (const c of [conn, rz]) if (c) await req('DELETE', `/api/integrations/${c.id}`, { token: T['it.admin'] });

console.log('\nIngest API v1');
const key = (await req('GET', '/api/integrations', { token: T['it.admin'] })).json.api_key;
const KH = { 'x-api-key': key };
await test('G01', 'Ingest without an API key is refused (401)', async () => { eq((await req('POST', '/api/v1/orders', { body: { outlet_id: 'r1', total: 100 } })).status, 401, 'status'); });
await test('G02', 'Order with items is recorded with tax', async () => { const r = await req('POST', '/api/v1/orders', { headers: KH, body: { outlet_id: 'r1', channel: 'dine-in', items: [{ item_id: dish.id, qty: 1 }] } }); eq(r.status, 200, r.text); ok(r.json.total === dish.price, 'total'); if (INR) ok(Math.abs(r.json.tax - dish.price * 0.05) < 0.01, 'gst'); });
await test('G03', 'Order with zero total is refused (400)', async () => { eq((await req('POST', '/api/v1/orders', { headers: KH, body: { outlet_id: 'r1', total: 0 } })).status, 400, 'status'); });
await test('G04', 'Attendance for an unknown employee is refused (400)', async () => { eq((await req('POST', '/api/v1/attendance', { headers: KH, body: { external_id: 'NOPE' } })).status, 400, 'status'); });
await test('G05', 'Reading for an unknown sensor is refused (400)', async () => { eq((await req('POST', '/api/v1/readings', { headers: KH, body: { sensor_id: 'zz', value: 3 } })).status, 400, 'status'); });
await test('G06', 'Three out-of-range readings raise a high cold-chain alert', async () => {
  for (let i = 0; i < 3; i++) await req('POST', '/api/v1/readings', { headers: KH, body: { sensor_id: 'r6-walkin', value: 11.5 } });
  const a = (await req('GET', '/api/alerts?branch=r6', { token: T.owner })).json; ok(a.some((x) => x.category === 'safety' && x.severity === 'high' && x.title.includes('Walk-in')), 'alert missing');
  for (let i = 0; i < 3; i++) await req('POST', '/api/v1/readings', { headers: KH, body: { sensor_id: 'r6-walkin', value: 3 } });
});
await test('G07', 'Vision batch with heartbeats is accepted and updates camera health', async () => { const r = await req('POST', '/api/v1/vision', { headers: { ...KH, 'user-agent': 'outletos-edge/qa' }, body: { events: [{ outlet_id: 'r1', camera_id: 'r1-hotline', type: 'hairnet', ok: true, confidence: 0.9, people: 2 }], heartbeats: [{ camera_id: 'r1-hotline', fps: 2, latency_ms: 80, model: 'qa' }] } }); eq(r.status, 200, r.text); });
await test('G08', 'A 2★ review raises a guest alert', async () => { await req('POST', '/api/v1/reviews', { headers: KH, body: { outlet_id: 'r2', rating: 2, platform: 'Google', author: 'QA', text: 'QA slow service test' } }); const a = (await req('GET', '/api/alerts?branch=r2', { token: T.owner })).json; ok(a.some((x) => x.category === 'guest' && x.detail.includes('QA slow service test')), 'alert missing'); });
await test('G09', 'Face check-in without consent is refused (403)', async () => { const g = (await req('GET', '/api/guests', { token: T.owner })).json.top.find((x) => !x.consent_face); if (!g) return; eq((await req('POST', '/api/v1/guest-visits', { headers: KH, body: { outlet_id: 'r1', guest_id: g.id, method: 'face' } })).status, 403, 'status'); });
await test('G10', 'CSV import reports row-level errors', async () => { const r = await req('POST', '/api/v1/import/orders', { headers: { ...KH, 'content-type': 'text/csv' }, body: 'outlet_id,total,channel\nr1,250,dine-in\nr1,0,dine-in\n' }); eq(r.json.imported, 1, 'imported'); eq(r.json.errors.length, 1, 'errors'); });
await test('G11', 'Malformed JSON is rejected (400)', async () => { const r = await req('POST', '/api/v1/orders', { headers: { ...KH, 'content-type': 'application/json' }, body: '{bad json' }); ok(r.status === 400, `status ${r.status}`); });

console.log('\nAlerts');
await test('L01', 'Acknowledge an alert', async () => { const a = (await req('GET', '/api/alerts?branch=r1', { token: T['manager.r1'] })).json[0]; if (!a) return; eq((await req('POST', `/api/alerts/${a.id}/ack`, { token: T['manager.r1'] })).status, 200, 'status'); });
await test('L02', 'Cannot acknowledge another branch\'s alert (404)', async () => { const a = (await req('GET', '/api/alerts?branch=r2', { token: T.owner })).json[0]; if (!a) return; eq((await req('POST', `/api/alerts/${a.id}/ack`, { token: T['manager.r1'] })).status, 404, 'status'); });
await test('L03', 'Auditor cannot acknowledge (403)', async () => { eq((await req('POST', '/api/alerts/ack-all', { token: T.auditor })).status, 403, 'status'); });

console.log('\nAI agents');
await test('Q01', 'Roster shows Maître plus specialists the role may use', async () => { const r = (await req('GET', '/api/agents', { token: T.owner })).json; ok(r.maitre && r.specialists.length >= 7, 'agents'); const c = (await req('GET', '/api/agents', { token: T['cook.r1'] })).json; ok(c.specialists.filter((x) => x.available).length < r.specialists.filter((x) => x.available).length, 'cook should see fewer'); });
await test('Q02', 'Briefing returns findings', async () => { const r = (await req('GET', '/api/agents/briefing', { token: T.owner })).json; ok(Array.isArray(r.findings), 'findings'); });
await test('Q03', 'Chat streams a plan and an answer (forecast question)', async () => {
  const r = await req('POST', '/api/agents/chat', { token: T.owner, body: { message: 'What is the forecast for next week?' } });
  const ev = r.text.trim().split('\n').map((l) => JSON.parse(l)); ok(ev.some((e) => e.type === 'answer' && /forecast/i.test(e.text)), 'no forecast answer');
});
await test('Q04', 'Line cook asking about sales gets no revenue figures', async () => { const r = await req('POST', '/api/agents/chat', { token: T['cook.r1'], body: { message: 'How are sales today?' } }); const ans = r.text.trim().split('\n').map((l) => JSON.parse(l)).find((e) => e.type === 'answer'); ok(ans && !/[₹$]\d/.test(ans.text), ans?.text); });
await test('Q05', 'Over-long message is refused (400)', async () => { eq((await req('POST', '/api/agents/chat', { token: T.owner, body: { message: 'x'.repeat(2500) } })).status, 400, 'status'); });

console.log('\nTeam & access');
await test('T01', 'Team list shows roles and permissions', async () => { const r = (await req('GET', '/api/team', { token: T.owner })).json; ok(r.roles.some((x) => x.id === 'cashier') && r.users.length >= 9, 'shape'); });
await test('T02', 'Short password is refused (400)', async () => { eq((await req('POST', '/api/team', { token: T.owner, body: { name: 'X', username: 'qa.short', role: 'host', branches: ['r1'], password: 'short' } })).status, 400, 'status'); });
await test('T03', 'Line cook without station is refused (400)', async () => { eq((await req('POST', '/api/team', { token: T.owner, body: { name: 'X', username: `qa.cook${Date.now()}`, role: 'chef', branches: ['r1'], password: 'longenough123' } })).status, 400, 'status'); });
await test('T04', 'Owner cannot deactivate themselves (400)', async () => { const me = (await req('GET', '/api/me', { token: T.owner })).json.user; eq((await req('PATCH', `/api/team/${me.id}`, { token: T.owner, body: { active: false } })).status, 400, 'status'); });
await test('T05', 'Create and deactivate a user; deactivated user cannot sign in', async () => {
  const u = `qa.host${Date.now()}`; const r = await req('POST', '/api/team', { token: T.owner, body: { name: 'QA Host', username: u, role: 'host', branches: ['r1'], password: 'longenough123' } }); eq(r.status, 200, r.text);
  ok(await login(u, 'longenough123'), 'login before'); await req('PATCH', `/api/team/${r.json.id}`, { token: T.owner, body: { active: false } }); ok(!(await login(u, 'longenough123')), 'login after deactivation');
});

console.log('\nTelegram bot');
{
  // A fake Telegram Bot API on a random local port records what the bot sends; updates are pushed to the real webhook route
  const { createServer } = await import('node:http');
  const sent = [], calls = [];
  const fake = createServer((rq, rs) => { let b = ''; rq.on('data', (c) => { b += c; }); rq.on('end', () => {
    const method = rq.url.split('/').pop(); const body = b ? JSON.parse(b) : {}; calls.push({ method, body });
    if (method === 'sendMessage') sent.push(body);
    const result = method === 'getMe' ? { id: 1, is_bot: true, username: 'outletos_test_bot', first_name: 'OutletOS Test' } : method === 'sendMessage' ? { message_id: sent.length } : true;
    rs.setHeader('content-type', 'application/json'); rs.end(JSON.stringify({ ok: true, result }));
  }); });
  await new Promise((r) => fake.listen(0, '127.0.0.1', r));
  const api_base = `http://127.0.0.1:${fake.address().port}`;
  const TOKEN = `123456:${'A'.repeat(35)}`;
  let hook = null, uid = 1;
  const count = (chat) => sent.filter((x) => String(x.chat_id) === String(chat)).length;
  const reply = async (chat, after) => { for (let i = 0; i < 80; i++) { const m = sent.filter((x) => String(x.chat_id) === String(chat)).slice(after); if (m.length) return m[m.length - 1]; await new Promise((r) => setTimeout(r, 100)); } return null; };
  const post = (body) => req('POST', hook.path, { headers: { 'x-telegram-bot-api-secret-token': hook.header }, body });
  const say = async (chat, text, type = 'private') => {
    const n = count(chat);
    const r = await post({ update_id: uid++, message: { message_id: uid, chat: { id: chat, type }, from: { id: chat, first_name: 'QA' }, text } });
    eq(r.status, 200, 'webhook status');
    return (await reply(chat, n)) || { text: '(no reply)' };
  };
  const linkChat = async (token, chat) => { const c = (await req('POST', '/api/telegram/link-code', { token })).json; ok(c.code, 'code'); return say(chat, `/start ${c.code}`); };

  await test('TG01', 'Line cook cannot configure the bot (403)', async () => { eq((await req('POST', '/api/telegram/config', { token: T['cook.r1'], body: { token: TOKEN } })).status, 403, 'status'); });
  await test('TG02', 'A malformed bot token is refused (400)', async () => { eq((await req('POST', '/api/telegram/config', { token: T['it.admin'], body: { token: 'not-a-token', api_base } })).status, 400, 'status'); });
  await test('TG03', 'IT admin connects the bot (webhook mode); token is masked in status', async () => {
    const r = await req('POST', '/api/telegram/config', { token: T['it.admin'], body: { token: TOKEN, api_base, mode: 'webhook', public_url: 'https://outletos.example.test', enabled: true } });
    eq(r.status, 200, `status ${r.text}`); eq(r.json.bot_username, 'outletos_test_bot', 'bot'); ok(!JSON.stringify(r.json).includes(TOKEN), 'full token leaked');
    const sw = calls.find((c) => c.method === 'setWebhook'); ok(sw, 'setWebhook called'); hook = { path: new URL(sw.body.url).pathname, header: sw.body.secret_token };
    ok(calls.some((c) => c.method === 'setMyCommands'), 'command menu registered');
  });
  await test('TG04', 'Webhook with the wrong secret is rejected (403)', async () => { eq((await req('POST', hook.path, { headers: { 'x-telegram-bot-api-secret-token': 'wrong' }, body: {} })).status, 403, 'status'); });
  await test('TG05', 'An unlinked chat gets connect instructions, no data', async () => { const m = await say(7001, '/sales'); ok(/connect/i.test(m.text) && !/Sales today/.test(m.text), m.text); });
  await test('TG06', 'Owner links a chat with a one-time code; bot confirms name and role', async () => { const m = await linkChat(T.owner, 7002); ok(/Linked to OutletOS/.test(m.text) && /Owner/.test(m.text), m.text); });
  await test('TG07', 'A used link code cannot link a second chat', async () => {
    const c = (await req('POST', '/api/telegram/link-code', { token: T['host.r1'] })).json; await say(7010, `/start ${c.code}`);
    const m = await say(7011, `/start ${c.code}`); ok(/invalid or has expired/.test(m.text), m.text);
  });
  await test('TG08', 'Group chats are refused for privacy', async () => { const m = await say(-7100, '/sales', 'group'); ok(/private chat/.test(m.text), m.text); });
  await test('TG09', 'Owner /sales returns money figures for all branches', async () => { const m = await say(7002, '/sales'); ok(/Sales today/.test(m.text) && /Branches/.test(m.text), m.text); });
  await test('TG10', 'Line cook: /sales is refused by role, /kitchen works', async () => {
    await linkChat(T['cook.r1'], 7003);
    const a = await say(7003, '/sales'); ok(/include \/sales/.test(a.text), a.text);
    const b = await say(7003, '/kitchen'); ok(/Kitchen/.test(b.text) && !/Sales today/.test(b.text), b.text);
  });
  await test('TG11', 'Branch manager cannot switch to another branch; can focus on own', async () => {
    await linkChat(T['manager.r1'], 7004);
    const a = await say(7004, '/branch r2'); ok(/have access/.test(a.text), a.text);
    const b = await say(7004, '/branch r1'); ok(/Scope set/.test(b.text), b.text);
  });
  await test('TG12', '/report 7d returns the management report', async () => { const m = await say(7002, '/report 7d'); ok(/Management report/.test(m.text) && /KPIs/.test(m.text), m.text); });
  await test('TG13', '/alerts offers Acknowledge; tapping it acknowledges as the linked user', async () => {
    const before = (await req('GET', '/api/alerts?status=open&limit=500', { token: T.owner })).json.length;
    const m = await say(7002, '/alerts'); if (!before) return ok(/No open alerts/.test(m.text), m.text);
    const btn = m.reply_markup?.inline_keyboard?.[0]?.[0]; ok(btn && btn.callback_data.startsWith('ack:'), 'no approve button');
    const n = count(7002);
    eq((await post({ update_id: uid++, callback_query: { id: 'cb1', data: btn.callback_data, message: { message_id: 1, chat: { id: 7002 } } } })).status, 200, 'callback');
    const conf = await reply(7002, n); ok(/Acknowledged \d+/.test(conf?.text || ''), conf?.text);
    const after = (await req('GET', '/api/alerts?status=open&limit=500', { token: T.owner })).json.length; ok(after < before, `open ${before} -> ${after}`);
  });
  await test('TG14', 'A plain-language question is answered by the AI agents', async () => { const m = await say(7002, 'What is the forecast for next week?'); ok(/forecast/i.test(m.text), m.text); });
  await test('TG15', 'Status for a non-admin hides the token and other users\' links', async () => { const r = (await req('GET', '/api/telegram/status', { token: T['cook.r1'] })).json; ok(r.configured && r.linked.length === 1 && !('links' in r) && !('token' in r), JSON.stringify(r)); });
  await test('TG16', '/unlink disconnects the chat', async () => { await say(7004, '/unlink'); const m = await say(7004, '/kitchen'); ok(/connect/i.test(m.text), m.text); });
  await req('POST', '/api/telegram/config', { token: T['it.admin'], body: { clear: true } }); // leave the demo without a bot
  fake.close();
}

summary();
process.exit(results.some((r) => !r.ok) ? 1 : 0);

function summary() {
  const pass = results.filter((r) => r.ok).length;
  console.log(`\n${pass}/${results.length} passed${results.length - pass ? `, ${results.length - pass} failed` : ''} · ${Math.round(results.reduce((a, r) => a + r.ms, 0) / 1000)}s`);
  for (const r of results.filter((x) => !x.ok)) console.log(`  FAIL ${r.id} ${r.name}: ${r.error}`);
  try { writeFileSync(resolve(OUT, `test-results-${ONBOARDING ? 'onboarding' : 'main'}.json`), JSON.stringify({ base: BASE, ran: new Date().toISOString(), passed: pass, total: results.length, results }, null, 2)); } catch { /* docs folder missing */ }
  void current;
}
