// Canonical ingest layer. Every source (simulator, POS webhook, CSV, edge vision agent,
// IoT gateway, webcam lab) goes through these functions, so rules & alerts behave identically.
import { INSTANCE } from './instance.js';
import { db, getSetting, midnight } from './db.js';
import { publish } from './bus.js';
import { guestProfile } from './guests.js';

// What CCTV can honestly measure (see docs/research/cctv-metrics.md). Tiers:
//   realtime: presence/zone/time metrics that hold up at 2 fps on existing CCTV, alert on repetition
//   kpi:      reliable as aggregates (p50/p90, %), alerts only after per-site validation
//   audit:    small-object checks (gloves, hair cover, phone, hand-wash sequence) need close cameras; sampled for human review, never auto-alert
//   dropped:  not measurable from ceiling CCTV (use-by label OCR, clear-liquid spills); accepted for compatibility, never scored
export const VISION_CHECKS = {
  station:  { label: 'Station staffed',            bad: 'Station unattended',              severity: 'high',   tier: 'realtime', metric: 'Station coverage % = staffed seconds ÷ open seconds (on after 5 s, off after 30 s)' },
  access:   { label: 'Authorised access',          bad: 'After-hours cold-store entry',    severity: 'high',   tier: 'realtime', metric: 'Person in cold-store door zone ≥ 3 s outside opening hours' },
  door:     { label: 'Walk-in door closed',        bad: 'Walk-in door open > 3 min',       severity: 'medium', tier: 'realtime', metric: 'Door-state classifier on a fixed door region; open seconds per hour' },
  counter:  { label: 'Counter attended',           bad: 'Guest waiting at unattended counter', severity: 'medium', tier: 'realtime', metric: 'Guest zone occupied while staff zone empty ≥ 30 s' },
  queue:    { label: 'Queue within target',        bad: 'Queue wait over target',          severity: 'medium', tier: 'realtime', metric: 'Queue length L(t); wait W ≈ L̄ ÷ service rate (Little’s law), p90 per 15 min' },
  pass:     { label: 'Pass cleared',               bad: 'Dish waiting at pass > 2 min',    severity: 'medium', tier: 'realtime', metric: 'Plate dwell in the pass polygon (appear → picked up); needs per-site plate training' },
  person:   { label: 'Person detected',            bad: 'Person detected',                 severity: 'low',    tier: 'realtime', metric: 'Zone occupancy: confirmed person tracks per zone' },
  greeted:  { label: 'Staff approach < 60 s',      bad: 'No staff approach within 60 s',   severity: 'medium', tier: 'kpi',      metric: 'Time-to-first-staff-approach: entry → staff within 1.5 m for 3 s (proximity, not a verified greeting)' },
  guest:    { label: 'First table visit < 5 min',  bad: 'Table waiting > 5 min',           severity: 'medium', tier: 'kpi',      metric: 'Table occupied → first staff visit within 1 m for 3 s' },
  apron:    { label: 'Uniform compliant',          bad: 'Uniform breach',                  severity: 'low',    tier: 'kpi',      metric: '% of person-minutes in site uniform (torso crop, track vote)' },
  handwash: { label: 'Sink visit after raw handling', bad: 'No sink visit after raw handling', severity: 'high', tier: 'audit',   metric: 'Sink-zone dwell ≥ 20 s after raw zone; sequence needs one track across zones, sampled for review' },
  hairnet:  { label: 'Hair covered',               bad: 'No hair covering',                severity: 'medium', tier: 'audit',    metric: 'Head-crop classifier; real-time only where the camera gives ≥125 px/m at the head' },
  gloves:   { label: 'Gloves on',                  bad: 'Bare hands at assembly',          severity: 'high',   tier: 'audit',    metric: 'Hand-crop classifier; needs ≥250 px/m at the hands (camera ≤ 2.5–3 m)' },
  phone:    { label: 'No phone on line',           bad: 'Phone use on the line',           severity: 'medium', tier: 'audit',    metric: 'Aggregate % of person-minutes only; opt-in; never per-person ranking' },
  spill:    { label: 'Floor clear',                bad: 'Spill / slip hazard',             severity: 'medium', tier: 'dropped',  metric: 'Not reliable from RGB CCTV (clear liquids, glare); use thermal or manual checks' },
  label:    { label: 'Use-by label valid',         bad: 'Expired use-by label',            severity: 'medium', tier: 'dropped',  metric: 'Text is < 1 px tall from ceiling CCTV; use a phone/tablet label scan at the prep station' },
};
export const TIER_TYPES = (tiers) => Object.entries(VISION_CHECKS).filter(([k, v]) => tiers.includes(v.tier) && k !== 'person').map(([k]) => k);
export const SCORED_TYPES = TIER_TYPES(['realtime', 'kpi']);   // camera compliance KPI
export const AUDIT_TYPES = TIER_TYPES(['audit']);

