// Management reporting: KPI scorecard, KRI register, comparisons and forecasts.
// Every number is computed from the same fact tables as the live dashboard, for the caller's branches only,
// and every block is gated by the caller's permissions (field-level RBAC + ABAC department scope).
import { db, midnight, inList } from './db.js';
import { scopeBranches, alertAllowed } from './policy.js';
import { SCORED_TYPES } from './ingest.js';
import { fmtMoney } from './instance.js';
import { getSetting } from './db.js';
const T = (k, d) => getSetting('targets', {})[k] ?? d; // budgets set in onboarding

const MIN = 60_000, HOUR = 3600_000, DAY = 86400_000;
const LD = (col) => `date(${col} / 1000, 'unixepoch', 'localtime')`;
const ONLINE = `channel IN ('delivery','online')`;
const HIGH_RISK_CHECKS = ['station', 'access', 'counter'];
export const TPPH_TARGET = Number(process.env.REPORT_TPPH_TARGET || 2.2);

export const PERIODS = {
  today: 'Today so far', yesterday: 'Yesterday', '7d': 'Last 7 days', '14d': 'Last 14 days',
};

const dkey = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dayStarts = (from, to) => { const out = []; for (let d = midnight(from); d < to; d = midnight(d + 26 * HOUR)) out.push(d); return out; };
const sum = (a) => a.reduce((x, y) => x + y, 0);
const mean = (a) => (a.length ? sum(a) / a.length : 0);
const div = (a, b) => (b ? a / b : null);
const phi = (z) => 1 / (1 + Math.exp(-1.702 * z)); // logistic approximation of the normal CDF

function periodRange(period, t) {
  const day = midnight(t);
  const back = (n) => midnight(day - n * DAY + 2 * HOUR);
  switch (period) {
    case 'yesterday': return { from: back(1), to: day, prev: [back(8), back(7)], prevLabel: 'same day last week', days: 1 };
    case '7d': return { from: back(7), to: day, prev: [back(14), back(7)], prevLabel: 'previous 7 days', days: 7 };
    case '14d': return { from: back(14), to: day, prev: [back(28), back(14)], prevLabel: 'previous 14 days', days: 14 };
    default: return { from: day, to: t, prev: [back(7), t - (day - back(7))], prevLabel: 'same time last week', days: (t - day) / DAY, partial: true };
  }
}

// ---------- facts: additive sums per branch per local day ----------
const ZERO = () => ({ sales: 0, orders: 0, covers: 0, food: 0, online: 0, dine: 0, dine_covers: 0, dine_orders: 0, known: 0,
  hours: 0, labour: 0, shifts: 0, late: 0, scheduled: 0, tk_n: 0, tk_sec: 0, tk_on: 0, v_n: 0, v_ok: 0, hw_n: 0, hw_ok: 0, crit: 0,
  r_n: 0, r_out: 0, rv_n: 0, rv_sum: 0, rv_neg: 0, target: 0, seat_days: 0 });

function addInto(a, b) { for (const k in b) a[k] = (a[k] || 0) + b[k]; return a; }

