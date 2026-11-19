// Restaurant-group simulator. It only talks to the canonical ingest layer, exactly like a real
// POS, delivery platform, KDS, attendance device, edge vision agent or IoT gateway would.
import { db, getSetting, setSetting, tx, midnight } from './db.js';
import { recordOrder, fireTicket, readyTicket, recordAttendance, ingestVision, sweepCameras, recordReading, recordReview, recordGuestVisit, sweepAbsences, VISION_CHECKS } from './ingest.js';
import { VirtualEdgeAgent, AGENT_VERSION } from './vision/edge-sim.js';
import { RULES } from './vision/rules.js';
import { INSTANCE as I } from './instance.js';
import { seedBackOffice, autoBumpPosTickets, eightySixSet } from './backoffice.js';

const MIN = 60_000, DAY = 86400_000, WEEK = 7 * DAY;
export const HISTORY_DAYS = 28; // 4 full weeks before today: enough for week-over-week, 14-day comparisons and weekday-seasonal forecasts
// Day-of-week demand (Sun..Sat): quiet Monday, busy Friday/Saturday/Sunday
const WEEKDAY = [1.1, 0.86, 0.9, 0.95, 1.0, 1.16, 1.2];
// Share of peak demand by local hour (late-night delivery keeps a floor)
const DEMAND = [0.35, 0.3, 0.28, 0.28, 0.28, 0.3, 0.36, 0.45, 0.55, 0.6, 0.62, 0.8, 1.0, 0.95, 0.72, 0.55, 0.55, 0.68, 0.88, 1.0, 0.94, 0.76, 0.56, 0.42];
const PROFILE = {
  // trend: sales growth per week · waste: food-cost multiplier (over-portioning, spoilage) · late: share of late clock-ins
  r1: { pace: 1.15, online: 1.0, slow: 0.07, discipline: 0.97, trend: 0.006, waste: 1.0, late: 0.1 },
  r2: { pace: 1.0, online: 0.9, slow: 0.06, discipline: 0.965, trend: 0.0, waste: 1.04, late: 0.12 },
  r3: { pace: 0.85, online: 0.7, slow: 0.05, discipline: 0.975, trend: -0.004, waste: 1.0, late: 0.08 },
  r4: { pace: 0.95, online: 1.1, slow: 0.16, discipline: 0.9, trend: -0.012, waste: 1.09, late: 0.22 },
  r5: { pace: 1.2, online: 1.5, slow: 0.1, discipline: 0.94, trend: 0.015, waste: 0.98, late: 0.14 },
  r6: { pace: 0.9, online: 1.0, slow: 0.06, discipline: 0.985, trend: 0.003, waste: 1.0, late: 0.06 },
};
const GLOBAL_REVIEWS = {
  5: ['Amazing food and super friendly staff!', 'Best truffle pasta in town. Will be back.', 'Quick service, great vibe, perfect pizza.', 'Loved the new risotto. Staff remembered our usual!'],
  4: ['Great food, a bit noisy at peak time.', 'Tasty burger, fries could be crispier.', 'Lovely evening, dessert took a while.'],
  3: ['Food was okay, service was slow tonight.', 'Delivery arrived lukewarm but tasted fine.'],
  2: ['Waited 40 minutes for mains. Not great.', 'Order was missing an item and support was slow.'],
};
const GLOBAL_AUTHORS = ['Alex P.', 'Sarah K.', 'Kenji O.', 'Ana M.', 'R. Gupta', 'James W.', 'Lina H.', 'Chen Y.', 'Fatima A.', 'Tom B.'];

const REVIEWS = I.reviews || GLOBAL_REVIEWS, AUTHORS = I.authors || GLOBAL_AUTHORS;
const rnd = (a, b) => a + Math.random() * (b - a);
const chance = (p) => Math.random() < p;
const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
const poisson = (lambda) => { let n = 0, p = Math.exp(-lambda), s = p; const u = Math.random(); while (u > s && n < 50) { n++; p *= lambda / n; s += p; } return n; };

