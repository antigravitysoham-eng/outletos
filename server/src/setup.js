// First-run onboarding: owner account, save-and-resume draft, and "complete", which turns the wizard's answers into a
// working tenant (organisation, outlets, floors and tables, menu, team and roles, devices, connectors, modules, targets),
// then optionally fills it with sample activity so every screen has something to show on day one.
import { randomBytes } from 'node:crypto';
import { db, tx, getSetting, setSetting } from './db.js';
import { INSTANCE, applyOrg } from './instance.js';
import { hashPassword, CAMERAS, SENSORS, GLOBAL_MENU } from './seed.js';
import { COUNTRIES, COUNTRY, BUSINESS_TYPES, MODULES, STAFF_TEMPLATES } from './countries.js';
import { CATALOG, CATALOG_BY_ID, CATEGORIES } from './connectors.js';
import { issueToken, principal, publicUser } from './policy.js';
import { httpError } from './ingest.js';

const INDIAN_MENU = (await import('./instance.js')).INDIA_MENU;
// Loaded hourly labour cost in local currency (wages + statutory on-costs), used for budgets until payroll is connected
const WAGE = { IN: 230, AE: 32, SA: 30, QA: 30, GB: 15, US: 22, CA: 21, SG: 14, MY: 14, TH: 90, AU: 38, NZ: 32, FR: 18, DE: 19, ES: 14, IT: 15, NL: 19, JP: 1500, ZA: 60, ID: 30000 };
const FIRST = ['Alex', 'Sam', 'Jordan', 'Taylor', 'Morgan', 'Riya', 'Arjun', 'Lina', 'Omar', 'Mei', 'Leo', 'Ana', 'Noah', 'Zara', 'Kenji', 'Sofia', 'Ravi', 'Chloe', 'Diego', 'Aisha', 'Hugo', 'Nora', 'Ethan', 'Isha'];
const LAST = ['Patel', 'Kim', 'Khan', 'Silva', 'Nair', 'Weber', 'Tanaka', 'Haddad', 'Moreau', 'Costa', 'Lim', 'Singh', 'Garcia', 'Chen', 'Ahmed', 'Brown', 'Rossi', 'Iyer', 'Das', 'Kapoor'];
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'item';

export const needsOwner = () => db.prepare('SELECT COUNT(*) n FROM users').get().n === 0;
export function status() {
  const s = getSetting('setup', null);
  return { needs_owner: needsOwner(), setup: s ? { status: s.status, step: s.step, updated: s.updated } : { status: needsOwner() ? 'new' : 'complete' }, instance: INSTANCE.id };
}

export function catalog() {
  return {
    countries: COUNTRIES, business_types: BUSINESS_TYPES, modules: MODULES, staff_templates: STAFF_TEMPLATES, wage: WAGE,
    menu_templates: [
      { id: 'indian', label: 'Indian kitchen', count: INDIAN_MENU.length, sample: INDIAN_MENU.slice(0, 6).map((m) => m[1]) },
      { id: 'global', label: 'International bistro', count: GLOBAL_MENU.length, sample: GLOBAL_MENU.slice(0, 6).map((m) => m[1]) },
    ],
    connectors: CATALOG.map(({ id, name, vendor, category, india, market, mode, access, webhooks }) => ({ id, name, vendor, category, india, market, mode, access, webhooks })), categories: CATEGORIES,
    roles: [['owner', 'Owner'], ['area_manager', 'Area Manager'], ['branch_manager', 'Branch Manager'], ['head_chef', 'Head Chef'], ['chef', 'Line Cook'], ['cashier', 'Cashier / Captain'], ['host', 'Host'], ['auditor', 'Food Safety Auditor'], ['it_admin', 'IT / Integrations']],
  };
}