/** Facts for branches B in [from, to), keyed `${branch}|${date}`. Staff facts honour the caller's department scope. */
function dailyFacts(p, B, from, to, t) {
  const L = inList(B), F = {};
  const cell = (b, d) => (F[`${b}|${d}`] ??= ZERO());
  const dept = p.attrs.department ? 'AND s.department = ?' : '';
  const dArgs = p.attrs.department ? [p.attrs.department] : [];

  for (const r of db.prepare(`SELECT outlet_id b, ${LD('closed_at')} d, SUM(total) sales, COUNT(*) orders, SUM(covers) covers, SUM(food_cost) food,
      SUM(CASE WHEN ${ONLINE} THEN total ELSE 0 END) online, SUM(CASE WHEN channel = 'dine-in' THEN total ELSE 0 END) dine,
      SUM(CASE WHEN channel = 'dine-in' THEN covers ELSE 0 END) dine_covers, SUM(CASE WHEN channel = 'dine-in' THEN 1 ELSE 0 END) dine_orders,
      SUM(CASE WHEN channel = 'dine-in' AND guest_id IS NOT NULL THEN 1 ELSE 0 END) known
    FROM orders WHERE outlet_id IN (${L}) AND closed_at >= ? AND closed_at < ? GROUP BY b, d`).all(...B, from, to)) {
    const { b, d, ...vals } = r;
    addInto(cell(b, d), vals);
  }

  // shifts belong to the day they were due: a 23:50 clock-in for a 00:00 shift counts for the next day
  for (const r of db.prepare(`SELECT a.outlet_id b, ${LD('(a.ts_in + 900000)')} d, COUNT(*) shifts, SUM(CASE WHEN a.late_min >= 10 THEN 1 ELSE 0 END) late,
      SUM((MIN(COALESCE(a.ts_out, ?), ?) - a.ts_in) / 3600000.0) hours, SUM((MIN(COALESCE(a.ts_out, ?), ?) - a.ts_in) / 3600000.0 * s.hourly_rate) labour
    FROM attendance a JOIN staff s ON s.id = a.staff_id WHERE a.outlet_id IN (${L}) AND a.ts_in >= ? AND a.ts_in < ? ${dept} GROUP BY b, d`)
    .all(t, to, t, to, ...B, from - 15 * MIN, to - 15 * MIN, ...dArgs)) {
    const c = cell(r.b, r.d); c.shifts += r.shifts; c.late += r.late; c.hours += Math.max(0, r.hours); c.labour += Math.max(0, r.labour);
  }
  const staff = db.prepare(`SELECT s.outlet_id, s.shift_start FROM staff s WHERE s.outlet_id IN (${L}) ${dept}`).all(...B, ...dArgs);
  for (const d of dayStarts(from, to)) {
    for (const s of staff) if (d + s.shift_start * MIN + 30 * MIN <= Math.min(to, t)) cell(s.outlet_id, dkey(d)).scheduled++;
  }

  for (const r of db.prepare(`SELECT outlet_id b, ${LD('fired_at')} d, COUNT(*) n, SUM((ready_at - fired_at) / 1000.0) sec,
      SUM(CASE WHEN (ready_at - fired_at) / 1000.0 <= target_sec THEN 1 ELSE 0 END) on_time
    FROM tickets WHERE outlet_id IN (${L}) AND fired_at >= ? AND fired_at < ? AND ready_at IS NOT NULL GROUP BY b, d`).all(...B, from, to)) {
    const c = cell(r.b, r.d); c.tk_n += r.n; c.tk_sec += r.sec; c.tk_on += r.on_time;
  }
  for (const r of db.prepare(`SELECT outlet_id b, ${LD('ts')} d, COUNT(*) n, SUM(ok) ok,
      SUM(CASE WHEN type = 'handwash' THEN 1 ELSE 0 END) hw_n, SUM(CASE WHEN type = 'handwash' THEN ok ELSE 0 END) hw_ok,
      SUM(CASE WHEN ok = 0 AND type IN (${HIGH_RISK_CHECKS.map(() => '?').join(',')}) THEN 1 ELSE 0 END) crit
    FROM vision_events WHERE outlet_id IN (${L}) AND ts >= ? AND ts < ? AND type IN (${SCORED_TYPES.map(() => '?').join(',')}, 'handwash') GROUP BY b, d`).all(...HIGH_RISK_CHECKS, ...B, from, to, ...SCORED_TYPES)) {
    const c = cell(r.b, r.d); c.v_n += r.n - r.hw_n; c.v_ok += r.ok - r.hw_ok; c.hw_n += r.hw_n; c.hw_ok += r.hw_ok; c.crit += r.crit;
  }
  for (const r of db.prepare(`SELECT s.outlet_id b, ${LD('r.ts')} d, COUNT(*) n, SUM(CASE WHEN r.value < s.min OR r.value > s.max THEN 1 ELSE 0 END) out_n
    FROM readings r JOIN sensors s ON s.id = r.sensor_id WHERE s.outlet_id IN (${L}) AND r.ts >= ? AND r.ts < ? GROUP BY b, d`).all(...B, from, to)) {
    const c = cell(r.b, r.d); c.r_n += r.n; c.r_out += r.out_n;
  }
  for (const r of db.prepare(`SELECT outlet_id b, ${LD('ts')} d, COUNT(*) n, SUM(rating) total, SUM(CASE WHEN rating <= 2 THEN 1 ELSE 0 END) neg
    FROM reviews WHERE outlet_id IN (${L}) AND ts >= ? AND ts < ? GROUP BY b, d`).all(...B, from, to)) {
    const c = cell(r.b, r.d); c.rv_n += r.n; c.rv_sum += r.total; c.rv_neg += r.neg;
  }
  // budget (phased by weekday, pro-rated for a part-day by the usual share of sales done by this time) and capacity
  const outlets = db.prepare(`SELECT id, daily_target, seats FROM outlets WHERE id IN (${L})`).all(...B);
  const phase = weekdayPhase();
  for (const d of dayStarts(from, to)) {
    const frac = to < d + DAY ? cumShare(B, to) : 1;
    for (const o of outlets) { const c = cell(o.id, dkey(d)); c.target += o.daily_target * phase[new Date(d).getDay()] * frac; c.seat_days += o.seats * Math.min(1, (Math.min(to, d + DAY) - d) / DAY); }
  }
  return F;
}

let phaseCache = null;
/** Budget phasing: each weekday's share of a normal week (from the last 4 weeks), averaging 1.0, so a weekly budget lands on busy days. */
export function weekdayPhase() {
  const day = midnight();
  if (phaseCache?.day === day) return phaseCache.phase;
  const rows = db.prepare(`SELECT CAST(strftime('%w', closed_at / 1000, 'unixepoch', 'localtime') AS INTEGER) w, SUM(total) v FROM orders WHERE closed_at >= ? AND closed_at < ? GROUP BY w`).all(day - 28 * DAY, day);
  const v = Array.from({ length: 7 }, (_, w) => rows.find((r) => r.w === w)?.v || 0);
  const m = mean(v);
  const phase = m ? v.map((x) => x / m) : v.map(() => 1);
  phaseCache = { day, phase };
  return phase;
}

const closedCache = new Map();
/** Facts for all branches for closed days [from, day). Immutable once the day is over, so cached per data generation. */
function closedDays(p, from, day) {
  const gen = db.prepare('SELECT MIN(id) m FROM orders').get().m; // changes when the demo is rebuilt
  const key = `${p.attrs.department || '*'}|${from}|${day}|${gen}`;
  let F = closedCache.get(key);
  if (!F) {
    const all = db.prepare('SELECT id FROM outlets').all().map((r) => r.id);
    F = dailyFacts(p, all, from, day, day);
    for (const k of closedCache.keys()) if (!k.startsWith(`${p.attrs.department || '*'}|`) || closedCache.size > 4) closedCache.delete(k);
    closedCache.set(key, F);
  }
  return F;
}

const cumCache = new Map();
/** Average share of a day's sales completed by the time-of-day of `ts` (last 14 full days). */
function cumShare(B, ts) {
  const day = midnight(ts), key = `${B.join(',')}|${day}`;
  let prof = cumCache.get(key);
  if (!prof) {
    const rows = db.prepare(`SELECT CAST(strftime('%H', closed_at / 1000, 'unixepoch', 'localtime') AS INTEGER) h, SUM(total) v FROM orders
      WHERE outlet_id IN (${inList(B)}) AND closed_at >= ? AND closed_at < ? GROUP BY h`).all(...B, day - 14 * DAY, day);
    const tot = sum(rows.map((r) => r.v)) || 1;
    prof = Array.from({ length: 24 }, (_, h) => (rows.find((r) => r.h === h)?.v || 0) / tot);
    cumCache.set(key, prof);
    if (cumCache.size > 200) cumCache.delete(cumCache.keys().next().value);
  }
  const d = new Date(ts), h = d.getHours(), f = (d.getMinutes() + d.getSeconds() / 60) / 60;
  return Math.max(0.01, sum(prof.slice(0, h)) + prof[h] * f);
}
const hourProfile = (B, ts) => { cumShare(B, ts); return cumCache.get(`${B.join(',')}|${midnight(ts)}`); };

