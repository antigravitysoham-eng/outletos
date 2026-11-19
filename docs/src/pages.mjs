// Print-first A4 page system shared by the training guide, one-pager and case study.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, LOGO, icon, esc } from './lib.mjs';

export const FONTS = '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet" />';

export const PAGE_CSS = `
:root{--crimson:#D92D3A;--wine:#7A1A22;--deep:#1A0B0E;--orange:#F97316;--ink:#16100F;--ink2:#40373A;--ink3:#776B6E;--rule:#ECE5E3;--paper:#FBF9F8;--soft:#FDF0F1;--teal:#0C7566;--amber:#B54708;
  --f:'Plus Jakarta Sans',system-ui,'Segoe UI',sans-serif;--m:'JetBrains Mono',ui-monospace,Consolas,monospace}
*{box-sizing:border-box;margin:0;padding:0}
html{background:#E9E4E2}
body{font-family:var(--f);color:var(--ink);-webkit-font-smoothing:antialiased;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:210mm;height:297mm;margin:10mm auto;background:#fff;position:relative;overflow:hidden;box-shadow:0 10px 40px -18px rgba(40,10,14,.35);display:flex;flex-direction:column}
@media print{@page{size:A4;margin:0} html{background:#fff} .page{margin:0;box-shadow:none;break-after:page}}
.page>*{flex-shrink:0}
.pad{padding:13mm 14mm 0;flex:1 0 auto;display:flex;flex-direction:column}
.pad>.row:last-child{margin-top:auto;margin-bottom:4mm}
.ph{display:flex;justify-content:space-between;align-items:center;padding:9mm 14mm 0}
.ph .mod{display:flex;align-items:center;gap:10px}
.ph .num{font-family:var(--m);font-size:9pt;font-weight:600;color:#fff;background:var(--crimson);border-radius:6px;padding:3px 8px;letter-spacing:.06em}
.ph .sec{font-family:var(--m);font-size:7.5pt;letter-spacing:.2em;text-transform:uppercase;color:var(--ink3)}
.ph .brand{display:flex;align-items:center;gap:7px;font-weight:800;font-size:9.5pt;letter-spacing:-.01em}
.ph .brand svg{width:18px;height:18px}
h1.t{font-size:27pt;font-weight:800;letter-spacing:-.035em;line-height:1.05;margin-top:6mm}
p.lead{font-size:11pt;color:var(--ink2);line-height:1.5;margin-top:2.5mm;max-width:165mm}
.who{display:flex;gap:6px;flex-wrap:wrap;margin-top:3.5mm}
.chip{font-size:7.5pt;font-weight:600;padding:3px 9px;border-radius:20px;background:var(--soft);color:var(--wine);white-space:nowrap}
.chip.g{background:#E7F5F1;color:var(--teal)} .chip.n{background:#F3EFEE;color:var(--ink2)}
.shot{position:relative;margin-top:5mm;border-radius:10px;overflow:visible;box-shadow:0 1px 2px rgba(22,16,15,.06),0 12px 30px -14px rgba(60,16,22,.35);background:#fff;border:1px solid var(--rule)}
.shot .bar{height:7mm;border-bottom:1px solid var(--rule);display:flex;align-items:center;gap:5px;padding-left:9px;background:#FAF7F6;border-radius:10px 10px 0 0}
.shot .bar i{width:7px;height:7px;border-radius:50%;display:block}
.shot .bar b{margin:0 auto;font-family:var(--m);font-size:6.5pt;font-weight:500;color:var(--ink3);background:#fff;border:1px solid var(--rule);border-radius:5px;padding:1px 26px;transform:translateX(-24px)}
.shot .img{position:relative;border-radius:0 0 10px 10px;overflow:hidden;line-height:0}
.shot img{width:100%;display:block}
.co{position:absolute;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:var(--crimson);color:#fff;font-size:9pt;font-weight:800;display:grid;place-items:center;
  box-shadow:0 0 0 3px #fff,0 0 0 5px rgba(217,45,58,.35),0 4px 10px rgba(0,0,0,.25);z-index:2;line-height:1}
.legend{display:grid;grid-template-columns:1fr 1fr;gap:4mm 8mm;margin-top:7mm}
.legend .it{display:flex;gap:9px;align-items:flex-start}
.legend .n{flex:none;width:19px;height:19px;border-radius:50%;background:var(--crimson);color:#fff;font-size:8pt;font-weight:800;display:grid;place-items:center;margin-top:1px}
.legend b{display:block;font-size:10.4pt;font-weight:700;letter-spacing:-.01em}
.legend span{font-size:9.3pt;color:var(--ink2);line-height:1.42;display:block;margin-top:1px}
.row{display:grid;grid-template-columns:1fr 1fr;gap:6mm;margin-top:6mm}
.card{border:1px solid var(--rule);border-radius:10px;padding:4.2mm 4.8mm;background:var(--paper)}
.card h4{font-family:var(--m);font-size:7pt;letter-spacing:.18em;text-transform:uppercase;color:var(--crimson);font-weight:600;margin-bottom:2.4mm;display:flex;align-items:center;gap:6px}
.card ul{list-style:none} .card li{font-size:9.4pt;color:var(--ink2);line-height:1.45;padding-left:15px;position:relative;margin:1.4mm 0}
.card li::before{content:'';position:absolute;left:0;top:6px;width:7px;height:7px;border-radius:2px;background:var(--crimson)}
.card.tip{background:linear-gradient(135deg,#FFF6F0,#FDF0F1);border-color:#F6D7D0}
.card.tip p{font-size:9.6pt;color:var(--ink2);line-height:1.5}
.pf{margin-top:auto;display:flex;justify-content:space-between;align-items:center;padding:0 14mm 8mm;font-family:var(--m);font-size:7pt;color:var(--ink3);letter-spacing:.08em}
.pf .pn{font-weight:600;color:var(--ink)}
.qs{margin-top:7mm}.ql{font-family:var(--m);font-size:7pt;letter-spacing:.2em;text-transform:uppercase;color:var(--ink3);margin-bottom:2.5mm}
.qg{display:grid;grid-template-columns:repeat(3,1fr);gap:3.5mm}.q{display:flex;gap:8px;align-items:flex-start;border-radius:10px;padding:3.4mm 3.8mm;background:#F7F3F2;font-size:9.4pt;font-weight:600;line-height:1.38;color:var(--ink)}.q svg{flex:none;margin-top:2px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:5mm}
.small .legend{grid-template-columns:1fr;gap:2.2mm;margin-top:4mm}
`;

