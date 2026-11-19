// Builds the OutletOS document set (HTML + PDF):  node docs/build.mjs
import { writeFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { technicalDoc } from './src/technical.mjs';
import { trainingDoc } from './src/training.mjs';
import { onePager, caseStudy } from './src/marketing.mjs';
import { testPlanDoc } from './src/testplan.mjs';
import { telegramDoc } from './src/telegram.mjs';
import { LOGO } from './src/lib.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const DOCS = [
  ['OutletOS-Technical-Product-Document', technicalDoc, 'Architecture, DFDs, user flows, security, data model, APIs'],
  ['OutletOS-Product-Training-Guide', trainingDoc, 'Step-by-step setup, then every screen explained with callouts'],
  ['OutletOS-Value-Proposition', onePager, 'One-page overview for buyers and investors'],
  ['OutletOS-Case-Study', caseStudy, 'Illustrative four-week rollout at a six-restaurant group'],
  ['OutletOS-Test-Plan-and-Results', testPlanDoc, 'Automated and browser test scenarios with the latest results'],
  ['OutletOS-Telegram-Bot-Guide', telegramDoc, 'Set up the Telegram assistant, link your chat, commands by role, security'],
];
const only = process.argv[2];
for (const [name, fn] of DOCS) {
  if (only && !name.toLowerCase().includes(only)) continue;
  writeFileSync(resolve(DIR, `${name}.html`), fn());
  console.log('html', name);
}
writeFileSync(resolve(DIR, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>OutletOS Documents</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&display=swap" rel="stylesheet"/>
<style>body{margin:0;font-family:'Plus Jakarta Sans',sans-serif;background:linear-gradient(150deg,#D92D3A,#7A1A22 60%,#1A0B0E);min-height:100vh;color:#fff;display:grid;place-items:center}
.w{max-width:820px;padding:40px}.b{display:flex;gap:10px;align-items:center;font-weight:800;font-size:20px}.b svg{width:34px;height:34px}h1{font-size:42px;letter-spacing:-.03em;margin:26px 0 6px}
.g{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:26px}.c{background:#fff;color:#16100F;border-radius:16px;padding:20px 22px}.c b{font-size:17px;display:block}.c p{margin:6px 0 12px;color:#6E6366;font-size:14px}
.c a{color:#C42B37;font-weight:700;text-decoration:none;margin-right:14px;font-size:14px}</style></head><body><div class="w"><div class="b">${LOGO} OutletOS</div><h1>Document set</h1><div style="opacity:.85">Version 2.1 · November 2026</div><div class="g">
${DOCS.map(([n, , d]) => `<div class="c"><b>${n.replace('OutletOS-', '').replaceAll('-', ' ')}</b><p>${d}</p><a href="${n}.html">Open</a><a href="${n}.pdf">PDF</a></div>`).join('')}</div></div></body></html>`);

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
if (!CHROME || process.env.NO_PDF) process.exit(0);
for (const [name] of DOCS) {
  if (only && !name.toLowerCase().includes(only)) continue;
  const pdf = resolve(DIR, `${name}.pdf`);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--run-all-compositor-stages-before-draw', '--virtual-time-budget=15000',
    `--print-to-pdf=${pdf}`, pathToFileURL(resolve(DIR, `${name}.html`)).href], { stdio: 'ignore', timeout: 180000 });
  console.log('pdf ', name, `${Math.round(statSync(pdf).size / 1024)} KB`);
}
