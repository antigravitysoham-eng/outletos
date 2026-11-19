// Back office: POS billing (tables, KOT, discounts, NC, split tender, GST bill), menu & 86, inventory (recipes,
// theoretical stock, wastage, counts, purchase orders, vendors), reservations & waitlist, and finance (day end,
// GST register, Tally XML, aggregator reconciliation, leakage audit with staff risk scoring).
// Every function takes the caller's principal and only touches branches in scope.
import { db, tx, midnight, inList, getSetting } from './db.js';
import { INSTANCE, fmtMoney } from './instance.js';
import { scopeBranches } from './policy.js';
import { recordOrder, fireTicket, readyTicket, httpError } from './ingest.js';
import { packFor, buildRecipes } from './recipes.js';

const MIN = 60_000, HOUR = 3600_000, DAY = 86400_000;
const r2 = (x) => Math.round(x * 100) / 100;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const india = INSTANCE.id === 'india';

db.exec(`
CREATE TABLE IF NOT EXISTS dining_tables (id TEXT PRIMARY KEY, outlet_id TEXT, area TEXT, name TEXT, seats INTEGER);
CREATE TABLE IF NOT EXISTS pos_orders (id INTEGER PRIMARY KEY AUTOINCREMENT, outlet_id TEXT, table_id TEXT, channel TEXT, status TEXT, guest_id TEXT, customer TEXT,
  covers INTEGER, items TEXT, discount_pct REAL DEFAULT 0, discount_reason TEXT, nc_reason TEXT, service_pct REAL DEFAULT 0, kots INTEGER DEFAULT 0, printed INTEGER DEFAULT 0,
  bill_no TEXT, payments TEXT, opened_by TEXT, opened_at INTEGER, settled_at INTEGER, order_id INTEGER, cancel_reason TEXT);
CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, outlet_id TEXT, ts INTEGER, user TEXT, action TEXT, ref TEXT, detail TEXT, amount REAL);
CREATE TABLE IF NOT EXISTS ingredients (id TEXT PRIMARY KEY, name TEXT, unit TEXT, cost REAL, category TEXT, vendor_id TEXT);
CREATE TABLE IF NOT EXISTS recipes (item_id TEXT, ingredient_id TEXT, qty REAL, PRIMARY KEY (item_id, ingredient_id));
CREATE TABLE IF NOT EXISTS vendors (id TEXT PRIMARY KEY, name TEXT, supplies TEXT, lead_days INTEGER, phone TEXT, gstin TEXT);
CREATE TABLE IF NOT EXISTS stock_counts (id INTEGER PRIMARY KEY AUTOINCREMENT, outlet_id TEXT, ingredient_id TEXT, qty REAL, theoretical REAL, ts INTEGER, user TEXT);
CREATE TABLE IF NOT EXISTS stock_moves (id INTEGER PRIMARY KEY AUTOINCREMENT, outlet_id TEXT, ingredient_id TEXT, qty REAL, type TEXT, ref TEXT, reason TEXT, cost REAL, ts INTEGER, user TEXT);
CREATE TABLE IF NOT EXISTS purchase_orders (id INTEGER PRIMARY KEY AUTOINCREMENT, outlet_id TEXT, vendor_id TEXT, status TEXT, lines TEXT, total REAL, created_at INTEGER, created_by TEXT, expected_at INTEGER, received_at INTEGER);
CREATE TABLE IF NOT EXISTS reservations (id INTEGER PRIMARY KEY AUTOINCREMENT, outlet_id TEXT, name TEXT, phone TEXT, covers INTEGER, ts INTEGER, status TEXT, source TEXT,
  table_id TEXT, deposit REAL, notes TEXT, created_at INTEGER, guest_id TEXT);
CREATE TABLE IF NOT EXISTS day_closes (outlet_id TEXT, date TEXT, closed_at INTEGER, closed_by TEXT, summary TEXT, cash_declared REAL, PRIMARY KEY (outlet_id, date));
CREATE TABLE IF NOT EXISTS menu_86 (outlet_id TEXT, item_id TEXT, ts INTEGER, user TEXT, PRIMARY KEY (outlet_id, item_id));
CREATE INDEX IF NOT EXISTS ix_audit ON audit_log(outlet_id, ts);
CREATE INDEX IF NOT EXISTS ix_moves ON stock_moves(outlet_id, ts);
CREATE INDEX IF NOT EXISTS ix_pos ON pos_orders(outlet_id, status);
CREATE INDEX IF NOT EXISTS ix_resv ON reservations(outlet_id, ts);
`);
if (!db.prepare('PRAGMA table_info(tickets)').all().some((c) => c.name === 'source')) db.exec('ALTER TABLE tickets ADD COLUMN source TEXT');

// ---------- reference lists ----------
export const REASONS = {
  discount: ['Loyal regular', 'Corporate tie-up', 'Birthday / anniversary', 'Service recovery', 'Manager approval', 'Happy hour'],
  nc: ['Staff meal', "Owner's guest", 'Guest complaint (remake)', 'Food tasting', 'Marketing / influencer'],
  cancel: ['Guest changed mind', 'Wrong item punched', 'Item unavailable', 'Long wait', 'Duplicate KOT'],
  waste: ['Expired', 'Spoiled', 'Over-production', 'Dropped / spilled', 'Returned by guest', 'Quality reject'],
};
export const TENDERS = india ? ['upi', 'card', 'cash', 'wallet', 'credit'] : ['card', 'cash', 'wallet', 'credit'];
const AREAS = india ? [['AC Hall', 10, 4], ['Family', 6, 6], ['Terrace', 6, 4]] : [['Main floor', 12, 4], ['Patio', 6, 4], ['Bar', 4, 2]];
const RES_SOURCES = india ? ['Phone', 'Walk-in', 'Zomato Dining', 'EazyDiner', 'District', 'Website'] : ['Phone', 'OpenTable', 'Website', 'Walk-in', 'Google'];
export const COMMISSION = {
  Swiggy: 0.22, Zomato: 0.22, Magicpin: 0.12, ONDC: 0.08, Website: 0.02, 'Uber Eats': 0.25, DoorDash: 0.22, Deliveroo: 0.25, Talabat: 0.22, GrabFood: 0.25, foodpanda: 0.25,
};
const TCS = india ? 0.005 : 0, GST_ON_COMMISSION = india ? 0.18 : 0;

