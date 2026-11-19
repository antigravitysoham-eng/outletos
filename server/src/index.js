import express from 'express';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, getSetting, setSetting, inList } from './db.js';
import { seedReference, hashPassword, DEMO_USERS, DEMO_PASSWORD } from './seed.js';
import { sseHandler, recentEvents } from './bus.js';
import * as TG from './telegram.js';
import * as M from './metrics.js';
import { report } from './reports.js';
import * as BO from './backoffice.js';
import * as ingest from './ingest.js';
import { startSimulator, resume, pause, resetDemo, simulatorStatus, invalidateRef } from './simulator.js';
import * as SETUP from './setup.js';
import { applyMapping, parseCsv, SCHEMAS, TEMPLATES } from './integrations.js';
import { CATALOG, CATALOG_BY_ID, CATEGORIES, setupSteps, maskConfig, cameraBlock } from './connectors.js';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { INSTANCE, publicInstance, applyOrg } from './instance.js';
import { runChat, agentRoster, briefing, recentRuns } from './agents/engine.js';
import { ROLES, PERMISSIONS, requireAuth, requirePerm, verifyPassword, issueToken, principal, publicUser, scopeBranches, alertAllowed } from './policy.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || INSTANCE.port);

seedReference();
applyOrg(getSetting('org', null)); // a tenant configured in onboarding
if (!getSetting('api_key')) setSetting('api_key', `ok_live_${randomBytes(18).toString('hex')}`);
startSimulator();

const app = express();
app.use(express.json({ limit: '2mb', verify: (req, _res, buf) => { if (req.originalUrl.startsWith('/api/v1/webhooks/')) req.rawBody = buf; } }));
app.use(express.text({ type: ['text/csv', 'text/plain'], limit: '5mb' }));

const wrap = (fn) => (req, res) => {
  const fail = (e) => { if (!res.headersSent) res.status(e.status || 500).json({ error: e.message }); };
  try {
    const out = fn(req, res);
    if (out && typeof out.then === 'function') out.then((v) => { if (v !== undefined && !res.headersSent) res.json(v); }, fail);
    else if (out !== undefined) res.json(out);
  } catch (e) { fail(e); }
};
const requireKey = (req, res, next) => ((req.get('x-api-key') || req.query.key) === getSetting('api_key') ? next() : res.status(401).json({ error: 'Missing or invalid x-api-key' }));
const many = (body, fn) => (Array.isArray(body) ? body.map((x) => fn(x)) : fn(body));