const now = () => Date.now();
const num = (v, d = 0) => { const n = typeof v === 'string' ? Number(v.replace(/[,\s]/g, '')) : Number(v); return v !== null && v !== '' && v !== undefined && Number.isFinite(n) ? n : d; };
export function httpError(status, message) { const e = new Error(message); e.status = status; return e; }
const ensureOutlet = (id) => { if (!id || !db.prepare('SELECT 1 FROM outlets WHERE id = ?').get(id)) throw httpError(400, `Unknown outlet_id "${id}"`); };
const MENU = new Map();
const menu = (id) => { if (!MENU.size) db.prepare('SELECT * FROM menu_items').all().forEach((m) => MENU.set(m.id, m)); return MENU.get(id); };
export const ONLINE_CHANNELS = ['delivery', 'online'];

// ---------- alerts ----------
export function raiseAlert({ outlet_id, category, severity, title, detail = '', station = null, dedupe_key, ts = now(), quiet = false, window = 10 * 60_000 }) {
  const key = dedupe_key || `${outlet_id}:${category}:${title}`;
  if (db.prepare('SELECT 1 FROM alerts WHERE dedupe_key = ? AND ts > ?').get(key, ts - window)) return null;
  const { lastInsertRowid } = db.prepare('INSERT INTO alerts(outlet_id, category, severity, station, title, detail, dedupe_key, ts) VALUES (?,?,?,?,?,?,?,?)')
    .run(outlet_id, category, severity, station, title, detail, key, ts);
  const alert = { id: Number(lastInsertRowid), outlet_id, category, severity, station, title, detail, ts, ack: 0 };
  if (!quiet) publish('alert', { alert, outlet_id });
  return alert;
}

// ---------- orders (any POS / delivery platform) ----------
export function recordOrder(o, { quiet = false } = {}) {
  ensureOutlet(o.outlet_id);
  const items = Array.isArray(o.items) ? o.items.filter((i) => menu(i.item_id)) : [];
  const itemsTotal = items.reduce((a, i) => a + num(i.qty, 1) * num(i.price, menu(i.item_id).price), 0);
  let total = o.total != null ? num(o.total) : itemsTotal;
  // Tax-inclusive menus: an order without an explicit tax split is treated as gross; net sales exclude the tax
  let inclTax = null;
  if (o.tax == null && INSTANCE.tax.inclusive && INSTANCE.tax.rate > 0) { inclTax = total - total / (1 + INSTANCE.tax.rate); total -= inclTax; }
  if (total <= 0) throw httpError(400, 'total must be > 0 (or send items)');
  const closed = num(o.closed_at, now());
  const foodCost = o.food_cost != null ? num(o.food_cost)
    : items.length ? items.reduce((a, i) => a + num(i.qty, 1) * menu(i.item_id).cost, 0) : total * 0.3;
  const row = {
    outlet_id: o.outlet_id, external_id: o.external_id ?? null, source: o.source || 'api', channel: o.channel || 'dine-in',
    platform: o.platform || (ONLINE_CHANNELS.includes(o.channel) ? 'Website' : 'POS'), payment: o.payment || 'card',
    guest_id: o.guest_id ?? null, covers: Math.max(1, num(o.covers, 1)), total: Math.round(total * 100) / 100,
    food_cost: Math.round(foodCost * 100) / 100, table_no: o.table_no ?? null, opened_at: num(o.opened_at, closed), closed_at: closed,
    tax: o.tax != null ? num(o.tax) : Math.round((inclTax ?? total * INSTANCE.tax.rate) * 100) / 100,
  };
  const { lastInsertRowid } = db.prepare(`INSERT INTO orders(outlet_id, external_id, source, channel, platform, payment, guest_id, covers, total, food_cost, table_no, opened_at, closed_at, tax)
    VALUES (:outlet_id, :external_id, :source, :channel, :platform, :payment, :guest_id, :covers, :total, :food_cost, :table_no, :opened_at, :closed_at, :tax)`).run(row);
  const id = Number(lastInsertRowid);
  const insI = db.prepare('INSERT INTO order_items(order_id, outlet_id, item_id, qty, price, ts) VALUES (?,?,?,?,?,?)');
  for (const i of items) insI.run(id, row.outlet_id, i.item_id, num(i.qty, 1), num(i.price, menu(i.item_id).price), closed);
  if (!quiet) publish('order', { outlet_id: row.outlet_id, id, total: row.total, channel: row.channel, platform: row.platform, covers: row.covers, table_no: row.table_no, items: items.length });
  return { id, ...row };
}

