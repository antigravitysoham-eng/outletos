// Read side: role-aware KPIs and analytics. Every function receives the caller's principal and
// only touches branches in scope; fields a role may not see are never computed or returned.
import { INSTANCE } from './instance.js';
import { db, midnight, inList } from './db.js';
import { VISION_CHECKS, ONLINE_CHANNELS, SCORED_TYPES, AUDIT_TYPES } from './ingest.js';
const SCORED = `type IN (${SCORED_TYPES.map((t) => `'${t}'`).join(',')})`;
import { scopeBranches, alertAllowed } from './policy.js';
import { guestProfile, maskPhone } from './guests.js';

const HOUR = 3600_000, DAY = 86400_000;
const TIER_SCALE = INSTANCE.id === 'india' ? 80 : 1;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const ONLINE = `channel IN ('delivery','online')`;
const LT = (col) => `strftime('%H', ${col} / 1000, 'unixepoch', 'localtime')`;
const LD = (col) => `date(${col} / 1000, 'unixepoch', 'localtime')`;

function salesTotals(B, from, to) {
  return db.prepare(`SELECT COALESCE(SUM(total),0) sales, COUNT(*) orders, COALESCE(SUM(covers),0) covers,
      COALESCE(SUM(CASE WHEN ${ONLINE} THEN total END),0) online, COALESCE(SUM(CASE WHEN ${ONLINE} THEN 1 END),0) online_orders,
      COALESCE(SUM(food_cost),0) food
    FROM orders WHERE outlet_id IN (${inList(B)}) AND closed_at >= ? AND closed_at < ?`).get(...B, from, to);
}

function laborCost(B, from, t) {
  return db.prepare(`SELECT COALESCE(SUM((MIN(COALESCE(a.ts_out, ?), ?) - a.ts_in) / 3600000.0 * s.hourly_rate), 0) c
    FROM attendance a JOIN staff s ON s.id = a.staff_id WHERE a.outlet_id IN (${inList(B)}) AND a.ts_in >= ?`).get(t, t, ...B, from).c;
}

function ops(B, t, p) {
  const out = {};
  if (p.perms.has('kitchen.view')) {
    const k = db.prepare(`SELECT AVG((ready_at - fired_at) / 1000.0) avg_sec, AVG(CASE WHEN (ready_at - fired_at) / 1000.0 <= target_sec THEN 1.0 ELSE 0 END) on_time, COUNT(*) n
      FROM tickets WHERE outlet_id IN (${inList(B)}) AND ready_at >= ?`).get(...B, t - HOUR);
    out.kitchen = { avg_sec: k.avg_sec || 0, on_time: k.n ? k.on_time : null, done_last_hour: k.n,
      open: db.prepare(`SELECT COUNT(*) n FROM tickets WHERE outlet_id IN (${inList(B)}) AND ready_at IS NULL`).get(...B).n };
  }
  if (p.perms.has('vision.view')) {
    const v = db.prepare(`SELECT AVG(ok * 1.0) rate, COUNT(*) n, SUM(1 - ok) flags FROM vision_events WHERE outlet_id IN (${inList(B)}) AND ts >= ? AND ${SCORED}`).get(...B, t - 2 * HOUR);
    out.hygiene = { rate: v.n ? v.rate : null, flags: v.flags || 0 };
  }
  if (p.perms.has('staff.view')) {
    const day = midnight(t);
    const dept = p.attrs.department ? `AND s.department = '${p.attrs.department}'` : '';
    out.staff = {
      on_duty: db.prepare(`SELECT COUNT(*) n FROM attendance a JOIN staff s ON s.id = a.staff_id WHERE a.outlet_id IN (${inList(B)}) AND a.ts_out IS NULL ${dept}`).get(...B).n,
      scheduled: db.prepare(`SELECT COUNT(*) n FROM staff s WHERE s.outlet_id IN (${inList(B)}) ${dept} AND ((? >= ? + s.shift_start * 60000 AND ? < ? + s.shift_end * 60000)
        OR EXISTS (SELECT 1 FROM attendance a WHERE a.staff_id = s.id AND a.ts_out IS NULL))`).get(...B, t, day, t, day).n,
      late: db.prepare(`SELECT COUNT(*) n FROM attendance a JOIN staff s ON s.id = a.staff_id WHERE a.outlet_id IN (${inList(B)}) AND a.ts_in >= ? AND a.late_min >= 10 ${dept}`).get(...B, day).n,
    };
  }
  if (p.perms.has('safety.view')) {
    out.safety = db.prepare(`SELECT COUNT(*) n, SUM(CASE WHEN r.value BETWEEN s.min AND s.max THEN 1 ELSE 0 END) ok FROM sensors s
      JOIN readings r ON r.id = (SELECT id FROM readings WHERE sensor_id = s.id ORDER BY ts DESC LIMIT 1) WHERE s.outlet_id IN (${inList(B)})`).get(...B);
  }
  if (p.perms.has('alerts.view')) {
    const rows = db.prepare(`SELECT outlet_id, category, station, severity FROM alerts WHERE ack = 0 AND ts >= ? AND outlet_id IN (${inList(B)})`).all(t - DAY, ...B).filter((a) => alertAllowed(p, a));
    out.alerts = { open: rows.length, high: rows.filter((a) => a.severity === 'high').length };
  }
  if (p.perms.has('guests.view')) {
    const day = midnight(t);
    out.guests = db.prepare(`SELECT COUNT(*) recognized, SUM(CASE WHEN method = 'face' THEN 1 ELSE 0 END) face, SUM(CASE WHEN ts > ? THEN 1 ELSE 0 END) in_house
      FROM guest_visits WHERE outlet_id IN (${inList(B)}) AND ts >= ?`).get(t - 75 * 60_000, ...B, day);
  }
  return out;
}