export function createOwner({ name, email, username, password, company }) {
  if (!needsOwner()) throw httpError(409, 'This workspace already has an owner. Sign in instead.');
  if (!name || !username) throw httpError(400, 'Name and username are required');
  if (!password || String(password).length < 10) throw httpError(400, 'Use at least 10 characters for the password');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError(400, 'Enter a valid email');
  const id = `u_${randomBytes(6).toString('hex')}`;
  db.prepare('INSERT INTO users(id, username, name, role, branches, station, password_hash, active, created_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id, String(username).trim().toLowerCase(), String(name).slice(0, 80), 'owner', '*', null, hashPassword(String(password)), 1, Date.now());
  if (email) db.prepare('UPDATE users SET email = ? WHERE id = ?').run(String(email).slice(0, 120), id);
  setSetting('setup', { status: 'in_progress', step: 'business', data: { org: { group: company || '' } }, updated: Date.now() });
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  return { token: issueToken(u), user: publicUser(principal(u)) };
}

export function getDraft() { return getSetting('setup', { status: 'new', data: {} }); }
export function saveDraft({ step, data }) {
  const cur = getSetting('setup', {});
  if (cur.status === 'complete') throw httpError(409, 'Setup is already complete');
  const json = JSON.stringify(data || {});
  if (json.length > 2_000_000) throw httpError(413, 'Draft too large');
  setSetting('setup', { status: 'in_progress', step: step || cur.step, data: data || {}, updated: Date.now() });
  return { ok: true, updated: Date.now() };
}

/** Validate the wizard data and build the tenant. Returns invite credentials to hand out once. */
export async function complete(p, data, { onSample } = {}) {
  const cur = getSetting('setup', {});
  if (cur.status === 'complete') throw httpError(409, 'Setup is already complete');
  const { org = {}, outlets = [], menu = {}, team = {}, modules = [], integrations = [], targets = {}, sample = true } = data || {};
  const country = COUNTRY[org.country];
  if (!country) throw httpError(400, 'Choose a country');
  if (!org.group?.trim()) throw httpError(400, 'Business name is required');
  if (!outlets.length) throw httpError(400, 'Add at least one outlet');
  if (outlets.length > 500) throw httpError(400, 'Up to 500 outlets per setup run');
  const bt = BUSINESS_TYPES.find((b) => b.id === org.business_type) || BUSINESS_TYPES[1];
  const mods = [...new Set([...(modules.length ? modules : bt.modules), 'pos', 'reports'])];
  const tax = { ...country.tax, ...(org.tax || {}) };
  const now = Date.now();
  const invites = [];

  tx(() => {
    for (const t of ['outlets', 'menu_items', 'staff', 'cameras', 'sensors', 'guests', 'dining_tables', 'connectors']) db.exec(`DELETE FROM ${t}`);
    // ---------- outlets, floors, tables ----------
    const insO = db.prepare('INSERT INTO outlets(id, name, location, city, country, region, seats, manager, daily_target, platforms, state, gstin, fssai) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
    const insT = db.prepare('INSERT INTO dining_tables VALUES (?,?,?,?,?)');
    const aggregators = integrations.map((x) => CATALOG_BY_ID[x.catalog_id]).filter((x) => x?.category === 'aggregator').map((x) => x.name.split(' ')[0]);
    const platforms = aggregators.length ? [...new Set(aggregators)].slice(0, 3) : country.platforms.slice(0, 3);
    outlets.forEach((o, i) => {
      const oid = `o${i + 1}`;
      o._id = oid;
      const seats = Math.max(0, Math.round(Number(o.seats) || 0));
      insO.run(oid, String(o.name || `Outlet ${i + 1}`).slice(0, 80), String(o.address || o.area || '').slice(0, 120), String(o.city || '').slice(0, 60), country.name, String(o.state || o.region || '').slice(0, 60),
        seats, o.manager || p.name, Number(o.daily_target) || 0, JSON.stringify(platforms), o.state || null, o.ids?.gstin || null, o.ids?.fssai || null);
      db.prepare('UPDATE outlets SET type = ?, hours = ?, profile = ? WHERE id = ?').run(o.type || bt.id, JSON.stringify(o.hours || { open: '11:00', close: '23:00' }), JSON.stringify({ ids: o.ids || {}, tax_rate: o.tax_rate ?? null, phone: o.phone || null }), oid);
      let n = 0;
      for (const a of o.areas || []) for (const tb of a.tables || []) {
        n++;
        insT.run(`${oid}-T${n}`, oid, String(a.name || 'Main').slice(0, 40), String(tb.name || `T${n}`).slice(0, 12), Math.max(1, Number(tb.seats) || 2));
      }
    });
    // ---------- menu ----------
    const insM = db.prepare('INSERT INTO menu_items(id, name, category, price, cost, station, prep_sec, tags, is_new) VALUES (?,?,?,?,?,?,?,?,?)');
    let items = [];
    if (menu.source === 'template') items = (menu.template === 'indian' ? INDIAN_MENU : GLOBAL_MENU).map(([id, name, category, price, station, prep, tags, isNew]) => ({ id, name, category, price, station, prep, tags, isNew }));
    else items = (menu.items || []).filter((m) => m.name && Number(m.price) > 0).map((m) => ({ id: slug(m.id || m.name), name: m.name, category: m.category || 'Mains', price: Number(m.price), station: m.station || 'Hot Line', prep: Number(m.prep_sec) || 480, tags: m.veg ? 'veg' : (m.tags || '') }));
    if (menu.source === 'template' && menu.priceFactor && menu.priceFactor !== 1) { const st = Number(menu.priceStep) || 0.5; items = items.map((m) => ({ ...m, price: Math.max(st, Math.round((m.price * menu.priceFactor) / st) * st) })); }
    const seen = new Set();
    for (const m of items) { let mid = m.id; while (seen.has(mid)) mid += '_2'; seen.add(mid); insM.run(mid, m.name, m.category, m.price, Math.round(m.price * (0.27 + Math.random() * 0.06) * 100) / 100, m.station, m.prep, m.tags || '', m.isNew ? 1 : 0); }
    // ---------- staff (rostered from the outlet's service model, scaled by seats) and user accounts ----------
    const wage = WAGE[country.code] || 15;
    const insS = db.prepare('INSERT INTO staff VALUES (?,?,?,?,?,?,?,?,?,?)');
    outlets.forEach((o, i) => {
      const model = (BUSINESS_TYPES.find((b) => b.id === (o.type || bt.id)) || bt).service;
      const tpl = STAFF_TEMPLATES[model] || STAFF_TEMPLATES.table;
      const scale = Math.max(0.6, Math.min(3, (Number(o.seats) || 40) / 70));
      let k = 0;
      for (const [role, dept, station, count, start, end] of tpl) {
        const c = role.includes('Manager') || role.includes('Head') ? 1 : Math.max(1, Math.round(count * scale * (o.staffFactor || 1)));
        for (let j = 0; j < c; j++, k++) {
          const name = role.includes('Manager') && o.manager ? o.manager : `${FIRST[(i * 7 + k * 3) % FIRST.length]} ${LAST[(i * 5 + k * 7) % LAST.length]}`;
          const rate = Math.round(wage * (role.includes('Manager') ? 2.2 : role.includes('Head') || role.includes('Lead') ? 1.8 : role.includes('Dish') || role.includes('Packer') ? 0.85 : 1) * 100) / 100;
          insS.run(`${o._id}-s${k + 1}`, o._id, name, role, dept, station, rate, start, end, `EMP-${o._id.toUpperCase()}-${100 + k}`);
        }
      }
    });
    const keyToId = Object.fromEntries(outlets.map((o) => [o.key ?? o._id, o._id]));
    for (const inv of (team.invites || []).slice(0, 500)) {
      if (!inv.name || !inv.role) continue;
      const username = slug(inv.email?.split('@')[0] || inv.name).replace(/_/g, '.');
      if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) continue;
      const code = randomBytes(6).toString('base64url');
      const scope = ['owner', 'auditor', 'it_admin'].includes(inv.role) ? '*' : (inv.outlets || []).map((k) => keyToId[k]).filter(Boolean).join(',') || outlets[0]._id;
      db.prepare('INSERT INTO users(id, username, name, role, branches, station, password_hash, active, created_at) VALUES (?,?,?,?,?,?,?,?,?)')
        .run(`u_${randomBytes(6).toString('hex')}`, username, String(inv.name).slice(0, 80), inv.role, scope, inv.role === 'chef' ? inv.station || 'Hot Line' : null, hashPassword(code), 1, now);
      if (inv.email) db.prepare('UPDATE users SET email = ? WHERE username = ?').run(inv.email, username);
      invites.push({ name: inv.name, role: inv.role, username, temporary_password: code, email: inv.email || null });
    }
    // ---------- devices per enabled module ----------
    const insC = db.prepare('INSERT INTO cameras(id, outlet_id, name, zone, stream_url, status) VALUES (?,?,?,?,?,?)');
    const insSe = db.prepare('INSERT INTO sensors VALUES (?,?,?,?,?,?,?,?)');
    for (const o of outlets) {
      if (mods.includes('vision')) for (const [cid, name, zone] of CAMERAS) { if ((Number(o.seats) || 0) === 0 && ['dining', 'entrance'].includes(cid)) continue; insC.run(`${o._id}-${cid}`, o._id, name, zone, '', 'online'); }
      if (mods.includes('safety')) for (const [sid, name, kind, unit, min, max, base] of SENSORS) insSe.run(`${o._id}-${sid}`, o._id, name, kind, unit, min, max, base);
    }
    // ---------- connectors chosen in setup (credentials are added later on the Integrations page) ----------
    const insX = db.prepare('INSERT INTO connectors(id, name, kind, target, mapping, created_at, catalog_id, config, status) VALUES (?,?,?,?,?,?,?,?,?)');
    for (const x of integrations.slice(0, 200)) {
      const cat = CATALOG_BY_ID[x.catalog_id];
      if (!cat) continue;
      const target = CATEGORIES[cat.category].target === 'export' ? 'orders' : CATEGORIES[cat.category].target;
      const oid = keyToId[x.outlet] || outlets[0]._id;
      insX.run(`con_${randomBytes(12).toString('hex')}`, cat.name, cat.category, target, JSON.stringify(cat.mapping || {}).replaceAll('"r1"', JSON.stringify(oid)), now, cat.id, JSON.stringify({ outlet: oid }), 'awaiting credentials');
    }
    // ---------- sample guests (only when exploring with sample activity) ----------
    if (sample) {
      const insG = db.prepare('INSERT INTO guests VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
      const menuIds = db.prepare('SELECT id, category FROM menu_items').all();
      for (let i = 0; i < Math.min(1200, 120 * outlets.length); i++) {
        const fav = [menuIds[(i * 7) % menuIds.length], menuIds[(i * 11 + 3) % menuIds.length]].filter(Boolean).map((m) => m.id).join(',');
        insG.run(`g${1000 + i}`, `${FIRST[(i * 5) % FIRST.length]} ${LAST[(i * 3 + 1) % LAST.length]}`, `${country.dial} ${String(9000000000 + Math.floor(Math.random() * 999999999)).slice(0, 10)}`,
          outlets[i % outlets.length]._id, 'New', `${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`, i % 9 === 0 ? 'nuts' : '', ['Window', 'Booth', 'Patio', 'Quiet corner'][i % 4], 'Still water', fav, i % 2, now);
      }
    }
    // ---------- organisation ----------
    const orgCfg = {
      group: org.group.trim(), legal_name: org.legal_name || '', country: country.code, currency: { ...country.currency, ...(org.currency || {}) }, timezone: org.timezone || country.timezones[0],
      tax, ids: org.ids || {}, business_type: bt.id, brands: org.brands || [], service_pct: org.service_pct ?? country.service.default, fiscal: org.fiscal || country.fiscal, roundTo: country.roundTo,
      altMain: menu.source === 'template' ? (menu.template === 'indian' ? 'Biryani' : 'Pizza') : null, payments: country.payments, platforms,
    };
    setSetting('org', orgCfg);
    setSetting('group_name', orgCfg.group);
    setSetting('modules', mods);
    setSetting('targets', { food: Number(targets.food) || bt.targets.food, labour: Number(targets.labour) || bt.targets.labour, prime: (Number(targets.food) || bt.targets.food) + (Number(targets.labour) || bt.targets.labour) });
    setSetting('simulator', { running: !!sample });
    setSetting('day_start', 0);
    setSetting('setup', { status: 'complete', step: 'done', data: { ...data, _invitesIssued: invites.length }, updated: now, completed_at: now, completed_by: p.name });
  });
  applyOrg(getSetting('org'));
  if (onSample) await onSample(!!sample);
  return { ok: true, invites, outlets: outlets.length, tables: db.prepare('SELECT COUNT(*) n FROM dining_tables').get().n, staff: db.prepare('SELECT COUNT(*) n FROM staff').get().n, menu: db.prepare('SELECT COUNT(*) n FROM menu_items').get().n };
}