// ---------- kitchen tickets (KDS) ----------
export function fireTicket(t, { quiet = false } = {}) {
  ensureOutlet(t.outlet_id);
  const m = t.item_id ? menu(t.item_id) : null;
  const row = {
    outlet_id: t.outlet_id, order_id: t.order_id ?? null, item_id: t.item_id ?? null, item: t.item || m?.name || 'Item',
    station: t.station || m?.station || 'Pass', table_no: t.table_no ?? null, channel: t.channel || 'dine-in',
    target_sec: num(t.target_sec, m?.prep_sec ?? 600), fired_at: num(t.fired_at, now()), ready_at: t.ready_at ?? null,
  };
  const { lastInsertRowid } = db.prepare(`INSERT INTO tickets(outlet_id, order_id, item_id, item, station, table_no, channel, target_sec, fired_at, ready_at)
    VALUES (:outlet_id, :order_id, :item_id, :item, :station, :table_no, :channel, :target_sec, :fired_at, :ready_at)`).run(row);
  const id = Number(lastInsertRowid);
  if (row.ready_at) checkDelay({ id, ...row }, quiet);
  else if (!quiet) publish('ticket', { outlet_id: row.outlet_id, id, item: row.item, station: row.station, table_no: row.table_no, channel: row.channel, state: 'fired' });
  return { id, ...row };
}

export function readyTicket(id, ready_at = now(), { quiet = false } = {}) {
  const t = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
  if (!t) throw httpError(404, 'ticket not found');
  db.prepare('UPDATE tickets SET ready_at = ? WHERE id = ?').run(ready_at, id);
  checkDelay({ ...t, ready_at }, quiet);
  if (!quiet) publish('ticket', { outlet_id: t.outlet_id, id, item: t.item, station: t.station, table_no: t.table_no, channel: t.channel, state: 'ready', secs: Math.round((ready_at - t.fired_at) / 1000) });
}

function checkDelay(t, quiet) {
  const secs = (t.ready_at - t.fired_at) / 1000;
  // One alert per station slowdown (not per ticket): fires when a dish runs 2x its target, then quiet for 15 min
  if (secs > t.target_sec * 2) {
    raiseAlert({ outlet_id: t.outlet_id, category: 'speed', severity: secs > t.target_sec * 2.5 ? 'high' : 'medium', station: t.station,
      title: `${t.station} running slow: ${t.item} took ${Math.round(secs / 60)} min`,
      detail: `Target ${Math.round(t.target_sec / 60)} min · ${t.channel === 'dine-in' ? `table ${t.table_no}` : t.channel}`, dedupe_key: `speed:${t.outlet_id}:${t.station}`, ts: t.ready_at, quiet, window: 15 * 60_000 });
  }
}

