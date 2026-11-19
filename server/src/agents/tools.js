// Agent tool registry. Every tool wraps the same read functions the dashboard uses and runs with the
// caller's principal, so agents inherit RBAC + ABAC exactly: a Line Cook's agent can only see Grill
// tickets, a Host's agent sees masked phones, and nobody's agent can read a branch outside their scope.
import { db, midnight, inList } from '../db.js';
import * as M from '../metrics.js';
import { alertAllowed } from '../policy.js';
import { searchPlaybook } from './knowledge.js';
import { reportDigest } from '../reports.js';

const HOUR = 3600_000, DAY = 86400_000;
const r0 = (v) => (v == null ? null : Math.round(v));
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100);
const pctv = (v) => (v == null ? null : Math.round(v * 1000) / 10); // 0.873 -> 87.3
const hhmm = (ts) => (ts ? new Date(ts).toTimeString().slice(0, 5) : null);
const minsAgo = (ts) => (ts ? Math.round((Date.now() - ts) / 60_000) : null);

/** Accepts r3, "Restaurant 3", "3", "London"… and returns an outlet id (or undefined for "all"). */
export function resolveBranch(input) {
  if (!input || /^all\b/i.test(String(input))) return undefined;
  const s = String(input).trim().toLowerCase();
  const rows = db.prepare('SELECT id, name, city, location FROM outlets').all();
  const hit = rows.find((o) => o.id === s || o.name.toLowerCase() === s || o.city.toLowerCase() === s || (o.location || '').toLowerCase() === s)
    || rows.find((o) => s.replace(/\D/g, '') && o.id === `r${s.replace(/\D/g, '')}`)
    || rows.find((o) => s.includes(o.city.toLowerCase()) || s.includes(o.name.toLowerCase()));
  if (!hit) { const e = new Error(`Unknown branch "${input}". Use r1-r6, "Restaurant N" or a city.`); e.status = 400; throw e; }
  return hit.id;
}
const branchName = (id) => db.prepare('SELECT name, city FROM outlets WHERE id = ?').get(id);
const label = (id) => { const b = branchName(id); return b ? `${b.name} (${b.city})` : id; };

const BRANCH = { type: 'string', description: 'Optional branch: r1-r6, "Restaurant N" or a city. Omit for every branch the user can see.' };
const obj = (props = {}, required = []) => ({ type: 'object', properties: props, required, additionalProperties: false });