/** Branch score 0-100 from six pillars (only computed for roles with the dashboard). */
function branchScores(B, t) {
  const day = midnight(t);
  return B.map((id) => {
    const today = salesTotals([id], day, t), yday = salesTotals([id], day - DAY, t - DAY);
    const k = db.prepare(`SELECT AVG(CASE WHEN (ready_at - fired_at) / 1000.0 <= target_sec THEN 1.0 ELSE 0 END) r, COUNT(*) n FROM tickets WHERE outlet_id = ? AND ready_at >= ?`).get(id, t - HOUR);
    const v = db.prepare(`SELECT AVG(ok * 1.0) r, COUNT(*) n FROM vision_events WHERE outlet_id = ? AND ts >= ? AND ${SCORED}`).get(id, t - 2 * HOUR);
    const st = db.prepare(`SELECT (SELECT COUNT(*) FROM attendance WHERE outlet_id = ? AND ts_out IS NULL) on_duty,
      (SELECT COUNT(*) FROM staff s WHERE s.outlet_id = ? AND ((? >= ? + s.shift_start * 60000 AND ? < ? + s.shift_end * 60000) OR EXISTS (SELECT 1 FROM attendance a WHERE a.staff_id = s.id AND a.ts_out IS NULL))) sched`).get(id, id, t, day, t, day);
    const sf = db.prepare(`SELECT COUNT(*) n, SUM(CASE WHEN r.value BETWEEN s.min AND s.max THEN 1 ELSE 0 END) ok FROM sensors s
      JOIN readings r ON r.id = (SELECT id FROM readings WHERE sensor_id = s.id ORDER BY ts DESC LIMIT 1) WHERE s.outlet_id = ?`).get(id);
    const rv = db.prepare(`SELECT AVG(rating) r, COUNT(*) n FROM (SELECT rating FROM reviews WHERE outlet_id = ? ORDER BY ts DESC LIMIT 25)`).get(id);
    const c = {
      sales: clamp01(yday.sales ? today.sales / yday.sales : 1), speed: k.n ? clamp01(k.r) : 1, hygiene: v.n ? clamp01((v.r - 0.75) / 0.25) : 1,
      staff: st.sched ? clamp01(st.on_duty / st.sched) : 1, safety: sf.n ? sf.ok / sf.n : 1, guests: rv.n ? clamp01((rv.r - 3) / 2) : 1,
    };
    const W = { sales: 20, speed: 20, hygiene: 20, staff: 15, safety: 15, guests: 10 };
    return { id, score: Math.round(Object.entries(W).reduce((a, [k2, w]) => a + c[k2] * w, 0)), components: c, rating: rv.r };
  });
}