// ---------- attendance ----------
export function recordAttendance(a, { quiet = false } = {}) {
  const staff = a.staff_id ? db.prepare('SELECT * FROM staff WHERE id = ?').get(a.staff_id) : db.prepare('SELECT * FROM staff WHERE external_id = ?').get(a.external_id);
  if (!staff) throw httpError(400, 'Unknown staff_id / external_id');
  const ts = num(a.ts, now());
  const evt = { outlet_id: staff.outlet_id, staff: staff.name, role: staff.role, department: staff.department };
  if ((a.action || 'in') === 'out') {
    db.prepare('UPDATE attendance SET ts_out = ? WHERE staff_id = ? AND ts_out IS NULL').run(ts, staff.id);
    if (!quiet) publish('attendance', { ...evt, action: 'out' });
    return { staff_id: staff.id, action: 'out', ts };
  }
  if (db.prepare('SELECT 1 FROM attendance WHERE staff_id = ? AND ts_out IS NULL').get(staff.id)) return { staff_id: staff.id, action: 'in', ts, duplicate: true };
  // Nearest shift start: a 23:50 clock-in for a 00:00 shift is 10 min early, not 23 h late
  let due = midnight(ts) + staff.shift_start * 60_000;
  if (ts - due > 12 * 3600_000) due += 86400_000;
  if (due - ts > 12 * 3600_000) due -= 86400_000;
  const late = Math.max(0, Math.round((ts - due) / 60_000));
  db.prepare('INSERT INTO attendance(staff_id, outlet_id, ts_in, method, late_min) VALUES (?,?,?,?,?)').run(staff.id, staff.outlet_id, ts, a.method || 'face', late);
  if (late >= 10) raiseAlert({ outlet_id: staff.outlet_id, category: 'people', severity: late > 30 ? 'medium' : 'low', title: `${staff.name} clocked in ${late} min late`,
    detail: `${staff.role} · ${staff.station}`, dedupe_key: `late:${staff.id}:${midnight(ts)}`, ts, quiet, window: 1e15 });
  if (!quiet) publish('attendance', { ...evt, action: 'in', late });
  return { staff_id: staff.id, action: 'in', ts, late_min: late };
}

export function sweepAbsences(ts = now(), quiet = false) {
  const day = midnight(ts);
  const due = db.prepare(`SELECT s.* FROM staff s WHERE ? > ? + (s.shift_start + 30) * 60000 AND ? < ? + s.shift_end * 60000
     AND NOT EXISTS (SELECT 1 FROM attendance a WHERE a.staff_id = s.id AND a.ts_in >= ?)`).all(ts, day, ts, day, day - 3600_000);
  for (const s of due) raiseAlert({ outlet_id: s.outlet_id, category: 'people', severity: 'medium', title: `No-show: ${s.name}`,
    detail: `${s.role} · ${s.station}, not clocked in 30 min after shift start`, dedupe_key: `absent:${s.id}:${day}`, ts, quiet, window: 1e15 });
}