const dayCache = new Map();
function rollup(F, branches, from, to) {
  const ck = `${from}|${to}`;
  let days = dayCache.get(ck);
  if (!days) { days = dayStarts(from, to).map(dkey); dayCache.set(ck, days); if (dayCache.size > 5000) dayCache.clear(); }
  const out = ZERO();
  for (const d of days) for (const b of branches) { const v = F[`${b}|${d}`]; if (v) addInto(out, v); }
  return out;
}

// ---------- KPI catalogue ----------
// better: 'up' | 'down' · tol: relative tolerance for amber · perms: all required
const K = [
  { id: 'net_sales', group: 'Revenue', label: 'Net sales', unit: 'money', better: 'up', tol: 0.05, perms: ['sales.view'], v: (f) => f.sales, target: (f) => f.target, def: 'Sum of closed order totals, all channels' },
  { id: 'sales_vs_budget', group: 'Revenue', label: 'Sales vs budget', unit: 'pctpt', better: 'up', perms: ['sales.view'], v: (f) => div(f.sales - f.target, f.target), target: () => 0, tol: 0.05, absTol: 0.05, def: 'Net sales relative to the budget (pro-rated for part days)' },
  { id: 'orders', group: 'Revenue', label: 'Orders', unit: 'num', better: 'up', perms: ['sales.view'], v: (f) => f.orders, def: 'Closed orders, all channels' },
  { id: 'covers', group: 'Revenue', label: 'Guests served (covers)', unit: 'num', better: 'up', perms: ['sales.view'], v: (f) => f.covers, def: 'Covers across all channels' },
  { id: 'aov', group: 'Revenue', label: 'Average order value', unit: 'money2', better: 'up', perms: ['sales.view'], v: (f) => div(f.sales, f.orders), def: 'Net sales ÷ orders' },
  { id: 'spc', group: 'Revenue', label: 'Spend per cover (dine-in)', unit: 'money2', better: 'up', perms: ['sales.view'], v: (f) => div(f.dine, f.dine_covers), def: 'Dine-in sales ÷ dine-in covers' },
  { id: 'online_share', group: 'Revenue', label: 'Online & delivery share', unit: 'pct', better: 'none', perms: ['sales.view'], v: (f) => div(f.online, f.sales), def: 'Delivery + web orders ÷ net sales' },
  { id: 'sales_per_seat', group: 'Revenue', label: 'Sales per seat per day', unit: 'money2', better: 'up', perms: ['sales.view'], v: (f) => div(f.sales, f.seat_days), def: 'Net sales ÷ (seats × days)' },
  { id: 'food_pct', group: 'Profitability', label: 'Food cost %', unit: 'pct1', better: 'down', target: () => T('food', 0.3), tol: 0.05, perms: ['finance.view'], v: (f) => div(f.food, f.sales), def: 'Theoretical food cost (recipe cost × waste) ÷ net sales' },
  { id: 'labour_pct', group: 'Profitability', label: 'Labour cost %', unit: 'pct1', better: 'down', target: () => T('labour', 0.28), tol: 0.07, perms: ['finance.view', 'staff.view'], v: (f) => div(f.labour, f.sales), def: 'Fully-loaded wages for worked hours ÷ net sales' },
  { id: 'prime_pct', group: 'Profitability', label: 'Prime cost %', unit: 'pct1', better: 'down', target: () => T('prime', 0.6), tol: 0.05, perms: ['finance.view', 'staff.view'], v: (f) => div(f.food + f.labour, f.sales), def: '(Food + labour) ÷ net sales' },
  { id: 'gross_margin', group: 'Profitability', label: 'Contribution after prime cost', unit: 'money', better: 'up', perms: ['finance.view', 'staff.view'], v: (f) => f.sales - f.food - f.labour, def: 'Net sales − food − labour' },
  { id: 'splh', group: 'Productivity', label: 'Sales per labour hour', unit: 'money2', better: 'up', perms: ['sales.view', 'staff.view'], v: (f) => div(f.sales, f.hours), def: 'Net sales ÷ worked hours' },
  { id: 'tpph', group: 'Productivity', label: 'Orders per labour hour', unit: 'dec', better: 'up', target: () => TPPH_TARGET, tol: 0.1, perms: ['staff.view'], v: (f) => div(f.orders, f.hours), def: 'Orders ÷ worked hours (TPPH)' },
  { id: 'ticket_time', group: 'Operations', label: 'Average ticket time', unit: 'sec', better: 'down', perms: ['kitchen.view'], v: (f) => div(f.tk_sec, f.tk_n), def: 'Mean fire-to-ready time per kitchen ticket' },
  { id: 'on_time', group: 'Operations', label: 'Tickets on time', unit: 'pct', better: 'up', target: () => 0.9, tol: 0.04, perms: ['kitchen.view'], v: (f) => div(f.tk_on, f.tk_n), def: 'Tickets ready within the dish target time' },
  { id: 'hygiene', group: 'Quality & compliance', label: 'Camera compliance (real-time checks)', unit: 'pct1', better: 'up', target: () => 0.95, tol: 0.03, perms: ['vision.view'], v: (f) => div(f.v_ok, f.v_n), def: 'Passed ÷ all checks that CCTV measures reliably: station staffed, after-hours access, door, counter, queue, pass, staff approach, table visit, uniform' },
  { id: 'handwash', group: 'Quality & compliance', label: 'Sink visits after raw handling (audit)', unit: 'pct1', better: 'up', target: () => 0.92, tol: 0.05, perms: ['vision.view'], v: (f) => div(f.hw_ok, f.hw_n), def: 'Audit-tier estimate: sink dwell ≥ 20 s after the raw zone. Sampled for human review, not a verified hand-wash' },
  { id: 'haccp', group: 'Quality & compliance', label: 'Cold chain in range', unit: 'pct1', better: 'up', target: () => 0.99, tol: 0.01, perms: ['safety.view'], v: (f) => div(f.r_n - f.r_out, f.r_n), def: 'Fridge / freezer readings inside the safe band' },
  { id: 'attendance', group: 'People', label: 'Shift attendance', unit: 'pct1', better: 'up', target: () => 0.95, tol: 0.03, perms: ['staff.view'], v: (f) => (f.scheduled ? Math.min(1, f.shifts / f.scheduled) : null), def: 'Shifts worked ÷ shifts rostered' },
  { id: 'punctuality', group: 'People', label: 'On-time clock-ins', unit: 'pct1', better: 'up', target: () => 0.9, tol: 0.05, perms: ['staff.view'], v: (f) => div(f.shifts - f.late, f.shifts), def: 'Clock-ins less than 10 min late' },
  { id: 'rating', group: 'Guests', label: 'Average review rating', unit: 'rating', better: 'up', target: () => 4.4, tol: 0.03, perms: ['reviews.view'], v: (f) => div(f.rv_sum, f.rv_n), def: 'Mean star rating across platforms' },
  { id: 'returning', group: 'Guests', label: 'Returning-guest share (dine-in)', unit: 'pct', better: 'up', target: () => 0.15, tol: 0.15, perms: ['guests.view'], v: (f) => div(f.known, f.dine_orders), def: 'Dine-in orders linked to a known guest' },
];

