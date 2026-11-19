// Returning-guest intelligence: builds a profile from order history and turns it into
// concrete, explainable suggestions for the host, server and kitchen.
import { INSTANCE } from './instance.js';
import { db } from './db.js';

const DAY = 86400_000;
export const maskPhone = (p) => (p ? p.replace(/(\+\d+ )\d+(\d{4})$/, '$1••••$2') : '');

// spend thresholds are in the instance currency (≈ ×80 for INR)
const SCALE = INSTANCE.id === 'india' ? 80 : 1;
export const LOYALTY_RATE = 0.05; // 5% of spend back as wallet credit
function tierFor(visits, spend) {
  if (visits >= 12 || spend >= 900 * SCALE) return 'Gold';
  if (visits >= 5 || spend >= 350 * SCALE) return 'Silver';
  return visits >= 2 ? 'Regular' : 'New';
}

export function guestProfile(id, { at = null, pii = false } = {}) {
  const g = db.prepare('SELECT * FROM guests WHERE id = ?').get(id);
  if (!g) return null;
  const stats = db.prepare(`SELECT COUNT(*) visits, COALESCE(SUM(total), 0) spend, MAX(closed_at) last, MIN(closed_at) first,
      SUM(CASE WHEN channel IN ('delivery','online') THEN 1 ELSE 0 END) online
    FROM orders WHERE guest_id = ?`).get(id);
  const fav = db.prepare(`SELECT m.id, m.name, m.category, m.tags, SUM(oi.qty) qty FROM order_items oi
      JOIN orders o ON o.id = oi.order_id JOIN menu_items m ON m.id = oi.item_id
    WHERE o.guest_id = ? GROUP BY m.id ORDER BY qty DESC LIMIT 6`).all(id);
  const recent = db.prepare(`SELECT o.id, o.outlet_id, o.channel, o.platform, o.total, o.closed_at, o.covers,
      (SELECT GROUP_CONCAT(m.name, ', ') FROM order_items oi JOIN menu_items m ON m.id = oi.item_id WHERE oi.order_id = o.id) items
    FROM orders o WHERE o.guest_id = ? ORDER BY o.closed_at DESC LIMIT 6`).all(id);
  const allergies = (g.allergies || '').split(',').filter(Boolean);
  const ordered = new Set(fav.map((f) => f.id));
  const safe = (tags) => !allergies.some((a) => (tags || '').includes(a === 'seafood' ? 'seafood' : a) || (a === 'seafood' && (tags || '').includes('fish')));
  const menu = db.prepare('SELECT * FROM menu_items').all();
  const popular = db.prepare(`SELECT item_id, SUM(qty) q FROM order_items WHERE ts > ? ${at ? 'AND outlet_id = ?' : ''} GROUP BY item_id ORDER BY q DESC`)
    .all(...(at ? [Date.now() - 7 * DAY, at] : [Date.now() - 7 * DAY])).map((r) => r.item_id);

  const visits = stats.visits;
  const tier = tierFor(visits, stats.spend);
  const daysSince = stats.last ? Math.floor((Date.now() - stats.last) / DAY) : null;
  const top = fav.find((f) => f.category !== 'Drinks') || fav[0];
  const favDrink = fav.find((f) => f.category === 'Drinks');
  const s = [];

  if (allergies.length) {
    const avoid = menu.filter((m) => !safe(m.tags)).map((m) => m.name).slice(0, 4);
    s.push({ kind: 'allergy', priority: 1, text: `Allergy: ${allergies.join(', ')}. Flag to kitchen; avoid ${avoid.join(', ')}.` });
  }
  if (top) s.push({ kind: 'reorder', priority: 2, text: `Usually orders ${top.name} (${top.qty}×). Offer it first.` });
  const fresh = menu.find((m) => m.is_new && !ordered.has(m.id) && safe(m.tags) && (!top || m.category === top.category))
    || menu.find((m) => m.is_new && !ordered.has(m.id) && safe(m.tags));
  if (fresh) s.push({ kind: 'try', priority: 3, text: `New on the menu: ${fresh.name}. Matches their taste for ${top ? top.category.toLowerCase() : 'our classics'}.` });
  const pairCat = top && ['Mains', 'Pizza', 'Biryani', 'Starters'].includes(top.category) ? 'Desserts' : 'Drinks';
  const pair = fav.find((f) => f.category === pairCat) || menu.find((m) => m.category === pairCat && safe(m.tags) && popular.includes(m.id));
  if (pair) s.push({ kind: 'pair', priority: 4, text: `Pair with ${pair.name}${fav.some((f) => f.id === pair.id) ? ', a past favourite' : ', popular this week'}.` });
  if (daysSince != null && daysSince >= 21) s.push({ kind: 'winback', priority: 2, text: `First visit in ${daysSince} days. Welcome back with a complimentary dessert.` });
  if ([5, 10, 25, 50].includes(visits + 1)) s.push({ kind: 'milestone', priority: 2, text: `This is visit #${visits + 1}. Thank them personally.` });
  const [mm, dd] = (g.birthday || '').split('-').map(Number);
  if (mm) {
    const today = new Date(); const bd = new Date(today.getFullYear(), mm - 1, dd);
    const diff = Math.round((bd - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / DAY);
    if (diff >= 0 && diff <= 7) s.push({ kind: 'birthday', priority: 1, text: diff === 0 ? 'Birthday today. Prepare a candle on dessert.' : `Birthday in ${diff} days. Offer a celebration dessert.` });
  }
  s.push({ kind: 'comfort', priority: 5, text: `Prefers ${g.seating.toLowerCase()} seating · start them with ${(favDrink?.name ?? g.drink).toLowerCase()}.` });
  if (tier === 'Gold') s.push({ kind: 'vip', priority: 2, text: 'Gold guest. Manager to greet; prioritise their kitchen tickets.' });
  if (stats.online >= 3 && visits - stats.online <= 1) s.push({ kind: 'channel', priority: 4, text: `Mostly orders delivery (${stats.online}×). Mention the dine-in loyalty perk.` });

  return {
    id: g.id, name: g.name, phone: pii ? g.phone : maskPhone(g.phone), home_outlet: g.home_outlet, tier, visits,
    spend: Math.round(stats.spend), avg_spend: visits ? Math.round(stats.spend / visits) : 0, last_visit: stats.last, first_visit: stats.first,
    days_since: daysSince, online_orders: stats.online, allergies, seating: g.seating, drink: g.drink, birthday: g.birthday,
    consent_face: !!g.consent_face, favorites: fav.map((f) => ({ id: f.id, name: f.name, category: f.category, qty: f.qty })),
    recent, suggestions: s.sort((a, b) => a.priority - b.priority),
    loyalty: { rate: LOYALTY_RATE, earned: Math.round(stats.spend * LOYALTY_RATE), next_tier: tier === 'Gold' ? null : tier === 'Silver' ? 'Gold' : 'Silver' },
  };
}