export function dashboard(p, branch) {
  const t = Date.now(), day = midnight(t);
  const B = scopeBranches(p, branch);
  const out = { ts: t, scope: B, branches: db.prepare(`SELECT id, name, location, city, country, region FROM outlets WHERE id IN (${inList(B)}) ORDER BY id`).all(...B) };

  if (p.perms.has('sales.view')) {
    const today = salesTotals(B, day, t), yday = salesTotals(B, day - DAY, t - DAY);
    out.sales = { today, yesterday: yday };
    const hourly = db.prepare(`SELECT CAST(${LT('closed_at')} AS INTEGER) h, SUM(CASE WHEN closed_at >= ? THEN total ELSE 0 END) today,
        SUM(CASE WHEN closed_at < ? THEN total ELSE 0 END) yesterday,
        SUM(CASE WHEN closed_at >= ? AND ${ONLINE} THEN total ELSE 0 END) online, SUM(CASE WHEN closed_at >= ? AND NOT ${ONLINE} THEN total ELSE 0 END) offline,
        SUM(CASE WHEN closed_at >= ? THEN 1 ELSE 0 END) orders, SUM(CASE WHEN closed_at < ? THEN 1 ELSE 0 END) yorders,
        SUM(CASE WHEN closed_at >= ? THEN COALESCE(covers, 0) ELSE 0 END) covers
      FROM orders WHERE outlet_id IN (${inList(B)}) AND ((closed_at >= ? AND closed_at < ?) OR (closed_at >= ? AND closed_at < ?)) GROUP BY h`)
      .all(day, day, day, day, day, day, day, ...B, day, t, day - DAY, day);
    const byH = Object.fromEntries(hourly.map((r) => [r.h, r]));
    // Best-selling dish in each hour today (for the hero chart tooltip)
    const topRows = db.prepare(`SELECT CAST(${LT('oi.ts')} AS INTEGER) h, m.name, SUM(oi.qty) q FROM order_items oi JOIN menu_items m ON m.id = oi.item_id
      WHERE oi.outlet_id IN (${inList(B)}) AND oi.ts >= ? AND oi.ts < ? GROUP BY h, m.name ORDER BY h, q DESC`).all(...B, day, t);
    const topByH = {};
    for (const r of topRows) if (!topByH[r.h]) topByH[r.h] = { name: r.name, qty: r.q };
    out.hourly = Array.from({ length: 24 }, (_, h) => {
      const r = byH[h] || {};
      const future = h > new Date(t).getHours();
      return { h, label: `${String(h).padStart(2, '0')}:00`, today: future ? null : Math.round(r.today || 0), yesterday: Math.round(r.yesterday || 0),
        online: future ? null : Math.round(r.online || 0), offline: future ? null : Math.round(r.offline || 0), orders: future ? null : r.orders || 0,
        yorders: r.yorders || 0, covers: future ? null : r.covers || 0, top: future ? null : topByH[h] || null, current: h === new Date(t).getHours() };
    });
    out.sources = db.prepare(`SELECT CASE WHEN channel = 'dine-in' THEN 'Dine-in' WHEN channel = 'takeaway' THEN 'Takeaway' ELSE platform END src,
        CASE WHEN ${ONLINE} THEN 'online' ELSE 'offline' END kind, SUM(total) sales, COUNT(*) orders
      FROM orders WHERE outlet_id IN (${inList(B)}) AND closed_at >= ? GROUP BY src ORDER BY sales DESC`).all(...B, day);
    out.payments = db.prepare(`SELECT payment, SUM(total) sales, COUNT(*) orders FROM orders WHERE outlet_id IN (${inList(B)}) AND closed_at >= ? GROUP BY payment ORDER BY sales DESC`).all(...B, day);
    out.topItems = db.prepare(`SELECT m.id, m.name, m.category, m.is_new, SUM(oi.qty) qty, SUM(oi.qty * oi.price) sales FROM order_items oi JOIN menu_items m ON m.id = oi.item_id
      WHERE oi.outlet_id IN (${inList(B)}) AND oi.ts >= ? GROUP BY m.id ORDER BY sales DESC LIMIT 8`).all(...B, day);
    out.categories = db.prepare(`SELECT m.category, SUM(oi.qty * oi.price) sales FROM order_items oi JOIN menu_items m ON m.id = oi.item_id
      WHERE oi.outlet_id IN (${inList(B)}) AND oi.ts >= ? GROUP BY m.category ORDER BY sales DESC`).all(...B, day);
    out.week = db.prepare(`SELECT ${LD('closed_at')} d, SUM(total) total, SUM(CASE WHEN ${ONLINE} THEN total ELSE 0 END) online, SUM(CASE WHEN NOT ${ONLINE} THEN total ELSE 0 END) offline, COUNT(*) orders
      FROM orders WHERE outlet_id IN (${inList(B)}) AND closed_at >= ? GROUP BY d ORDER BY d`).all(...B, day - 6 * DAY);
    out.heatmap = db.prepare(`SELECT ${LD('closed_at')} d, CAST(${LT('closed_at')} AS INTEGER) h, SUM(total) v FROM orders
      WHERE outlet_id IN (${inList(B)}) AND closed_at >= ? GROUP BY d, h`).all(...B, day - 6 * DAY);
    if (B.length > 1) {
      out.board = out.branches.map((b) => {
        const s = salesTotals([b.id], day, t), y = salesTotals([b.id], day - DAY, t - DAY);
        const hrs = Object.fromEntries(db.prepare(`SELECT CAST(${LT('closed_at')} AS INTEGER) h, SUM(total) v FROM orders WHERE outlet_id = ? AND closed_at >= ? GROUP BY h`).all(b.id, day).map((r) => [r.h, r.v]));
        const spark = Array.from({ length: new Date(t).getHours() + 1 }, (_, h) => ({ v: Math.round(hrs[h] || 0) }));
        return { ...b, sales: s.sales, yesterday: y.sales, orders: s.orders, aov: s.orders ? s.sales / s.orders : 0, online_share: s.sales ? s.online / s.sales : 0, spark };
      }).sort((a, b) => b.sales - a.sales);
    }
    if (p.perms.has('finance.view')) {
      const labor = laborCost(B, day, t);
      out.finance = { food_pct: today.sales ? today.food / today.sales : 0, labor_pct: today.sales ? labor / today.sales : 0,
        prime_pct: today.sales ? (today.food + labor) / today.sales : 0, labor, food: today.food };
    }
  }
  out.ops = ops(B, t, p);
  if (p.perms.has('staff.view') && p.perms.has('dashboard.view')) out.staffing = staffing(p, branch);
  if (p.perms.has('dashboard.view')) {
    const scores = branchScores(B, t);
    out.scores = scores;
    out.score = Math.round(scores.reduce((a, s) => a + s.score, 0) / Math.max(1, scores.length));
  }
  return out;
}

