// Access control: RBAC (role → permissions) + ABAC (attributes: branch scope, region,
// station, department, category). Every read route and every live event goes through here.
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { db, getSetting, setSetting } from './db.js';

export const PERMISSIONS = {
  'dashboard.view': 'See the dashboard',
  'sales.view': 'Sales, orders, channels, top items',
  'finance.view': 'Food cost, labour cost, prime cost',
  'kitchen.view': 'Kitchen tickets and speed of service',
  'vision.view': 'Camera feeds and AI detections',
  'safety.view': 'Fridge and freezer sensors, HACCP log',
  'staff.view': 'Staff attendance',
  'staff.pay': 'Hourly rates and labour cost per person',
  'guests.view': 'Guest arrivals, history and suggestions',
  'guests.pii': 'Full guest phone numbers',
  'reviews.view': 'Online reviews',
  'alerts.view': 'See alerts',
  'alerts.ack': 'Acknowledge alerts',
  'users.view': 'See team and roles',
  'users.manage': 'Create users and assign roles',
  'integrations.manage': 'API keys, connectors, simulator',
  'pos.bill': 'Take orders, send KOTs, print and settle bills',
  'menu.manage': 'Edit menu prices and item availability',
  'inventory.manage': 'Stock, recipes, wastage, counts and purchase orders',
  'reservations.manage': 'Table reservations and waitlist',
  'finance.close': 'Day end, GST register, Tally export, reconciliation',
};

const ALL = Object.keys(PERMISSIONS);
const OPS = ['dashboard.view', 'kitchen.view', 'vision.view', 'safety.view', 'staff.view', 'alerts.view', 'alerts.ack'];

export const ROLES = {
  owner: { label: 'Owner', description: 'Every branch, every number, manages the team.', scope: 'all', perms: ALL },
  area_manager: { label: 'Area Manager', description: 'All operations and finance for the branches in their region.', scope: 'assigned',
    perms: [...OPS, 'sales.view', 'finance.view', 'staff.pay', 'guests.view', 'guests.pii', 'reviews.view', 'users.view', 'menu.manage', 'inventory.manage', 'reservations.manage', 'finance.close'] },
  branch_manager: { label: 'Branch Manager', description: 'Runs one branch: sales, costs, staff, guests, kitchen.', scope: 'assigned',
    perms: [...OPS, 'sales.view', 'finance.view', 'staff.pay', 'guests.view', 'guests.pii', 'reviews.view', 'pos.bill', 'menu.manage', 'inventory.manage', 'reservations.manage', 'finance.close'] },
  head_chef: { label: 'Head Chef', description: 'Kitchen, cameras, food safety and the kitchen team. No sales or costs.', scope: 'assigned',
    perms: [...OPS, 'inventory.manage'], attrs: { department: 'Kitchen', alertCategories: ['speed', 'hygiene', 'safety', 'people'] } },
  chef: { label: 'Line Cook', description: 'Only the tickets and alerts for their own station.', scope: 'assigned',
    perms: ['kitchen.view', 'safety.view', 'alerts.view'], attrs: { stationOnly: true, alertCategories: ['speed', 'safety'] } },
  host: { label: 'Host / Front of House', description: 'Guest arrivals, preferences and suggestions, reviews.', scope: 'assigned',
    perms: ['guests.view', 'reviews.view', 'alerts.view', 'alerts.ack', 'reservations.manage', 'pos.bill'], attrs: { alertCategories: ['guest'] } },
  cashier: { label: 'Cashier / Captain', description: 'Takes orders on the POS, sends KOTs, settles bills, manages reservations.', scope: 'assigned',
    perms: ['pos.bill', 'reservations.manage', 'guests.view', 'alerts.view'], attrs: { alertCategories: ['guest'] } },
  auditor: { label: 'Food Safety Auditor', description: 'Read-only hygiene, cameras and cold chain across all branches.', scope: 'all',
    perms: ['vision.view', 'safety.view', 'alerts.view'], attrs: { alertCategories: ['hygiene', 'safety'] } },
  it_admin: { label: 'IT / Integrations', description: 'Connects POS, devices and cameras. No business data.', scope: 'all',
    perms: ['integrations.manage', 'users.view'] },
};