export const TOOLS = [
  // ---------- Revenue ----------
  {
    name: 'sales_overview', perm: 'sales.view',
    description: 'Today\'s sales so far vs the same time yesterday: revenue, orders, covers, average order value, online vs in-store split, sales by channel/platform, and a per-branch league table when several branches are in scope.',
    input_schema: obj({ branch: BRANCH }),
    run(p, { branch }) {
      const d = M.dashboard(p, resolveBranch(branch));
      const s = d.sales.today, y = d.sales.yesterday;
      return {
        scope: d.branches.map((b) => b.name), time: hhmm(Date.now()),
        today: { sales: r0(s.sales), orders: s.orders, covers: s.covers, aov: r2(s.orders ? s.sales / s.orders : 0), online_sales: r0(s.online), online_share_pct: pctv(s.sales ? s.online / s.sales : 0) },
        same_time_yesterday: { sales: r0(y.sales), orders: y.orders },
        change_vs_yesterday_pct: pctv(y.sales ? (s.sales - y.sales) / y.sales : null),
        channels: d.sources.map((c) => ({ source: c.src, kind: c.kind, sales: r0(c.sales), orders: c.orders })),
        payments: d.payments.map((x) => ({ method: x.payment, sales: r0(x.sales) })),
        branches: d.board?.map((b) => ({ id: b.id, name: b.name, city: b.city, sales: r0(b.sales), yesterday: r0(b.yesterday), orders: b.orders, aov: r2(b.aov), online_share_pct: pctv(b.online_share) })),
      };
    },
  },
  {
    name: 'sales_trend', perm: 'sales.view',
    description: 'Seven-day daily revenue (online vs in-store) plus today\'s hour-by-hour sales against yesterday, for spotting trends, peaks and slow hours.',
    input_schema: obj({ branch: BRANCH }),
    run(p, { branch }) {
      const d = M.dashboard(p, resolveBranch(branch));
      return {
        scope: d.branches.map((b) => b.name),
        last_7_days: d.week.map((w) => ({ date: w.d, total: r0(w.total), online: r0(w.online), in_store: r0(w.offline), orders: w.orders })),
        today_by_hour: d.hourly.filter((h) => h.today != null && (h.today || h.yesterday)).map((h) => ({ hour: h.label, today: h.today, yesterday: h.yesterday, orders: h.orders })),
      };
    },
  },
  {
    name: 'menu_performance', perm: 'sales.view',
    description: 'Best-selling dishes today by revenue and quantity, sales by menu category, and which new dishes are selling.',
    input_schema: obj({ branch: BRANCH }),
    run(p, { branch }) {
      const d = M.dashboard(p, resolveBranch(branch));
      return {
        top_dishes: d.topItems.map((i) => ({ dish: i.name, category: i.category, is_new: !!i.is_new, qty: i.qty, sales: r0(i.sales) })),
        categories: d.categories.map((c) => ({ category: c.category, sales: r0(c.sales) })),
      };
    },
  },
  {
    name: 'prime_cost', perm: 'finance.view',
    description: 'Today\'s food cost %, labour cost % and prime cost % (food + labour as a share of sales), with labour cost in dollars. Healthy prime cost for fine dining is roughly 60-65%.',
    input_schema: obj({ branch: BRANCH }),
    run(p, { branch }) {
      const B = resolveBranch(branch);
      const ids = B ? [B] : p.branches;
      const rows = ids.map((id) => {
        const f = M.dashboard(p, id).finance;
        return { branch: label(id), food_pct: pctv(f.food_pct), labour_pct: pctv(f.labor_pct), prime_pct: pctv(f.prime_pct), labour_cost: r0(f.labor), food_cost: r0(f.food) };
      });
      const all = M.dashboard(p, B).finance;
      return { overall: { food_pct: pctv(all.food_pct), labour_pct: pctv(all.labor_pct), prime_pct: pctv(all.prime_pct), labour_cost: r0(all.labor) }, by_branch: ids.length > 1 ? rows : undefined };
    },
  },

  // ---------- Kitchen ----------
  {
    name: 'kitchen_status', perm: 'kitchen.view',
    description: 'Live kitchen: open tickets, oldest waiting ticket, speed of service and on-time rate per station over the last hour, and the dishes running furthest over their target time today.',
    input_schema: obj({ branch: BRANCH }),
    run(p, { branch }) {
      const k = M.kitchen(p, resolveBranch(branch));
      const oldest = k.open[0];
      return {
        station_filter: k.station || 'all stations',
        last_hour: { tickets_done: k.kpi.done_last_hour, avg_ticket_min: r1(k.kpi.avg_sec / 60), on_time_pct: pctv(k.kpi.on_time) },
        open_tickets: k.open.length, tickets_today: k.today,
        oldest_open: oldest ? { item: oldest.item, station: oldest.station, branch: oldest.branch, waiting_min: minsAgo(oldest.fired_at), target_min: r1(oldest.target_sec / 60) } : null,
        stations: k.stations.map((s) => ({ station: s.station, done: s.n, open: s.open, avg_min: r1(s.avg_sec / 60), target_min: r1(s.target / 60), on_time_pct: pctv(s.on_time) })),
        slowest_dishes: k.slowest.map((s) => ({ dish: s.item, station: s.station, avg_min: r1(s.avg_sec / 60), target_min: r1(s.target / 60), over_by_pct: pctv(s.avg_sec / s.target - 1) })),
      };
    },
  },

  // ---------- Vision ----------
  {
    name: 'vision_compliance', perm: 'vision.view',
    description: 'Camera results for the last 2 hours. Each check has a tier: real-time (station staffed, after-hours access, walk-in door, unattended counter, queue, pass; alerts), KPI (staff approach, table visit, uniform; aggregate) or audit (gloves, hair cover, phone, sink visit; sampled for human review, not reliable from ceiling CCTV). Includes branches ranked by compliance and the latest exceptions. Never present audit-tier results as verified.',
    input_schema: obj({ branch: BRANCH }),
    run(p, { branch }) {
      const v = M.vision(p, resolveBranch(branch));
      return {
        cameras: v.cameras.length, cameras_live: v.cameras.filter((c) => c.status !== 'offline').length,
        checks: v.byType.map((t) => ({ check: t.label, observations: t.n, compliance_pct: pctv(t.rate) })).sort((a, b) => a.compliance_pct - b.compliance_pct),
        branches: v.byBranch.map((b) => ({ branch: b.name, compliance_pct: pctv(b.rate), violations: b.flags })),
        latest_violations: v.events.slice(0, 8).map((e) => ({ what: e.label || e.type, camera: e.camera_name, branch: e.branch, minutes_ago: minsAgo(e.ts) })),
        people_on_camera_now: v.cameras.reduce((a, c) => a + (c.people || 0), 0),
      };
    },
  },

  // ---------- Guests ----------
  {
    name: 'guest_insights', perm: 'guests.view',
    description: 'Returning guests: who has been recognised today (face opt-in, loyalty QR, phone), guests in house now, returning-guest share and their spend vs new guests, latest arrivals with their top suggestion, and the top guests by lifetime spend.',
    input_schema: obj({ branch: BRANCH }),
    run(p, { branch }) {
      const g = M.guests(p, resolveBranch(branch));
      return {
        today: { recognised: g.kpi.recognized, by_face: g.kpi.face, by_qr: g.kpi.qr, in_house_now: g.kpi.in_house },
        returning_share_7d_pct: pctv(g.kpi.returning_share), returning_avg_spend: r2(g.kpi.known_aov), new_guest_avg_spend: r2(g.kpi.new_aov),
        latest_arrivals: g.arrivals.slice(0, 6).map((a) => ({ guest: a.profile?.name, tier: a.profile?.tier, branch: a.branch, method: a.method, minutes_ago: minsAgo(a.ts),
          allergies: a.profile?.allergies, top_suggestion: a.profile?.suggestions?.[0]?.text })),
        top_guests: g.top.slice(0, 8).map((t) => ({ guest: t.name, tier: t.tier, visits: t.visits, lifetime_spend: r0(t.spend), phone: t.phone })),
      };
    },
  },
  {
    name: 'guest_lookup', perm: 'guests.view',
    description: 'Look up one guest by (part of) their name and return their profile: tier, visits, spend, favourite dishes, allergies, seating, and the service suggestions for their next visit. Phone numbers are masked unless the user may see them.',
    input_schema: obj({ name: { type: 'string', description: 'Full or partial guest name' } }, ['name']),
    run(p, { name }) {
      const rows = db.prepare(`SELECT DISTINCT g.id, g.name FROM guests g LEFT JOIN orders o ON o.guest_id = g.id
        WHERE g.name LIKE ? AND (g.home_outlet IN (${inList(p.branches)}) OR o.outlet_id IN (${inList(p.branches)})) LIMIT 5`).all(`%${name}%`, ...p.branches, ...p.branches);
      if (!rows.length) return { found: 0, note: `No guest matching "${name}" in your branches.` };
      const prof = M.guestDetail(p, rows[0].id);
      return {
        found: rows.length, other_matches: rows.slice(1).map((r) => r.name),
        guest: { name: prof.name, phone: prof.phone, tier: prof.tier, visits: prof.visits, lifetime_spend: prof.spend, avg_spend: prof.avg_spend, days_since_last_visit: prof.days_since,
          favourites: prof.favorites.map((f) => `${f.name} (${f.qty}x)`), allergies: prof.allergies, seating: prof.seating, drink: prof.drink, face_match_opt_in: prof.consent_face,
          suggestions: prof.suggestions.map((s) => s.text) },
      };
    },
  },
  {
    name: 'reviews_summary', perm: 'reviews.view',
    description: 'Latest online reviews (Google, TripAdvisor, delivery apps): average rating, sentiment split, recurring complaints and praise, and the most recent negative reviews.',
    input_schema: obj({ branch: BRANCH }),
    run(p, { branch }) {
      const r = M.reviews(p, resolveBranch(branch));
      const avg = r.length ? r.reduce((a, x) => a + x.rating, 0) / r.length : null;
      const count = (s) => r.filter((x) => x.sentiment === s).length;
      return {
        reviews: r.length, avg_rating: r2(avg), positive: count('positive'), neutral: count('neutral'), negative: count('negative'),
        negative_recent: r.filter((x) => x.sentiment === 'negative').slice(0, 4).map((x) => ({ branch: x.branch, platform: x.platform, rating: x.rating, text: x.text, minutes_ago: minsAgo(x.ts) })),
        positive_recent: r.filter((x) => x.sentiment === 'positive').slice(0, 3).map((x) => ({ branch: x.branch, platform: x.platform, text: x.text })),
      };
    },
  },

  // ---------- Workforce ----------
  {
    name: 'staffing_productivity', perm: 'staff.view',
    description: 'Labour productivity today: TPPH (orders per labour hour) vs target, labour hours per order, guests per labour hour, sales per labour hour (sales roles only), labour cost (finance roles only), and each hour flagged overstaffed / understaffed with the recommended headcount.',
    input_schema: obj({ branch: BRANCH }),
    run(p, { branch }) {
      const s = M.staffing(p, resolveBranch(branch));
      const hours = s.hours.filter((h) => h.status !== 'closed');
      return {
        team: s.department, target_tpph: r1(s.target_tpph), tpph: r2(s.tpph), labour_hours: s.labour_hours, orders: s.orders,
        labour_hours_per_order: r2(s.lhpo), guests_per_labour_hour: r2(s.covers_plh), sales_per_labour_hour: s.splh != null ? r0(s.splh) : undefined,
        labour_cost: s.labour_cost != null ? r0(s.labour_cost) : undefined,
        overstaffed_hours: hours.filter((h) => h.status === 'over').map((h) => `${h.label} (${h.staff} on, ${h.recommended} needed)`),
        understaffed_hours: hours.filter((h) => h.status === 'under').map((h) => `${h.label} (${h.staff} on, ${h.recommended} needed)`),
        current_hour: hours.at(-1),
      };
    },
  },
  {
    name: 'attendance_status', perm: 'staff.view',
    description: 'Who is on shift now, who clocked in late today (and by how much), who is absent or due, with role, station and branch. Hourly rates only for roles allowed to see pay.',
    input_schema: obj({ branch: BRANCH }),
    run(p, { branch }) {
      const rows = M.people(p, resolveBranch(branch));
      const pick = (r) => ({ name: r.name, role: r.role, station: r.station || undefined, branch: r.branch, ...(r.late_min ? { late_min: r.late_min } : {}), ...(r.hourly_rate != null ? { hourly_rate: r.hourly_rate } : {}) });
      const by = (st) => rows.filter((r) => r.status === st);
      return {
        rostered: rows.length, on_shift: by('on shift').length + by('late').length, finished: by('finished').length,
        late_today: rows.filter((r) => r.late_min >= 10).map(pick), absent: by('absent').map(pick), due_now: by('due').map(pick),
      };
    },
  },

  // ---------- Food safety ----------
  {
    name: 'cold_chain_status', perm: 'safety.view',
    description: 'Fridge, freezer and hot-hold sensors: current temperature against the HACCP safe range, sensors out of range right now, and how long they have been out of range in the last 2 hours.',
    input_schema: obj({ branch: BRANCH }),
    run(p, { branch }) {
      const s = M.safety(p, resolveBranch(branch));
      const outMin = (x) => x.history.filter((h) => h.value < x.min || h.value > x.max).length; // readings are ~1/min
      return {
        sensors: s.length, in_range: s.filter((x) => x.ok).length,
        out_of_range_now: s.filter((x) => x.ok === false).map((x) => ({ sensor: x.name, branch: x.branch, value: r1(x.value), unit: x.unit, safe_range: `${x.min} to ${x.max}`, minutes_out_last_2h: outMin(x) })),
        drifting: s.filter((x) => x.ok && outMin(x) > 0).map((x) => ({ sensor: x.name, branch: x.branch, value: r1(x.value), minutes_out_last_2h: outMin(x) })),
      };
    },
  },

  // ---------- Incidents ----------
  {
    name: 'open_alerts', perm: 'alerts.view',
    description: 'Open (unacknowledged) alerts from the last 24 hours that this user may see, newest first, with id, severity, category, branch and detail. Optionally filter by category or severity.',
    input_schema: obj({ branch: BRANCH, category: { type: 'string', enum: ['speed', 'hygiene', 'safety', 'people', 'sales', 'guest'] }, severity: { type: 'string', enum: ['high', 'medium', 'low'] } }),
    run(p, { branch, category, severity }) {
      let a = M.alerts(p, { branch: resolveBranch(branch), status: 'open', limit: 300 });
      if (category) a = a.filter((x) => x.category === category);
      if (severity) a = a.filter((x) => x.severity === severity);
      const byCat = {};
      a.forEach((x) => { byCat[x.category] = (byCat[x.category] || 0) + 1; });
      return { open: a.length, high: a.filter((x) => x.severity === 'high').length, by_category: byCat,
        latest: a.slice(0, 10).map((x) => ({ id: x.id, severity: x.severity, category: x.category, title: x.title, detail: x.detail, branch: x.branch, station: x.station || undefined, minutes_ago: minsAgo(x.ts) })) };
    },
  },
  {
    name: 'branch_health', perm: 'dashboard.view',
    description: 'Outlet Health Score (0-100) for each branch with the six pillar scores (sales pace, speed of service, hygiene, staff attendance, cold chain, guest sentiment, each 0-1) so you can see what is dragging a branch down.',
    input_schema: obj({ branch: BRANCH }),
    run(p, { branch }) {
      const d = M.dashboard(p, resolveBranch(branch));
      return { group_score: d.score, branches: d.scores.map((s) => ({ branch: label(s.id), score: s.score, pillars: Object.fromEntries(Object.entries(s.components).map(([k, v]) => [k, r2(v)])) })).sort((a, b) => a.score - b.score) };
    },
  },
  {
    name: 'propose_acknowledge_alerts', perm: 'alerts.ack', action: true,
    description: 'Propose acknowledging specific open alerts (by id) once the cause is understood. This does NOT acknowledge anything: it creates an approval card the user must confirm in the app. Use only when the user asks to clear or acknowledge alerts.',
    input_schema: obj({ alert_ids: { type: 'array', items: { type: 'integer' }, description: 'Alert ids from open_alerts' }, reason: { type: 'string', description: 'One-line reason shown on the approval card' } }, ['alert_ids', 'reason']),
    run(p, { alert_ids, reason }) {
      const rows = (alert_ids || []).map((id) => db.prepare('SELECT * FROM alerts WHERE id = ? AND ack = 0').get(id)).filter((a) => a && alertAllowed(p, a));
      if (!rows.length) return { proposed: 0, note: 'None of those alerts are open and visible to this user.' };
      return { proposed: rows.length, requires_user_approval: true, action: { kind: 'ack_alerts', ids: rows.map((a) => a.id), titles: rows.map((a) => a.title), reason } };
    },
  },

  // ---------- Management reporting ----------
  {
    name: 'kpi_scorecard', perm: null,
    description: 'Management report for a period: every KPI the user may see (actual, target, prior period, change, RAG status), the key risk indicators with thresholds and branches in breach, and an executive summary. Periods: today, yesterday, 7d, 14d.',
    input_schema: obj({ branch: BRANCH, period: { type: 'string', enum: ['today', 'yesterday', '7d', '14d'], description: 'Reporting period (default 7d)' } }),
    run(p, { branch, period = '7d' }) {
      if (!['sales.view', 'kitchen.view', 'vision.view', 'safety.view', 'staff.view', 'reviews.view'].some((x) => p.perms.has(x))) return { error: 'This role has no reporting access.' };
      return reportDigest(p, { branch: resolveBranch(branch), period });
    },
  },
  {
    name: 'sales_forecast', perm: 'sales.view',
    description: 'Sales forecast: projected close for today with the chance of hitting budget, the next 7 days with 80% ranges and budget gap per branch, and the model backtest error (MAPE).',
    input_schema: obj({ branch: BRANCH }),
    run(p, { branch }) { return reportDigest(p, { branch: resolveBranch(branch), period: 'today' }).forecast; },
  },

  // ---------- Knowledge (available to every agent) ----------
  {
    name: 'search_playbook', perm: null,
    description: 'Search the group\'s operating playbook: SOPs, HACCP limits and corrective actions, metric definitions (TPPH, prime cost, health score), service standards and escalation rules. Use it to explain a number or recommend the correct procedure.',
    input_schema: obj({ query: { type: 'string', description: 'What to look up, e.g. "freezer above -15" or "how is TPPH calculated"' } }, ['query']),
    run(_p, { query }) { return { results: searchPlaybook(query, 3) }; },
  },
];

export const TOOL_BY_NAME = Object.fromEntries(TOOLS.map((t) => [t.name, t]));
export const toolAllowed = (p, t) => !t.perm || p.perms.has(t.perm);

/** Run a tool as the user. Errors (403 on a branch, bad input) come back as data the agent can explain. */
export function runTool(p, name, input = {}) {
  const t = TOOL_BY_NAME[name];
  if (!t) return { error: `Unknown tool ${name}` };
  if (!toolAllowed(p, t)) return { error: `Access denied: the ${p.roleLabel} role does not have ${t.perm}.` };
  try { return t.run(p, input || {}); } catch (e) { return { error: e.message }; }
}

export { HOUR, DAY, midnight };