export function kitchen(p, branch) {
  const t = Date.now(), day = midnight(t);
  const B = scopeBranches(p, branch);
  const st = p.attrs.stationOnly ? 'AND station = ?' : '';
  const sa = p.attrs.stationOnly ? [p.station] : [];
  const open = db.prepare(`SELECT t.*, o.name branch FROM tickets t JOIN outlets o ON o.id = t.outlet_id WHERE t.outlet_id IN (${inList(B)}) AND t.ready_at IS NULL ${st.replace('station', 't.station')} ORDER BY t.fired_at LIMIT 80`).all(...B, ...sa);
  const done = db.prepare(`SELECT * FROM tickets WHERE outlet_id IN (${inList(B)}) AND ready_at IS NOT NULL ${st} ORDER BY ready_at DESC LIMIT 15`).all(...B, ...sa);
  const stations = db.prepare(`SELECT station, COUNT(*) n, AVG((ready_at - fired_at) / 1000.0) avg_sec, AVG(CASE WHEN (ready_at - fired_at) / 1000.0 <= target_sec THEN 1.0 ELSE 0 END) on_time,
      AVG(target_sec) target FROM tickets WHERE outlet_id IN (${inList(B)}) AND ready_at >= ? ${st} GROUP BY station ORDER BY station`).all(...B, t - HOUR, ...sa)
    .map((s) => ({ ...s, open: open.filter((o) => o.station === s.station).length }));
  const series = db.prepare(`SELECT CAST(ready_at / 1800000 AS INTEGER) * 1800000 bucket, AVG((ready_at - fired_at) / 60000.0) avg_min, COUNT(*) n
    FROM tickets WHERE outlet_id IN (${inList(B)}) AND ready_at >= ? ${st} GROUP BY bucket ORDER BY bucket`).all(...B, day, ...sa);
  const slowest = db.prepare(`SELECT item, station, COUNT(*) n, AVG((ready_at - fired_at) / 1000.0) avg_sec, AVG(target_sec) target
    FROM tickets WHERE outlet_id IN (${inList(B)}) AND ready_at >= ? ${st} GROUP BY item HAVING n >= 3 ORDER BY avg_sec / target DESC LIMIT 6`).all(...B, day, ...sa);
  const k = ops(B, t, { perms: new Set(['kitchen.view']), attrs: {} }).kitchen;
  return { ts: t, station: p.attrs.stationOnly ? p.station : null, open, done, stations, series, slowest, kpi: k,
    today: db.prepare(`SELECT COUNT(*) n FROM tickets WHERE outlet_id IN (${inList(B)}) AND fired_at >= ? ${st}`).get(...B, day, ...sa).n };
}