// ---------- auth ----------
app.get('/api/auth/demo-users', wrap(() => (INSTANCE.blank ? [] : DEMO_USERS).map(([username, name, role, branches, station]) => ({
  username, name, role, roleLabel: ROLES[role].label, description: ROLES[role].description,
  scope: branches === '*' ? 'All branches' : branches.split(',').map((b) => `Restaurant ${b.slice(1)}`).join(', '), station,
}))));
app.post('/api/auth/login', wrap((req) => {
  const { username, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(String(username || '').trim().toLowerCase());
  if (!user || !verifyPassword(String(password || ''), user.password_hash)) throw ingest.httpError(401, 'Wrong username or password');
  return { token: issueToken(user), user: publicUser(principal(user)) };
}));

// ---------- onboarding (first run) ----------
app.get('/api/setup/status', wrap(() => SETUP.status()));
app.post('/api/setup/owner', wrap((req) => SETUP.createOwner(req.body || {})));

// ---------- Telegram webhook (Telegram calls this; path secret + header secret, no user session) ----------
app.post('/api/telegram/webhook/:secret', (req, res) => {
  if (!TG.verifyWebhook(req.params.secret, req.get('x-telegram-bot-api-secret-token'))) return res.status(403).json({ error: 'Forbidden' });
  res.json({ ok: true }); // acknowledge fast; Telegram retries slow webhooks
  TG.handleUpdate(req.body || {}).catch((e) => console.error('[telegram]', e.message));
});

const api = express.Router();
api.use(requireAuth);
// ---------- Telegram bot ----------
api.get('/telegram/status', wrap((req) => TG.status(req.user)));
api.post('/telegram/link-code', wrap((req) => TG.linkCode(req.user)));
api.delete('/telegram/link', wrap((req) => TG.unlink(req.user)));
api.delete('/telegram/links/:chat', requirePerm('integrations.manage'), wrap((req) => TG.unlink(req.user, req.params.chat)));
api.post('/telegram/config', requirePerm('integrations.manage'), wrap((req) => TG.configure(req.user, req.body || {})));
api.post('/telegram/test', requirePerm('integrations.manage'), wrap((req) => TG.testBot(req.user)));
api.get('/me', wrap((req) => ({ user: publicUser(req.user), group: getSetting('group_name', INSTANCE.group), instance: publicInstance(), modules: getSetting('modules', null), setup: SETUP.status().setup,
  branches: db.prepare(`SELECT id, name, location, city, country, region FROM outlets WHERE id IN (${inList(req.user.branches)}) ORDER BY id`).all(...req.user.branches) })));
api.get('/stream', sseHandler);
api.get('/feed', wrap((req) => recentEvents(req.user)));

// ---------- reads (RBAC per route, ABAC inside metrics) ----------
const b = (req) => req.query.branch;
api.get('/dashboard', wrap((req) => M.dashboard(req.user, b(req))));
api.get('/kitchen', requirePerm('kitchen.view'), wrap((req) => M.kitchen(req.user, b(req))));
api.get('/vision', requirePerm('vision.view'), wrap((req) => M.vision(req.user, b(req))));
api.get('/guests', requirePerm('guests.view'), wrap((req) => M.guests(req.user, b(req))));
api.get('/guests/:id', requirePerm('guests.view'), wrap((req) => M.guestDetail(req.user, req.params.id) ?? (() => { throw ingest.httpError(404, 'Guest not found'); })()));
api.get('/people', requirePerm('staff.view'), wrap((req) => M.people(req.user, b(req))));
api.get('/staffing', requirePerm('staff.view'), wrap((req) => M.staffing(req.user, b(req))));
api.get('/safety', requirePerm('safety.view'), wrap((req) => M.safety(req.user, b(req))));
api.get('/reviews', requirePerm('reviews.view'), wrap((req) => M.reviews(req.user, b(req))));
const REPORT_PERMS = ['sales.view', 'kitchen.view', 'vision.view', 'safety.view', 'staff.view', 'reviews.view'];
api.get('/reports', (req, res, next) => (REPORT_PERMS.some((x) => req.user.perms.has(x)) ? next() : res.status(403).json({ error: `Your role (${req.user.roleLabel}) has no reports` })),
  wrap((req) => report(req.user, { branch: b(req), period: req.query.period })));
api.get('/alerts', requirePerm('alerts.view'), wrap((req) => M.alerts(req.user, { branch: b(req), status: req.query.status, limit: req.query.limit })));
api.post('/alerts/:id/ack', requirePerm('alerts.ack'), wrap((req) => {
  const a = db.prepare('SELECT * FROM alerts WHERE id = ?').get(req.params.id);
  if (!a || !alertAllowed(req.user, a)) throw ingest.httpError(404, 'Alert not found');
  db.prepare('UPDATE alerts SET ack = 1, ack_by = ? WHERE id = ?').run(req.user.name, a.id);
  return { ok: true };
}));
api.post('/alerts/ack-all', requirePerm('alerts.ack'), wrap((req) => {
  const ids = M.alerts(req.user, { branch: b(req), status: 'open', limit: 1000 }).map((a) => a.id);
  const st = db.prepare('UPDATE alerts SET ack = 1, ack_by = ? WHERE id = ?');
  ids.forEach((id) => st.run(req.user.name, id));
  return { ok: true, count: ids.length };
}));
// Browser webcam lab posts here: same pipeline as the edge agent, limited to the user's branches
api.post('/lab/vision', requirePerm('vision.view'), wrap((req) => { scopeBranches(req.user, req.body?.outlet_id); return ingest.recordVision({ ...req.body, source: 'webcam-lab' }); }));
api.put('/cameras/:id', requirePerm('integrations.manage'), wrap((req) => {
  db.prepare('UPDATE cameras SET stream_url = ? WHERE id = ?').run(String(req.body?.stream_url || ''), req.params.id);
  return { ok: true };
}));

const OWNER = requirePerm('users.manage');
api.get('/setup/catalog', OWNER, wrap(() => SETUP.catalog()));
api.get('/setup/draft', OWNER, wrap(() => SETUP.getDraft()));
api.put('/setup/draft', OWNER, wrap((req) => SETUP.saveDraft(req.body || {})));
api.post('/setup/complete', OWNER, async (req, res) => {
  try {
    res.json(await SETUP.complete(req.user, req.body || {}, { onSample: async (sample) => {
      pause(); invalidateRef();
      if (sample) { resetDemo(); resume(); } else BO.seedBackOffice(Date.now(), { sample: false });
    } }));
  } catch (e) { if (!e.status) console.error('[setup]', e); res.status(e.status || 500).json({ error: e.message }); }
});

// ---------- POS ----------
const POS = requirePerm('pos.bill');
api.get('/pos', POS, wrap((req) => BO.posState(req.user, b(req))));
api.get('/pos/history', POS, wrap((req) => BO.posHistory(req.user, b(req))));
api.post('/pos/orders', POS, wrap((req) => BO.posCreate(req.user, req.body || {})));
api.patch('/pos/orders/:id', POS, wrap((req) => BO.posUpdate(req.user, Number(req.params.id), req.body || {})));
api.post('/pos/orders/:id/kot', POS, wrap((req) => BO.posKot(req.user, Number(req.params.id))));
api.post('/pos/orders/:id/discount', POS, wrap((req) => BO.posDiscount(req.user, Number(req.params.id), req.body || {})));
api.post('/pos/orders/:id/nc', POS, wrap((req) => BO.posNc(req.user, Number(req.params.id), req.body || {})));
api.post('/pos/orders/:id/print', POS, wrap((req) => BO.posPrint(req.user, Number(req.params.id))));
api.post('/pos/orders/:id/settle', POS, wrap((req) => BO.posSettle(req.user, Number(req.params.id), req.body || {})));
api.post('/pos/orders/:id/cancel', POS, wrap((req) => BO.posCancel(req.user, Number(req.params.id), req.body || {})));
api.post('/kitchen/tickets/:id/ready', requirePerm('kitchen.view'), wrap((req) => {
  const tk = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
  if (!tk || !req.user.branches.includes(tk.outlet_id)) throw ingest.httpError(404, 'Ticket not found');
  if (req.user.attrs.stationOnly && tk.station !== req.user.station) throw ingest.httpError(403, 'Not your station');
  if (!tk.ready_at) ingest.readyTicket(tk.id, Date.now());
  return { ok: true };
}));
// ---------- menu & inventory ----------
const anyPerm = (...perms) => (req, res, next) => (perms.some((x) => req.user.perms.has(x)) ? next() : res.status(403).json({ error: `Your role (${req.user.roleLabel}) cannot access this` }));
api.get('/menu', anyPerm('menu.manage', 'inventory.manage', 'pos.bill'), wrap((req) => BO.menuView(req.user, b(req))));
api.post('/menu/:id/availability', anyPerm('menu.manage', 'inventory.manage'), wrap((req) => BO.setAvailability(req.user, { ...req.body, item_id: req.params.id })));
api.patch('/menu/:id', requirePerm('menu.manage'), wrap((req) => BO.setPrice(req.user, { item_id: req.params.id, price: req.body?.price })));
const INV = requirePerm('inventory.manage');
api.get('/inventory', INV, wrap((req) => BO.inventory(req.user, b(req))));
api.post('/inventory/waste', INV, wrap((req) => BO.recordWaste(req.user, req.body || {})));
api.post('/inventory/count', INV, wrap((req) => BO.recordCount(req.user, req.body || {})));
api.post('/inventory/po', INV, wrap((req) => BO.createPo(req.user, req.body || {})));
api.post('/inventory/po/:id/receive', INV, wrap((req) => BO.receivePo(req.user, Number(req.params.id), req.body || {})));
// ---------- reservations ----------
const RES = requirePerm('reservations.manage');
api.get('/reservations', RES, wrap((req) => BO.reservations(req.user, b(req), req.query.date)));
api.post('/reservations', RES, wrap((req) => BO.createReservation(req.user, req.body || {})));
api.patch('/reservations/:id', RES, wrap((req) => BO.updateReservation(req.user, Number(req.params.id), req.body || {})));
// ---------- finance & compliance ----------
const FIN = requirePerm('finance.view');
api.get('/finance/dayend', FIN, wrap((req) => BO.dayEnd(req.user, b(req), req.query.date)));
api.post('/finance/dayend/close', requirePerm('finance.close'), wrap((req) => BO.closeDay(req.user, req.body || {})));
api.get('/finance/gst', FIN, wrap((req) => BO.gstRegister(req.user, b(req), Math.min(31, Number(req.query.days) || 7))));
api.get('/finance/reconciliation', FIN, wrap((req) => BO.reconciliation(req.user, b(req), Math.min(28, Number(req.query.days) || 7))));
api.get('/finance/leakage', FIN, wrap((req) => BO.leakage(req.user, b(req), Math.min(28, Number(req.query.days) || 14))));
api.get('/finance/tally', requirePerm('finance.close'), (req, res) => {
  try {
    const xml = BO.tallyXml(req.user, b(req), req.query.date);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="tally-sales-${req.query.date || 'yesterday'}.xml"`);
    res.send(xml);
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

// ---------- AI agents (same RBAC/ABAC as every other read: tools run as the signed-in user) ----------
api.get('/agents', wrap((req) => agentRoster(req.user)));
api.get('/agents/briefing', wrap((req) => ({ findings: briefing(req.user, req.query.branch && req.query.branch !== 'all' && req.user.branches.includes(req.query.branch) ? req.query.branch : undefined), ts: Date.now() })));
api.get('/agents/runs', wrap((req) => recentRuns(req.user)));
api.post('/agents/chat', async (req, res) => {
  const { message, agent = 'maitre', history = [], branch } = req.body || {};
  if (!message || typeof message !== 'string' || message.length > 2000) return res.status(400).json({ error: 'message (up to 2000 characters) is required' });
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.flushHeaders?.();
  const emit = (e) => { if (!res.writableEnded) res.write(`${JSON.stringify(e)}
`); };
  await runChat(req.user, { message: message.trim(), agent, history, branch }, emit);
  res.end();
});

// ---------- team & access ----------
api.get('/team', requirePerm('users.view'), wrap((req) => ({
  roles: Object.entries(ROLES).map(([id, r]) => ({ id, label: r.label, description: r.description, scope: r.scope, perms: r.perms, attrs: r.attrs || {} })),
  permissions: PERMISSIONS,
  users: db.prepare('SELECT id, username, name, role, branches, station, active, created_at FROM users ORDER BY created_at').all()
    .filter((u) => req.user.role === 'owner' || req.user.role === 'it_admin' || u.branches === '*' || u.branches.split(',').some((x) => req.user.branches.includes(x)))
    .map((u) => ({ ...u, roleLabel: ROLES[u.role]?.label })),
})));
api.post('/team', requirePerm('users.manage'), wrap((req) => {
  const { name, username, role, branches = [], station = null, password } = req.body || {};
  if (!name || !username || !ROLES[role]) throw ingest.httpError(400, 'name, username and a valid role are required');
  if (!password || String(password).length < 8) throw ingest.httpError(400, 'Password must be at least 8 characters');
  const scope = ROLES[role].scope === 'all' ? '*' : branches.filter((x) => req.user.branches.includes(x)).join(',');
  if (scope !== '*' && !scope) throw ingest.httpError(400, 'Pick at least one branch');
  if (role === 'chef' && !station) throw ingest.httpError(400, 'Line cooks need a station');
  const id = `u_${randomBytes(6).toString('hex')}`;
  try {
    db.prepare('INSERT INTO users(id, username, name, role, branches, station, password_hash, active, created_at) VALUES (?,?,?,?,?,?,?,?,?)').run(id, String(username).trim().toLowerCase(), name, role, scope, role === 'chef' ? station : null, hashPassword(String(password)), 1, Date.now());
  } catch { throw ingest.httpError(409, 'Username already exists'); }
  return { id };
}));
api.patch('/team/:id', requirePerm('users.manage'), wrap((req) => {
  if (req.params.id === req.user.id) throw ingest.httpError(400, 'You cannot change your own access');
  db.prepare('UPDATE users SET active = ? WHERE id = ?').run(req.body?.active ? 1 : 0, req.params.id);
  return { ok: true };
}));

// ---------- integrations & simulator ----------
const INT = requirePerm('integrations.manage');
api.get('/simulator', INT, wrap(() => simulatorStatus()));
api.post('/simulator', INT, wrap((req) => {
  const { action } = req.body || {};
  if (action === 'pause') pause(); else if (action === 'resume') resume(); else if (action === 'reset') resetDemo();
  return simulatorStatus();
}));
api.get('/integrations', INT, wrap((req) => ({
  api_key: getSetting('api_key'), schemas: SCHEMAS, templates: TEMPLATES,
  catalog: CATALOG.map((x) => ({ ...x, steps: setupSteps(x, `${req.protocol}://${req.get('host')}`) })), categories: CATEGORIES,
  connectors: db.prepare('SELECT * FROM connectors ORDER BY created_at DESC').all().map((c) => {
    const cat = CATALOG_BY_ID[c.catalog_id];
    const cfg = c.config ? JSON.parse(c.config) : {};
    return { ...c, mapping: JSON.parse(c.mapping), config: maskConfig(cfg, cat?.fields), catalog: cat ? { id: cat.id, name: cat.name, category: cat.category, mode: cat.mode, signing: !!cat.signing } : null,
      steps: cat ? setupSteps(cat, `${req.protocol}://${req.get('host')}`, c.id) : null, cameras: cat?.category === 'cctv' ? cameraBlock(cat, cfg, cfg.outlet || 'r1') : null };
  }),
  cameras: db.prepare('SELECT c.*, o.name branch FROM cameras c JOIN outlets o ON o.id = c.outlet_id ORDER BY c.outlet_id').all(),
})));
api.post('/integrations', INT, wrap((req) => {
  const { catalog_id, config = {} } = req.body || {};
  const cat = catalog_id ? CATALOG_BY_ID[catalog_id] : null;
  if (catalog_id && !cat) throw ingest.httpError(400, 'Unknown connector');
  const name = req.body?.name || cat?.name;
  const target = req.body?.target || (cat ? (CATEGORIES[cat.category].target === 'export' ? 'orders' : CATEGORIES[cat.category].target) : 'orders');
  // starter mappings default unmatched vendor store ids to the branch chosen at install
  const mapping = req.body?.mapping || (() => { const o = scopeBranches(req.user, config.outlet || undefined)[0] || 'r1'; return JSON.parse(JSON.stringify(cat?.mapping || {}).replaceAll('"r1"', JSON.stringify(o)).replaceAll('"=r1"', JSON.stringify('=' + o))); })();
  const kind = req.body?.kind || cat?.category || 'pos';
  if (!name) throw ingest.httpError(400, 'name required');
  if (!SCHEMAS[target]) throw ingest.httpError(400, `target must be one of ${Object.keys(SCHEMAS).join(', ')}`);
  const clean = Object.fromEntries(Object.entries(config).filter(([k, v]) => typeof v === 'string' && v.length < 4000 && (k === 'outlet' || cat?.fields?.some((f) => f.key === k))));
  const id = `con_${randomBytes(12).toString('hex')}`;
  db.prepare('INSERT INTO connectors(id, name, kind, target, mapping, created_at, catalog_id, config, status) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id, name, kind, target, JSON.stringify(mapping), Date.now(), cat?.id ?? null, JSON.stringify(clean), 'configured');
  return { id };
}));
api.patch('/integrations/:id', INT, wrap((req) => {
  const c = db.prepare('SELECT * FROM connectors WHERE id = ?').get(req.params.id);
  if (!c) throw ingest.httpError(404, 'connector not found');
  const cat = CATALOG_BY_ID[c.catalog_id];
  if (req.body?.mapping) db.prepare('UPDATE connectors SET mapping = ? WHERE id = ?').run(JSON.stringify(req.body.mapping), c.id);
  if (req.body?.config) {
    const cfg = c.config ? JSON.parse(c.config) : {};
    for (const [k, v] of Object.entries(req.body.config)) if (typeof v === 'string' && !v.startsWith('••••') && (k === 'outlet' || cat?.fields?.some((f) => f.key === k))) cfg[k] = v;
    db.prepare('UPDATE connectors SET config = ? WHERE id = ?').run(JSON.stringify(cfg), c.id);
  }
  return { ok: true };
}));
api.delete('/integrations/:id', INT, wrap((req) => { db.prepare('DELETE FROM connectors WHERE id = ?').run(req.params.id); return { ok: true }; }));
api.post('/integrations/:id/test', INT, wrap((req) => {
  const c = db.prepare('SELECT * FROM connectors WHERE id = ?').get(req.params.id);
  if (!c) throw ingest.httpError(404, 'connector not found');
  return { mapped: applyMapping(req.body, JSON.parse(c.mapping)) };
}));

// ---------- public ingest API v1 (machine-to-machine, API key) ----------
const v1 = express.Router();
v1.post('/orders', requireKey, wrap((req) => many(req.body, (x) => ingest.recordOrder({ source: 'api', ...x }))));
v1.post('/tickets', requireKey, wrap((req) => many(req.body, (x) => (x.id && x.ready_at ? ingest.readyTicket(x.id, x.ready_at) : ingest.fireTicket(x)))));
v1.post('/attendance', requireKey, wrap((req) => many(req.body, ingest.recordAttendance)));
v1.post('/vision', requireKey, wrap((req) => ingest.ingestVision(req.body, { source: req.get('user-agent')?.startsWith('outletos-edge') ? req.get('user-agent') : 'api' })));
v1.post('/vision/heartbeat', requireKey, wrap((req) => many(req.body, ingest.recordHeartbeat)));
v1.post('/readings', requireKey, wrap((req) => many(req.body, ingest.recordReading)));
v1.post('/reviews', requireKey, wrap((req) => many(req.body, ingest.recordReview)));
v1.post('/guest-visits', requireKey, wrap((req) => many(req.body, ingest.recordGuestVisit)));
v1.post('/import/orders', requireKey, wrap((req) => {
  const rows = parseCsv(typeof req.body === 'string' ? req.body : '');
  const results = rows.map((r, i) => { try { ingest.recordOrder({ source: 'csv', ...r }); return null; } catch (e) { return `row ${i + 2}: ${e.message}`; } });
  return { imported: results.filter((x) => !x).length, errors: results.filter(Boolean) };
}));
v1.post('/webhooks/:connector', wrap((req) => {
  const c = db.prepare('SELECT * FROM connectors WHERE id = ?').get(req.params.connector);
  if (!c) throw ingest.httpError(404, 'connector not found');
  // Verify the vendor's HMAC signature when the connector type signs webhooks and a secret is configured
  const cat = CATALOG_BY_ID[c.catalog_id];
  const secret = c.config ? JSON.parse(c.config).webhook_secret : null;
  if (cat?.signing && secret) {
    const s = cat.signing, given = String(req.get(s.header) || '');
    const body = s.includeUrl ? Buffer.concat([Buffer.from(`${req.protocol}://${req.get('host')}${req.originalUrl}`), req.rawBody || Buffer.alloc(0)]) : (req.rawBody || Buffer.alloc(0));
    const want = createHmac(s.algo, secret).update(body).digest(s.encoding);
    if (!given || given.length !== want.length || !timingSafeEqual(Buffer.from(given), Buffer.from(want))) {
      db.prepare('UPDATE connectors SET last_error = ? WHERE id = ?').run(`Rejected: bad ${s.header} signature`, c.id);
      throw ingest.httpError(401, 'Invalid webhook signature');
    }
    if (c.last_error) db.prepare('UPDATE connectors SET last_error = NULL WHERE id = ?').run(c.id);
  }
  const fallbackOutlet = c.config ? JSON.parse(c.config).outlet : null;
  const records = applyMapping(req.body, JSON.parse(c.mapping)).map((r) => (r.outlet_id || !fallbackOutlet || c.target === 'readings' || c.target === 'attendance' ? r : { ...r, outlet_id: fallbackOutlet }));
  const fn = { orders: ingest.recordOrder, attendance: ingest.recordAttendance, vision: ingest.recordVision, readings: ingest.recordReading, reviews: ingest.recordReview }[c.target];
  const saved = records.map((r) => fn({ source: c.name, ...r }));
  db.prepare('UPDATE connectors SET last_seen = ?, received = received + ? WHERE id = ?').run(Date.now(), saved.length, c.id);
  return { accepted: saved.length };
}));
// ---------- ZKTeco / eSSL ADMS push (biometric attendance terminals post punches here) ----------
// Handshake: GET /iclock/cdata?SN=… ; punches: POST /iclock/cdata?SN=…&table=ATTLOG with lines "PIN\tYYYY-MM-DD HH:MM:SS\tstatus\tverify…".
// Only serial numbers registered on an eSSL/ZKTeco connector are accepted.
const admsDevice = (sn) => db.prepare("SELECT * FROM connectors WHERE catalog_id IN ('essl','zkteco')").all()
  .find((c) => String(JSON.parse(c.config || '{}').device_sn || '').split(',').map((x) => x.trim()).filter(Boolean).includes(String(sn || '')));
app.get('/iclock/cdata', (req, res) => {
  if (!admsDevice(req.query.SN)) return res.status(403).type('text/plain').send('Unknown device');
  res.type('text/plain').send(`GET OPTION FROM: ${req.query.SN}\nATTLOGStamp=None\nOPERLOGStamp=9999\nErrorDelay=30\nDelay=10\nTransTimes=00:00;14:05\nTransInterval=1\nTransFlag=1111000000\nRealtime=1\nEncrypt=0`);
});
app.get('/iclock/getrequest', (req, res) => res.type('text/plain').send(admsDevice(req.query.SN) ? 'OK' : 'Unknown device'));
app.post('/iclock/cdata', express.text({ type: '*/*', limit: '1mb' }), (req, res) => {
  const dev = admsDevice(req.query.SN);
  if (!dev) return res.status(403).type('text/plain').send('Unknown device');
  if (req.query.table !== 'ATTLOG') return res.type('text/plain').send('OK');
  let n = 0;
  for (const line of String(req.body || '').split(/\r?\n/).filter(Boolean)) {
    const [pin, when, status] = line.split('\t');
    const staff = db.prepare('SELECT id FROM staff WHERE external_id = ? OR id = ?').get(pin, pin);
    if (!staff) continue;
    try { ingest.recordAttendance({ staff_id: staff.id, ts: new Date(when.replace(' ', 'T')).getTime(), action: ['1', '5'].includes(String(status)) ? 'out' : 'in', method: 'biometric' }); n++; } catch { /* skip bad line */ }
  }
  db.prepare('UPDATE connectors SET last_seen = ?, received = received + ? WHERE id = ?').run(Date.now(), n, dev.id);
  res.type('text/plain').send(`OK: ${n}`);
});
app.use('/api/v1', v1); // mounted before the authenticated router so machine clients use API keys
app.use('/api', api);

// ---------- serve built web app ----------
const dist = resolve(__dirname, '../../web/dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api).*/, (req, res) => res.sendFile(resolve(dist, 'index.html')));
}

TG.startTelegram();
app.listen(PORT, () => console.log(`OutletOS [${INSTANCE.label}] on http://localhost:${PORT}  ${INSTANCE.blank ? (SETUP.needsOwner() ? '(open it to create your workspace)' : '') : `(demo password: ${DEMO_PASSWORD})`}`));