const allBranches = () => db.prepare('SELECT id FROM outlets ORDER BY id').all().map((r) => r.id);

export function principal(user) {
  const role = ROLES[user.role];
  if (!role) return null;
  const branches = role.scope === 'all' || user.branches === '*' ? allBranches() : (user.branches || '').split(',').filter(Boolean);
  return {
    id: user.id, username: user.username, name: user.name, role: user.role, roleLabel: role.label,
    perms: new Set(role.perms), branches, station: user.station || null, attrs: role.attrs || {},
  };
}

export const can = (p, perm, branchId) => !!p && p.perms.has(perm) && (!branchId || p.branches.includes(branchId));

/** Branches this request may read: the requested one (if allowed) or the whole scope. */
export function scopeBranches(p, requested) {
  if (requested && requested !== 'all') {
    if (!p.branches.includes(requested)) { const e = new Error('No access to this branch'); e.status = 403; throw e; }
    return [requested];
  }
  return p.branches;
}

export const alertAllowed = (p, a) =>
  p.branches.includes(a.outlet_id) && (!p.attrs.alertCategories || p.attrs.alertCategories.includes(a.category))
  && (!p.attrs.stationOnly || !a.station || a.station === p.station);

// Which live events a user may receive
const EVENT_PERM = { order: 'sales.view', ticket: 'kitchen.view', vision: 'vision.view', attendance: 'staff.view', reading: 'safety.view', review: 'reviews.view', guest: 'guests.view' };
export function eventVisible(p, type, data) {
  if (type === 'alert') return p.perms.has('alerts.view') && alertAllowed(p, data.alert);
  const perm = EVENT_PERM[type];
  if (!perm || !p.perms.has(perm) || !p.branches.includes(data.outlet_id)) return false;
  if (type === 'ticket' && p.attrs.stationOnly && data.station !== p.station) return false;
  if (type === 'attendance' && p.attrs.department && data.department !== p.attrs.department) return false;
  return true;
}

// ---------- auth: scrypt passwords + HMAC-signed tokens ----------
const secret = () => {
  let s = getSetting('auth_secret');
  if (!s) { s = randomBytes(32).toString('hex'); setSetting('auth_secret', s); }
  return s;
};
const b64 = (s) => Buffer.from(s).toString('base64url');

export function verifyPassword(pw, stored) {
  const [salt, hash] = (stored || '').split(':');
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, 'hex'), b = scryptSync(pw, salt, 32);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function issueToken(user) {
  const body = b64(JSON.stringify({ uid: user.id, exp: Date.now() + 12 * 3600_000 }));
  return `${body}.${createHmac('sha256', secret()).update(body).digest('base64url')}`;
}

export function userFromToken(token) {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const good = createHmac('sha256', secret()).update(body).digest('base64url');
  if (sig.length !== good.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  const { uid, exp } = JSON.parse(Buffer.from(body, 'base64url').toString());
  if (exp < Date.now()) return null;
  const user = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(uid);
  return user ? principal(user) : null;
}

export function requireAuth(req, res, next) {
  const h = req.get('authorization') || '';
  const p = userFromToken(h.startsWith('Bearer ') ? h.slice(7) : req.query.token);
  if (!p) return res.status(401).json({ error: 'Please sign in' });
  req.user = p;
  next();
}

export const requirePerm = (perm) => (req, res, next) =>
  req.user?.perms.has(perm) ? next() : res.status(403).json({ error: `Your role (${req.user?.roleLabel}) cannot access this` });

export const publicUser = (p) => ({
  id: p.id, username: p.username, name: p.name, role: p.role, roleLabel: p.roleLabel,
  perms: [...p.perms], branches: p.branches, station: p.station, attrs: p.attrs,
});