// ---------- cached reference data ----------
let REF = null;
export const invalidateRef = () => { REF = null; };
// Behaviour per outlet: the six demo branches have hand-tuned profiles; any other outlet (created in onboarding) gets one
// derived from its seats and type, so the simulator works for any tenant shape.
function profileFor(o, i = 0) {
  if (PROFILE[o.id]) return PROFILE[o.id];
  const seats = Number(o.seats) || 0, h = (k) => ((Math.sin((i + 1) * 9301 + k * 49297) + 1) / 2);
  return (PROFILE[o.id] = { pace: Math.max(0.35, Math.min(2.2, (seats || 50) / 85)) * (0.85 + h(1) * 0.3), online: seats ? 0.8 + h(2) * 0.6 : 3, dine: seats ? 1 : 0, slow: 0.05 + h(3) * 0.08, discipline: 0.92 + h(4) * 0.065, trend: (h(5) - 0.45) * 0.02, waste: 0.97 + h(6) * 0.1, late: 0.06 + h(7) * 0.12 });
}
function ref() {
  if (REF) return REF;
  const menu = db.prepare('SELECT * FROM menu_items').all();
  const byCat = {};
  for (const m of menu) (byCat[m.category] ??= []).push(m);
  REF = {
    branches: db.prepare('SELECT * FROM outlets ORDER BY id').all().map((b) => ({ ...b, platforms: JSON.parse(b.platforms) })),
    menu, byCat, byId: Object.fromEntries(menu.map((m) => [m.id, m])),
    cameras: db.prepare('SELECT * FROM cameras').all(), sensors: db.prepare('SELECT * FROM sensors').all(),
    staff: db.prepare('SELECT * FROM staff').all(),
    guests: db.prepare('SELECT id, home_outlet, favorites, allergies, consent_face FROM guests ORDER BY id').all()
      .map((g) => ({ ...g, favorites: g.favorites.split(',').filter(Boolean), allergies: g.allergies.split(',').filter(Boolean) })),
  };
  return REF;
}

function pickGuest(outletId) {
  const r = ref();
  const local = r.guests.filter((g) => g.home_outlet === outletId);
  const pool = chance(0.8) ? local : r.guests;
  return pool[Math.floor(pool.length * Math.random() ** 1.4)]; // skewed: a few loyal regulars visit often
}

let off86 = new Set(), off86At = 0;
function chooseItems(covers, guest, { dessert = true, outlet = null } = {}) {
  const { byCat, byId } = ref();
  if (Date.now() - off86At > 10_000) { off86 = eightySixSet(); off86At = Date.now(); }
  const safe = (m) => !guest || !guest.allergies.some((a) => m.tags.includes(a) || (a === 'seafood' && m.tags.includes('fish')));
  const choose = (cats) => {
    if (guest && chance(0.55)) {
      const fav = guest.favorites.map((id) => byId[id]).filter((m) => m && cats.includes(m.category));
      if (fav.length) return pickOne(fav);
    }
    const opts = cats.flatMap((c) => byCat[c] || []).filter(safe).filter((m) => !m.is_new || chance(0.35)).filter((m) => !outlet || !off86.has(`${outlet}:${m.id}`));
    return pickOne(opts.length ? opts : byCat[cats[0]]?.length ? byCat[cats[0]] : ref().menu);
  };
  const items = [];
  const add = (m) => { const ex = items.find((i) => i.item_id === m.id); ex ? ex.qty++ : items.push({ item_id: m.id, qty: 1, price: m.price }); };
  for (let c = 0; c < covers; c++) {
    add(choose(chance(0.3) ? [I.altMain] : ['Mains', I.altMain]));
    if (chance(0.75)) add(choose(['Drinks']));
  }
  for (let c = 0; c < Math.ceil(covers / 2); c++) {
    if (chance(0.6)) add(choose(['Starters']));
    if (chance(0.35)) add(choose(['Sides']));
    if (dessert && chance(0.4)) add(choose(['Desserts']));
  }
  return items;
}

// ---------- live state ----------
const tables = new Map();   // outlet -> [{...}]
const pending = [];         // tickets in progress: { id, readyAt }
const arrivals = new Map(); // staff_id -> planned arrival
const clocked = new Set();  // staff_id:day already handled
let absentees = new Set();
let excursions = new Map(), lastReading = new Map();
let tableSeq = 1, timer = null, lastSensor = 0, lastSweep = 0;
const edgeAgents = new Map();
const zoneAt = new Map();

