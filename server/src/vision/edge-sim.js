// Virtual edge agent: the simulator's stand-in for one edge box per restaurant.
// Same pipeline and contracts as edge-agent/agent.py:
//   camera frames -> CameraRules (shared rules.json) -> outbox batch -> POST /api/v1/vision contract
//   + a heartbeat per camera every `heartbeat_s` (fps, latency, model, agent version)
// The only difference from a real site is where frames come from (VirtualCamera instead of RTSP + model).
import { VirtualCamera } from './scene.js';
import { CameraRules, RULES } from './rules.js';

export const AGENT_VERSION = `virtual-edge/${RULES.version}`;
export const SIM_MODEL = 'synthetic-detector (stands in for RF-DETR-N + PPE head)';

export class VirtualEdgeAgent {
  constructor(outlet, cameras, { discipline = 0.96 } = {}) {
    this.outlet = outlet;
    this.cams = cameras.map((c) => ({ cam: c, scene: new VirtualCamera(c, { discipline }), rules: new CameraRules(c), nextFrame: 0, beatAt: 0 }));
    this.outbox = [];
  }

  /** Advance from..to (ms). Returns { events, heartbeats } ready for the ingest contract. */
  run(from, to, { demand = 1, frameMs = 1000 / RULES.fps } = {}) {
    const heartbeats = [];
    for (const c of this.cams) {
      if (!c.nextFrame) c.nextFrame = from;
      let frames = 0;
      for (; c.nextFrame < to; c.nextFrame += frameMs) {
        this.outbox.push(...c.rules.process(c.scene.frame(Math.round(c.nextFrame), demand)));
        frames++;
      }
      if (to - c.beatAt >= RULES.heartbeat_s * 1000) {
        heartbeats.push({ outlet_id: this.outlet, camera_id: c.cam.id, ts: to, fps: Math.round((1000 / frameMs) * 10) / 10, latency_ms: 40 + Math.round(Math.random() * 60),
          frames, model: SIM_MODEL, agent: AGENT_VERSION, status: 'online' });
        c.beatAt = to;
      }
    }
    const events = this.outbox.sort((a, b) => a.ts - b.ts);
    this.outbox = [];
    return { events, heartbeats };
  }
}