export function vision(p, branch) {
  const t = Date.now();
  const B = scopeBranches(p, branch);
  const cameras = db.prepare(`SELECT c.*, o.name branch FROM cameras c JOIN outlets o ON o.id = c.outlet_id WHERE c.outlet_id IN (${inList(B)}) ORDER BY c.outlet_id, c.rowid`).all(...B)
    .map((c) => {
      const last = db.prepare('SELECT * FROM vision_events WHERE camera_id = ? ORDER BY ts DESC LIMIT 1').get(c.id);
      const s = db.prepare(`SELECT AVG(ok * 1.0) rate, COUNT(*) n FROM vision_events WHERE camera_id = ? AND ts >= ? AND ${SCORED}`).get(c.id, t - 2 * HOUR);
      return { ...c, last, compliance: s.n ? s.rate : null, people: last?.people ?? 0 };
    });
  const byType = db.prepare(`SELECT type, COUNT(*) n, SUM(ok) ok FROM vision_events WHERE outlet_id IN (${inList(B)}) AND ts >= ? AND type IN (${[...SCORED_TYPES, ...AUDIT_TYPES].map((x) => `'${x}'`).join(',')}) GROUP BY type`)
    .all(...B, t - 2 * HOUR).map((r) => ({ ...r, label: VISION_CHECKS[r.type]?.label ?? r.type, rate: r.n ? r.ok / r.n : null }));
  const byBranch = db.prepare(`SELECT v.outlet_id, o.name, AVG(v.ok * 1.0) rate, SUM(1 - v.ok) flags FROM vision_events v JOIN outlets o ON o.id = v.outlet_id
    WHERE v.outlet_id IN (${inList(B)}) AND v.ts >= ? AND v.${SCORED} GROUP BY v.outlet_id ORDER BY rate`).all(...B, t - 2 * HOUR);
  const events = db.prepare(`SELECT v.*, c.name camera_name, o.name branch FROM vision_events v LEFT JOIN cameras c ON c.id = v.camera_id JOIN outlets o ON o.id = v.outlet_id
    WHERE v.outlet_id IN (${inList(B)}) AND v.ok = 0 ORDER BY v.ts DESC LIMIT 50`).all(...B);
  // Presence-and-time metrics that CCTV measures reliably (last 2 h unless stated)
  const L = inList(B), since = t - 2 * HOUR;
  const durs = (type) => db.prepare(`SELECT duration_s d FROM vision_events WHERE outlet_id IN (${L}) AND type = ? AND ts >= ? AND duration_s IS NOT NULL ORDER BY duration_s`).all(...B, type, since).map((r) => r.d);
  const pctl = (a, q) => (a.length ? a[Math.min(a.length - 1, Math.floor(q * a.length))] : null);
  const rate = (type, from = since) => db.prepare(`SELECT COUNT(*) n, SUM(ok) ok FROM vision_events WHERE outlet_id IN (${L}) AND type = ? AND ts >= ?`).get(...B, type, from);
  const st = rate('station'), q = durs('queue'), pa = durs('pass'), dr = db.prepare(`SELECT COUNT(*) n, SUM(CASE WHEN ok = 0 THEN 1 ELSE 0 END) long, AVG(duration_s) avg FROM vision_events WHERE outlet_id IN (${L}) AND type = 'door' AND ts >= ?`).get(...B, since);
  const occ = db.prepare(`SELECT camera_id, people FROM vision_events WHERE id IN (SELECT MAX(id) FROM vision_events WHERE outlet_id IN (${L}) AND type = 'person' AND zone = 'front' AND ts >= ? GROUP BY camera_id)`).all(...B, t - 30 * 60_000);
  const measured = {
    station_coverage: st.n ? st.ok / st.n : null,
    queue_wait_p50: pctl(q, 0.5), queue_wait_p90: pctl(q, 0.9), queue_samples: q.length,
    pass_dwell_p50: pctl(pa, 0.5), pass_dwell_p90: pctl(pa, 0.9), pass_over_2min: pa.filter((x) => x > 120).length,
    door_events: dr.n, door_open_avg_s: dr.avg, door_long: dr.long || 0,
    counter_unattended: (rate('counter').n || 0) - (rate('counter').ok || 0),
    after_hours_access_24h: (() => { const r = rate('access', t - DAY); return (r.n || 0) - (r.ok || 0); })(),
    occupancy_now: occ.reduce((a, r) => a + (r.people || 0), 0),
    cameras_online: cameras.filter((c) => c.status !== 'offline').length, cameras_total: cameras.length,
  };
  const audit = db.prepare(`SELECT v.*, c.name camera_name, o.name branch FROM vision_events v LEFT JOIN cameras c ON c.id = v.camera_id JOIN outlets o ON o.id = v.outlet_id
    WHERE v.outlet_id IN (${L}) AND v.ok = 0 AND v.type IN (${AUDIT_TYPES.map(() => '?').join(',')}) ORDER BY v.ts DESC LIMIT 30`).all(...B, ...AUDIT_TYPES);
  const tiers = Object.entries(VISION_CHECKS).map(([id, c]) => ({ id, label: c.label, tier: c.tier, metric: c.metric }));
  return { ts: t, cameras, byType: byType.map((r) => ({ ...r, tier: VISION_CHECKS[r.type]?.tier })), byBranch, events: events.filter((e) => ['realtime', 'kpi'].includes(VISION_CHECKS[e.type]?.tier)), measured, audit, tiers };
}