function fireAll(o, items, { t, order_id = null, table_no = null, channel, opts, offsetFor = () => 0 }) {
  const { byId } = ref();
  const p = profileFor(o);
  const scheduled = [];
  for (const it of items) {
    const m = byId[it.item_id];
    for (let q = 0; q < it.qty; q++) {
      const fireAt = t + offsetFor(m) * MIN;
      const slow = chance(p.slow);
      const dur = m.prep_sec * (slow ? rnd(1.6, 2.4) : Math.max(0.5, 0.85 + gauss() * 0.2));
      scheduled.push({ outlet_id: o.id, order_id, item_id: m.id, table_no, channel, fireAt, dur });
    }
  }
  return scheduled;
}

function processTicketQueue(t, opts, queue) {
  for (let i = queue.length - 1; i >= 0; i--) {
    const q = queue[i];
    if (!q.id && t >= q.fireAt) {
      const tk = fireTicket({ outlet_id: q.outlet_id, order_id: q.order_id, item_id: q.item_id, table_no: q.table_no, channel: q.channel, fired_at: Math.round(q.fireAt) }, opts);
      q.id = tk.id; q.readyAt = Math.round(q.fireAt + q.dur * 1000);
    }
    if (q.id && t >= q.readyAt) { readyTicket(q.id, q.readyAt, opts); queue.splice(i, 1); }
  }
}

