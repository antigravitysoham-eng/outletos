// Records a reproducible multi-camera scene, runs it through the simulator's rule engine (rules.js)
// and writes edge-agent/tests/fixture.json. edge-agent/tests/test_parity.py replays the same frames
// through the real edge agent's rule engine (rules.py) and must produce identical events.
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VirtualCamera } from '../src/vision/scene.js';
import { CameraRules, RULES } from '../src/vision/rules.js';

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../../edge-agent/tests/fixture.json');
const start = new Date(2026, 10, 18, 22, 35, 0).getTime();          // crosses 23:00, when the cold store becomes restricted
const cams = [...Object.keys(RULES.zones), 'kitchen', 'storage', 'storage'].map((zone, k) => ({ id: `t-${zone}-${k}`, outlet_id: 'r1', zone }));
const frames = [], events = [];
for (const [i, cam] of cams.entries()) {
  const scene = new VirtualCamera(cam, { discipline: 0.85, seed: 1000 + i });
  const rules = new CameraRules(cam);
  for (let ts = start; ts < start + 45 * 60_000; ts += 1000 / RULES.fps) {
    const f = scene.frame(ts, 1.2);
    frames.push(f);
    events.push(...rules.process(f));
  }
}
writeFileSync(out, JSON.stringify({ rules_version: RULES.version, cameras: cams, frames, events }));
const kinds = {};
events.forEach((e) => { kinds[`${e.type}:${e.ok ? 'ok' : 'bad'}`] = (kinds[`${e.type}:${e.ok ? 'ok' : 'bad'}`] || 0) + 1; });
console.log(`fixture: ${cams.length} cameras, ${frames.length} frames, ${events.length} events (JS rules ${RULES.version})`);
console.log('  ' + Object.entries(kinds).sort().map(([k, v]) => `${k} ${v}`).join(' · '));