export function guests(p, branch) {
  const t = Date.now(), day = midnight(t);
  const B = scopeBranches(p, branch);
  const pii = p.perms.has('guests.pii');
  const arrivals = db.prepare(`SELECT gv.*, o.name branch FROM guest_visits gv JOIN outlets o ON o.id = gv.outlet_id
    WHERE gv.outlet_id IN (${inList(B)}) ORDER BY gv.ts DESC LIMIT 12`).all(...B)
    .map((v) => ({ ...v, profile: guestProfile(v.guest_id, { at: v.outlet_id, pii }) }));
  const kpi = db.prepare(`SELECT COUNT(*) recognized, SUM(CASE WHEN method = 'face' THEN 1 ELSE 0 END) face,
      SUM(CASE WHEN method = 'loyalty-qr' THEN 1 ELSE 0 END) qr, SUM(CASE WHEN ts > ? THEN 1 ELSE 0 END) in_house
    FROM guest_visits WHERE outlet_id IN (${inList(B)}) AND ts >= ?`).get(t - 75 * 60_000, ...B, day);
  const dine = db.prepare(`SELECT COUNT(*) n, SUM(CASE WHEN guest_id IS NOT NULL THEN 1 ELSE 0 END) known, AVG(CASE WHEN guest_id IS NOT NULL THEN total END) known_aov,
      AVG(CASE WHEN guest_id IS NULL THEN total END) new_aov FROM orders WHERE outlet_id IN (${inList(B)}) AND closed_at >= ? AND channel = 'dine-in'`).get(...B, day - 6 * DAY);
  const top = db.prepare(`SELECT g.id, g.name, g.phone, g.consent_face, COUNT(o.id) visits, SUM(o.total) spend, MAX(o.closed_at) last
    FROM orders o JOIN guests g ON g.id = o.guest_id WHERE o.outlet_id IN (${inList(B)}) GROUP BY g.id ORDER BY spend DESC LIMIT 20`).all(...B)
    .map((g) => ({ ...g, phone: pii ? g.phone : maskPhone(g.phone), tier: g.visits >= 12 || g.spend >= 900 * TIER_SCALE ? 'Gold' : g.visits >= 5 || g.spend >= 350 * TIER_SCALE ? 'Silver' : 'Regular', wallet: Math.round(g.spend * 0.05) }));
  return { ts: t, arrivals, kpi: { ...kpi, returning_share: dine.n ? dine.known / dine.n : 0, known_aov: dine.known_aov || 0, new_aov: dine.new_aov || 0 }, top };
}