function step(t, dt, { quiet = false, detail = true, light = false } = {}) {
  const opts = { quiet };
  const perMin = dt / MIN;
  const r = ref();
  const hour = new Date(t).getHours();
  const baseDemand = DEMAND[hour] + (DEMAND[(hour + 1) % 24] - DEMAND[hour]) * (new Date(t).getMinutes() / 60);

  const wk = WEEKDAY[new Date(t).getDay()];
  for (const [oi, o] of r.branches.entries()) {
    const p = profileFor(o, oi);
    const platforms = o.platforms;
    const demand = baseDemand * wk * (1 + p.trend * (t - midnight()) / WEEK);
    const cost = (items) => Math.round(items.reduce((a, i) => a + i.qty * r.byId[i.item_id].cost, 0) * p.waste * 100) / 100;

    // Online & takeaway: paid at order time
    for (let n = poisson(0.12 * p.pace * p.online * demand * perMin); n > 0; n--) {
      const known = chance(0.18) ? pickGuest(o.id) : null;
      const platform = chance(0.25) ? 'Website' : pickOne(platforms.filter((x) => x !== 'Website'));
      const items = chooseItems(chance(0.6) ? 1 : 2, known, { dessert: true, outlet: o.id });
      const ord = recordOrder({ outlet_id: o.id, source: 'simulator', channel: platform === 'Website' ? 'online' : 'delivery', platform, payment: 'prepaid',
        guest_id: known?.id, covers: 1, items, food_cost: cost(items), closed_at: t, opened_at: t }, opts);
      if (light) historyTickets(o, items, t, ord); else pending.push(...fireAll(o, items, { t, order_id: ord.id, channel: ord.channel, opts }));
    }
    for (let n = poisson(0.05 * p.pace * demand * perMin); n > 0; n--) {
      const items = chooseItems(1, null, { dessert: false, outlet: o.id });
      const ord = recordOrder({ outlet_id: o.id, source: 'simulator', channel: 'takeaway', platform: 'POS', payment: pickOne(I.takeawayPayments),
        covers: 1, items, food_cost: cost(items), closed_at: t, opened_at: t }, opts);
      if (light) historyTickets(o, items, t, ord); else pending.push(...fireAll(o, items, { t, order_id: ord.id, channel: 'takeaway', opts }));
    }

    // Dine-in: seat → order → courses → pay
    for (let n = poisson(0.16 * p.pace * (p.dine ?? 1) * demand * perMin); n > 0; n--) {
      const covers = pickOne([1, 2, 2, 2, 3, 4, 4, 5, 6]);
      const guest = chance(0.18) ? pickGuest(o.id) : null;
      const items = chooseItems(covers, guest, { outlet: o.id });
      const payment = pickOne(I.payments);
      if (light) {
        const ord = recordOrder({ outlet_id: o.id, source: 'simulator', channel: 'dine-in', platform: 'POS', payment, guest_id: guest?.id, covers, items, food_cost: cost(items),
          table_no: `T${(tableSeq++ % 30) + 1}`, opened_at: t - 55 * MIN, closed_at: t }, opts);
        historyTickets(o, items, t - 48 * MIN, ord);
        continue;
      }
      const tb = { no: `T${(tableSeq++ % 30) + 1}`, covers, guest, items, payment, seated: t, orderAt: t + rnd(4, 7) * MIN, closeAt: t + rnd(50, 75) * MIN, ordered: false };
      (tables.get(o.id) ?? tables.set(o.id, []).get(o.id)).push(tb);
      if (guest) {
        const method = guest.consent_face && chance(0.7) ? 'face' : pickOne(['loyalty-qr', 'phone', 'reservation']);
        recordGuestVisit({ outlet_id: o.id, guest_id: guest.id, method, confidence: method === 'face' ? rnd(0.91, 0.99) : 1, table_no: tb.no, covers, ts: t }, opts);
      }
    }
    if (!light) {
      const list = tables.get(o.id) || [];
      for (let i = list.length - 1; i >= 0; i--) {
        const tb = list[i];
        if (!tb.ordered && t >= tb.orderAt) {
          tb.ordered = true;
          pending.push(...fireAll(o, tb.items, { t, table_no: tb.no, channel: 'dine-in', opts,
            offsetFor: (m) => (m.category === 'Desserts' ? rnd(32, 42) : ['Mains', I.altMain].includes(m.category) ? rnd(9, 15) : 0) }));
        }
        if (t >= tb.closeAt) {
          recordOrder({ outlet_id: o.id, source: 'simulator', channel: 'dine-in', platform: 'POS', payment: tb.payment, guest_id: tb.guest?.id,
            covers: tb.covers, items: tb.items, food_cost: cost(tb.items), table_no: tb.no, opened_at: tb.seated, closed_at: t }, opts);
          list.splice(i, 1);
        }
      }
    }

    if (light) { historyOps(o, p, t, dt, demand); continue; }

    // Staff clock-ins as shifts come due
    const day = midnight(t);
    for (const s of r.staff) {
      if (s.outlet_id !== o.id || absentees.has(s.id)) continue;
      const due = day + s.shift_start * MIN, end = day + s.shift_end * MIN;
      if (t < due - 12 * MIN || t > end) continue;
      if (!arrivals.has(s.id)) arrivals.set(s.id, due + (chance(p.late) ? rnd(11, 35) : rnd(-12, 4)) * MIN);
      const key = s.id + ':' + day;
      if (clocked.has(key) || t < arrivals.get(s.id)) continue;
      clocked.add(key);
      if (!db.prepare('SELECT 1 FROM attendance WHERE staff_id = ? AND ts_in >= ?').get(s.id, day)) {
        recordAttendance({ staff_id: s.id, ts: Math.round(arrivals.get(s.id)), method: pickOne(['face', 'face', 'face', 'mobile-geo', 'biometric']) }, opts);
      }
    }
    for (const a of db.prepare(`SELECT a.staff_id, s.shift_end FROM attendance a JOIN staff s ON s.id = a.staff_id WHERE a.outlet_id = ? AND a.ts_out IS NULL`).all(o.id)) {
      if (t > day + a.shift_end * MIN + 5 * MIN) recordAttendance({ staff_id: a.staff_id, action: 'out', ts: t }, opts);
    }

    if (!detail) continue;
    // Cameras: one virtual edge agent per branch runs the real pipeline (scene -> detector/tracker output ->
    // shared rules.json -> batched events + heartbeats) and posts through the same contract as edge-agent/agent.py
    if (!edgeAgents.has(o.id)) edgeAgents.set(o.id, new VirtualEdgeAgent(o.id, r.cameras.filter((c) => c.outlet_id === o.id), { discipline: p.discipline }));
    ingestVision(edgeAgents.get(o.id).run(t - dt, t, { demand: Math.min(1.2, demand), frameMs: dt >= MIN ? 1000 : 1000 / RULES.fps }), { ...opts, source: AGENT_VERSION });
    if (t - (zoneAt.get(o.id) || 0) >= 5 * MIN) { zoneAt.set(o.id, t); zoneMetrics(o, p, t, demand, (e) => ingestVision([{ ...e, duration_s: e.duration_s ?? null }], { ...opts, source: AGENT_VERSION })); }
    if (chance(0.06 * demand * perMin)) {
      const x = Math.random();
      const rating = x < 0.6 ? 5 : x < 0.85 ? 4 : x < 0.95 ? 3 : 2;
      const adj = o.id === 'r4' && chance(0.3) ? Math.max(2, rating - 1) : rating;
      recordReview({ outlet_id: o.id, platform: pickOne([...I.reviewPlatforms, ...platforms.filter((x) => x !== 'Website')]), rating: adj, author: pickOne(AUTHORS), text: pickOne(REVIEWS[adj]), ts: t }, opts);
    }
  }

  if (!light) { processTicketQueue(t, opts, pending); autoBumpPosTickets(t); }

  if (detail && t - lastSensor >= MIN) {
    lastSensor = t;
    for (const s of r.sensors) {
      let v = (lastReading.get(s.id) ?? s.base) * 0.7 + s.base * 0.3 + gauss() * (s.max - s.min) * 0.04;
      if (!excursions.has(s.id) && chance(s.kind === 'temperature' ? 0.002 : 0.001)) excursions.set(s.id, Math.round(rnd(4, 8)));
      if (excursions.has(s.id)) {
        const left = excursions.get(s.id);
        v = s.max + (s.max - s.min) * rnd(0.15, 0.6);
        left <= 1 ? excursions.delete(s.id) : excursions.set(s.id, left - 1);
      }
      lastReading.set(s.id, excursions.has(s.id) ? s.base : v);
      recordReading({ sensor_id: s.id, value: Math.round(v * 10) / 10, ts: t }, opts);
    }
  }
  if (!light && t - lastSweep >= 5 * MIN) { lastSweep = t; sweepAbsences(t, quiet); sweepCameras(t, quiet); }
}

