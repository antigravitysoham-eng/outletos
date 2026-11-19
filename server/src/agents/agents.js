// The agent team: one orchestrator (Maître) and seven module specialists. Each specialist owns a
// slice of the tools, a persona, a proactive scan (what it would flag without being asked) and a
// grounded "local" answer composer used when no LLM key is configured.
import { fmtMoney } from '../instance.js';
import { runTool, toolAllowed, TOOL_BY_NAME } from './tools.js';
import { searchPlaybook } from './knowledge.js';

const $ = (v) => fmtMoney(v);
const pc = (v) => (v == null ? '—' : `${v}%`);
const signed = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v}%`);
const has = (q, ...words) => words.some((w) => q.includes(w));
const list = (a, n = 3) => a.slice(0, n).join(', ') + (a.length > n ? ` and ${a.length - n} more` : '');

export const SPECIALISTS = [
  {
    id: 'revenue', name: 'Revenue Analyst', icon: 'TrendingUp', color: '#D92D3A', module: 'Sales & finance',
    blurb: 'Sales pace, channels, online vs in-store, menu mix and prime cost.',
    tools: ['sales_overview', 'sales_trend', 'menu_performance', 'prime_cost', 'sales_forecast', 'kpi_scorecard', 'search_playbook'],
    persona: 'You are the Revenue Analyst for a fine-dining restaurant group. You explain sales pace against yesterday, channel mix (online = delivery apps + website, in-store = dine-in + takeaway), average order value, menu performance and prime cost. Always quote the comparison baseline and name the branch.',
    questions: ['How are sales vs yesterday?', 'What is the forecast for next week?', 'What are our best-selling dishes?', 'Which KPIs are off target this week?'],
    keywords: ['sale', 'revenue', 'money', 'aov', 'order value', 'channel', 'online', 'offline', 'in-store', 'delivery', 'dish', 'menu', 'best sell', 'top', 'prime', 'food cost', 'margin', 'trend', 'week', 'peak', 'busiest', 'payment', 'revpash', 'behind', 'ahead', 'yesterday', 'compare', 'branches', 'forecast', 'predict', 'projection', 'next week', 'budget', 'kpi', 'scorecard', 'report', 'kri', 'risk indicator'],
    scan(p, branch) {
      const out = [];
      if (!p.perms.has('sales.view')) return out;
      const s = runTool(p, 'sales_overview', { branch });
      if (s.error) return out;
      const ch = s.change_vs_yesterday_pct;
      out.push({ severity: ch != null && ch < -10 ? 'high' : ch != null && ch < 0 ? 'medium' : 'info', title: `Sales ${$(s.today.sales)} so far, ${signed(ch)} vs this time yesterday`,
        detail: `${s.today.orders} orders · AOV ${$(s.today.aov)} · ${pc(s.today.online_share_pct)} online.`, ask: 'How are sales vs yesterday?' });
      const lag = (s.branches || []).map((b) => ({ ...b, ch: b.yesterday ? Math.round((b.sales - b.yesterday) / b.yesterday * 1000) / 10 : null })).filter((b) => b.ch != null && b.ch < -12).sort((a, b) => a.ch - b.ch)[0];
      if (lag) out.push({ severity: 'medium', title: `${lag.name} (${lag.city}) is ${signed(lag.ch)} vs yesterday`, detail: `${$(lag.sales)} so far against ${$(lag.yesterday)} at this time yesterday.`, ask: `Why is ${lag.name} behind today?` });
      if (p.perms.has('finance.view')) {
        const f = runTool(p, 'prime_cost', { branch });
        if (!f.error && f.overall.prime_pct > 65) out.push({ severity: 'medium', title: `Prime cost at ${pc(f.overall.prime_pct)} (target 60-65%)`, detail: `Food ${pc(f.overall.food_pct)} · labour ${pc(f.overall.labour_pct)}.`, ask: 'What is driving prime cost today?' });
      }
      return out;
    },
    answer(p, q, branch) {
      const used = [];
      const run = (n, i = {}) => { used.push(n); return runTool(p, n, { branch, ...i }); };
      const parts = [];
      if (has(q, 'dish', 'menu', 'best sell', 'top', 'item', 'popular', 'category')) {
        const m = run('menu_performance');
        parts.push(`**Top dishes today:** ${m.top_dishes.slice(0, 5).map((d) => `${d.dish} ${$(d.sales)} (${d.qty}×)${d.is_new ? ' · new' : ''}`).join(' · ')}.`);
        if (m.categories[0]) parts.push(`**Strongest category:** ${m.categories[0].category} at ${$(m.categories[0].sales)}; weakest ${m.categories.at(-1).category} at ${$(m.categories.at(-1).sales)}.`);
        const fresh = m.top_dishes.filter((d) => d.is_new);
        parts.push(fresh.length ? `New dishes in the top list: ${fresh.map((d) => d.dish).join(', ')}. Keep them on the server script.` : 'No new dish has reached the top list yet. Brief servers to recommend them at the table.');
      }
      if (has(q, 'prime', 'food cost', 'labour cost', 'labor cost', 'margin', 'cost')) {
        if (!p.perms.has('finance.view')) parts.push('Cost figures are hidden for your role.');
        else {
          const f = run('prime_cost');
          parts.push(`**Prime cost ${pc(f.overall.prime_pct)}** (food ${pc(f.overall.food_pct)} + labour ${pc(f.overall.labour_pct)}; labour ${$(f.overall.labour_cost)} so far). Benchmark is 60-65%.`);
          if (f.by_branch) { const worst = [...f.by_branch].sort((a, b) => b.prime_pct - a.prime_pct)[0]; parts.push(`Highest: ${worst.branch} at ${pc(worst.prime_pct)}.`); }
        }
      }
      if (has(q, 'forecast', 'predict', 'projection', 'next week', 'next 7', 'budget', 'will we')) {
        const f = run('sales_forecast');
        if (f) {
          parts.push(`**Forecast:** next 7 days ${$(f.next_7_days)} (80% range ${$(f.range[0])}–${$(f.range[1])}) against a budget of ${$(f.budget)}, ${signed(Math.round((f.next_7_days / f.budget - 1) * 1000) / 10)}. Today should close near ${$(f.today_projection)} (${Math.round(f.chance_hit_budget_today * 100)}% chance of hitting budget).`);
          const below = f.by_branch.filter((b) => b.gap != null && b.gap < -0.03).sort((a, b) => a.gap - b.gap);
          if (below.length) parts.push(`Below budget next week: ${below.map((b) => `${b.branch} ${signed(Math.round(b.gap * 1000) / 10)}`).join(', ')}.`);
          if (f.backtest_mape != null) parts.push(`Model check: last week's backtest error was ${(f.backtest_mape * 100).toFixed(1)}%.`);
        }
      }
      if (has(q, 'kpi', 'scorecard', 'report', 'kri', 'risk indicator', 'off target', 'on target')) {
        const r = run('kpi_scorecard', { period: has(q, 'today') ? 'today' : has(q, 'yesterday') ? 'yesterday' : '7d' });
        if (!r.error) {
          const off = r.kpis.filter((k) => k.status === 'red' || k.status === 'amber');
          parts.push(`**${r.period} scorecard:** ${r.kpis.filter((k) => k.status === 'green').length} of ${r.kpis.filter((k) => k.status !== 'none').length} KPIs on target.${off.length ? ` Off target: ${off.map((k) => k.label.toLowerCase()).join(', ')}.` : ''}`);
          const red = r.kris.filter((k) => k.status === 'red');
          parts.push(red.length ? `**Risk indicators in breach:** ${red.map((k) => `${k.label}${k.breaches?.length ? ` (${k.breaches.join(', ')})` : ''}: ${k.action}`).join(' ')}` : 'No key risk indicator is in breach.');
        }
      }
      if (has(q, 'trend', 'week', 'peak', 'busiest', 'hour', 'slow') && !has(q, 'next week', 'forecast')) {
        const t = run('sales_trend');
        const best = [...t.last_7_days].sort((a, b) => b.total - a.total)[0];
        const peak = [...t.today_by_hour].sort((a, b) => b.today - a.today)[0];
        parts.push(`**Last 7 days:** ${t.last_7_days.map((d) => `${d.date.slice(5)} ${$(d.total)}`).join(' · ')}. Best day ${best?.date} at ${$(best?.total)}.`);
        if (peak) parts.push(`Today's peak so far: ${peak.hour} with ${$(peak.today)} (${peak.orders} orders).`);
      }
      if (!parts.length || has(q, 'sale', 'revenue', 'behind', 'ahead', 'yesterday', 'online', 'offline', 'channel', 'how are we', 'how is')) {
        const s = run('sales_overview');
        parts.unshift(`**${$(s.today.sales)} in sales so far today** across ${s.scope.length > 1 ? `${s.scope.length} branches` : s.scope[0]}, ${signed(s.change_vs_yesterday_pct)} vs the same time yesterday (${$(s.same_time_yesterday.sales)}). ${s.today.orders} orders, ${s.today.covers} covers, average order ${$(s.today.aov)}.`);
        parts.push(`**Online vs in-store:** ${pc(s.today.online_share_pct)} online (${$(s.today.online_sales)}). Top channels: ${s.channels.slice(0, 3).map((c) => `${c.source} ${$(c.sales)}`).join(', ')}.`);
        if (s.branches?.length) {
          const ranked = s.branches.map((b) => ({ ...b, ch: b.yesterday ? Math.round((b.sales - b.yesterday) / b.yesterday * 1000) / 10 : null }));
          const lead = ranked[0], lag = [...ranked].sort((a, b) => (a.ch ?? 0) - (b.ch ?? 0))[0];
          parts.push(`**Leader:** ${lead.name} (${lead.city}) ${$(lead.sales)}. **Weakest pace:** ${lag.name} (${lag.city}) ${signed(lag.ch)} vs yesterday.`);
        }
      }
      return { text: parts.join('\n\n'), used };
    },
  },
  {
    id: 'kitchen', name: 'Kitchen Ops', icon: 'ChefHat', color: '#F97316', module: 'Kitchen Operations',
    blurb: 'Ticket times, station bottlenecks and the dishes running late.',
    tools: ['kitchen_status', 'search_playbook'],
    persona: 'You are the Kitchen Operations agent. You watch ticket times, on-time rate per station, the oldest open ticket and the slowest dishes, and you recommend practical fixes during service (re-sequence, move a floater, 86 a dish, check equipment).',
    questions: ['Which station is slowest right now?', 'How many tickets are open?', 'Which dishes are running late?'],
    keywords: ['kitchen', 'ticket', 'station', 'grill', 'fry', 'saute', 'sauté', 'pass', 'cold', 'pastry', 'speed', 'slow', 'late dish', 'on-time', 'on time', 'bottleneck', 'backed up', 'wait'],
    scan(p, branch) {
      if (!p.perms.has('kitchen.view')) return [];
      const k = runTool(p, 'kitchen_status', { branch });
      if (k.error) return [];
      const out = [];
      const worst = [...k.stations].filter((s) => s.done >= 3).sort((a, b) => a.on_time_pct - b.on_time_pct)[0];
      if (worst && worst.on_time_pct < 80) out.push({ severity: worst.on_time_pct < 65 ? 'high' : 'medium', title: `${worst.station} station ${pc(worst.on_time_pct)} on time`, detail: `Averaging ${worst.avg_min} min against a ${worst.target_min} min target · ${worst.open} open.`, ask: `Why is the ${worst.station} station slow?` });
      if (k.oldest_open && k.oldest_open.waiting_min > 2 * k.oldest_open.target_min) out.push({ severity: 'high', title: `${k.oldest_open.item} waiting ${k.oldest_open.waiting_min} min`, detail: `${k.oldest_open.station} · ${k.oldest_open.branch} · target ${k.oldest_open.target_min} min.`, ask: 'Which tickets are overdue?' });
      if (!out.length) out.push({ severity: 'info', title: `Kitchen ${pc(k.last_hour.on_time_pct)} on time`, detail: `${k.last_hour.tickets_done} tickets in the last hour · ${k.open_tickets} open.`, ask: 'How is the kitchen doing?' });
      return out;
    },
    answer(p, q, branch) {
      const k = runTool(p, 'kitchen_status', { branch });
      if (k.error) return { text: k.error, used: ['kitchen_status'] };
      const parts = [`**Kitchen (${k.station_filter}):** ${k.last_hour.tickets_done} tickets in the last hour, average ${k.last_hour.avg_ticket_min} min, **${pc(k.last_hour.on_time_pct)} on time**. ${k.open_tickets} tickets open now.`];
      const ranked = [...k.stations].sort((a, b) => a.on_time_pct - b.on_time_pct);
      if (ranked.length) parts.push(`**By station:** ${ranked.map((s) => `${s.station} ${pc(s.on_time_pct)} (${s.avg_min}/${s.target_min} min, ${s.open} open)`).join(' · ')}.`);
      if (k.oldest_open) parts.push(`**Oldest open ticket:** ${k.oldest_open.item} at ${k.oldest_open.station}, waiting ${k.oldest_open.waiting_min} min (target ${k.oldest_open.target_min}).`);
      const over = k.slowest_dishes.filter((d) => d.over_by_pct > 0);
      parts.push(over.length ? `**Running over target today:** ${over.slice(0, 3).map((d) => `${d.dish} ${signed(d.over_by_pct)}`).join(', ')}.` : 'Every dish is averaging inside its target time today.');
      const w = ranked[0];
      if (w && w.on_time_pct < 80) parts.push(`**Do now:** move a floater to ${w.station}, re-sequence fires so ${w.station} items go first, and consider pausing ${k.slowest_dishes.find((d) => d.station === w.station)?.dish ?? 'its slowest dish'} until the queue clears.`);
      return { text: parts.join('\n\n'), used: ['kitchen_status'] };
    },
  },
  {
    id: 'vision', name: 'Vision & Operations', icon: 'ScanEye', color: '#7C5CFF', module: 'Vision Intelligence',
    blurb: 'What CCTV measures reliably: station coverage, queues, pass waits, door and after-hours access; PPE in audit.',
    tools: ['vision_compliance', 'search_playbook'],
    persona: 'You are the Vision & Operations agent. You read camera AI detections (processed on site; only events leave the restaurant) and turn them into coaching: which checks are slipping, where, and what the SOP says. Never identify staff by face; talk about stations and teams.',
    questions: ['Which station is going uncovered?', 'Which branch has the lowest camera compliance?', 'What were the latest camera exceptions?'],
    keywords: ['camera', 'cctv', 'vision', 'hygiene', 'hairnet', 'hair', 'glove', 'handwash', 'hand wash', 'hand-wash', 'phone', 'spill', 'access', 'unauthor', 'compliance', 'violation', 'ppe', 'apron', 'uniform', 'queue', 'pass', 'door', 'coverage', 'occupancy', 'counter'],
    scan(p, branch) {
      if (!p.perms.has('vision.view')) return [];
      const v = runTool(p, 'vision_compliance', { branch });
      if (v.error || !v.checks.length) return [];
      const w = v.checks[0];
      const b = v.branches[0];
      return [{ severity: w.compliance_pct < 85 ? 'high' : w.compliance_pct < 93 ? 'medium' : 'info', title: `${w.check}: ${pc(w.compliance_pct)} compliance`, detail: `Weakest check in the last 2 h${b && v.branches.length > 1 ? ` · lowest branch ${b.branch} at ${pc(b.compliance_pct)} overall` : ''}.`, ask: 'Which hygiene check is slipping?' }];
    },
    answer(p, q, branch) {
      const v = runTool(p, 'vision_compliance', { branch });
      if (v.error) return { text: v.error, used: ['vision_compliance'] };
      const parts = [`**Camera AI, last 2 hours:** ${v.cameras_live}/${v.cameras} cameras live, ${v.people_on_camera_now} people on camera now.`];
      parts.push(`**Weakest checks:** ${v.checks.slice(0, 3).map((c) => `${c.check} ${pc(c.compliance_pct)}`).join(' · ')}. Strongest: ${v.checks.at(-1)?.check} ${pc(v.checks.at(-1)?.compliance_pct)}.`);
      if (v.branches.length > 1) parts.push(`**By branch (lowest first):** ${v.branches.slice(0, 3).map((b) => `${b.branch} ${pc(b.compliance_pct)} (${b.violations} flags)`).join(' · ')}.`);
      if (v.latest_violations.length) parts.push(`**Latest:** ${v.latest_violations.slice(0, 4).map((e) => `${e.what} at ${e.branch}${e.camera ? ` (${e.camera})` : ''}, ${e.minutes_ago} min ago`).join('; ')}.`);
      const sop = searchPlaybook(v.checks[0]?.check || 'hygiene', 1)[0];
      if (sop) parts.push(`**SOP (${sop.title}):** ${sop.text.split('. ').slice(0, 2).join('. ')}.`);
      return { text: parts.join('\n\n'), used: ['vision_compliance', 'search_playbook'] };
    },
  },
  {
    id: 'guest', name: 'Guest Experience', icon: 'HeartHandshake', color: '#E8488A', module: 'Guest Intelligence',
    blurb: 'Returning guests, allergies, VIPs, personal suggestions and reviews.',
    tools: ['guest_insights', 'guest_lookup', 'reviews_summary', 'search_playbook'],
    persona: 'You are the Guest Experience agent. You help hosts and managers recognise returning guests and personalise service: allergies first, then their usual order, new dishes that match their taste, pairings, VIP handling and win-back offers. You also summarise reviews. Respect masking: never reveal a phone number the tool masked.',
    questions: ['Which regulars are in house now?', 'What should we know about our top guests?', 'Summarise the latest reviews'],
    keywords: ['guest', 'customer', 'regular', 'returning', 'vip', 'gold', 'allerg', 'birthday', 'loyal', 'review', 'rating', 'complain', 'feedback', 'suggest', 'in house', 'arriv', 'who is', 'tell me about'],
    scan(p, branch) {
      const out = [];
      if (p.perms.has('guests.view')) {
        const g = runTool(p, 'guest_insights', { branch });
        if (!g.error) {
          const vip = g.latest_arrivals.filter((a) => a.minutes_ago <= 75 && (a.tier === 'Gold' || a.allergies?.length));
          out.push({ severity: vip.length ? 'medium' : 'info', title: `${g.today.in_house_now} recognised guests in house`, detail: vip.length ? `Watch: ${vip.slice(0, 3).map((a) => `${a.guest} (${a.tier}${a.allergies?.length ? `, ${a.allergies.join('/')} allergy` : ''})`).join(', ')}.` : `${g.today.recognised} recognised today · returning guests ${pc(g.returning_share_7d_pct)} of dine-in.`, ask: 'Which regulars are in house now?' });
        }
      }
      if (p.perms.has('reviews.view')) {
        const r = runTool(p, 'reviews_summary', { branch });
        if (!r.error && r.negative >= 3) out.push({ severity: 'medium', title: `${r.negative} negative reviews in the latest ${r.reviews}`, detail: `Average rating ${r.avg_rating}.`, ask: 'Summarise the latest reviews' });
      }
      return out;
    },
    answer(p, q, branch, raw) {
      const used = [], parts = [];
      const name = raw.match(/(?:about|is|for|lookup|look up|profile of)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/)?.[1];
      if (name && p.perms.has('guests.view')) {
        used.push('guest_lookup');
        const g = runTool(p, 'guest_lookup', { name });
        if (g.found) {
          const x = g.guest;
          parts.push(`**${x.name}** · ${x.tier} · ${x.visits} visits · ${$(x.lifetime_spend)} lifetime (avg ${$(x.avg_spend)}) · last visit ${x.days_since_last_visit ?? '—'} days ago · phone ${x.phone}.`);
          parts.push(`**Favourites:** ${x.favourites.slice(0, 4).join(', ') || '—'}. **Seating:** ${x.seating}. **Drink:** ${x.drink}.${x.allergies.length ? ` **Allergies: ${x.allergies.join(', ')}.**` : ''}`);
          parts.push(`**For their next visit:**\n${x.suggestions.map((s) => `- ${s}`).join('\n')}`);
          return { text: parts.join('\n\n'), used };
        }
        parts.push(g.note);
      }
      if (has(q, 'review', 'rating', 'complain', 'feedback') && p.perms.has('reviews.view')) {
        used.push('reviews_summary');
        const r = runTool(p, 'reviews_summary', { branch });
        parts.push(`**Reviews:** average ${r.avg_rating} across the latest ${r.reviews} (${r.positive} positive, ${r.neutral} neutral, ${r.negative} negative).`);
        if (r.negative_recent.length) parts.push(`**Recent negatives:**\n${r.negative_recent.map((x) => `- ${x.branch} · ${x.platform} ${x.rating}★: "${x.text}"`).join('\n')}`);
        parts.push('Reply to each negative review within 24 hours and name what changed.');
      }
      if ((!parts.length || has(q, 'guest', 'regular', 'vip', 'in house', 'arriv', 'returning', 'allerg', 'top')) && p.perms.has('guests.view')) {
        used.push('guest_insights');
        const g = runTool(p, 'guest_insights', { branch });
        parts.push(`**Today:** ${g.today.recognised} returning guests recognised (${g.today.by_face} by opt-in face match, ${g.today.by_qr} by loyalty QR); **${g.today.in_house_now} in house now**. Returning guests are ${pc(g.returning_share_7d_pct)} of dine-in orders this week and spend ${$(g.returning_avg_spend)} vs ${$(g.new_guest_avg_spend)} for new guests.`);
        if (g.latest_arrivals.length) parts.push(`**Latest arrivals:**\n${g.latest_arrivals.slice(0, 4).map((a) => `- **${a.guest}** (${a.tier}, ${a.branch}, ${a.minutes_ago} min ago)${a.allergies?.length ? ` · allergy: ${a.allergies.join(', ')}` : ''} · ${a.top_suggestion}`).join('\n')}`);
        if (has(q, 'top', 'vip', 'best')) parts.push(`**Top guests by spend:** ${g.top_guests.slice(0, 5).map((t) => `${t.guest} (${t.tier}, ${t.visits} visits, ${$(t.lifetime_spend)})`).join(', ')}.`);
      }
      return { text: parts.join('\n\n') || 'Guest data is not available for your role.', used };
    },
  },
  {
    id: 'workforce', name: 'Workforce Planner', icon: 'Users', color: '#0BA5EC', module: 'Workforce',
    blurb: 'TPPH, over/under-staffed hours, lateness, absences and labour cost.',
    tools: ['staffing_productivity', 'attendance_status', 'search_playbook'],
    persona: 'You are the Workforce Planner. You measure TPPH (orders per labour hour) against target, flag overstaffed and understaffed hours with the recommended headcount, and track lateness and absences. Recommend concrete staffing moves. Only mention pay or labour cost if the tool returned it.',
    questions: ['Are we over or understaffed right now?', 'Who was late today?', 'What is our TPPH?'],
    keywords: ['staff', 'tpph', 'labour', 'labor', 'productiv', 'late', 'absent', 'shift', 'roster', 'schedule', 'headcount', 'overstaff', 'understaff', 'clock', 'attendance', 'team', 'people', 'who is on', 'splh'],
    scan(p, branch) {
      if (!p.perms.has('staff.view')) return [];
      const s = runTool(p, 'staffing_productivity', { branch });
      const a = runTool(p, 'attendance_status', { branch });
      const out = [];
      if (!s.error && s.tpph != null) {
        const st = s.current_hour?.status;
        out.push({ severity: st === 'under' ? 'high' : st === 'over' ? 'medium' : 'info', title: `TPPH ${s.tpph} vs target ${s.target_tpph}`, detail: st === 'under' ? `Understaffed this hour: ${s.current_hour.staff} on, ${s.current_hour.recommended} needed.` : st === 'over' ? `Overstaffed this hour: ${s.current_hour.staff} on, ${s.current_hour.recommended} needed.` : `${s.labour_hours} labour hours for ${s.orders} orders today.`, ask: 'Are we over or understaffed right now?' });
      }
      if (!a.error && (a.late_today.length || a.absent.length)) out.push({ severity: a.absent.length ? 'medium' : 'info', title: `${a.late_today.length} late, ${a.absent.length} absent today`, detail: a.absent.length ? `Absent: ${list(a.absent.map((x) => `${x.name} (${x.role})`))}.` : `Late: ${list(a.late_today.map((x) => x.name))}.`, ask: 'Who was late today?' });
      return out;
    },
    answer(p, q, branch) {
      const used = [], parts = [];
      if (!has(q, 'late', 'absent', 'who', 'clock', 'attendance', 'no show') || has(q, 'tpph', 'staffed', 'productiv', 'labour', 'labor', 'headcount')) {
        used.push('staffing_productivity');
        const s = runTool(p, 'staffing_productivity', { branch });
        parts.push(`**TPPH ${s.tpph ?? '—'}** against a target of ${s.target_tpph} (${s.team}). ${s.labour_hours} labour hours for ${s.orders} orders · ${s.labour_hours_per_order} labour hours per order · ${s.guests_per_labour_hour} guests per labour hour.${s.sales_per_labour_hour != null ? ` Sales per labour hour ${$(s.sales_per_labour_hour)}.` : ''}${s.labour_cost != null ? ` Labour cost so far ${$(s.labour_cost)}.` : ''}`);
        const c = s.current_hour;
        if (c) parts.push(`**This hour (${c.label}):** ${c.staff} on shift, ${c.recommended} recommended → **${c.status === 'over' ? 'overstaffed' : c.status === 'under' ? 'understaffed' : 'about right'}**.`);
        if (s.overstaffed_hours.length) parts.push(`Overstaffed earlier: ${list(s.overstaffed_hours, 4)}.`);
        if (s.understaffed_hours.length) parts.push(`Understaffed earlier: ${list(s.understaffed_hours, 4)}.`);
        if (c?.status === 'over') parts.push('**Do now:** send one person on break or start tomorrow\'s prep; release the longest-serving extra after the rush.');
        if (c?.status === 'under') parts.push('**Do now:** call the on-call cook and open the second pass; pause slow dishes until the queue clears.');
      }
      if (has(q, 'late', 'absent', 'who', 'clock', 'attendance', 'no show', 'on shift')) {
        used.push('attendance_status');
        const a = runTool(p, 'attendance_status', { branch });
        parts.push(`**Attendance:** ${a.on_shift} on shift of ${a.rostered} rostered today · ${a.finished} finished.`);
        parts.push(a.late_today.length ? `**Late:** ${a.late_today.map((x) => `${x.name} (${x.role}, ${x.branch}, ${x.late_min} min)`).join(', ')}.` : 'Nobody was more than 10 minutes late.');
        if (a.absent.length) parts.push(`**Absent:** ${a.absent.map((x) => `${x.name} (${x.role}, ${x.branch})`).join(', ')}. Call the on-call list.`);
      }
      return { text: parts.join('\n\n'), used };
    },
  },
  {
    id: 'safety', name: 'Food Safety (HACCP)', icon: 'ThermometerSnowflake', color: '#12B76A', module: 'Food Safety & HACCP',
    blurb: 'Cold chain, HACCP limits and corrective actions.',
    tools: ['cold_chain_status', 'search_playbook'],
    persona: 'You are the Food Safety (HACCP) agent. You watch fridge, freezer and humidity sensors against their safe ranges and give the exact corrective action from the playbook, including when food must be discarded. Be precise with temperatures and durations.',
    questions: ['Is anything out of temperature?', 'What do we do if the freezer is warm?', 'Is the cold chain safe right now?'],
    keywords: ['fridge', 'freezer', 'temperature', 'temp', 'cold', 'chiller', 'cooler', 'walk-in', 'haccp', 'sensor', 'humidity', 'food safety', 'safe', 'discard'],
    scan(p, branch) {
      if (!p.perms.has('safety.view')) return [];
      const c = runTool(p, 'cold_chain_status', { branch });
      if (c.error) return [];
      if (c.out_of_range_now.length) return c.out_of_range_now.slice(0, 2).map((x) => ({ severity: x.minutes_out_last_2h >= 30 ? 'high' : 'medium', title: `${x.sensor} at ${x.value}${x.unit} (${x.branch})`, detail: `Safe range ${x.safe_range}${x.unit} · out of range ~${x.minutes_out_last_2h} min in the last 2 h.`, ask: `What should we do about the ${x.sensor} at ${x.branch}?` }));
      return [{ severity: 'info', title: `Cold chain: ${c.in_range}/${c.sensors} sensors in range`, detail: c.drifting.length ? `${c.drifting.length} drifted earlier and recovered.` : 'No excursions in the last 2 hours.', ask: 'Is the cold chain safe right now?' }];
    },
    answer(p, q, branch) {
      const c = runTool(p, 'cold_chain_status', { branch });
      if (c.error) return { text: c.error, used: ['cold_chain_status'] };
      const parts = [`**Cold chain:** ${c.in_range} of ${c.sensors} sensors in range right now.`];
      if (c.out_of_range_now.length) {
        parts.push(`**Out of range now:**\n${c.out_of_range_now.map((x) => `- **${x.sensor}, ${x.branch}:** ${x.value}${x.unit} (safe ${x.safe_range}${x.unit}), out ~${x.minutes_out_last_2h} min in the last 2 h`).join('\n')}`);
        const sop = searchPlaybook(`${c.out_of_range_now[0].sensor} temperature`, 1)[0];
        if (sop) parts.push(`**Corrective action (${sop.title}):** ${sop.text}`);
      } else parts.push('Nothing is out of range. ' + (c.drifting.length ? `Earlier drift (recovered): ${c.drifting.map((x) => `${x.sensor} at ${x.branch}`).join(', ')}.` : 'No excursions in the last 2 hours.'));
      if (has(q, 'what do', 'what should', 'procedure', 'rule', 'limit', 'if ')) {
        const sop = searchPlaybook(q, 1)[0];
        if (sop && !parts.some((x) => x.includes(sop.title))) parts.push(`**Playbook (${sop.title}):** ${sop.text}`);
      }
      return { text: parts.join('\n\n'), used: ['cold_chain_status', 'search_playbook'] };
    },
  },
  {
    id: 'incident', name: 'Incident Manager', icon: 'Siren', color: '#B42318', module: 'Alerts & Incidents',
    blurb: 'Open alerts, branch health scores, escalation and acknowledgement.',
    tools: ['open_alerts', 'branch_health', 'kpi_scorecard', 'propose_acknowledge_alerts', 'search_playbook'],
    persona: 'You are the Incident Manager. You triage open alerts by severity, explain what each one means, rank branches by Outlet Health Score and the pillar dragging them down, and follow the escalation rules. You may propose acknowledging alerts, but the user must approve; never claim an alert is acknowledged.',
    questions: ['What needs my attention right now?', 'Which branch has the lowest health score?', 'Acknowledge the resolved speed alerts'],
    keywords: ['alert', 'incident', 'urgent', 'attention', 'problem', 'issue', 'wrong', 'health', 'score', 'worst', 'acknowledge', 'ack', 'clear', 'escalat', 'fire', 'compare', 'branches'],
    scan(p, branch) {
      const out = [];
      if (p.perms.has('alerts.view')) {
        const a = runTool(p, 'open_alerts', { branch });
        if (!a.error && a.open) out.push({ severity: a.high ? 'high' : 'medium', title: `${a.open} open alerts${a.high ? `, ${a.high} high` : ''}`, detail: `Latest: ${a.latest[0]?.title} (${a.latest[0]?.branch}).`, ask: 'What needs my attention right now?' });
      }
      if (p.perms.has('dashboard.view')) {
        const h = runTool(p, 'branch_health', { branch });
        const w = h.branches?.[0];
        if (w && w.score < 80) {
          const pillar = Object.entries(w.pillars).sort((a, b) => a[1] - b[1])[0];
          out.push({ severity: w.score < 70 ? 'high' : 'medium', title: `${w.branch} health score ${w.score}`, detail: `Weakest pillar: ${pillar[0]} (${Math.round(pillar[1] * 100)}%).`, ask: `Why is ${w.branch.split(' (')[0]} scoring low?` });
        }
      }
      return out;
    },
    answer(p, q, branch) {
      const used = [], parts = [], actions = [];
      if (p.perms.has('alerts.view')) {
        used.push('open_alerts');
        const cat = ['speed', 'hygiene', 'safety', 'people', 'sales', 'guest'].find((c) => q.includes(c));
        const a = runTool(p, 'open_alerts', { branch, category: cat });
        parts.push(`**${a.open} open alerts${cat ? ` (${cat})` : ''}**, ${a.high} high severity. By category: ${Object.entries(a.by_category).map(([k, v]) => `${k === 'hygiene' ? 'camera & access' : k} ${v}`).join(', ') || 'none'}.`);
        if (a.latest.length) parts.push(a.latest.slice(0, 5).map((x) => `- **${x.severity.toUpperCase()}** ${x.title} · ${x.branch}${x.station ? ` · ${x.station}` : ''} · ${x.minutes_ago} min ago`).join('\n'));
        if (has(q, 'acknowledge', 'ack', 'clear', 'resolve') && p.perms.has('alerts.ack') && a.latest.length) {
          used.push('propose_acknowledge_alerts');
          const pr = runTool(p, 'propose_acknowledge_alerts', { alert_ids: a.latest.slice(0, 5).map((x) => x.id), reason: `Requested from the agent chat${cat ? ` (${cat} alerts)` : ''}` });
          if (pr.action) { actions.push(pr.action); parts.push(`I've prepared an approval card to acknowledge ${pr.proposed} alert(s). Nothing changes until you approve it.`); }
        }
      }
      if (p.perms.has('dashboard.view') && (!parts.length || has(q, 'health', 'score', 'worst', 'branch', 'attention'))) {
        used.push('branch_health');
        const h = runTool(p, 'branch_health', { branch });
        parts.push(`**Health scores (lowest first):** ${h.branches.map((b) => `${b.branch.split(' (')[0]} ${b.score}`).join(' · ')}. Group ${h.group_score}.`);
        const w = h.branches[0];
        if (w) { const pillar = Object.entries(w.pillars).sort((a, b) => a[1] - b[1])[0]; parts.push(`${w.branch} is lowest; its weakest pillar is **${pillar[0]}** at ${Math.round(pillar[1] * 100)}%.`); }
      }
      return { text: parts.join('\n\n') || 'You do not have access to alerts or health scores.', used, actions };
    },
  },
];

export const MAITRE = {
  id: 'maitre', name: 'Maître', icon: 'Sparkles', color: '#D92D3A', module: 'All modules',
  blurb: 'Your chief-of-staff agent. Understands the question, briefs the right specialists, and gives one answer.',
  questions: ['Give me today\'s briefing', 'What needs my attention right now?', 'Compare the branches today', 'Why is the weakest branch behind?'],
};

export const SPEC_BY_ID = Object.fromEntries(SPECIALISTS.map((s) => [s.id, s]));

/** Agents this user can use: a specialist is available when the role can run at least one of its data tools. */
export function availableAgents(p) {
  return SPECIALISTS.map((s) => {
    const tools = s.tools.filter((t) => TOOL_BY_NAME[t] && TOOL_BY_NAME[t].perm && toolAllowed(p, TOOL_BY_NAME[t]));
    return { ...s, allowedTools: tools, available: tools.length > 0 };
  });
}