export function guestDetail(p, id) {
  const prof = guestProfile(id, { pii: p.perms.has('guests.pii') });
  if (!prof) return null;
  const visitedScope = db.prepare(`SELECT 1 FROM orders WHERE guest_id = ? AND outlet_id IN (${inList(p.branches)}) LIMIT 1`).get(id, ...p.branches);
  if (!visitedScope && !p.branches.includes(prof.home_outlet)) { const e = new Error('Guest not in your branches'); e.status = 403; throw e; }
  prof.recent = prof.recent.filter((r) => p.branches.includes(r.outlet_id));
  return prof;
}

export function people(p, branch) {
  const t = Date.now(), day = midnight(t);
  const B = scopeBranches(p, branch);
  const dept = p.attrs.department ? 'AND s.department = ?' : '';
  const rows = db.prepare(`SELECT s.*, o.name branch,
      (SELECT ts_in FROM attendance a WHERE a.staff_id = s.id AND a.ts_in >= ? ORDER BY ts_in DESC LIMIT 1) ts_in,
      (SELECT ts_out FROM attendance a WHERE a.staff_id = s.id AND a.ts_in >= ? ORDER BY ts_in DESC LIMIT 1) ts_out,
      (SELECT late_min FROM attendance a WHERE a.staff_id = s.id AND a.ts_in >= ? ORDER BY ts_in DESC LIMIT 1) late_min,
      (SELECT method FROM attendance a WHERE a.staff_id = s.id AND a.ts_in >= ? ORDER BY ts_in DESC LIMIT 1) method
    FROM staff s JOIN outlets o ON o.id = s.outlet_id WHERE s.outlet_id IN (${inList(B)}) ${dept} ORDER BY s.outlet_id, s.shift_start`)
    .all(day - HOUR, day - HOUR, day - HOUR, day - HOUR, ...B, ...(p.attrs.department ? [p.attrs.department] : []));
  const showPay = p.perms.has('staff.pay');
  return rows.map(({ hourly_rate, ...r }) => {
    const due = day + r.shift_start * 60_000, end = day + r.shift_end * 60_000;
    let status = 'later';
    if (r.ts_in && !r.ts_out) status = r.late_min >= 10 ? 'late' : 'on shift';
    else if (r.ts_in && r.ts_out) status = 'finished';
    else if (t > end) status = 'absent';
    else if (t > due + 30 * 60_000) status = 'absent';
    else if (t > due) status = 'due';
    const hours = r.ts_in ? ((r.ts_out || t) - r.ts_in) / HOUR : 0;
    return { ...r, due, end, status, hours, ...(showPay ? { hourly_rate, cost: hours * hourly_rate } : {}) };
  });
}

export function safety(p, branch) {
  const t = Date.now();
  const B = scopeBranches(p, branch);
  return db.prepare(`SELECT s.*, o.name branch FROM sensors s JOIN outlets o ON o.id = s.outlet_id WHERE s.outlet_id IN (${inList(B)}) ORDER BY s.outlet_id, s.rowid`).all(...B).map((s) => {
    const history = db.prepare('SELECT value, ts FROM readings WHERE sensor_id = ? AND ts >= ? ORDER BY ts').all(s.id, t - 2 * HOUR);
    const last = history.at(-1);
    return { ...s, history, value: last?.value ?? null, ok: last ? last.value >= s.min && last.value <= s.max : null };
  });
}