const KRI = [
  { id: 'kri_prime', label: 'Prime cost overrun', kpi: 'prime_pct', amber: 0.62, red: 0.66, worse: 'up', owner: 'Branch Manager', action: 'Review rota against forecast covers and check portioning on top sellers.' },
  { id: 'kri_food', label: 'Food cost drift', kpi: 'food_pct', amber: 0.31, red: 0.33, worse: 'up', owner: 'Head Chef', action: 'Run a waste log for 3 days and re-cost the top 10 dishes.' },
  { id: 'kri_labour', label: 'Labour cost overrun', kpi: 'labour_pct', amber: 0.3, red: 0.34, worse: 'up', owner: 'Branch Manager', action: 'Trim shoulder-hour shifts flagged as overstaffed on the Workforce page.' },
  { id: 'kri_budget', label: 'Revenue shortfall vs budget', kpi: 'sales_vs_budget', amber: -0.05, red: -0.1, worse: 'down', owner: 'Area Manager', action: 'Push delivery promotions in quiet dayparts; review menu pricing.' },
  { id: 'kri_late', label: 'Late kitchen tickets', calc: (f) => div(f.tk_n - f.tk_on, f.tk_n), unit: 'pct', amber: 0.12, red: 0.2, worse: 'up', perms: ['kitchen.view'], owner: 'Head Chef', action: 'Rebalance stations at peak and pre-prep the slowest dishes.' },
  { id: 'kri_hygiene', label: 'Camera non-compliance (real-time checks)', calc: (f) => div(f.v_n - f.v_ok, f.v_n), unit: 'pct1', amber: 0.05, red: 0.08, worse: 'up', perms: ['vision.view'], owner: 'Head Chef', action: 'Toolbox talk at shift start; spot checks on PPE and hand-wash.' },
  { id: 'kri_critical', label: 'Unstaffed station / access / counter breaches per 1,000 checks', calc: (f) => (f.v_n ? (f.crit / f.v_n) * 1000 : null), unit: 'dec', amber: 15, red: 30, worse: 'up', perms: ['vision.view'], owner: 'Food Safety Lead', action: 'Unstaffed stations, after-hours cold-store entries and unattended counters: review clips daily.' },
  { id: 'kri_cold', label: 'Cold-chain excursions', calc: (f) => div(f.r_out, f.r_n), unit: 'pct1', amber: 0.005, red: 0.015, worse: 'up', perms: ['safety.view'], owner: 'Head Chef', action: 'Service the units with repeat excursions; check door seals and loading.' },
  { id: 'kri_absent', label: 'Absenteeism', calc: (f) => (f.scheduled ? Math.max(0, 1 - f.shifts / f.scheduled) : null), unit: 'pct1', amber: 0.06, red: 0.1, worse: 'up', perms: ['staff.view'], owner: 'Branch Manager', action: 'Keep a call-in list; review repeat absences with HR.' },
  { id: 'kri_lateness', label: 'Late clock-ins', calc: (f) => div(f.late, f.shifts), unit: 'pct1', amber: 0.12, red: 0.18, worse: 'up', perms: ['staff.view'], owner: 'Branch Manager', action: 'Address repeat late arrivals; check rota publication lead time.' },
  { id: 'kri_reviews', label: 'Negative reviews (≤ 2★)', calc: (f) => div(f.rv_neg, f.rv_n), unit: 'pct', amber: 0.08, red: 0.15, worse: 'up', perms: ['reviews.view'], owner: 'Branch Manager', action: 'Reply within 24 h; root-cause slow service and missing items.' },
  { id: 'kri_platform', label: 'Delivery-platform dependency', kpi: 'online_share', amber: 0.45, red: 0.55, worse: 'up', owner: 'Area Manager', action: 'Grow direct web orders and dine-in to cut commission exposure.' },
];

const allowed = (p, perms = []) => perms.every((x) => p.perms.has(x));

function status(def, value, target) {
  if (value == null || target == null || def.better === 'none') return 'none';
  if (def.absTol != null) return value >= target ? 'green' : value >= target - def.absTol ? 'amber' : 'red';
  const tol = def.tol ?? 0.05;
  if (def.better === 'up') return value >= target ? 'green' : value >= target * (1 - tol) ? 'amber' : 'red';
  return value <= target ? 'green' : value <= target * (1 + tol) ? 'amber' : 'red';
}
const kriStatus = (k, v) => (v == null ? 'none' : (k.worse === 'up' ? (v >= k.red ? 'red' : v >= k.amber ? 'amber' : 'green') : (v <= k.red ? 'red' : v <= k.amber ? 'amber' : 'green')));

