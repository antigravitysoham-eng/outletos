import { INSTANCE } from './instance.js'; // first: sets the instance time zone before anything reads the clock
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || resolve(__dirname, '../data', INSTANCE.db);
mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');

db.exec(`
CREATE TABLE IF NOT EXISTS outlets (
  id TEXT PRIMARY KEY, name TEXT, location TEXT, city TEXT, country TEXT, region TEXT,
  seats INTEGER, manager TEXT, daily_target REAL, platforms TEXT
);
CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY, name TEXT, category TEXT, price REAL, cost REAL, station TEXT,
  prep_sec INTEGER, tags TEXT, is_new INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY, outlet_id TEXT, name TEXT, role TEXT, department TEXT, station TEXT,
  hourly_rate REAL, shift_start INTEGER, shift_end INTEGER, external_id TEXT
);
CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id TEXT, outlet_id TEXT,
  ts_in INTEGER, ts_out INTEGER, method TEXT, late_min INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT, outlet_id TEXT, external_id TEXT, source TEXT,
  channel TEXT, platform TEXT, payment TEXT, guest_id TEXT, covers INTEGER, total REAL,
  food_cost REAL, table_no TEXT, opened_at INTEGER, closed_at INTEGER
);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER, outlet_id TEXT, item_id TEXT,
  qty INTEGER, price REAL, ts INTEGER
);
CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT, outlet_id TEXT, order_id INTEGER, item_id TEXT, item TEXT,
  station TEXT, table_no TEXT, channel TEXT, target_sec INTEGER, fired_at INTEGER, ready_at INTEGER
);
CREATE TABLE IF NOT EXISTS cameras (
  id TEXT PRIMARY KEY, outlet_id TEXT, name TEXT, zone TEXT, stream_url TEXT, status TEXT
);
CREATE TABLE IF NOT EXISTS vision_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, outlet_id TEXT, camera_id TEXT, type TEXT,
  ok INTEGER, severity TEXT, label TEXT, confidence REAL, people INTEGER, ts INTEGER
);
CREATE TABLE IF NOT EXISTS sensors (
  id TEXT PRIMARY KEY, outlet_id TEXT, name TEXT, kind TEXT, unit TEXT, min REAL, max REAL, base REAL
);
CREATE TABLE IF NOT EXISTS readings ( id INTEGER PRIMARY KEY AUTOINCREMENT, sensor_id TEXT, value REAL, ts INTEGER );
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT, outlet_id TEXT, platform TEXT, rating REAL,
  author TEXT, text TEXT, sentiment TEXT, ts INTEGER
);
CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, outlet_id TEXT, category TEXT, severity TEXT, station TEXT,
  title TEXT, detail TEXT, dedupe_key TEXT, ts INTEGER, ack INTEGER DEFAULT 0, ack_by TEXT
);
CREATE TABLE IF NOT EXISTS guests (
  id TEXT PRIMARY KEY, name TEXT, phone TEXT, home_outlet TEXT, tier TEXT, birthday TEXT,
  allergies TEXT, seating TEXT, drink TEXT, favorites TEXT, consent_face INTEGER, created_at INTEGER
);
CREATE TABLE IF NOT EXISTS guest_visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT, guest_id TEXT, outlet_id TEXT, ts INTEGER, method TEXT,
  confidence REAL, table_no TEXT, covers INTEGER
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, username TEXT UNIQUE, name TEXT, role TEXT, branches TEXT, station TEXT,
  password_hash TEXT, active INTEGER DEFAULT 1, created_at INTEGER
);
CREATE TABLE IF NOT EXISTS connectors (
  id TEXT PRIMARY KEY, name TEXT, kind TEXT, target TEXT, mapping TEXT,
  created_at INTEGER, last_seen INTEGER, received INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS settings ( key TEXT PRIMARY KEY, value TEXT );

CREATE INDEX IF NOT EXISTS ix_orders_ts ON orders(closed_at, outlet_id);
CREATE INDEX IF NOT EXISTS ix_orders_guest ON orders(guest_id);
CREATE INDEX IF NOT EXISTS ix_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS ix_items_ts ON order_items(ts, outlet_id);
CREATE INDEX IF NOT EXISTS ix_tickets_ts ON tickets(outlet_id, fired_at);
CREATE INDEX IF NOT EXISTS ix_tickets_open ON tickets(ready_at);
CREATE INDEX IF NOT EXISTS ix_vision_ts ON vision_events(outlet_id, ts);
CREATE INDEX IF NOT EXISTS ix_vision_cam ON vision_events(camera_id, ts);
CREATE INDEX IF NOT EXISTS ix_readings ON readings(sensor_id, ts);
CREATE INDEX IF NOT EXISTS ix_alerts_ts ON alerts(ts);
CREATE INDEX IF NOT EXISTS ix_alerts_key ON alerts(dedupe_key, ts);
CREATE INDEX IF NOT EXISTS ix_att ON attendance(staff_id, ts_in);
CREATE INDEX IF NOT EXISTS ix_visits ON guest_visits(outlet_id, ts);
`);

// Additive migrations (safe on existing databases): edge-agent event detail + camera health
for (const [table, col, type] of [
  ['vision_events', 'zone', 'TEXT'], ['vision_events', 'track_id', 'TEXT'], ['vision_events', 'duration_s', 'REAL'], ['vision_events', 'text', 'TEXT'], ['vision_events', 'source', 'TEXT'],
  ['cameras', 'last_seen', 'INTEGER'], ['cameras', 'fps', 'REAL'], ['cameras', 'latency_ms', 'INTEGER'], ['cameras', 'model', 'TEXT'], ['cameras', 'agent', 'TEXT'],
  ['orders', 'tax', 'REAL'], ['users', 'email', 'TEXT'], ['outlets', 'type', 'TEXT'], ['outlets', 'hours', 'TEXT'], ['outlets', 'profile', 'TEXT'], ['outlets', 'state', 'TEXT'], ['outlets', 'gstin', 'TEXT'], ['outlets', 'fssai', 'TEXT'],
  ['connectors', 'catalog_id', 'TEXT'], ['connectors', 'config', 'TEXT'], ['connectors', 'status', 'TEXT'], ['connectors', 'last_error', 'TEXT'],
]) {
  if (!db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
}

export const getSetting = (key, fallback = null) => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? JSON.parse(row.value) : fallback;
};
export const setSetting = (key, value) =>
  db.prepare('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, JSON.stringify(value));

export const tx = (fn) => {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; }
  catch (e) { db.exec('ROLLBACK'); throw e; }
};

/** Local midnight of the current business day. */
export const midnight = (t = Date.now()) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const inList = (arr) => arr.map(() => '?').join(',') || "''";