// ---------- zone & time metrics (queue, pass, walk-in door, counter) ----------
// These are the presence-and-time measurements CCTV does reliably. In the demo they are generated per outlet every
// 5 minutes from demand and the outlet's discipline; a real edge agent posts the same event types.
function zoneMetrics(o, p, t, demand, write) {
  const cams = ref().cameras.filter((c) => c.outlet_id === o.id), cam = (id) => cams.find((c) => c.id.endsWith(id));
  const busy = Math.min(1.4, demand), slack = 1 - p.discipline;
  const entrance = cam('-entrance'), pass = cam('-pass'), store = cam('-store'), dining = cam('-dining');
  if (entrance && (p.dine ?? 1)) {
    const L = Math.max(0, Math.round(busy * 3 + gauss() * 1.5)), wait = Math.round(L * rnd(35, 70) * (1 + slack * 4));
    write({ outlet_id: o.id, camera_id: entrance.id, type: 'queue', ok: wait <= 300, people: L, duration_s: wait, zone: 'entrance', ts: t });
    write({ outlet_id: o.id, camera_id: entrance.id, type: 'counter', ok: !chance(0.02 + slack * 0.6 * busy), people: L, zone: 'entrance', ts: t });
  }
  if (pass) { const dwell = Math.round(rnd(25, 80) * (1 + busy * 0.5) * (1 + slack * 5)); write({ outlet_id: o.id, camera_id: pass.id, type: 'pass', ok: dwell <= 120, people: Math.round(busy * 3), duration_s: dwell, zone: 'pass', ts: t }); }
  if (store && chance(0.5)) { const open = Math.round(rnd(8, 60) * (chance(slack * 1.5) ? 6 : 1)); write({ outlet_id: o.id, camera_id: store.id, type: 'door', ok: open <= 180, people: 1, duration_s: open, zone: 'storage', ts: t }); }
  if (dining) write({ outlet_id: o.id, camera_id: dining.id, type: 'person', ok: true, people: Math.max(0, Math.round(busy * (Number(o.seats) || 60) * 0.35 + gauss() * 3)), zone: 'front', ts: t });
}