export function alerts(p, { branch, status = 'open', limit = 200 } = {}) {
  const B = scopeBranches(p, branch);
  return db.prepare(`SELECT a.*, o.name branch FROM alerts a JOIN outlets o ON o.id = a.outlet_id WHERE a.outlet_id IN (${inList(B)}) ${status === 'open' ? 'AND a.ack = 0' : ''}
      AND a.ts >= ? ORDER BY a.ts DESC LIMIT ?`).all(...B, Date.now() - DAY, Number(limit) * 3)
    .filter((a) => alertAllowed(p, a)).slice(0, Number(limit));
}

export function reviews(p, branch) {
  const B = scopeBranches(p, branch);
  return db.prepare(`SELECT r.*, o.name branch FROM reviews r JOIN outlets o ON o.id = r.outlet_id WHERE r.outlet_id IN (${inList(B)}) ORDER BY r.ts DESC LIMIT 20`).all(...B);
}

export { ONLINE_CHANNELS };

// ---------- Staffing productivity: TPPH (transactions per person-hour), SPLH, labour hours per order ----------
export function staffing(p, branch) {
  const t = Date.now(), day = midnight(t);
  const B = scopeBranches(p, branch);
  const dept = p.attrs.department ? 'AND s.department = ?' : '';
  const dargs = p.attrs.department ? [p.attrs.department] : [];
  const shifts = db.prepare(`SELECT a.ts_in, COALESCE(a.ts_out, ?) ts_out, s.hourly_rate FROM attendance a JOIN staff s ON s.id = a.staff_id
    WHERE a.outlet_id IN (${inList(B)}) AND a.ts_in >= ? ${dept}`).all(t, ...B, day - HOUR, ...dargs);
  const orders = Object.fromEntries(db.prepare(`SELECT CAST(${LT('closed_at')} AS INTEGER) h, COUNT(*) n, SUM(total) sales, SUM(covers) covers
    FROM orders WHERE outlet_id IN (${inList(B)}) AND closed_at >= ? GROUP BY h`).all(...B, day).map((r) => [r.h, r]));
  const target = Number(process.env.TARGET_TPPH || 3) * (p.attrs.department === 'Kitchen' ? 1.6 : 1); // orders per labour hour
  const nowH = new Date(t).getHours();
  const hours = [];
  let totH = 0, totN = 0, totS = 0, totC = 0;
  for (let h = 0; h <= nowH; h++) {
    const hs = day + h * HOUR, he = Math.min(hs + HOUR, t);
    const labour = shifts.reduce((a, s) => a + Math.max(0, Math.min(s.ts_out, he) - Math.max(s.ts_in, hs)) / HOUR, 0);
    const o = orders[h] || { n: 0, sales: 0, covers: 0 };
    const span = (he - hs) / HOUR;
    const staffOn = span > 0 ? labour / span : 0;
    const tpph = labour ? o.n / labour : null;
    const recommended = Math.max(2, Math.ceil((o.n / Math.max(span, 0.25)) / target));
    hours.push({ h, label: `${String(h).padStart(2, '0')}:00`, staff: Math.round(staffOn * 10) / 10, recommended, orders: o.n, tpph: tpph && Math.round(tpph * 100) / 100,
      status: !labour ? 'closed' : tpph < target * 0.75 ? 'over' : tpph > target * 1.25 ? 'under' : 'ok' });
    totH += labour; totN += o.n; totS += o.sales; totC += o.covers;
  }
  const out = {
    target_tpph: target, labour_hours: Math.round(totH * 10) / 10, orders: totN,
    tpph: totH ? totN / totH : null, lhpo: totN ? totH / totN : null, covers_plh: totH ? totC / totH : null,
    over_hours: hours.filter((x) => x.status === 'over').length, under_hours: hours.filter((x) => x.status === 'under').length,
    hours, department: p.attrs.department || 'All teams',
  };
  if (p.perms.has('sales.view')) out.splh = totH ? totS / totH : null;
  if (p.perms.has('finance.view')) out.labour_cost = shifts.reduce((a, s) => a + Math.max(0, s.ts_out - s.ts_in) / HOUR * s.hourly_rate, 0);
  return out;
}