// ---------- computer vision events ----------
export function recordVision(v, { quiet = false } = {}) {
  ensureOutlet(v.outlet_id);
  const check = VISION_CHECKS[v.type];
  if (!check) throw httpError(400, `Unknown vision type "${v.type}". Use one of: ${Object.keys(VISION_CHECKS).join(', ')}`);
  const ok = v.ok === undefined ? 1 : v.ok ? 1 : 0;
  const row = { outlet_id: v.outlet_id, camera_id: v.camera_id || null, type: v.type, ok, severity: ok ? 'none' : v.severity || check.severity,
    label: v.label || (ok ? check.label : check.bad), confidence: num(v.confidence, 0.9), people: num(v.people, 1), ts: num(v.ts, now()),
    zone: v.zone ?? null, track_id: v.track_id ?? null, duration_s: v.duration_s ?? null, text: v.text ?? null, source: v.source ?? null };
  const { lastInsertRowid } = db.prepare(`INSERT INTO vision_events(outlet_id, camera_id, type, ok, severity, label, confidence, people, ts, zone, track_id, duration_s, text, source)
    VALUES (:outlet_id, :camera_id, :type, :ok, :severity, :label, :confidence, :people, :ts, :zone, :track_id, :duration_s, :text, :source)`).run(row);
  // Escalate only on repetition (2 high / 3 medium in 15 min on one camera) so single false positives don't page anyone.
  // Only real-time-tier checks page people; KPI checks alert once the site is validated; audit checks go to human review.
  const alerting = check.tier === 'realtime' || (check.tier === 'kpi' && getSetting('vision_validated', false));
  if (!ok && alerting && row.type !== 'person' && row.severity !== 'low') {
    const recent = db.prepare(`SELECT COUNT(*) n FROM vision_events WHERE camera_id IS ? AND type = ? AND ok = 0 AND ts > ?`).get(row.camera_id, row.type, row.ts - 15 * 60_000).n;
    if (recent >= (row.severity === 'high' ? 2 : 3) || v.force_alert) {
      const cam = row.camera_id ? db.prepare('SELECT name FROM cameras WHERE id = ?').get(row.camera_id) : null;
      raiseAlert({ outlet_id: row.outlet_id, category: ['greeted', 'guest'].includes(row.type) ? 'guest' : 'hygiene', severity: row.severity,
        title: `${row.label} (${recent}× in 15 min)`, detail: `${cam?.name ?? 'Camera'} · ${Math.round(row.confidence * 100)}% confidence`,
        dedupe_key: `vision:${row.camera_id}:${row.type}`, ts: row.ts, quiet });
    }
  }
  if (!quiet) publish('vision', { ...row, id: Number(lastInsertRowid) });
  return { id: Number(lastInsertRowid), ...row };
}

/** The edge-agent contract: an array of events, or { events: [...], heartbeats: [...] }. Used by POST /api/v1/vision,
 *  the browser webcam lab and the simulator's virtual edge agent, so every source takes the same path. */
export function ingestVision(body, { quiet = false, source = null } = {}) {
  const events = Array.isArray(body) ? body : body?.events ?? (body?.type ? [body] : []);
  const heartbeats = Array.isArray(body) ? [] : body?.heartbeats ?? [];
  const saved = events.map((e) => recordVision({ ...e, source: e.source ?? source }, { quiet }));
  heartbeats.forEach((h) => recordHeartbeat(h, { quiet }));
  return { accepted: saved.length, heartbeats: heartbeats.length };
}

/** Camera health from the edge agent: proves the stream is decoding and the model is running. */
export function recordHeartbeat(h, { quiet = false } = {}) {
  const cam = db.prepare('SELECT * FROM cameras WHERE id = ?').get(h.camera_id);
  if (!cam) throw httpError(400, `Unknown camera_id "${h.camera_id}"`);
  const ts = num(h.ts, now());
  db.prepare('UPDATE cameras SET last_seen = ?, fps = ?, latency_ms = ?, model = ?, agent = ?, status = ? WHERE id = ?')
    .run(ts, num(h.fps, 0), Math.round(num(h.latency_ms, 0)), h.model ?? cam.model, h.agent ?? cam.agent, h.status === 'degraded' ? 'degraded' : 'online', cam.id);
  if (cam.status === 'offline' && !quiet) publish('vision', { outlet_id: cam.outlet_id, camera_id: cam.id, type: 'person', ok: 1, label: 'Camera back online', ts });
  return { ok: true };
}

/** A camera whose agent stops sending heartbeats is marked offline and raises one alert. */
export function sweepCameras(ts = now(), quiet = false) {
  const limit = (getSetting('vision_offline_after_s', 180)) * 1000;
  for (const c of db.prepare("SELECT * FROM cameras WHERE last_seen IS NOT NULL AND status != 'offline' AND last_seen < ?").all(ts - limit)) {
    db.prepare("UPDATE cameras SET status = 'offline' WHERE id = ?").run(c.id);
    raiseAlert({ outlet_id: c.outlet_id, category: 'hygiene', severity: 'medium', title: `${c.name} camera offline`,
      detail: `No heartbeat from the edge agent for ${Math.round((ts - c.last_seen) / 60000)} min. Monitoring paused for this area.`, dedupe_key: `cam-offline:${c.id}`, ts, quiet, window: 60 * 60_000 });
  }
}

