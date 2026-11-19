// The group's operating playbook: the knowledge agents use to explain numbers and recommend the
// right procedure. Replace or extend these entries with your own SOPs; search is a small BM25-style
// keyword ranker, so no vector database or external service is needed.
export const PLAYBOOK = [
  { id: 'haccp-cold', title: 'Cold holding limits (HACCP CCP-3)', tags: 'fridge walk-in cooler prep chiller temperature cold chain haccp',
    text: 'Chilled food must be held at 5°C or below (walk-in 0-5°C, prep fridge 1-5°C, dessert chiller 1-6°C, bar fridge 2-7°C). Above 5°C for more than 30 minutes: move high-risk stock to another unit, log the corrective action, and call maintenance. Above 8°C for 2 hours: discard high-risk food (dairy, cooked meats, seafood, prepared sauces).' },
  { id: 'haccp-frozen', title: 'Frozen storage limits', tags: 'freezer frozen -18 -16 temperature haccp defrost',
    text: 'Freezers must hold -18°C or colder; the alert threshold is -16°C. A short rise during a delivery or defrost cycle is normal. If above -15°C for 45 minutes, check the door seal and condenser, move stock to a working freezer, and do not refreeze anything that has started to thaw.' },
  { id: 'haccp-humidity', title: 'Dry store humidity', tags: 'humidity dry store 65 mould',
    text: 'Dry store relative humidity should stay between 35% and 65%. Above 65% for a day raises mould and pest risk: improve ventilation, check for leaks, and rotate flour, rice and spices first.' },
  { id: 'hygiene-hands', title: 'Hand-washing and gloves', tags: 'handwash hand wash gloves bare hand plating hygiene vision',
    text: 'Wash hands for at least 20 seconds on entering the kitchen, after raw protein, after the toilet, and after touching the face or phone. Gloves are required for ready-to-eat plating. Ceiling CCTV cannot reliably see gloves or a proper hand-wash, so these camera checks are audit-tier: flags go to a supervisor review queue with the clip and never page anyone automatically. Real-time camera alerts (2 high or 3 medium in 15 minutes) cover reliable checks only: unstaffed station, after-hours cold-store entry, walk-in door left open, unattended counter. First breach: coach on the spot. Repeated: written note by the head chef.' },
  { id: 'hygiene-ppe', title: 'Hair covering, uniform and phones', tags: 'hairnet hair covering cap apron uniform phone ppe vision',
    text: 'Hair must be covered on the line; clean apron each shift; no personal phones on the line (phones stay in lockers). These are medium/low severity checks and escalate only on repetition. Treat camera findings as coaching, and recognise high-compliance teams in the weekly huddle.' },
  { id: 'vision-privacy', title: 'Camera AI privacy rules', tags: 'privacy camera cctv face recognition consent dpdp gdpr',
    text: 'Video is processed on the edge box in each restaurant and never leaves site; only events are sent. Face matching is used only for guests who opted in to loyalty face recognition, never for staff discipline. Violation snapshots are blurred and expire after 30 days.' },
  { id: 'speed-targets', title: 'Speed-of-service targets', tags: 'ticket time speed kitchen station target on-time slow',
    text: 'Every dish has its own target ticket time set on the menu (about 5 minutes for cold starters up to 15 for grill mains). On-time rate below 80% for an hour means the station needs help. A ticket over 2x its target raises a speed alert for that station. Fixes, in order: re-sequence fires, move a floater to the station, 86 the slowest dish temporarily, check equipment.' },
  { id: 'tpph', title: 'TPPH: transactions per person-hour', tags: 'tpph productivity labour hour staffing orders per labour hour',
    text: 'TPPH = orders closed / labour hours worked in the same hour. Group target is 3.0 for the whole team and 4.8 for the kitchen-only view. Below 75% of target is overstaffed (send someone on break or home early, start prep for tomorrow). Above 125% is understaffed (call in the on-call cook, open the second pass). Recommended headcount = orders per hour / target, minimum 2.' },
  { id: 'labour-metrics', title: 'Other labour metrics', tags: 'lhpo splh labour cost sales per labour hour guests per labour hour',
    text: 'Labour hours per order (LHPO) is the inverse of TPPH. Sales per labour hour (SPLH) = sales / labour hours. Labour cost uses fully-loaded hourly rates (wage x 3 for taxes, benefits and overheads). Labour % above 35% of sales in fine dining needs attention.' },
  { id: 'prime-cost', title: 'Prime cost', tags: 'prime cost food cost labour cost finance margin cogs',
    text: 'Prime cost = (food cost + labour cost) / sales. Fine-dining benchmark: food 28-32%, labour 30-35%, prime 60-65%. Prime above 65% for a week: review portion sizes, high-cost dishes with low sales, overtime and overstaffed hours.' },
  { id: 'health-score', title: 'Outlet Health Score', tags: 'health score branch score pillars weights',
    text: 'The Outlet Health Score (0-100) is a weighted blend: sales pace vs yesterday 20, speed of service 20, hygiene compliance 20, staff attendance 15, cold chain in range 15, guest sentiment 10. Below 70 needs the area manager\'s attention today; look at the lowest pillar first.' },
  { id: 'attendance', title: 'Attendance and lateness', tags: 'late absent attendance clock in shift no show',
    text: 'Clock-in more than 10 minutes after shift start counts as late; more than 30 minutes with no clock-in is absent. Two lates in a week: a conversation with the manager. A no-show during service: call the on-call list first, then re-assign stations by priority (grill, pass, sauté).' },
  { id: 'guest-service', title: 'Returning-guest service standards', tags: 'guest returning vip gold allergy birthday welcome back host suggestions',
    text: 'Greet returning guests by name within 60 seconds. Allergies are always flagged to the kitchen on the ticket before ordering. Gold guests are greeted by the manager and their tickets are prioritised. Guests away for 21+ days get a complimentary dessert. Birthdays within 7 days get a celebration dessert.' },
  { id: 'reviews', title: 'Responding to reviews', tags: 'review negative rating complaint response google tripadvisor',
    text: 'Reply to every negative review within 24 hours: thank them, name the specific issue, say what changed, invite them back with the manager\'s name. Never argue or share guest details. Three reviews mentioning the same issue in a week is a pattern: raise it at the next line-up.' },
  { id: 'escalation', title: 'Alert escalation rules', tags: 'alert escalation incident severity acknowledge',
    text: 'High-severity alerts must be acknowledged within 10 minutes by the branch manager or head chef. Acknowledge only once the cause is known and the corrective action is under way. Cold-chain and hygiene alerts stay on the HACCP log even after acknowledgement.' },
  { id: 'channels', title: 'Online vs in-store channels', tags: 'online delivery website dine-in takeaway channel commission',
    text: 'Online = delivery apps plus the group website; in-store = dine-in plus takeaway. Delivery apps charge roughly 15-30% commission, so the website and dine-in are the most profitable channels. If online share rises above 40% at a fine-dining branch, check dine-in demand and table availability.' },
];