const SIZE_CACHE = new Map();
function jpegSize(name) {
  if (SIZE_CACHE.has(name)) return SIZE_CACHE.get(name);
  const b = readFileSync(resolve(ROOT, 'marketing/shots', name));
  let i = 2;
  while (i < b.length) {
    const marker = b[i + 1], len = b.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc3) { const s = { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) }; SIZE_CACHE.set(name, s); return s; }
    i += 2 + len;
  }
  return { w: 1280, h: 665 };
}
const dataUri = (name) => `data:image/jpeg;base64,${readFileSync(resolve(ROOT, 'marketing/shots', name)).toString('base64')}`;

/** Screenshot in a browser frame with numbered callouts at source-pixel coordinates; crop = [top, bottom] px */
export function frame(name, callouts = [], { url = 'outletos.app', crop = null } = {}) {
  const { w, h } = jpegSize(name);
  const [ct, cb] = crop || [0, h];
  const vh = cb - ct;
  const dots = callouts.map(([x, y], i) => `<span class="co" style="left:${(x / w * 100).toFixed(2)}%;top:${((y - ct) / vh * 100).toFixed(2)}%">${i + 1}</span>`).join('');
  const img = crop
    ? `<div style="aspect-ratio:${w}/${vh};overflow:hidden;position:relative"><img src="${dataUri(name)}" style="position:absolute;top:${(-ct / vh * 100).toFixed(3)}%;height:${(h / vh * 100).toFixed(3)}%;width:100%"/></div>`
    : `<img src="${dataUri(name)}" alt=""/>`;
  return `<div class="shot"><div class="bar"><i style="background:#FF5F57"></i><i style="background:#FEBC2E"></i><i style="background:#28C840"></i><b>${esc(url)}</b></div><div class="img">${img}${dots}</div></div>`;
}
export const legend = (items) => `<div class="legend">${items.map(([t, d], i) => `<div class="it"><span class="n">${i + 1}</span><div><b>${esc(t)}</b><span>${esc(d)}</span></div></div>`).join('')}</div>`;
export const header = (num, sec) => `<div class="ph"><div class="mod">${num ? `<span class="num">${esc(num)}</span>` : ''}<span class="sec">${esc(sec)}</span></div><div class="brand">${LOGO} OutletOS</div></div>`;
export const footer = (title, n) => `<div class="pf"><span>${esc(title)}</span><span class="pn">${String(n).padStart(2, '0')}</span></div>`;
export const card = (title, items, ic = 'check-circle-2', cls = '') => `<div class="card ${cls}"><h4>${icon(ic, { size: 13, color: '#D92D3A', stroke: 2.4 })}${esc(title)}</h4>${Array.isArray(items) ? `<ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : `<p>${esc(items)}</p>`}</div>`;
export const chips = (list, cls = '') => `<div class="who">${list.map((x) => `<span class="chip ${cls}">${esc(x)}</span>`).join('')}</div>`;
export const doc = (title, css, pages) => `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${esc(title)}</title>${FONTS}<style>${PAGE_CSS}${css}</style></head><body>${pages.join('\n')}</body></html>`;

export const questions = (qs) => `<div class="qs"><div class="ql">Answers questions like</div><div class="qg">${qs.map((q) => `<div class="q">${icon('message-circle-question', { size: 15, color: '#D92D3A' })}<span>${esc(q)}</span></div>`).join('')}</div></div>`;