// ---------- IoT sensors ----------
export function recordReading(r, { quiet = false } = {}) {
  const s = db.prepare('SELECT * FROM sensors WHERE id = ?').get(r.sensor_id);
  if (!s) throw httpError(400, `Unknown sensor_id "${r.sensor_id}"`);
  const value = num(r.value, NaN);
  if (!Number.isFinite(value)) throw httpError(400, 'value must be a number');
  const ts = num(r.ts, now());
  db.prepare('INSERT INTO readings(sensor_id, value, ts) VALUES (?,?,?)').run(s.id, value, ts);
  const out = (x) => x < s.min || x > s.max;
  if (out(value)) {
    const last = db.prepare('SELECT value FROM readings WHERE sensor_id = ? ORDER BY ts DESC LIMIT 3').all(s.id);
    if (last.length === 3 && last.every((x) => out(x.value))) {
      raiseAlert({ outlet_id: s.outlet_id, category: 'safety', severity: 'high', title: `${s.name} out of range: ${value.toFixed(1)}${s.unit}`,
        detail: `Safe band ${s.min}–${s.max}${s.unit} · HACCP excursion logged`, dedupe_key: `sensor:${s.id}`, ts, quiet });
    }
  }
  if (!quiet) publish('reading', { outlet_id: s.outlet_id, sensor_id: s.id, value, ts });
  return { sensor_id: s.id, value, ts };
}

// ---------- reviews ----------
export function recordReview(r, { quiet = false } = {}) {
  ensureOutlet(r.outlet_id);
  const rating = Math.min(5, Math.max(1, num(r.rating, 5)));
  const row = { outlet_id: r.outlet_id, platform: r.platform || 'Google', rating, author: r.author || 'Guest', text: r.text || '',
    sentiment: r.sentiment || (rating >= 4 ? 'positive' : rating >= 3 ? 'neutral' : 'negative'), ts: num(r.ts, now()) };
  db.prepare(`INSERT INTO reviews(outlet_id, platform, rating, author, text, sentiment, ts) VALUES (:outlet_id, :platform, :rating, :author, :text, :sentiment, :ts)`).run(row);
  if (rating <= 2) raiseAlert({ outlet_id: row.outlet_id, category: 'guest', severity: 'medium', title: `${rating}★ review on ${row.platform}`,
    detail: `“${row.text.slice(0, 120)}” — ${row.author}`, ts: row.ts, quiet });
  if (!quiet) publish('review', row);
  return row;
}

// ---------- returning-guest recognition (opt-in face ID, loyalty QR, phone, reservation) ----------
export function recordGuestVisit(v, { quiet = false } = {}) {
  ensureOutlet(v.outlet_id);
  const g = v.guest_id ? db.prepare('SELECT * FROM guests WHERE id = ?').get(v.guest_id) : db.prepare('SELECT * FROM guests WHERE phone = ?').get(v.phone);
  if (!g) throw httpError(400, 'Unknown guest');
  const method = v.method || 'loyalty-qr';
  if (method === 'face' && !g.consent_face) throw httpError(403, 'Guest has not opted in to face recognition');
  const ts = num(v.ts, now());
  db.prepare('INSERT INTO guest_visits(guest_id, outlet_id, ts, method, confidence, table_no, covers) VALUES (?,?,?,?,?,?,?)')
    .run(g.id, v.outlet_id, ts, method, num(v.confidence, 0.95), v.table_no ?? null, num(v.covers, 2));
  if (!quiet) {
    const p = guestProfile(g.id, { at: v.outlet_id });
    publish('guest', { outlet_id: v.outlet_id, guest_id: g.id, name: g.name, tier: p.tier, visits: p.visits, method, table_no: v.table_no,
      headline: p.suggestions[0]?.text ?? 'Welcome back', allergies: p.allergies });
  }
  return { guest_id: g.id, ts };
}

export { ensureOutlet, menu };