const tokenize = (s) => String(s).toLowerCase().replace(/[^a-z0-9°%\-\s]/g, ' ').split(/\s+/).filter((w) => w.length > 1);
const DOCS = PLAYBOOK.map((d) => ({ ...d, terms: tokenize(`${d.title} ${d.tags} ${d.tags} ${d.text}`) }));
const avgLen = DOCS.reduce((a, d) => a + d.terms.length, 0) / DOCS.length;
const df = new Map();
DOCS.forEach((d) => new Set(d.terms).forEach((t) => df.set(t, (df.get(t) || 0) + 1)));

export function searchPlaybook(query, k = 3) {
  const q = tokenize(query);
  return DOCS.map((d) => {
    let score = 0;
    for (const t of q) {
      const tf = d.terms.filter((x) => x === t || (t.length > 4 && x.startsWith(t.slice(0, -1)))).length;
      if (!tf) continue;
      const idf = Math.log(1 + (DOCS.length - (df.get(t) || 0) + 0.5) / ((df.get(t) || 0) + 0.5));
      score += idf * (tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * d.terms.length / avgLen));
    }
    return { id: d.id, title: d.title, text: d.text, score };
  }).filter((d) => d.score > 0).sort((a, b) => b.score - a.score).slice(0, k).map(({ score, ...d }) => d);
}