// ---------- history backfill (light mode) ----------
// Older days are generated at 5-minute resolution straight into the fact tables, so reports, comparisons and
// forecasts read one code path. Kitchen tickets, shifts, sensor readings and camera checks are written in bulk
// (no live events, no alerts); today and the last 3 hours still run the full real-time pipeline.
let hist = null;
const HIST_W = { station: 0.7, hairnet: 1, gloves: 1, apron: 0.6, phone: 0.8, handwash: 2.2, spill: 0.5, access: 0.2, label: 0.4, greeted: 1.2, guest: 1.7 };
function histStatements() {
  return hist ??= {
    ticket: db.prepare('INSERT INTO tickets(outlet_id, order_id, item_id, item, station, table_no, channel, target_sec, fired_at, ready_at) VALUES (?,?,?,?,?,?,?,?,?,?)'),
    shift: db.prepare('INSERT INTO attendance(staff_id, outlet_id, ts_in, ts_out, method, late_min) VALUES (?,?,?,?,?,?)'),
    reading: db.prepare('INSERT INTO readings(sensor_id, value, ts) VALUES (?,?,?)'),
    vision: db.prepare('INSERT INTO vision_events(outlet_id, camera_id, type, ok, severity, label, confidence, people, ts, zone, source) VALUES (?,?,?,?,?,?,?,?,?,?,?)'),
    days: new Set(), sensorAt: new Map(), visionAt: new Map(), dayNoise: new Map(), zoneAt: new Map(),
  };
}
function historyTickets(o, items, t, ord) {
  const h = histStatements(), { byId } = ref();
  for (const q of fireAll(o, items, { t, channel: ord.channel })) {
    const m = byId[q.item_id];
    h.ticket.run(o.id, ord.id, m.id, m.name, m.station, ord.table_no, ord.channel, m.prep_sec, Math.round(q.fireAt), Math.round(q.fireAt + q.dur * 1000));
  }
}
function historyOps(o, p, t, dt, demand) {
  const h = histStatements(), r = ref(), day = midnight(t);
  // a day's worth of shifts the first time we touch the day
  if (!h.days.has(o.id + day)) {
    h.days.add(o.id + day);
    h.dayNoise.set(o.id + day, gauss() * 0.012);
    for (const s of r.staff.filter((x) => x.outlet_id === o.id)) {
      if (!['Branch Manager', 'Head Chef'].includes(s.role) && chance(0.045 + (1 - p.discipline) * 0.2)) continue; // absent
      const due = day + s.shift_start * MIN, end = day + s.shift_end * MIN;
      const late = chance(p.late) ? Math.round(rnd(11, 35)) : 0;
      const tin = due + (late ? late : rnd(-12, 4)) * MIN;
      h.shift.run(s.id, o.id, Math.round(tin), Math.round(end + rnd(0, 12) * MIN), pickOne(['face', 'face', 'face', 'mobile-geo', 'biometric']), Math.max(0, late));
    }
  }
  // fridge/freezer readings every 15 minutes, with occasional excursions (more where discipline is weaker)
  if (t - (h.sensorAt.get(o.id) || 0) >= 15 * MIN) {
    h.sensorAt.set(o.id, t);
    for (const s of r.sensors.filter((x) => x.outlet_id === o.id)) {
      const key = 'x' + s.id;
      let left = h.sensorAt.get(key) || 0;
      if (!left && chance(0.0015 + (1 - p.discipline) * 0.02)) left = Math.round(rnd(1, 4));
      const v = left ? s.max + (s.max - s.min) * rnd(0.1, 0.5) : s.base + gauss() * (s.max - s.min) * 0.06;
      h.sensorAt.set(key, Math.max(0, left - 1));
      h.reading.run(s.id, Math.round(v * 10) / 10, t);
    }
  }
  // camera compliance checks: two observations per check per camera every 30 minutes
  if (t - (h.visionAt.get(o.id) || 0) >= 30 * MIN) {
    h.visionAt.set(o.id, t);
    const busy = Math.min(1.3, demand);
    const zones = RULES.zones;
    for (const c of r.cameras.filter((x) => x.outlet_id === o.id)) {
      for (const type of zones[c.zone]?.checks || []) {
        if (type === 'person') continue;
        if (type === 'access' && new Date(t).getHours() >= 7 && new Date(t).getHours() < 23) continue;
        for (let k = 0; k < 2; k++) {
          if (!HIST_W[type]) break;
          const miss = (1 - p.discipline) * HIST_W[type] * (0.75 + busy * 0.35) + (h.dayNoise.get(o.id + day) || 0);
          const ok = chance(1 - Math.max(0.003, miss)) ? 1 : 0;
          const chk = VISION_CHECKS[type];
          h.vision.run(o.id, c.id, type, ok, ok ? 'none' : chk.severity, ok ? chk.label : chk.bad, Math.round(rnd(0.7, 0.97) * 100) / 100,
            Math.max(0, Math.round(busy * 4 + gauss() * 2)), Math.round(t + rnd(0, 29) * MIN), c.zone, 'history-backfill');
        }
      }
    }
  }
  if (t - (h.zoneAt.get(o.id) || 0) >= 15 * MIN) {
    h.zoneAt.set(o.id, t);
    zoneMetrics(o, p, t, demand, (e) => h.vision.run(e.outlet_id, e.camera_id, e.type, e.ok ? 1 : 0, e.ok ? 'none' : VISION_CHECKS[e.type].severity, e.ok ? VISION_CHECKS[e.type].label : VISION_CHECKS[e.type].bad, 0.9, e.people, e.ts, e.zone, 'history-backfill'));
  }
  // online reviews arrive with traffic
  if (chance(Math.min(0.9, 0.06 * demand * (dt / MIN)))) {
    const x = Math.random();
    const rating = x < 0.6 ? 5 : x < 0.85 ? 4 : x < 0.95 ? 3 : 2;
    const adj = o.id === 'r4' && chance(0.3) ? Math.max(2, rating - 1) : rating;
    recordReview({ outlet_id: o.id, platform: pickOne([...I.reviewPlatforms, ...o.platforms.filter((y) => y !== 'Website')]), rating: adj, author: pickOne(AUTHORS), text: pickOne(REVIEWS[adj]), ts: t }, { quiet: true });
  }
}

