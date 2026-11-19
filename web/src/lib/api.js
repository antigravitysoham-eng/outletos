import { useCallback, useEffect, useRef, useState } from 'react';

const TOKEN_KEY = 'outletos_token';
export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
export const setToken = (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* storage blocked */ } };
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

export async function api(path, { method = 'GET', body, headers = {} } = {}) {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(body !== undefined && typeof body !== 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith('/auth') && !path.startsWith('/v1')) onUnauthorized();
  if (!res.ok) throw Object.assign(new Error(data.error || `HTTP ${res.status}`), { status: res.status });
  return data;
}

// ---- one live connection per browser, shared by every tab ----
// Browsers allow only 6 HTTP/1.1 connections per host across all tabs, so one stream per tab starves page loads once a
// few tabs are open. One tab wins a Web Lock and holds the only EventSource; it relays events and connection status to
// the other tabs over a BroadcastChannel. When that tab closes its lock is released and another tab takes over.
const listeners = new Set();
const statusListeners = new Set();
let source = null, connected = false, wanted = false, releaseLock = null, bc = null;
const EVENT_TYPES = ['order', 'ticket', 'vision', 'attendance', 'reading', 'review', 'alert', 'guest'];
const dispatch = (d) => listeners.forEach((fn) => fn(d));
const setConnected = (v) => { connected = v; statusListeners.forEach((fn) => fn(v)); };
const canShare = () => typeof BroadcastChannel !== 'undefined' && typeof navigator !== 'undefined' && !!navigator.locks;

function connect() {
  source = new EventSource(`/api/stream?token=${encodeURIComponent(getToken())}`);
  const status = (v) => { setConnected(v); bc?.postMessage({ kind: 'status', v }); };
  source.onopen = () => status(true);
  source.onerror = () => status(false);
  for (const t of EVENT_TYPES) source.addEventListener(t, (e) => { const d = JSON.parse(e.data); dispatch(d); bc?.postMessage({ kind: 'evt', d }); });
}

export function openStream() {
  if (wanted || !getToken()) return;
  wanted = true;
  if (!canShare()) { connect(); return; }
  const session = getToken().slice(-16);
  bc = new BroadcastChannel(`outletos-live:${session}`);
  bc.onmessage = ({ data: m }) => {
    if (m.kind === 'evt') dispatch(m.d);
    else if (m.kind === 'status') setConnected(m.v);
    else if (m.kind === 'hello' && source) bc.postMessage({ kind: 'status', v: connected });
  };
  // Lock per signed-in session, so a different user in the same browser never reads another user's events
  navigator.locks.request(`outletos-live:${session}`, () => new Promise((resolve) => {
    if (!wanted) return resolve();
    releaseLock = resolve;
    connect();
  })).catch(() => {});
  bc.postMessage({ kind: 'hello' });
}

export function closeStream() {
  wanted = false;
  source?.close(); source = null;
  releaseLock?.(); releaseLock = null;
  bc?.close(); bc = null;
  setConnected(false);
}
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => { source?.close(); source = null; releaseLock?.(); releaseLock = null; });
  // Restored from the back/forward cache: the old connection was closed on pagehide, so start over
  window.addEventListener('pageshow', (e) => { if (e.persisted && wanted) { closeStream(); openStream(); } });
}

export function useStream(handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => { openStream(); const fn = (d) => ref.current(d); listeners.add(fn); return () => listeners.delete(fn); }, []);
}
export function useConnection() {
  const [ok, setOk] = useState(connected);
  useEffect(() => { statusListeners.add(setOk); setOk(connected); return () => statusListeners.delete(setOk); }, []);
  return ok;
}

/** Fetch and keep fresh: refetch on matching live events (throttled) and on an interval. */
export function useLive(path, { types = null, throttle = 3000, interval = 20000 } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const last = useRef(0), pending = useRef(null);
  const load = useCallback(async () => {
    if (!path) return;
    last.current = Date.now();
    try { setData(await api(path)); setError(null); } catch (e) { setError(e.message); }
  }, [path]);
  useEffect(() => {
    setData(null); setError(null); load();
    const id = setInterval(load, interval);
    return () => { clearInterval(id); clearTimeout(pending.current); pending.current = null; };
  }, [load, interval]);
  useStream((evt) => {
    if (evt.type === 'resume') return load();
    if (!types || !types.includes(evt.type)) return;
    const wait = throttle - (Date.now() - last.current);
    if (wait <= 0) load();
    else if (!pending.current) pending.current = setTimeout(() => { pending.current = null; load(); }, wait);
  });
  return { data, error, reload: load };
}

// ---- formatting ----
// Currency and number style come from the instance (/api/me): USD/en-US for the global demo, INR/en-IN (lakh, crore) for India
let CUR = { code: 'USD', symbol: '$', locale: 'en-US' };
export const setCurrency = (c) => { if (c?.code) CUR = { ...CUR, ...c }; };
export const currency = () => CUR;
export function money(v, { compact = true, cents = false } = {}) {
  if (v == null || Number.isNaN(v)) return '—';
  const a = Math.abs(v), s = CUR.symbol, neg = v < 0 ? '−' : '';
  if (CUR.code === 'INR' && compact) {
    if (a >= 1e7) return `${neg}${s}${(a / 1e7).toFixed(2)} Cr`;
    if (a >= 1e5) return `${neg}${s}${(a / 1e5).toFixed(2)} L`;
    if (a >= 10_000) return `${neg}${s}${(a / 1e3).toFixed(1)}k`;
  } else {
    if (compact && a >= 1_000_000) return `${neg}${s}${(a / 1e6).toFixed(2)}M`;
    if (compact && a >= 10_000) return `${neg}${s}${(a / 1e3).toFixed(1)}k`;
  }
  return `${neg}${s}${a.toLocaleString(CUR.locale, { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 })}`;
}
export const num = (v) => (v == null ? '—' : Math.round(v).toLocaleString(CUR.locale));
export const pct = (v, d = 0) => (v == null || Number.isNaN(v) ? '—' : `${(v * 100).toFixed(d)}%`);
export const mmss = (sec) => { if (sec == null) return '—'; const s = Math.max(0, Math.round(sec)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export const clock = (ts) => (ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—');
export function ago(ts) {
  if (!ts) return '—';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}
export const delta = (a, b) => (b ? (a - b) / b : null);
export const initials = (name = '') => name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

export const BRANCH_COLORS = { r1: '#D92D3A', r2: '#F97316', r3: '#12B76A', r4: '#0BA5EC', r5: '#8B5CF6', r6: '#F5B300' };
export const SOURCE_COLORS = ['#D92D3A', '#F97316', '#7C5CFF', '#9E8CFF', '#0BA5EC', '#36BFFA', '#12B76A', '#E8488A', '#F5B300', '#B42318', '#2ED3B7'];