// ---------- forecasting: Holt's linear trend on weekday-adjusted daily series ----------
/** y: [{ d: ms day start, v }] oldest→newest. Returns forecasts for the next h days with 80% intervals. */
export function forecast(y, h = 7, { alpha = 0.2, beta = 0.04 } = {}) {
  const v = y.map((r) => r.v);
  const n = v.length;
  if (n < 14) return null;
  // weekday indices: each day relative to the mean of its own (full) week, newest weeks first
  const ratios = Array.from({ length: 7 }, () => []);
  for (let end = n; end - 7 >= 0; end -= 7) {
    const wk = v.slice(end - 7, end), m = mean(wk);
    if (m > 0) wk.forEach((x, j) => ratios[new Date(y[end - 7 + j].d).getDay()].push(x / m));
  }
  let s = ratios.map((r) => (r.length ? mean(r) : 1));
  const sm = mean(s); s = s.map((x) => x / sm);
  const z = v.map((x, i) => x / s[new Date(y[i].d).getDay()]);
  let l = mean(z.slice(0, 7)), b = (mean(z.slice(7, 14)) - mean(z.slice(0, 7))) / 7;
  const rel = [];
  for (let i = 7; i < n; i++) {
    const fit = l + b;
    if (fit > 0) rel.push((z[i] - fit) / fit);
    const nl = alpha * z[i] + (1 - alpha) * (l + b);
    b = beta * (nl - l) + (1 - beta) * b; l = nl;
  }
  const sigma = Math.max(0.055, Math.sqrt(mean(rel.slice(-21).map((e) => e * e))) || 0.05);
  const last = y[n - 1].d;
  const out = [];
  for (let k = 1; k <= h; k++) {
    const d = midnight(last + k * DAY + 2 * HOUR), w = new Date(d).getDay();
    const f = Math.max(0, (l + k * b) * s[w]);
    const band = 1.2816 * sigma * Math.sqrt(1 + (k - 1) * 0.12) * f;
    out.push({ d, date: dkey(d), dow: w, value: f, low: Math.max(0, f - band), high: f + band });
  }
  return { points: out, sigma, trend_per_week: l ? (7 * b) / l : 0, seasonality: s, level: l };
}

function backtest(y, h = 7) {
  if (y.length < 14 + h) return null;
  const fc = forecast(y.slice(0, -h), h);
  if (!fc) return null;
  const actual = y.slice(-h);
  const ape = actual.map((a, i) => (a.v ? Math.abs(a.v - fc.points[i].value) / a.v : 0));
  const covered = actual.filter((a, i) => a.v >= fc.points[i].low && a.v <= fc.points[i].high).length;
  return { mape: mean(ape), coverage: covered / h, points: actual.map((a, i) => ({ date: a.date ?? dkey(a.d), actual: a.v, forecast: fc.points[i].value })) };
}