// ---------- seeding (called after the demo history is built) ----------
export function seedBackOffice(t = Date.now(), { sample = true } = {}) {
  const day = midnight(t);
  const menuRows = db.prepare('SELECT * FROM menu_items').all();
  const pack = packFor(menuRows.map((m) => m.id));
  const INGREDIENTS = pack.ingredients, VENDORS = pack.vendors;
  tx(() => {
    for (const tbl of ['pos_orders', 'audit_log', 'stock_counts', 'stock_moves', 'purchase_orders', 'reservations', 'day_closes', 'menu_86']) db.exec(`DELETE FROM ${tbl}`);
    db.exec('DELETE FROM ingredients; DELETE FROM recipes; DELETE FROM vendors;');
    const keepTables = db.prepare('SELECT COUNT(*) n FROM dining_tables').get().n > 0 && !!getSetting('org');
    if (!keepTables) db.exec('DELETE FROM dining_tables');
    const outlets = db.prepare('SELECT * FROM outlets ORDER BY id').all();
    const insI = db.prepare('INSERT INTO ingredients VALUES (?,?,?,?,?,?)');
    INGREDIENTS.forEach((i) => insI.run(i.id, i.name, i.unit, i.cost, i.category, i.vendor));
    const insV = db.prepare('INSERT INTO vendors VALUES (?,?,?,?,?,?)');
    VENDORS.forEach((v, k) => insV.run(v.id, v.name, v.supplies, v.lead_days, india ? `+91 98${String(20000000 + k * 1234567).slice(0, 8)}` : `+1 555 01${k}0`, india ? `27AAFCV${1000 + k}K1Z${k}` : null));
    const insR = db.prepare('INSERT INTO recipes VALUES (?,?,?)');
    buildRecipes(menuRows, pack).forEach((r) => insR.run(r.item_id, r.ingredient_id, r.qty));
    const insT = db.prepare('INSERT INTO dining_tables VALUES (?,?,?,?,?)');
    for (const o of keepTables ? [] : outlets) {
      let n = 1;
      for (const [area, count, seats] of AREAS) for (let k = 0; k < count; k++, n++) insT.run(`${o.id}-T${n}`, o.id, area, `T${n}`, seats);
    }
    if (!sample) return; // a real tenant starts with empty stock, POs, bookings and audit trail
    // stock count two mornings ago, purchases since, a little wastage
    const countTs = day - 2 * DAY + 6 * HOUR;
    const insC = db.prepare('INSERT INTO stock_counts(outlet_id, ingredient_id, qty, theoretical, ts, user) VALUES (?,?,?,?,?,?)');
    const insM = db.prepare('INSERT INTO stock_moves(outlet_id, ingredient_id, qty, type, ref, reason, cost, ts, user) VALUES (?,?,?,?,?,?,?,?,?)');
    for (const o of outlets) {
      const use = usagePerDay(o.id, day);
      for (const i of INGREDIENTS) {
        const u = use[i.id] || 0;
        const low = (o.id === 'r4' && Math.random() < 0.3) || Math.random() < 0.08;
        const qty = r2(u * (low ? rnd(2.2, 3.2) : rnd(4.5, 7.5)));
        insC.run(o.id, i.id, qty, qty, countTs, 'system');
        if (Math.random() < 0.45) insM.run(o.id, i.id, r2(u * rnd(1.5, 2.5)), 'purchase', 'GRN', null, i.cost, day - DAY + rnd(9, 12) * HOUR, 'Stores');
      }
      for (let d = 7; d >= 0; d--) {
        for (let k = 0; k < (o.id === 'r4' ? 6 : 3); k++) {
          const i = pick(INGREDIENTS), u = use[i.id] || 1;
          const ts = day - d * DAY + rnd(10, 23) * HOUR;
          if (ts < t) insM.run(o.id, i.id, -r2(u * rnd(0.02, 0.12)), 'waste', null, pick(REASONS.waste), i.cost, ts, 'Kitchen');
        }
      }
      // one PO sent today, one received yesterday
      const v = pick(VENDORS);
      const lines = INGREDIENTS.filter((i) => i.vendor === v.id).slice(0, 4).map((i) => ({ ingredient_id: i.id, qty: Math.max(1, Math.round((use[i.id] || 1) * 2)), cost: i.cost }));
      db.prepare('INSERT INTO purchase_orders(outlet_id, vendor_id, status, lines, total, created_at, created_by, expected_at) VALUES (?,?,?,?,?,?,?,?)')
        .run(o.id, v.id, 'sent', JSON.stringify(lines), r2(lines.reduce((a, l) => a + l.qty * l.cost, 0)), day + 7 * HOUR, o.manager, day + DAY + 10 * HOUR);
      // reservations: today and tomorrow
      const insRes = db.prepare('INSERT INTO reservations(outlet_id, name, phone, covers, ts, status, source, table_id, deposit, notes, created_at, guest_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
      const guests = db.prepare('SELECT id, name, phone FROM guests WHERE home_outlet = ? ORDER BY RANDOM() LIMIT 30').all(o.id);
      for (let dd = -14; dd <= 1; dd++) {
        for (let k = 0; k < Math.round(dd < 0 ? rnd(6, 10) : rnd(10, 16)); k++) {
          const g = guests[k % guests.length];
          const ts = day + dd * DAY + (Math.random() < 0.35 ? rnd(12, 15) : rnd(19, 22.5)) * HOUR;
          const past = ts < t - 30 * MIN;
          const status = !past ? 'booked' : Math.random() < (o.id === 'r4' ? 0.18 : 0.08) ? 'no_show' : ts < t - 2 * HOUR ? 'completed' : 'seated';
          insRes.run(o.id, g?.name || 'Guest', g?.phone || '', pick([2, 2, 2, 3, 4, 4, 5, 6, 8]), Math.round(ts / (15 * MIN)) * 15 * MIN, status, pick(RES_SOURCES), null,
            Math.random() < 0.2 ? (india ? 500 : 20) : 0, pick(['', '', 'Anniversary', 'Birthday cake', 'High chair', 'Window seat', 'Jain food', 'Allergy: nuts']), t - rnd(1, 72) * HOUR, g?.id || null);
        }
      }
    }
    seedAudit(outlets, day, t);
  });
  usageCache.clear();
}

function seedAudit(outlets, day, t) {
  const ins = db.prepare('INSERT INTO audit_log(outlet_id, ts, user, action, ref, detail, amount) VALUES (?,?,?,?,?,?,?)');
  const menu = db.prepare('SELECT name, price FROM menu_items').all();
  for (const o of outlets) {
    let staff = db.prepare("SELECT name FROM staff WHERE outlet_id = ? AND department IN ('Front of House', 'Management')").all(o.id).map((s) => s.name);
    if (staff.length < 3) staff = [...staff, ...db.prepare('SELECT name FROM staff WHERE outlet_id = ? LIMIT 4').all(o.id).map((s) => s.name)];
    if (!staff.length) staff = [o.manager || 'Manager'];
    const risky = staff[Math.min(2, staff.length - 1)]; // one cashier with an unusual pattern, for the risk score to find
    for (let d = 14; d >= 0; d--) {
      const mult = o.id === 'r4' ? 2.2 : 1;
      const events = [['discount', 9], ['kot_cancel', 4], ['reprint', 3], ['nc', 2], ['modify_after_print', 1.2], ['bill_cancel', 0.6]];
      for (const [action, rate] of events) {
        for (let k = 0; k < Math.round(rate * mult * rnd(0.6, 1.4)); k++) {
          const ts = day - d * DAY + rnd(11, 23.5) * HOUR;
          if (ts > t) continue;
          const user = Math.random() < (o.id === 'r4' ? 0.35 : 0.12) ? risky : pick(staff);
          const m = pick(menu);
          const amount = action === 'discount' ? r2(m.price * rnd(1.5, 4) * pick([0.1, 0.1, 0.15, 0.2])) : action === 'reprint' ? 0 : r2(m.price * rnd(1, 2));
          const reason = action === 'discount' ? pick(REASONS.discount) : action === 'nc' ? pick(REASONS.nc) : ['kot_cancel', 'bill_cancel'].includes(action) ? pick(REASONS.cancel) : action === 'reprint' ? 'Bill reprinted' : 'Item changed after bill print';
          ins.run(o.id, Math.round(ts), user, action, `${o.id.toUpperCase()}-${Math.floor(rnd(1000, 9999))}`, `${reason}${['kot_cancel', 'nc', 'modify_after_print'].includes(action) ? ` · ${m.name}` : ''}`, amount);
        }
      }
    }
    // past day-ends closed by the manager
    for (let d = 14; d >= 1; d--) {
      const date = dkey(day - d * DAY + 2 * HOUR);
      const s = daySummary(o.id, midnight(day - d * DAY + 2 * HOUR));
      db.prepare('INSERT INTO day_closes VALUES (?,?,?,?,?,?)').run(o.id, date, midnight(day - d * DAY + 2 * HOUR) + DAY + 30 * MIN, o.manager, JSON.stringify(s), r2(s.tenders.cash || 0) - (Math.random() < 0.1 ? r2(rnd(50, 400) * (india ? 1 : 0.1)) : 0));
    }
  }
}

const dkey = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const singleBranch = (p, branch) => { const B = scopeBranches(p, branch); return B[0]; };
const audit = (outlet, user, action, ref, detail, amount = 0) =>
  db.prepare('INSERT INTO audit_log(outlet_id, ts, user, action, ref, detail, amount) VALUES (?,?,?,?,?,?,?)').run(outlet, Date.now(), user, action, String(ref), detail, r2(amount));

// =====================================================================================
// POS
// =====================================================================================
const unavailable = (outlet) => new Set(db.prepare('SELECT item_id FROM menu_86 WHERE outlet_id = ?').all(outlet).map((r) => r.item_id));
export const eightySixSet = () => new Set(db.prepare("SELECT outlet_id || ':' || item_id k FROM menu_86").all().map((r) => r.k));

export function bill(o) {
  const items = JSON.parse(o.items || '[]');
  const lines = items.filter((i) => i.qty > 0).map((i) => ({ ...i, amount: r2(i.qty * i.price) }));
  const subtotal = r2(lines.reduce((a, l) => a + l.amount, 0));
  const nc = !!o.nc_reason;
  const discount = nc ? subtotal : r2(subtotal * (o.discount_pct || 0) / 100);
  const service = nc ? 0 : r2((subtotal - discount) * (o.service_pct || 0) / 100);
  const parts = INSTANCE.tax.split || (INSTANCE.tax.rate ? [[INSTANCE.tax.name, INSTANCE.tax.rate]] : []);
  const rate = parts.reduce((x, [, r]) => x + r, 0);
  // Tax-inclusive countries (UAE, KSA, UK, EU, AU…): menu prices already contain tax, so it is extracted, not added
  const inclusive = !!INSTANCE.tax.inclusive && rate > 0;
  const base = r2(subtotal - discount + service);
  const taxable = inclusive ? r2(base / (1 + rate)) : base;
  const taxes = parts.map(([name, r]) => ({ name, rate: r, amount: r2(taxable * r) }));
  const gross = inclusive ? base : r2(taxable + taxes.reduce((a, x) => a + x.amount, 0));
  const step = INSTANCE.roundTo || (india ? 1 : 0.01);
  const total = r2(Math.round(gross / step) * step);
  return { lines, subtotal, discount, discount_pct: o.discount_pct || 0, discount_reason: o.discount_reason, nc, nc_reason: o.nc_reason, service, service_pct: o.service_pct || 0, taxable, taxes, inclusive, round_off: r2(total - gross), total };
}

function posOrder(id, B) {
  const o = db.prepare('SELECT * FROM pos_orders WHERE id = ?').get(id);
  if (!o || !B.includes(o.outlet_id)) throw httpError(404, 'Order not found');
  return o;
}
const view = (o) => ({ ...o, items: JSON.parse(o.items || '[]'), payments: o.payments ? JSON.parse(o.payments) : null, bill: bill(o) });

export function posState(p, branch) {
  const outlet = singleBranch(p, branch);
  const o = db.prepare('SELECT * FROM outlets WHERE id = ?').get(outlet);
  const off = unavailable(outlet);
  const open = db.prepare("SELECT * FROM pos_orders WHERE outlet_id = ? AND status IN ('open', 'billed') ORDER BY opened_at").all(outlet).map(view);
  const tables = db.prepare('SELECT * FROM dining_tables WHERE outlet_id = ? ORDER BY rowid').all(outlet).map((tb) => {
    const ord = open.find((x) => x.table_id === tb.id);
    const res = db.prepare("SELECT name, covers, ts FROM reservations WHERE table_id = ? AND status = 'booked' AND ts BETWEEN ? AND ?").get(tb.id, Date.now() - HOUR, Date.now() + 2 * HOUR);
    return { ...tb, status: ord ? (ord.status === 'billed' ? 'billed' : ord.kots ? 'occupied' : 'ordering') : res ? 'reserved' : 'free', order_id: ord?.id ?? null, total: ord?.bill.total ?? 0, since: ord?.opened_at ?? null, reservation: res || null };
  });
  const menu = db.prepare('SELECT id, name, category, price, station, tags, is_new FROM menu_items ORDER BY category, name').all().map((m) => ({ ...m, available: !off.has(m.id) }));
  const today = midnight();
  const settled = db.prepare("SELECT COUNT(*) n, COALESCE(SUM(json_extract(payments, '$.total')), 0) v FROM pos_orders WHERE outlet_id = ? AND status = 'settled' AND settled_at >= ?").get(outlet, today);
  return { outlet: { id: o.id, name: o.name, city: o.city, gstin: o.gstin, fssai: o.fssai, state: o.state, location: o.location }, group: getSetting('group_name', INSTANCE.group),
    tables, open, menu, reasons: REASONS, tenders: TENDERS, tax: INSTANCE.tax, currency: INSTANCE.currency, areas: [...new Set(tables.map((x) => x.area))], settled_today: settled };
}

export function posCreate(p, { branch, table_id = null, channel = 'dine-in', covers = 2, customer = null, guest_id = null }) {
  const outlet = singleBranch(p, branch);
  if (table_id) {
    const tb = db.prepare('SELECT * FROM dining_tables WHERE id = ? AND outlet_id = ?').get(table_id, outlet);
    if (!tb) throw httpError(400, 'Unknown table');
    const busy = db.prepare("SELECT id FROM pos_orders WHERE table_id = ? AND status IN ('open', 'billed')").get(table_id);
    if (busy) return view(db.prepare('SELECT * FROM pos_orders WHERE id = ?').get(busy.id));
  }
  if (!['dine-in', 'takeaway', 'delivery'].includes(channel)) throw httpError(400, 'channel must be dine-in, takeaway or delivery');
  const { lastInsertRowid } = db.prepare("INSERT INTO pos_orders(outlet_id, table_id, channel, status, covers, items, opened_by, opened_at, customer, guest_id) VALUES (?,?,?,'open',?, '[]', ?, ?, ?, ?)")
    .run(outlet, table_id, channel, Math.max(1, Number(covers) || 1), p.name, Date.now(), customer ? String(customer).slice(0, 80) : null, guest_id);
  return view(db.prepare('SELECT * FROM pos_orders WHERE id = ?').get(lastInsertRowid));
}

export function posUpdate(p, id, { items, covers, reason }) {
  const o = posOrder(id, p.branches);
  if (o.status !== 'open' && o.status !== 'billed') throw httpError(400, 'Order is closed');
  const cur = JSON.parse(o.items);
  const off = unavailable(o.outlet_id);
  const next = [];
  for (const it of items || []) {
    const m = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(it.item_id);
    if (!m) continue;
    const prev = cur.find((x) => x.item_id === it.item_id) || { sent: 0, qty: 0 };
    const qty = Math.max(0, Math.floor(Number(it.qty) || 0));
    if (qty > prev.qty && off.has(m.id)) throw httpError(400, `${m.name} is marked unavailable (86)`);
    if (qty < prev.sent) {
      if (!reason) throw httpError(400, `A reason is required to cancel ${m.name} after the KOT was sent`);
      audit(o.outlet_id, p.name, o.printed ? 'modify_after_print' : 'kot_cancel', id, `${reason} · ${m.name} ×${prev.sent - qty}`, (prev.sent - qty) * prev.price);
    }
    next.push({ item_id: m.id, name: m.name, price: prev.price ?? m.price, qty, sent: Math.min(prev.sent, qty), station: m.station, note: it.note ?? prev.note ?? '' });
  }
  for (const prev of cur) if (prev.sent > 0 && !next.find((x) => x.item_id === prev.item_id)) {
    if (!reason) throw httpError(400, `A reason is required to remove ${prev.name} after the KOT was sent`);
    audit(o.outlet_id, p.name, 'kot_cancel', id, `${reason} · ${prev.name} ×${prev.sent}`, prev.sent * prev.price);
  }
  db.prepare("UPDATE pos_orders SET items = ?, covers = COALESCE(?, covers), status = 'open' WHERE id = ?").run(JSON.stringify(next.filter((x) => x.qty > 0)), covers ?? null, id);
  return view(db.prepare('SELECT * FROM pos_orders WHERE id = ?').get(id));
}

export function posKot(p, id) {
  const o = posOrder(id, p.branches);
  const items = JSON.parse(o.items);
  const tb = o.table_id ? db.prepare('SELECT name FROM dining_tables WHERE id = ?').get(o.table_id)?.name : null;
  const fired = [];
  for (const it of items) {
    for (let k = it.sent; k < it.qty; k++) {
      const tk = fireTicket({ outlet_id: o.outlet_id, item_id: it.item_id, table_no: tb || `#${o.id}`, channel: o.channel, fired_at: Date.now() });
      db.prepare("UPDATE tickets SET source = 'pos' WHERE id = ?").run(tk.id);
      fired.push({ item: it.name, station: it.station, note: it.note });
    }
    it.sent = it.qty;
  }
  if (!fired.length) throw httpError(400, 'Nothing new to send to the kitchen');
  db.prepare('UPDATE pos_orders SET items = ?, kots = kots + 1 WHERE id = ?').run(JSON.stringify(items), id);
  const byStation = {};
  for (const f of fired) (byStation[f.station] ??= []).push(f);
  return { order: view(db.prepare('SELECT * FROM pos_orders WHERE id = ?').get(id)), kot: { no: o.kots + 1, table: tb, channel: o.channel, at: Date.now(), stations: byStation } };
}

export function posDiscount(p, id, { pct, reason }) {
  const o = posOrder(id, p.branches);
  const v = Math.max(0, Math.min(100, Number(pct) || 0));
  if (v > 0 && !reason) throw httpError(400, 'Pick a discount reason');
  if (v > 25 && !p.perms.has('finance.view')) throw httpError(403, 'Discounts above 25% need a manager');
  db.prepare('UPDATE pos_orders SET discount_pct = ?, discount_reason = ? WHERE id = ?').run(v, v ? reason : null, id);
  const after = db.prepare('SELECT * FROM pos_orders WHERE id = ?').get(id);
  if (v) audit(o.outlet_id, p.name, 'discount', id, `${reason} · ${v}%`, bill(after).discount);
  return view(after);
}

export function posNc(p, id, { reason }) {
  const o = posOrder(id, p.branches);
  if (!reason) throw httpError(400, 'Pick a reason for the complimentary (NC) bill');
  if (!p.perms.has('finance.view')) throw httpError(403, 'NC bills need a manager');
  db.prepare('UPDATE pos_orders SET nc_reason = ? WHERE id = ?').run(reason, id);
  const after = db.prepare('SELECT * FROM pos_orders WHERE id = ?').get(id);
  audit(o.outlet_id, p.name, 'nc', id, reason, bill(after).subtotal);
  return view(after);
}

export function posPrint(p, id) {
  const o = posOrder(id, p.branches);
  if (!JSON.parse(o.items).length) throw httpError(400, 'No items on this order');
  if (JSON.parse(o.items).some((i) => i.sent < i.qty)) throw httpError(400, 'Send the pending items to the kitchen (KOT) before printing the bill');
  db.prepare("UPDATE pos_orders SET printed = printed + 1, status = 'billed' WHERE id = ?").run(id);
  if (o.printed >= 1) audit(o.outlet_id, p.name, 'reprint', id, `Bill printed ${o.printed + 1} times`, 0);
  return view(db.prepare('SELECT * FROM pos_orders WHERE id = ?').get(id));
}

function nextBillNo(outlet, ts) {
  const d = new Date(ts);
  const fyStart = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; // Indian financial year starts 1 April
  const fy = `${String(fyStart).slice(2)}-${String(fyStart + 1).slice(2)}`;
  const prefix = `${outlet.toUpperCase()}/${fy}/`;
  const last = db.prepare("SELECT bill_no FROM pos_orders WHERE bill_no LIKE ? ORDER BY id DESC LIMIT 1").get(`${prefix}%`)?.bill_no;
  return `${prefix}${String((last ? Number(last.split('/').pop()) : 0) + 1).padStart(6, '0')}`;
}

export function posSettle(p, id, { payments = [] }) {
  const o = posOrder(id, p.branches);
  if (!['open', 'billed'].includes(o.status)) throw httpError(400, 'Order is already closed');
  const b = bill(o);
  if (!b.lines.length) throw httpError(400, 'No items on this order');
  if (b.lines.some((l) => l.sent < l.qty)) throw httpError(400, 'Send pending items to the kitchen first');
  const pays = b.nc ? [] : payments.map((x) => ({ mode: String(x.mode), amount: r2(Number(x.amount) || 0) })).filter((x) => x.amount > 0 && TENDERS.includes(x.mode));
  const paid = r2(pays.reduce((a, x) => a + x.amount, 0));
  if (!b.nc && Math.abs(paid - b.total) > 0.5) throw httpError(400, `Tender ${fmtMoney(paid)} does not match the bill total ${fmtMoney(b.total)}`);
  const now = Date.now();
  const billNo = nextBillNo(o.outlet_id, now);
  let orderId = null;
  if (!b.nc) {
    const items = b.lines.map((l) => ({ item_id: l.item_id, qty: l.qty, price: r2(l.price * (1 - b.discount_pct / 100) * (b.inclusive ? b.taxable / Math.max(0.01, b.subtotal - b.discount + b.service) : 1)) }));
    const tb = o.table_id ? db.prepare('SELECT name FROM dining_tables WHERE id = ?').get(o.table_id)?.name : null;
    orderId = recordOrder({ outlet_id: o.outlet_id, source: 'pos', channel: o.channel, platform: 'POS', payment: pays.length > 1 ? 'split' : pays[0].mode, guest_id: o.guest_id,
      covers: o.covers, items, total: r2(b.taxable), tax: r2(b.taxes.reduce((a, x) => a + x.amount, 0)), table_no: tb, external_id: billNo, opened_at: o.opened_at, closed_at: now }).id;
  }
  db.prepare("UPDATE pos_orders SET status = 'settled', settled_at = ?, bill_no = ?, payments = ?, order_id = ? WHERE id = ?")
    .run(now, billNo, JSON.stringify({ total: b.nc ? 0 : b.total, tenders: pays }), orderId, id);
  return view(db.prepare('SELECT * FROM pos_orders WHERE id = ?').get(id));
}

export function posCancel(p, id, { reason }) {
  const o = posOrder(id, p.branches);
  if (!reason) throw httpError(400, 'A cancellation reason is required');
  const b = bill(o);
  if (JSON.parse(o.items).some((i) => i.sent > 0)) audit(o.outlet_id, p.name, 'bill_cancel', id, reason, b.subtotal);
  db.prepare("UPDATE pos_orders SET status = 'cancelled', cancel_reason = ?, settled_at = ? WHERE id = ?").run(reason, Date.now(), id);
  return { ok: true };
}

export function posHistory(p, branch) {
  const outlet = singleBranch(p, branch);
  return db.prepare("SELECT * FROM pos_orders WHERE outlet_id = ? AND status IN ('settled', 'cancelled') ORDER BY settled_at DESC LIMIT 30").all(outlet).map(view);
}

/** Demo: the simulator bumps POS tickets on the KDS once they have cooked for their target time. */
export function autoBumpPosTickets(t) {
  for (const tk of db.prepare("SELECT id, fired_at, target_sec FROM tickets WHERE source = 'pos' AND ready_at IS NULL AND fired_at + target_sec * 1000 < ?").all(t)) {
    readyTicket(tk.id, tk.fired_at + Math.round(tk.target_sec * 1000 * rnd(0.85, 1.15)));
  }
}

// =====================================================================================
// Menu & availability
// =====================================================================================
export function menuView(p, branch) {
  const B = scopeBranches(p, branch), outlet = B.length === 1 ? B[0] : null;
  const off = outlet ? unavailable(outlet) : new Set();
  const sales = Object.fromEntries(db.prepare(`SELECT item_id, SUM(qty) q, SUM(qty * price) v FROM order_items WHERE outlet_id IN (${inList(B)}) AND ts >= ? GROUP BY item_id`).all(...B, Date.now() - 7 * DAY).map((r) => [r.item_id, r]));
  const rc = Object.fromEntries(db.prepare('SELECT r.item_id, SUM(r.qty * i.cost) c, COUNT(*) n FROM recipes r JOIN ingredients i ON i.id = r.ingredient_id GROUP BY r.item_id').all().map((r) => [r.item_id, r]));
  return { outlet, items: db.prepare('SELECT * FROM menu_items ORDER BY category, name').all().map((m) => ({ ...m, available: !off.has(m.id), food_pct: m.cost / m.price, recipe_cost: rc[m.id]?.c ?? null, recipe_lines: rc[m.id]?.n ?? 0, qty_7d: sales[m.id]?.q || 0, sales_7d: sales[m.id]?.v || 0,
    unavailable_at: db.prepare('SELECT outlet_id FROM menu_86 WHERE item_id = ?').all(m.id).map((r) => r.outlet_id).filter((x) => B.includes(x)) })) };
}

export function setAvailability(p, { branch, item_id, available }) {
  const outlet = singleBranch(p, branch);
  if (!db.prepare('SELECT 1 FROM menu_items WHERE id = ?').get(item_id)) throw httpError(404, 'Unknown item');
  if (available) db.prepare('DELETE FROM menu_86 WHERE outlet_id = ? AND item_id = ?').run(outlet, item_id);
  else db.prepare('INSERT OR REPLACE INTO menu_86 VALUES (?,?,?,?)').run(outlet, item_id, Date.now(), p.name);
  return { ok: true };
}

export function setPrice(p, { item_id, price }) {
  const m = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(item_id);
  if (!m) throw httpError(404, 'Unknown item');
  const v = Number(price);
  if (!(v > 0)) throw httpError(400, 'Price must be positive');
  if (v < m.cost * 1.25) throw httpError(400, `Price guard: ${fmtMoney(v)} leaves less than 20% margin over the ${fmtMoney(m.cost)} food cost`);
  db.prepare('UPDATE menu_items SET price = ? WHERE id = ?').run(v, item_id);
  for (const b of p.branches) audit(b, p.name, 'price_change', item_id, `${m.name}: ${fmtMoney(m.price)} → ${fmtMoney(v)}`, v - m.price);
  return { ok: true };
}

// =====================================================================================
// Inventory
// =====================================================================================
const usageCache = new Map();
/** Average daily theoretical usage per ingredient over the last 14 full days (sales × recipes). */
function usagePerDay(outlet, day = midnight()) {
  const key = `${outlet}|${day}|${db.prepare('SELECT MIN(id) m FROM orders').get().m}`;
  if (usageCache.has(key)) return usageCache.get(key);
  const rows = db.prepare('SELECT r.ingredient_id id, SUM(oi.qty * r.qty) q FROM order_items oi JOIN recipes r ON r.item_id = oi.item_id WHERE oi.outlet_id = ? AND oi.ts >= ? AND oi.ts < ? GROUP BY r.ingredient_id')
    .all(outlet, day - 14 * DAY, day);
  const out = Object.fromEntries(rows.map((r) => [r.id, r.q / 14]));
  usageCache.set(key, out);
  if (usageCache.size > 50) usageCache.delete(usageCache.keys().next().value);
  return out;
}

function onHand(outlet) {
  const countTs = db.prepare('SELECT MAX(ts) t FROM stock_counts WHERE outlet_id = ?').get(outlet).t || 0;
  const base = Object.fromEntries(db.prepare('SELECT ingredient_id id, qty FROM stock_counts WHERE outlet_id = ? AND ts = ?').all(outlet, countTs).map((r) => [r.id, r.qty]));
  const moves = Object.fromEntries(db.prepare("SELECT ingredient_id id, SUM(qty) q FROM stock_moves WHERE outlet_id = ? AND ts > ? AND type != 'variance' GROUP BY ingredient_id").all(outlet, countTs).map((r) => [r.id, r.q]));
  const used = Object.fromEntries(db.prepare('SELECT r.ingredient_id id, SUM(oi.qty * r.qty) q FROM order_items oi JOIN recipes r ON r.item_id = oi.item_id WHERE oi.outlet_id = ? AND oi.ts > ? GROUP BY r.ingredient_id').all(outlet, countTs).map((r) => [r.id, r.q]));
  return { countTs, qty: (id) => r2((base[id] || 0) + (moves[id] || 0) - (used[id] || 0)), used };
}

export function inventory(p, branch) {
  const outlet = singleBranch(p, branch);
  const use = usagePerDay(outlet), oh = onHand(outlet);
  const vendors = db.prepare('SELECT * FROM vendors').all();
  const vById = Object.fromEntries(vendors.map((v) => [v.id, v]));
  const items = db.prepare('SELECT * FROM ingredients ORDER BY category, name').all().map((i) => {
    const u = use[i.id] || 0, q = oh.qty(i.id), lead = vById[i.vendor_id]?.lead_days || 2;
    const par = u * (lead + 2), reorderAt = u * (lead + 1);
    const days = u ? q / u : null;
    return { ...i, vendor: vById[i.vendor_id]?.name, on_hand: q, usage_per_day: r2(u), days_left: days != null ? Math.round(days * 10) / 10 : null, par: r2(par), reorder_at: r2(reorderAt),
      suggest: q < reorderAt ? Math.ceil(Math.max(0, par - q)) : 0, value: r2(Math.max(0, q) * i.cost), status: q <= 0 ? 'out' : q < reorderAt ? 'low' : q > par * 2.2 ? 'over' : 'ok' };
  });
  const suggested = vendors.map((v) => ({ vendor_id: v.id, vendor: v.name, lead_days: v.lead_days, lines: items.filter((i) => i.vendor_id === v.id && i.suggest > 0).map((i) => ({ ingredient_id: i.id, name: i.name, unit: i.unit, qty: i.suggest, cost: i.cost })) }))
    .filter((s) => s.lines.length).map((s) => ({ ...s, total: r2(s.lines.reduce((a, l) => a + l.qty * l.cost, 0)) }));
  const waste = db.prepare("SELECT m.*, i.name, i.unit FROM stock_moves m JOIN ingredients i ON i.id = m.ingredient_id WHERE m.outlet_id = ? AND m.type = 'waste' AND m.ts >= ? ORDER BY m.ts DESC").all(outlet, Date.now() - 7 * DAY)
    .map((w) => ({ ...w, value: r2(-w.qty * w.cost) }));
  const sales7 = db.prepare('SELECT COALESCE(SUM(total), 0) v FROM orders WHERE outlet_id = ? AND closed_at >= ?').get(outlet, Date.now() - 7 * DAY).v;
  const pos = db.prepare('SELECT * FROM purchase_orders WHERE outlet_id = ? ORDER BY created_at DESC LIMIT 20').all(outlet).map((x) => ({ ...x, lines: JSON.parse(x.lines), vendor: vById[x.vendor_id]?.name }));
  const variance = db.prepare(`SELECT c.ingredient_id, i.name, i.unit, i.cost, c.qty, c.theoretical, c.ts FROM stock_counts c JOIN ingredients i ON i.id = c.ingredient_id
    WHERE c.outlet_id = ? AND c.ts = (SELECT MAX(ts) FROM stock_counts WHERE outlet_id = ?) AND c.user != 'system'`).all(outlet, outlet)
    .map((v) => ({ ...v, diff: r2(v.qty - v.theoretical), value: r2((v.qty - v.theoretical) * v.cost) })).filter((v) => Math.abs(v.diff) > 0.0001).sort((a, b) => a.value - b.value);
  const recipes = db.prepare('SELECT r.item_id, m.name item, m.price, m.cost std_cost, r.ingredient_id, i.name ingredient, i.unit, r.qty, r.qty * i.cost line_cost FROM recipes r JOIN menu_items m ON m.id = r.item_id JOIN ingredients i ON i.id = r.ingredient_id ORDER BY m.category, m.name').all();
  return { outlet, count_ts: oh.countTs, items, suggested, waste, waste_value: r2(waste.reduce((a, w) => a + w.value, 0)), waste_pct: sales7 ? waste.reduce((a, w) => a + w.value, 0) / sales7 : null,
    stock_value: r2(items.reduce((a, i) => a + i.value, 0)), low: items.filter((i) => i.status === 'low' || i.status === 'out').length, pos, vendors, variance, recipes, reasons: REASONS.waste };
}

export function recordWaste(p, { branch, ingredient_id, qty, reason }) {
  const outlet = singleBranch(p, branch);
  const i = db.prepare('SELECT * FROM ingredients WHERE id = ?').get(ingredient_id);
  if (!i) throw httpError(400, 'Unknown ingredient');
  const q = Number(qty);
  if (!(q > 0)) throw httpError(400, 'Quantity must be positive');
  if (!reason) throw httpError(400, 'Pick a wastage reason');
  db.prepare('INSERT INTO stock_moves(outlet_id, ingredient_id, qty, type, reason, cost, ts, user) VALUES (?,?,?,?,?,?,?,?)').run(outlet, i.id, -q, 'waste', reason, i.cost, Date.now(), p.name);
  return { ok: true, value: r2(q * i.cost) };
}

export function recordCount(p, { branch, counts = {} }) {
  const outlet = singleBranch(p, branch);
  const oh = onHand(outlet), ts = Date.now();
  const ins = db.prepare('INSERT INTO stock_counts(outlet_id, ingredient_id, qty, theoretical, ts, user) VALUES (?,?,?,?,?,?)');
  const all = db.prepare('SELECT id FROM ingredients').all();
  tx(() => { for (const { id } of all) { const th = oh.qty(id); const v = counts[id] != null && counts[id] !== '' ? Number(counts[id]) : th; ins.run(outlet, id, r2(v), th, ts, p.name); } });
  return { ok: true, counted: Object.keys(counts).length };
}

export function createPo(p, { branch, vendor_id, lines = [] }) {
  const outlet = singleBranch(p, branch);
  const v = db.prepare('SELECT * FROM vendors WHERE id = ?').get(vendor_id);
  if (!v) throw httpError(400, 'Unknown vendor');
  const clean = lines.map((l) => { const i = db.prepare('SELECT * FROM ingredients WHERE id = ?').get(l.ingredient_id); return i && Number(l.qty) > 0 ? { ingredient_id: i.id, qty: Number(l.qty), cost: i.cost } : null; }).filter(Boolean);
  if (!clean.length) throw httpError(400, 'Add at least one line');
  const now = Date.now();
  const { lastInsertRowid } = db.prepare("INSERT INTO purchase_orders(outlet_id, vendor_id, status, lines, total, created_at, created_by, expected_at) VALUES (?,?,'sent',?,?,?,?,?)")
    .run(outlet, v.id, JSON.stringify(clean), r2(clean.reduce((a, l) => a + l.qty * l.cost, 0)), now, p.name, now + v.lead_days * DAY);
  return { id: Number(lastInsertRowid) };
}

export function receivePo(p, id, { received = {} } = {}) {
  const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(id);
  if (!po || !p.branches.includes(po.outlet_id)) throw httpError(404, 'PO not found');
  if (po.status !== 'sent') throw httpError(400, 'PO is not open');
  const now = Date.now();
  tx(() => {
    for (const l of JSON.parse(po.lines)) {
      const q = received[l.ingredient_id] != null ? Number(received[l.ingredient_id]) : l.qty;
      if (q > 0) db.prepare("INSERT INTO stock_moves(outlet_id, ingredient_id, qty, type, ref, cost, ts, user) VALUES (?,?,?, 'purchase', ?, ?, ?, ?)").run(po.outlet_id, l.ingredient_id, q, `PO-${po.id}`, l.cost, now, p.name);
    }
    db.prepare("UPDATE purchase_orders SET status = 'received', received_at = ? WHERE id = ?").run(now, id);
  });
  return { ok: true };
}

// =====================================================================================
// Reservations & waitlist
// =====================================================================================
export function reservations(p, branch, date) {
  const outlet = singleBranch(p, branch);
  const day = date ? midnight(new Date(`${date}T12:00:00`).getTime()) : midnight();
  const list = db.prepare('SELECT r.*, t.name table_name FROM reservations r LEFT JOIN dining_tables t ON t.id = r.table_id WHERE r.outlet_id = ? AND r.ts >= ? AND r.ts < ? ORDER BY r.ts').all(outlet, day, day + DAY);
  const hist = db.prepare("SELECT COUNT(*) n, SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) ns FROM reservations WHERE outlet_id = ? AND ts < ?").get(outlet, Date.now() - HOUR);
  return { outlet, date: dkey(day), list, sources: RES_SOURCES, tables: db.prepare('SELECT * FROM dining_tables WHERE outlet_id = ? ORDER BY rowid').all(outlet),
    stats: { bookings: list.filter((r) => r.status !== 'waitlist').length, covers: list.filter((r) => !['cancelled', 'no_show', 'waitlist'].includes(r.status)).reduce((a, r) => a + r.covers, 0),
      waitlist: list.filter((r) => r.status === 'waitlist').length, no_show_rate: hist.n ? hist.ns / hist.n : null, deposits: list.reduce((a, r) => a + (r.deposit || 0), 0) } };
}

export function createReservation(p, { branch, name, phone = '', covers = 2, ts, source = 'Phone', notes = '', deposit = 0, waitlist = false }) {
  const outlet = singleBranch(p, branch);
  if (!name) throw httpError(400, 'Guest name is required');
  const when = waitlist ? Date.now() : Number(ts) || Date.parse(ts);
  if (!when) throw httpError(400, 'A valid time is required');
  const g = phone ? db.prepare('SELECT id FROM guests WHERE phone = ?').get(phone) : null;
  const { lastInsertRowid } = db.prepare('INSERT INTO reservations(outlet_id, name, phone, covers, ts, status, source, table_id, deposit, notes, created_at, guest_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(outlet, String(name).slice(0, 80), String(phone).slice(0, 30), Math.max(1, Number(covers) || 1), when, waitlist ? 'waitlist' : 'booked', waitlist ? 'Walk-in' : source, null, Number(deposit) || 0, String(notes).slice(0, 200), Date.now(), g?.id || null);
  return { id: Number(lastInsertRowid) };
}

export function updateReservation(p, id, { status, table_id }) {
  const r = db.prepare('SELECT * FROM reservations WHERE id = ?').get(id);
  if (!r || !p.branches.includes(r.outlet_id)) throw httpError(404, 'Reservation not found');
  if (status && !['booked', 'seated', 'completed', 'no_show', 'cancelled', 'waitlist'].includes(status)) throw httpError(400, 'Bad status');
  db.prepare('UPDATE reservations SET status = COALESCE(?, status), table_id = COALESCE(?, table_id) WHERE id = ?').run(status ?? null, table_id ?? null, id);
  let order = null;
  if (status === 'seated' && table_id && p.perms.has('pos.bill')) order = posCreate(p, { branch: r.outlet_id, table_id, covers: r.covers, customer: r.name, guest_id: r.guest_id });
  return { ok: true, order_id: order?.id ?? null };
}

// =====================================================================================
// Finance: day end, GST, Tally, reconciliation, leakage
// =====================================================================================
export function daySummary(outlet, day) {
  const end = day + DAY;
  const s = db.prepare(`SELECT COUNT(*) bills, COALESCE(SUM(total), 0) net, COALESCE(SUM(tax), 0) tax, COALESCE(SUM(covers), 0) covers FROM orders WHERE outlet_id = ? AND closed_at >= ? AND closed_at < ?`).get(outlet, day, end);
  const tenders = Object.fromEntries(db.prepare(`SELECT payment, SUM(total + COALESCE(tax, 0)) v FROM orders WHERE outlet_id = ? AND closed_at >= ? AND closed_at < ? GROUP BY payment`).all(outlet, day, end).map((r) => [r.payment, r2(r.v)]));
  const channels = Object.fromEntries(db.prepare(`SELECT channel, SUM(total) v FROM orders WHERE outlet_id = ? AND closed_at >= ? AND closed_at < ? GROUP BY channel`).all(outlet, day, end).map((r) => [r.channel, r2(r.v)]));
  const a = Object.fromEntries(db.prepare('SELECT action, COUNT(*) n, COALESCE(SUM(amount), 0) v FROM audit_log WHERE outlet_id = ? AND ts >= ? AND ts < ? GROUP BY action').all(outlet, day, end).map((r) => [r.action, { n: r.n, v: r2(r.v) }]));
  const waste = -db.prepare("SELECT COALESCE(SUM(qty * cost), 0) v FROM stock_moves WHERE outlet_id = ? AND type = 'waste' AND ts >= ? AND ts < ?").get(outlet, day, end).v;
  const split = (INSTANCE.tax.split || []).map(([name, rate]) => ({ name, amount: r2(s.tax * rate / INSTANCE.tax.rate) }));
  return { date: dkey(day), bills: s.bills, covers: s.covers, net: r2(s.net), tax: r2(s.tax), tax_split: split, gross: r2(s.net + s.tax), tenders, channels,
    discounts: a.discount || { n: 0, v: 0 }, nc: a.nc || { n: 0, v: 0 }, cancellations: { n: (a.kot_cancel?.n || 0) + (a.bill_cancel?.n || 0), v: r2((a.kot_cancel?.v || 0) + (a.bill_cancel?.v || 0)) },
    reprints: a.reprint?.n || 0, modified_after_print: a.modify_after_print?.n || 0, waste: r2(waste) };
}

export function dayEnd(p, branch, date) {
  const B = scopeBranches(p, branch);
  const day = date ? midnight(new Date(`${date}T12:00:00`).getTime()) : midnight();
  return { date: dkey(day), outlets: B.map((id) => {
    const o = db.prepare('SELECT id, name, city, gstin FROM outlets WHERE id = ?').get(id);
    const closed = db.prepare('SELECT * FROM day_closes WHERE outlet_id = ? AND date = ?').get(id, dkey(day));
    const s = closed ? JSON.parse(closed.summary) : daySummary(id, day);
    const open_tables = closed ? 0 : db.prepare("SELECT COUNT(*) n FROM pos_orders WHERE outlet_id = ? AND status IN ('open', 'billed')").get(id).n;
    return { ...o, summary: s, open_tables, closed: closed ? { at: closed.closed_at, by: closed.closed_by, cash_declared: closed.cash_declared, cash_variance: r2(closed.cash_declared - (s.tenders.cash || 0)) } : null };
  }) };
}

export function closeDay(p, { branch, date, cash_declared }) {
  const outlet = singleBranch(p, branch);
  const day = date ? midnight(new Date(`${date}T12:00:00`).getTime()) : midnight();
  if (db.prepare('SELECT 1 FROM day_closes WHERE outlet_id = ? AND date = ?').get(outlet, dkey(day))) throw httpError(409, 'This business day is already closed');
  const open = db.prepare("SELECT COUNT(*) n FROM pos_orders WHERE outlet_id = ? AND status IN ('open', 'billed')").get(outlet).n;
  if (open) throw httpError(400, `${open} table(s) still open: settle or cancel them before day end`);
  const s = daySummary(outlet, day);
  db.prepare('INSERT INTO day_closes VALUES (?,?,?,?,?,?)').run(outlet, dkey(day), Date.now(), p.name, JSON.stringify(s), Number(cash_declared) || 0);
  return { ok: true, summary: s };
}

export function gstRegister(p, branch, days = 7) {
  const B = scopeBranches(p, branch);
  const from = midnight(Date.now() - (days - 1) * DAY);
  const rows = db.prepare(`SELECT o.outlet_id, t.name, t.gstin, t.state, date(o.closed_at / 1000, 'unixepoch', 'localtime') d, COUNT(*) bills, SUM(o.total) taxable, SUM(COALESCE(o.tax, 0)) tax
    FROM orders o JOIN outlets t ON t.id = o.outlet_id WHERE o.outlet_id IN (${inList(B)}) AND o.closed_at >= ? GROUP BY o.outlet_id, d ORDER BY d DESC, o.outlet_id`).all(...B, from);
  const split = INSTANCE.tax.split || [];
  return { tax: INSTANCE.tax, rows: rows.map((r) => ({ ...r, taxable: r2(r.taxable), tax: r2(r.tax), parts: split.map(([name, rate]) => ({ name, amount: r2(r.tax * rate / (INSTANCE.tax.rate || 1)) })), total: r2(r.taxable + r.tax) })) };
}

const LEDGER = { prepaid: 'Aggregator Receivable', upi: 'UPI Collections', card: 'Card Collections (EDC)', cash: 'Cash', wallet: 'Wallet Collections', credit: 'Sundry Debtors - Credit Bills', split: 'Split Tender Collections' };
/** Tally XML (Import Data → Vouchers): one sales voucher per branch per day, ledgers by tender, GST ledgers split. */
export function tallyXml(p, branch, date) {
  const B = scopeBranches(p, branch);
  const day = date ? midnight(new Date(`${date}T12:00:00`).getTime()) : midnight(Date.now() - DAY);
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const ymd = dkey(day).replace(/-/g, '');
  const vouchers = B.map((id) => {
    const o = db.prepare('SELECT * FROM outlets WHERE id = ?').get(id);
    const s = daySummary(id, day);
    const debit = Object.entries(s.tenders).map(([mode, v]) => `      <ALLLEDGERENTRIES.LIST><LEDGERNAME>${esc(LEDGER[mode] || `${mode.toUpperCase()} Collections`)}</LEDGERNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><AMOUNT>-${v.toFixed(2)}</AMOUNT></ALLLEDGERENTRIES.LIST>`);
    const credit = [`      <ALLLEDGERENTRIES.LIST><LEDGERNAME>Sales - Restaurant</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>${s.net.toFixed(2)}</AMOUNT></ALLLEDGERENTRIES.LIST>`,
      ...s.tax_split.map((x) => `      <ALLLEDGERENTRIES.LIST><LEDGERNAME>${esc(`Output ${x.name}`)}</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>${x.amount.toFixed(2)}</AMOUNT></ALLLEDGERENTRIES.LIST>`)];
    const diff = r2(Object.values(s.tenders).reduce((a, v) => a + v, 0) - s.net - s.tax_split.reduce((a, x) => a + x.amount, 0));
    if (Math.abs(diff) >= 0.01) credit.push(`      <ALLLEDGERENTRIES.LIST><LEDGERNAME>Round Off</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>${diff.toFixed(2)}</AMOUNT></ALLLEDGERENTRIES.LIST>`);
    return `    <TALLYMESSAGE xmlns:UDF="TallyUDF">
     <VOUCHER VCHTYPE="Sales" ACTION="Create">
      <DATE>${ymd}</DATE><VOUCHERTYPENAME>Sales</VOUCHERTYPENAME><VOUCHERNUMBER>${esc(`${id.toUpperCase()}-DE-${ymd}`)}</VOUCHERNUMBER>
      <NARRATION>${esc(`Day-end sales ${o.name} ${o.city}${o.gstin ? ` GSTIN ${o.gstin}` : ''}: ${s.bills} bills, ${s.covers} covers`)}</NARRATION>
${debit.join('\n')}
${credit.join('\n')}
     </VOUCHER>
    </TALLYMESSAGE>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
 <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
 <BODY>
  <IMPORTDATA>
   <REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC>
   <REQUESTDATA>
${vouchers.join('\n')}
   </REQUESTDATA>
  </IMPORTDATA>
 </BODY>
</ENVELOPE>
`;
}

// deterministic pseudo-random per order id (stable reconciliation results)
const h01 = (n) => { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };

export function reconciliation(p, branch, days = 7) {
  const B = scopeBranches(p, branch);
  const from = midnight(Date.now() - days * DAY), to = midnight();
  const orders = db.prepare(`SELECT id, outlet_id, platform, total, COALESCE(tax, 0) tax, closed_at, external_id FROM orders WHERE outlet_id IN (${inList(B)}) AND channel IN ('delivery', 'online') AND closed_at >= ? AND closed_at < ?`).all(...B, from, to);
  const by = {};
  const issues = [];
  for (const o of orders) {
    const rate = COMMISSION[o.platform] ?? 0.2;
    const gross = o.total + o.tax;
    const commission = o.total * rate, gstc = commission * GST_ON_COMMISSION, tcs = o.total * TCS;
    const expected = gross - commission - gstc - tcs;
    const r = h01(o.id);
    const missing = o.platform !== 'Website' && r < 0.006, short = !missing && o.platform !== 'Website' && r > 0.988;
    const received = missing ? 0 : short ? expected - o.total * rnd(0.05, 0.2) : expected;
    const k = o.platform;
    const g = (by[k] ??= { platform: k, orders: 0, gross: 0, commission: 0, gst_on_commission: 0, tcs: 0, expected: 0, received: 0, missing: 0, short: 0, rate });
    g.orders++; g.gross += gross; g.commission += commission; g.gst_on_commission += gstc; g.tcs += tcs; g.expected += expected; g.received += received;
    if (missing || short) {
      g[missing ? 'missing' : 'short']++;
      if (issues.length < 60) issues.push({ order_id: o.id, outlet_id: o.outlet_id, platform: k, at: o.closed_at, type: missing ? 'Missing from payout' : 'Short paid', expected: r2(expected), received: r2(received), gap: r2(expected - received) });
    }
  }
  const platforms = Object.values(by).map((g) => Object.fromEntries(Object.entries(g).map(([k, v]) => [k, typeof v === 'number' && !['orders', 'missing', 'short', 'rate'].includes(k) ? r2(v) : v])))
    .sort((a, b) => b.gross - a.gross);
  const t = platforms.reduce((a, g) => ({ gross: a.gross + g.gross, commission: a.commission + g.commission, expected: a.expected + g.expected, received: a.received + g.received }), { gross: 0, commission: 0, expected: 0, received: 0 });
  return { days, from, to, platforms, issues: issues.sort((a, b) => b.gap - a.gap), totals: { ...Object.fromEntries(Object.entries(t).map(([k, v]) => [k, r2(v)])), gap: r2(t.expected - t.received), effective_commission: t.gross ? (t.gross - t.expected) / t.gross : null },
    note: india ? 'Commission at contracted rates, 18% GST on commission, 0.5% TCS (GST, e-commerce operators). Payout lines are simulated in the demo; connect the aggregator payout report to reconcile real settlements.' : 'Commission at contracted rates. Payout lines are simulated in the demo.' };
}

export function leakage(p, branch, days = 14) {
  const B = scopeBranches(p, branch);
  const from = midnight(Date.now() - (days - 1) * DAY);
  const events = db.prepare(`SELECT a.*, o.name branch FROM audit_log a JOIN outlets o ON o.id = a.outlet_id WHERE a.outlet_id IN (${inList(B)}) AND a.ts >= ? ORDER BY a.ts DESC`).all(...B, from);
  const bills = db.prepare(`SELECT outlet_id, COUNT(*) n, SUM(total) v FROM orders WHERE outlet_id IN (${inList(B)}) AND closed_at >= ? AND channel IN ('dine-in', 'takeaway') GROUP BY outlet_id`).all(...B, from);
  const billsBy = Object.fromEntries(bills.map((b) => [b.outlet_id, b]));
  const ACT = { discount: 'Discounts', kot_cancel: 'KOT item cancels', bill_cancel: 'Bill cancels', nc: 'Complimentary (NC)', reprint: 'Bill reprints', modify_after_print: 'Edits after bill print', price_change: 'Price changes' };
  const byAction = Object.entries(ACT).map(([k, label]) => { const e = events.filter((x) => x.action === k); return { action: k, label, n: e.length, value: r2(e.reduce((a, x) => a + (x.amount || 0), 0)) }; }).filter((x) => x.n);
  const byBranch = B.map((id) => {
    const e = events.filter((x) => x.outlet_id === id), b = billsBy[id] || { n: 0, v: 0 };
    const val = e.filter((x) => x.action !== 'price_change').reduce((a, x) => a + (x.amount || 0), 0);
    return { id, name: e[0]?.branch || id, events: e.length, value: r2(val), per_100_bills: b.n ? r2(e.filter((x) => x.action !== 'price_change').length / b.n * 100) : null, pct_of_sales: b.v ? val / b.v : null };
  });
  // staff risk score: z-score of each person's sensitive-action rate vs peers in the group (anti-theft signal, not proof)
  const users = {};
  for (const e of events) { if (e.action === 'price_change') continue; const u = (users[`${e.outlet_id}|${e.user}`] ??= { user: e.user, outlet_id: e.outlet_id, branch: e.branch, n: 0, value: 0, cancels: 0, after_print: 0, discounts: 0 }); u.n++; u.value += e.amount || 0; if (/cancel/.test(e.action)) u.cancels++; if (e.action === 'modify_after_print' || e.action === 'reprint') u.after_print++; if (e.action === 'discount') u.discounts++; }
  const list = Object.values(users);
  const w = (u) => u.cancels * 2 + u.after_print * 2.5 + u.discounts + u.value / (india ? 500 : 20);
  const m = list.reduce((a, u) => a + w(u), 0) / Math.max(1, list.length);
  const sd = Math.sqrt(list.reduce((a, u) => a + (w(u) - m) ** 2, 0) / Math.max(1, list.length)) || 1;
  const staff = list.map((u) => ({ ...u, value: r2(u.value), score: Math.round(Math.max(0, Math.min(100, 50 + ((w(u) - m) / sd) * 20))) })).sort((a, b) => b.score - a.score).slice(0, 12);
  return { days, byAction, byBranch, staff, recent: events.slice(0, 80), labels: ACT };
}