// Fresh demo: 4 weeks of history + today since midnight (full detail for the last 3 hours)
export function resetDemo() {
  const t = Date.now();
  const today = midnight(t);
  tables.clear(); pending.length = 0; hist = null; REF = null; arrivals.clear(); clocked.clear(); excursions = new Map(); lastReading = new Map(); lastSensor = 0; lastSweep = 0; edgeAgents.clear();
  console.log('[sim] building demo history…');
  tx(() => {
    for (const tbl of ['orders', 'order_items', 'tickets', 'attendance', 'vision_events', 'readings', 'reviews', 'alerts', 'guest_visits']) db.exec(`DELETE FROM ${tbl}`);
    db.exec("UPDATE cameras SET last_seen = NULL, status = 'online'");
    setSetting('day_start', today);
    absentees = new Set(ref().staff.filter((s) => !['Branch Manager', 'Head Chef'].includes(s.role) && chance(0.06)).map((s) => s.id));
    setSetting('absentees', [...absentees]);
    // A slice of lapsed guests with one old visit, so "welcome back" suggestions appear
    for (const g of ref().guests.filter(() => chance(0.12))) {
      recordOrder({ outlet_id: g.home_outlet, source: 'simulator', channel: 'dine-in', platform: 'POS', guest_id: g.id, covers: 2,
        items: chooseItems(2, g), closed_at: t - rnd(35, 80) * DAY }, { quiet: true });
    }
    const coarse = 5 * MIN;
    for (let ts = today - HISTORY_DAYS * DAY; ts < today; ts += coarse) step(ts, coarse, { quiet: true, light: true });
    for (let ts = today; ts < t; ts += MIN) step(ts, MIN, { quiet: true, detail: t - ts < 3 * 3600_000 });
    db.prepare('UPDATE alerts SET ack = 1, ack_by = ? WHERE ts < ?').run('system', t - 90 * MIN);
  });
  seedBackOffice(t);
  console.log('[sim] ready');
}

export function startSimulator() {
  if (!db.prepare('SELECT COUNT(*) n FROM outlets').get().n) return; // fresh workspace: nothing to simulate until onboarding is done
  absentees = new Set(getSetting('absentees', []));
  const dayStart = getSetting('day_start', 0);
  const lastActivity = db.prepare('SELECT MAX(fired_at) t FROM tickets').get().t || 0;
  if (dayStart !== midnight() || Date.now() - lastActivity > 15 * MIN) resetDemo();
  else if (!db.prepare('SELECT COUNT(*) n FROM ingredients').get().n) seedBackOffice();
  else db.prepare('UPDATE tickets SET ready_at = fired_at + target_sec * 1000 WHERE ready_at IS NULL').run(); // close tickets left mid-cook by a restart
  if (getSetting('simulator', { running: true }).running) resume();
}

export function resume() {
  if (timer) return;
  let last = Date.now();
  timer = setInterval(() => {
    const t = Date.now();
    try { step(t, t - last); } catch (e) { console.error('[sim]', e.message); }
    last = t;
  }, 2000);
  setSetting('simulator', { running: true });
}

export function pause() { clearInterval(timer); timer = null; setSetting('simulator', { running: false }); }
export const simulatorStatus = () => ({ running: !!timer, dayStart: getSetting('day_start', null) });