// ---------- the report ----------
export function report(p, { branch, period = 'today' } = {}) {
  const t = Date.now(), day = midnight(t);
  const B = scopeBranches(p, branch);
  if (!PERIODS[period]) period = 'today';
  const R = periodRange(period, t);
  const can = (perms) => allowed(p, perms);
  const outlets = db.prepare(`SELECT id, name, city, seats, daily_target FROM outlets WHERE id IN (${inList(B)}) ORDER BY id`).all(...B);

  // Closed days come from a cached daily rollup (computed once per day for every branch, like a nightly warehouse job);
  // only today is recomputed on each request. Plus the partial "same time last week" window for today.
  const winFrom = midnight(day - 28 * DAY + 2 * HOUR);
  const F = { ...closedDays(p, winFrom, day), ...dailyFacts(p, B, day, t, t) };
  const cur = (bs = B) => rollup(F, bs, R.from, R.to);
  const prevF = R.partial ? dailyFacts(p, B, R.prev[0], R.prev[1], R.prev[1]) : F;
  const prev = (bs = B) => rollup(prevF, bs, R.prev[0], R.prev[1]);
  const fc = cur(), fp = prev();

  // daily trend series for sparklines (last 14 full days + today)
  const trendDays = dayStarts(midnight(day - 14 * DAY + 2 * HOUR), t);
  const daily = trendDays.map((d) => ({ d, date: dkey(d), f: rollup(F, B, d, Math.min(d + DAY, t)) }));

  const kpis = K.filter((k) => can(k.perms)).map((k) => {
    const value = k.v(fc), prior = k.v(fp);
    const target = k.target ? k.target(fc) : null;
    return { id: k.id, group: k.group, label: k.label, unit: k.unit, better: k.better, def: k.def, value, prior, target,
      change: prior != null && value != null ? (k.unit === 'pctpt' ? value - prior : div(value - prior, Math.abs(prior))) : null,
      status: status(k, value, target), trend: daily.map((x) => ({ date: x.date, v: k.v(x.f) })) };
  });
  const kpiDef = Object.fromEntries(K.map((k) => [k.id, k]));

  const kriValue = (k, f, days) => (k.kpi ? kpiDef[k.kpi].v(f) : k.calc(f, days));
  const kriAllowed = (k) => can(k.kpi ? kpiDef[k.kpi].perms : k.perms);
  const perBranch = outlets.map((o) => ({ o, f: cur([o.id]), fp: prev([o.id]) }));
  const kris = KRI.filter(kriAllowed).map((k) => {
    const value = kriValue(k, fc, R.days), prior = kriValue(k, fp, R.days);
    const branches = perBranch.map(({ o, f }) => { const v = kriValue(k, f, R.days); return { id: o.id, name: o.name, value: v, status: kriStatus(k, v) }; });
    return { id: k.id, label: k.label, unit: k.unit || kpiDef[k.kpi]?.unit, value, prior, amber: k.amber, red: k.red, worse: k.worse, owner: k.owner, action: k.action,
      status: kriStatus(k, value), breaches: branches.filter((b) => b.status === 'red').map((b) => b.name), branches,
      trend: daily.map((x) => ({ date: x.date, v: kriValue(k, x.f, 1) })) };
  });
  // live risk indicators (current state, not period sums)
  if (p.perms.has('vision.view')) {
    const off = db.prepare(`SELECT COUNT(*) n FROM cameras WHERE outlet_id IN (${inList(B)}) AND status = 'offline'`).get(...B).n;
    kris.push({ id: 'kri_cameras', label: 'Cameras offline (now)', unit: 'num', value: off, amber: 1, red: 3, worse: 'up', owner: 'IT / Integrations', live: true,
      action: 'Check the edge box and network at the branch; monitoring is paused for that area.', status: kriStatus({ worse: 'up', amber: 1, red: 3 }, off), breaches: [], branches: [] });
  }
  if (p.perms.has('alerts.view')) {
    const open = db.prepare(`SELECT outlet_id, category, station, severity, ts FROM alerts WHERE ack = 0 AND severity = 'high' AND ts >= ? AND outlet_id IN (${inList(B)})`).all(t - DAY, ...B)
      .filter((a) => alertAllowed(p, a) && t - a.ts > 30 * MIN).length;
    kris.push({ id: 'kri_alerts', label: 'High alerts unresolved > 30 min (now)', unit: 'num', value: open, amber: 2, red: 5, worse: 'up', owner: 'Branch Manager', live: true,
      action: 'Assign an owner to each high alert; the Incident agent can draft the response.', status: kriStatus({ worse: 'up', amber: 2, red: 5 }, open), breaches: [], branches: [] });
  }

  // ---------- comparisons ----------
  const leagueKpis = ['net_sales', 'sales_vs_budget', 'aov', 'prime_pct', 'labour_pct', 'on_time', 'hygiene', 'haccp', 'punctuality', 'rating'].filter((id) => can(kpiDef[id].perms));
  const league = perBranch.map(({ o, f, fp: pf }) => {
    const row = { id: o.id, name: o.name, city: o.city, metrics: {}, change: null };
    let on = 0, scored = 0;
    for (const k of K.filter((x) => can(x.perms))) {
      const v = k.v(f), st = status(k, v, k.target ? k.target(f) : null);
      if (leagueKpis.includes(k.id)) row.metrics[k.id] = { value: v, status: st };
      if (st !== 'none') { scored++; if (st === 'green') on++; }
    }
    if (can(['sales.view'])) row.change = div(f.sales - pf.sales, pf.sales);
    row.on_target = on; row.scored = scored;
    row.red_kris = KRI.filter(kriAllowed).filter((k) => kriStatus(k, kriValue(k, f, R.days)) === 'red').length;
    return row;
  }).sort((a, b) => b.on_target / (b.scored || 1) - a.on_target / (a.scored || 1) || (b.metrics.net_sales?.value || 0) - (a.metrics.net_sales?.value || 0))
    .map((r, i) => ({ ...r, rank: i + 1 }));
  const groupAvg = {};
  for (const id of leagueKpis) groupAvg[id] = kpiDef[id].v(fc);

  const comparisons = { league, leagueKpis: leagueKpis.map((id) => ({ id, label: kpiDef[id].label, unit: kpiDef[id].unit, better: kpiDef[id].better })), groupAvg };

  if (can(['sales.view'])) {
    // current vs prior, day by day
    const curDays = dayStarts(R.from, R.to), prevDays = dayStarts(R.prev[0], R.prev[1]);
    comparisons.daily = curDays.map((d, i) => {
      const f = rollup(F, B, d, Math.min(d + DAY, t)), pd = prevDays[i];
      const pf = pd != null ? rollup(prevF, B, pd, Math.min(pd + DAY, R.prev[1])) : null;
      return { date: dkey(d), label: new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }), sales: f.sales, prior: pf?.sales ?? null, target: f.target };
    });
    if (R.partial) {
      // today: hour by hour vs same weekday last week
      const rows = (from, to) => Object.fromEntries(db.prepare(`SELECT CAST(strftime('%H', closed_at / 1000, 'unixepoch', 'localtime') AS INTEGER) h, SUM(total) v FROM orders
        WHERE outlet_id IN (${inList(B)}) AND closed_at >= ? AND closed_at < ? GROUP BY h`).all(...B, from, to).map((r) => [r.h, r.v]));
      const a = rows(day, t), bwk = rows(R.prev[0], R.prev[0] + DAY);
      comparisons.daily = Array.from({ length: 24 }, (_, h) => ({ label: `${String(h).padStart(2, '0')}:00`, sales: h <= new Date(t).getHours() ? a[h] || 0 : null, prior: bwk[h] || 0 }));
      comparisons.dailyIsHourly = true;
    }
    const mix = (from, to, BB = B) => db.prepare(`SELECT channel, SUM(total) sales, COUNT(*) orders FROM orders WHERE outlet_id IN (${inList(BB)}) AND closed_at >= ? AND closed_at < ? GROUP BY channel`).all(...BB, from, to);
    const cm = mix(R.from, R.to), pm = mix(R.prev[0], R.prev[1]);
    comparisons.channels = ['dine-in', 'takeaway', 'delivery', 'online'].map((c) => {
      const a = cm.find((x) => x.channel === c) || { sales: 0, orders: 0 }, b2 = pm.find((x) => x.channel === c) || { sales: 0, orders: 0 };
      return { channel: c, label: { 'dine-in': 'Dine-in', takeaway: 'Takeaway', delivery: 'Delivery apps', online: 'Own website' }[c], sales: a.sales, prior: b2.sales,
        share: div(a.sales, fc.sales), prior_share: div(b2.sales, fp.sales), change: div(a.sales - b2.sales, b2.sales) };
    });
    const parts = [['Breakfast', 6, 11], ['Lunch', 11, 15], ['Afternoon', 15, 18], ['Dinner', 18, 22], ['Late night', 22, 30]];
    const byHour = (from, to) => Object.fromEntries(db.prepare(`SELECT CAST(strftime('%H', closed_at / 1000, 'unixepoch', 'localtime') AS INTEGER) h, SUM(total) v, COUNT(*) n FROM orders
      WHERE outlet_id IN (${inList(B)}) AND closed_at >= ? AND closed_at < ? GROUP BY h`).all(...B, from, to).map((r) => [r.h, r]));
    const ch = byHour(R.from, R.to), ph = byHour(R.prev[0], R.prev[1]);
    const tot = (m, a, z) => { let v = 0, n = 0; for (let h = a; h < z; h++) { const r = m[h % 24]; if (r) { v += r.v; n += r.n; } } return { v, n }; };
    comparisons.dayparts = parts.map(([label, a, z]) => {
      const c = tot(ch, a, z), pr = tot(ph, a, z);
      return { label, hours: `${String(a % 24).padStart(2, '0')}–${String(z % 24).padStart(2, '0')}`, sales: c.v, orders: c.n, prior: pr.v, share: div(c.v, fc.sales), change: div(c.v - pr.v, pr.v), aov: div(c.v, c.n) };
    });
  }

  // ---------- menu engineering (Kasavana & Smith): popularity × contribution margin ----------
  let menu = null;
  if (can(['sales.view', 'finance.view'])) {
    const items = db.prepare(`SELECT m.id, m.name, m.category, m.price, m.cost, SUM(oi.qty) qty, SUM(oi.qty * oi.price) revenue FROM order_items oi JOIN menu_items m ON m.id = oi.item_id
      WHERE oi.outlet_id IN (${inList(B)}) AND oi.ts >= ? AND oi.ts < ? GROUP BY m.id`).all(...B, R.from, R.to);
    const totalQty = sum(items.map((i) => i.qty));
    const popThreshold = items.length ? (1 / items.length) * 0.7 : 0;
    const avgCm = totalQty ? sum(items.map((i) => (i.price - i.cost) * i.qty)) / totalQty : 0;
    menu = { popThreshold, avgCm, items: items.map((i) => {
      const mix = i.qty / (totalQty || 1), cm = i.price - i.cost;
      const cls = mix >= popThreshold ? (cm >= avgCm ? 'Star' : 'Plowhorse') : (cm >= avgCm ? 'Puzzle' : 'Dog');
      return { ...i, mix, cm, margin: cm * i.qty, food_pct: i.cost / i.price, class: cls };
    }).sort((a, b) => b.margin - a.margin) };
  }

  // ---------- forecasting ----------
  let fcast = null;
  if (can(['sales.view'])) {
    const hist = dayStarts(winFrom, day);
    const series = (bs, field = 'sales') => hist.map((d) => ({ d, date: dkey(d), v: rollup(F, bs, d, d + DAY)[field] }));
    const ys = series(B), yo = series(B, 'orders');
    const sf = forecast(ys, 8), of = forecast(yo, 8);
    if (sf) {
      const today = sf.points[0], next = sf.points.slice(1);
      const todayF = rollup(F, B, day, t);
      const share = cumShare(B, t);
      const remaining = today.value * (1 - share);
      const projection = todayF.sales + remaining;
      const phase = weekdayPhase();
      const targetDay = sum(outlets.map((o) => o.daily_target));
      const targetToday = targetDay * phase[new Date(t).getDay()];
      const sd = sf.sigma * today.value * Math.sqrt(1 - share) + 1;
      const prof = hourProfile(B, t);
      const nowH = new Date(t).getHours();
      const hourlyActual = Object.fromEntries(db.prepare(`SELECT CAST(strftime('%H', closed_at / 1000, 'unixepoch', 'localtime') AS INTEGER) h, SUM(total) v FROM orders
        WHERE outlet_id IN (${inList(B)}) AND closed_at >= ? GROUP BY h`).all(...B, day).map((r) => [r.h, r.v]));
      const foodPct = div(sum(hist.slice(-14).map((d) => rollup(F, B, d, d + DAY).food)), sum(hist.slice(-14).map((d) => rollup(F, B, d, d + DAY).sales))) || 0.3;
      const rostered = db.prepare(`SELECT SUM((shift_end - shift_start) / 60.0) h FROM staff WHERE outlet_id IN (${inList(B)})`).get(...B).h || 0;
      const bt = backtest(ys, 7);
      fcast = {
        method: "Holt's linear trend on weekday-adjusted daily sales (28-day window), 80% prediction interval from recent one-step errors",
        today: { actual: todayF.sales, projection, low: todayF.sales + Math.max(0, remaining - 1.2816 * sd), high: todayF.sales + remaining + 1.2816 * sd,
          target: targetToday, p_hit: phi((projection - targetToday) / sd), share_done: share,
          hourly: prof.map((s, h) => ({ label: `${String(h).padStart(2, '0')}:00`, actual: h <= nowH ? Math.round(hourlyActual[h] || 0) : null, forecast: Math.round(today.value * s) })) },
        days: next.map((pt, i) => {
          const orders = of?.points[i + 1]?.value ?? null;
          const needed = orders != null ? orders / TPPH_TARGET : null;
          return { ...pt, label: new Date(pt.d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }), target: targetDay * phase[pt.dow], orders,
            labour_needed: needed, labour_rostered: rostered, food_purchase: pt.value * foodPct };
        }),
        history: ys.slice(-14).map((r) => ({ date: r.date, label: new Date(r.d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), actual: r.v, target: rollup(F, B, r.d, r.d + DAY).target })),
        week_total: sum(next.map((x) => x.value)), week_low: sum(next.map((x) => x.low)), week_high: sum(next.map((x) => x.high)), week_target: sum(next.map((x) => targetDay * phase[x.dow])),
        trend_per_week: sf.trend_per_week, accuracy: bt, seasonality: sf.seasonality,
        branches: outlets.map((o) => {
          const bf = forecast(series([o.id]), 8);
          const wk = bf ? sum(bf.points.slice(1).map((x) => x.value)) : null;
          return { id: o.id, name: o.name, week: wk, target: o.daily_target * 7, gap: wk != null ? div(wk - o.daily_target * 7, o.daily_target * 7) : null, trend_per_week: bf?.trend_per_week ?? null };
        }),
      };
      const gapKri = { id: 'kri_forecast', label: 'Next-7-day forecast vs budget', unit: 'pctpt', value: div(fcast.week_total - fcast.week_target, fcast.week_target), amber: -0.03, red: -0.08, worse: 'down',
        owner: 'Area Manager', action: 'Plan promotions and staffing now for the branches forecast below budget.', forward: true, branches: fcast.branches.map((b) => ({ id: b.id, name: b.name, value: b.gap, status: kriStatus({ worse: 'down', amber: -0.03, red: -0.08 }, b.gap) })) };
      gapKri.status = kriStatus(gapKri, gapKri.value); gapKri.breaches = gapKri.branches.filter((b) => b.status === 'red').map((b) => b.name);
      kris.push(gapKri);
    }
  }

  // ---------- executive summary ----------
  const summary = [];
  const fmtPct = (x) => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(1)}%`;
  const money = fmtMoney;
  const k = Object.fromEntries(kpis.map((x) => [x.id, x]));
  if (k.net_sales) {
    const parts = [`Net sales ${money(k.net_sales.value)}`];
    if (k.net_sales.change != null) parts.push(`${fmtPct(k.net_sales.change)} vs ${R.prevLabel}`);
    if (k.sales_vs_budget?.value != null) parts.push(`${fmtPct(k.sales_vs_budget.value)} vs budget`);
    summary.push({ tone: k.sales_vs_budget?.status === 'red' ? 'bad' : k.sales_vs_budget?.status === 'green' ? 'good' : 'neutral', text: parts.join(' · ') + '.' });
  }
  if (k.prime_pct?.value != null) summary.push({ tone: k.prime_pct.status === 'green' ? 'good' : k.prime_pct.status === 'red' ? 'bad' : 'neutral',
    text: `Prime cost ${(k.prime_pct.value * 100).toFixed(1)}% (food ${(k.food_pct.value * 100).toFixed(1)}%, labour ${(k.labour_pct.value * 100).toFixed(1)}%) against a 60% target.` });
  if (league.length > 1 && k.sales_vs_budget) {
    const byBudget = [...league].filter((r) => r.metrics.sales_vs_budget?.value != null).sort((a, b) => b.metrics.sales_vs_budget.value - a.metrics.sales_vs_budget.value);
    if (byBudget.length > 1) {
      const top = byBudget[0], low = byBudget.at(-1);
      summary.push({ tone: 'neutral', text: `${top.name} leads at ${fmtPct(top.metrics.sales_vs_budget.value)} vs budget; ${low.name} trails at ${fmtPct(low.metrics.sales_vs_budget.value)}.` });
    }
  }
  const reds = kris.filter((x) => x.status === 'red');
  if (reds.length) summary.push({ tone: 'bad', text: `${reds.length} risk indicator${reds.length > 1 ? 's' : ''} in red: ${reds.slice(0, 4).map((x) => x.label.toLowerCase() + (x.breaches?.length && x.breaches.length < B.length ? ` (${x.breaches.join(', ')})` : '')).join('; ')}.` });
  else if (kris.length) summary.push({ tone: 'good', text: 'No risk indicators in red for this period.' });
  if (fcast) summary.push({ tone: fcast.week_target > 0 && fcast.week_total >= fcast.week_target ? 'good' : 'neutral',
    text: `Next 7 days forecast ${money(fcast.week_total)} (80% range ${money(fcast.week_low)}–${money(fcast.week_high)})${fcast.week_target > 0 ? `, ${fmtPct((fcast.week_total - fcast.week_target) / fcast.week_target)} vs budget` : ''}. ${R.partial ? `Today is projected to close at ${money(fcast.today.projection)}${fcast.today.target > 0 ? ` (${Math.round(fcast.today.p_hit * 100)}% chance of hitting budget)` : ''}.` : ''}`.trim() });
  if (!k.net_sales) {
    const ops = kpis.filter((x) => x.status !== 'none');
    const on = ops.filter((x) => x.status === 'green').length;
    summary.unshift({ tone: on === ops.length ? 'good' : 'neutral', text: `${on} of ${ops.length} operational KPIs on target for ${PERIODS[period].toLowerCase()}.` });
  }

  const onTarget = kpis.filter((x) => x.status === 'green').length, scored = kpis.filter((x) => x.status !== 'none').length;
  return {
    ts: t, period, periodLabel: PERIODS[period], prevLabel: R.prevLabel, from: R.from, to: R.to, prevFrom: R.prev[0], prevTo: R.prev[1],
    scope: outlets.map((o) => ({ id: o.id, name: o.name, city: o.city })), department: p.attrs.department || null,
    headline: { on_target: onTarget, scored, red_kris: reds.length, amber_kris: kris.filter((x) => x.status === 'amber').length },
    summary, kpis, kris, comparisons, menu, forecast: fcast,
  };
}

/** Compact numbers for the AI agents: scorecard + KRIs + forecast, already filtered by the caller's permissions. */
export function reportDigest(p, opts) {
  const r = report(p, opts);
  return {
    period: r.periodLabel, compared_with: r.prevLabel, branches: r.scope.map((b) => b.name),
    kpis: r.kpis.map(({ label, value, prior, target, status: s, change }) => ({ label, value, prior, target, status: s, change })),
    kris: r.kris.map(({ label, value, status: s, breaches, action }) => ({ label, value, status: s, breaches, action })),
    forecast: r.forecast && { next_7_days: Math.round(r.forecast.week_total), range: [Math.round(r.forecast.week_low), Math.round(r.forecast.week_high)], budget: Math.round(r.forecast.week_target),
      today_projection: Math.round(r.forecast.today.projection), chance_hit_budget_today: Math.round(r.forecast.today.p_hit * 100) / 100, backtest_mape: r.forecast.accuracy?.mape,
      by_branch: r.forecast.branches.map((b) => ({ branch: b.name, week: Math.round(b.week || 0), budget: b.target, gap: b.gap })) },
    summary: r.summary.map((s) => s.text),
  };
}
