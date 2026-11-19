// Shared toolkit for the OutletOS document set: icons, images, diagram primitives, sequence diagrams.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------- icons: read lucide's icon data straight from the installed package ----------
const ICON_DIR = resolve(ROOT, 'node_modules/lucide-react/dist/esm/icons');
const iconCache = new Map();
export function icon(name, { size = 20, color = 'currentColor', stroke = 2 } = {}) {
  if (!iconCache.has(name)) {
    const file = resolve(ICON_DIR, `${name}.mjs`);
    if (!existsSync(file)) throw new Error(`icon not found: ${name}`);
    let src = readFileSync(file, 'utf8');
    const alias = src.match(/export \{ default \} from '\.\/([\w-]+)\.mjs'/);   // lucide alias files re-export the real icon
    if (alias) src = readFileSync(resolve(ICON_DIR, `${alias[1]}.mjs`), 'utf8');
    const start = src.indexOf('[', src.indexOf('node:'));
    let depth = 0, end = start;
    for (; end < src.length; end++) { if (src[end] === '[') depth++; else if (src[end] === ']' && --depth === 0) break; }
    iconCache.set(name, new Function(`return ${src.slice(start, end + 1)}`)());
  }
  const inner = iconCache.get(name).map(([tag, attrs]) =>
    `<${tag} ${Object.entries(attrs).filter(([k]) => k !== 'key').map(([k, v]) => `${k}="${v}"`).join(' ')}/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

// ---------- images (embedded so every HTML file is self-contained) ----------
export const shot = (name) => `data:image/jpeg;base64,${readFileSync(resolve(ROOT, 'marketing/shots', name)).toString('base64')}`;
export const LOGO = `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#D92D3A"/><stop offset="1" stop-color="#F97316"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="url(#lg)"/><path d="M20 34a12 12 0 0 0 24 0" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/><circle cx="32" cy="22" r="5" fill="#fff"/></svg>`;

// ---------- diagram primitives (styled by the .dg-* classes in the technical document) ----------
let uid = 0;
export function diagram(viewW, viewH, aria, body, caption) {
  const id = `m${++uid}`;
  const inner = body(id);
  return `<figure class="dg"><div class="dg-scroll"><svg viewBox="0 0 ${viewW} ${viewH}" role="img" aria-label="${esc(aria)}" preserveAspectRatio="xMidYMid meet"><defs>
<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="dg-head"/></marker>
<marker id="${id}s" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="dg-head-soft"/></marker>
</defs>${inner}</svg></div><figcaption>${caption}</figcaption></figure>`;
}
export function box(x, y, w, h, title, sub = '', cls = '') {
  const cx = x + w / 2, cy = y + h / 2;
  const t = sub ? `<text x="${cx}" y="${cy - 4}" class="dg-t">${esc(title)}</text><text x="${cx}" y="${cy + 12}" class="dg-s">${esc(sub)}</text>`
    : `<text x="${cx}" y="${cy + 4.5}" class="dg-t">${esc(title)}</text>`;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" class="dg-box ${cls}"/>${t}`;
}
export function zone(x, y, w, h, label, cls = '') {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" class="dg-zone ${cls}"/><text x="${x + 14}" y="${y + 20}" class="dg-z">${esc(label)}</text>`;
}
/** Orthogonal edge through points; soft = dashed secondary flow; both = arrowheads at both ends */
export function edge(id, pts, { soft = false, both = false, head = true } = {}) {
  const m = soft ? `${id}s` : id;
  return `<polyline points="${pts.map((p) => p.join(',')).join(' ')}" class="dg-edge${soft ? ' dash soft' : ''}" fill="none"${head ? ` marker-end="url(#${m})"` : ''}${both ? ` marker-start="url(#${m})"` : ''}/>`;
}
export const label = (x, y, text, anchor = 'middle') => `<text x="${x}" y="${y}" class="dg-e" text-anchor="${anchor}">${esc(text)}</text>`;
export const dot = (x, y) => `<circle cx="${x}" cy="${y}" r="3.2" class="dg-head"/>`;
export function diamond(cx, cy, hw, hh, title, sub = '') {
  return `<polygon points="${cx},${cy - hh} ${cx + hw},${cy} ${cx},${cy + hh} ${cx - hw},${cy}" class="dg-box dec"/>`
    + (sub ? `<text x="${cx}" y="${cy - 3}" class="dg-t">${esc(title)}</text><text x="${cx}" y="${cy + 13}" class="dg-s">${esc(sub)}</text>`
      : `<text x="${cx}" y="${cy + 4.5}" class="dg-t">${esc(title)}</text>`);
}
/** Gane-Sarson data store: open-ended box with an id cell */
export function store(x, y, w, h, sid, name) {
  return `<path d="M${x + w} ${y} H${x} V${y + h} H${x + w}" class="dg-store"/><line x1="${x + 34}" y1="${y}" x2="${x + 34}" y2="${y + h}" class="dg-store"/>`
    + `<text x="${x + 17}" y="${y + h / 2 + 4}" class="dg-s" style="font-weight:600">${esc(sid)}</text><text x="${x + 44}" y="${y + h / 2 + 4.5}" class="dg-t" style="text-anchor:start;font-size:12px">${esc(name)}</text>`;
}
/** Entity box for the data model */
export function entity(x, y, w, name, fields, cls = '') {
  const h = 30 + fields.length * 17 + 8;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" class="dg-box ${cls}"/><path d="M${x} ${y + 28} H${x + w}" class="dg-store"/>`
    + `<text x="${x + 12}" y="${y + 19}" class="dg-t" style="text-anchor:start">${esc(name)}</text>`
    + fields.map((f, i) => `<text x="${x + 12}" y="${y + 46 + i * 17}" class="dg-s" style="text-anchor:start">${esc(f)}</text>`).join('');
}

/** Horizontal pipeline of numbered steps with optional drop-down branches */
export function pipeline(id, steps, { y = 70, w = 122, gap = 16, x0 = 20, h = 58 } = {}) {
  let s = '';
  steps.forEach((st, i) => {
    const x = x0 + i * (w + gap);
    s += box(x, y, w, h, st.t, st.s || '', st.cls || '');
    if (i < steps.length - 1) s += edge(id, [[x + w, y + h / 2], [x + w + gap, y + h / 2]]);
    if (st.down) {
      const cx = x + w / 2;
      s += edge(id, [[cx, y + h], [cx, y + h + 46]], { soft: !!st.down.soft });
      if (st.down.lbl) s += label(cx + 6, y + h + 28, st.down.lbl, 'start');
      s += box(x - 6, y + h + 46, w + 12, 50, st.down.t, st.down.s || '', st.down.cls || 'out');
    }
  });
  return s;
}

/** Auto-laid-out sequence diagram. msgs: {f,t,l,d(dashed)} | {self:i,l} | {frame:'label', rows:n} */
export function sequence(parts, msgs, { width = 980, top = 20, step = 34 } = {}) {
  const n = parts.length, colW = width / n, xs = parts.map((_, i) => colW * i + colW / 2);
  let y = top + 70, rows = '', frames = [];
  for (const m of msgs) {
    if (m.frame) { frames.push({ label: m.frame, y0: y - 14, rows: m.rows, x0: Math.min(...m.span.map((i) => xs[i])) - colW / 2 + 14, x1: Math.max(...m.span.map((i) => xs[i])) + colW / 2 - 14 }); y += 34; continue; }
    if (m.self !== undefined) {
      const x = xs[m.self];
      rows += `<polyline points="${x},${y - 6} ${x + 44},${y - 6} ${x + 44},${y + 14} ${x + 6},${y + 14}" class="dg-edge" fill="none" marker-end="url(#ID)"/>`
        + `<text x="${x + 52}" y="${y + 8}" class="dg-e" text-anchor="start">${esc(m.l)}</text>`;
      y += step + 6; continue;
    }
    const x1 = xs[m.f] + (m.t > m.f ? 4 : -4), x2 = xs[m.t] + (m.t > m.f ? -4 : 4);
    rows += `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" class="dg-edge${m.d ? ' dash soft' : ''}" marker-end="url(#ID${m.d ? 's' : ''})"/>`
      + `<text x="${(xs[m.f] + xs[m.t]) / 2}" y="${y - 7}" class="dg-e" text-anchor="middle">${esc(m.l)}</text>`;
    y += step;
  }
  const H = y + 10;
  const heads = parts.map((p, i) => `<rect x="${xs[i] - Math.min(70, colW / 2 - 6)}" y="${top}" width="${Math.min(140, colW - 12)}" height="44" rx="8" class="dg-box ${p.cls || ''}"/><text x="${xs[i]}" y="${top + (p.s ? 19 : 26)}" class="dg-t">${esc(p.t)}</text>${p.s ? `<text x="${xs[i]}" y="${top + 34}" class="dg-s">${esc(p.s)}</text>` : ''}<line x1="${xs[i]}" y1="${top + 44}" x2="${xs[i]}" y2="${H - 6}" class="dg-life"/>`).join('');
  // frames: height computed from following rows
  let fr = '';
  frames.forEach((f) => { const h = f.rows * step + 36; fr += `<rect x="${f.x0}" y="${f.y0}" width="${f.x1 - f.x0}" height="${h}" rx="8" class="dg-frame"/><text x="${f.x0 + 12}" y="${f.y0 + 15}" class="dg-z">${esc(f.label)}</text>`; });
  return { h: H, body: (id) => heads + fr + rows.replaceAll('url(#ID)', `url(#${id})`).replaceAll('url(#IDs)', `url(#${id}s)`) };
}
