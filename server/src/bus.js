// In-process event bus + per-user filtered Server-Sent Events.
import { eventVisible } from './policy.js';

const clients = new Set(); // { res, user }
const recent = []; // ring buffer so a freshly opened dashboard has context

export function sseHandler(req, res) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.write('retry: 3000\n\n');
  const client = { res, user: req.user };
  clients.add(client);
  const ping = setInterval(() => res.write(': ping\n\n'), 20000);
  req.on('close', () => { clearInterval(ping); clients.delete(client); });
}

export function publish(type, data) {
  // The event kind always wins; a payload's own 'type' (e.g. a vision check name) moves to 'check'
  const { type: check, ...rest } = data;
  const evt = { ...rest, ...(check !== undefined ? { check } : {}), type, ts: Date.now() };
  if (type !== 'reading' && !(type === 'vision' && data.ok)) { recent.push(evt); if (recent.length > 150) recent.shift(); }
  const msg = `event: ${type}\ndata: ${JSON.stringify(evt)}\n\n`;
  for (const c of clients) if (eventVisible(c.user, type, evt)) c.res.write(msg);
  for (const fn of subscribers) { try { fn(type, evt); } catch { /* a subscriber never breaks the bus */ } }
}

// In-process listeners (e.g. the Telegram bot's push alerts). Each subscriber filters by permission itself.
const subscribers = new Set();
export const subscribe = (fn) => { subscribers.add(fn); return () => subscribers.delete(fn); };

export const recentEvents = (user) => recent.filter((e) => eventVisible(user, e.type, e)).reverse().slice(0, 60);
