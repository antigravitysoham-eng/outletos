// Synthetic camera scenes for the simulator. Each VirtualCamera plays the part of
// "RTSP decode -> detector -> tracker -> zone assignment" on a real edge box and outputs exactly the
// frame format edge-agent/agent.py hands to the rule engine: tracked people with a sub-zone and PPE
// attributes, plus objects (spills, use-by labels). Detector imperfections are modelled on purpose:
// misses, occlusion (attribute unknown), false attribute flips and confidence jitter.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const seedOf = (s) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261);

// Where staff go next, and for how long (seconds), per camera type
const MOVES = {
  kitchen: { station: [['station', 0.55], ['raw', 0.2], ['door', 0.1], ['sink', 0.15]], raw: [['sink', 1]], door: [['sink', 1]], sink: [['station', 1]] },
  pass: { station: [['station', 0.7], ['door', 0.15], ['sink', 0.15]], door: [['sink', 1]], sink: [['station', 1]] },
};
const DWELL = { station: [40, 240], raw: [20, 90], door: [10, 40], sink: [22, 45], store: [20, 90], table: [20, 60], host: [30, 200], floor: [20, 120] };
const CROWD = { front: [8, 40], entrance: [0, 4] };

export class VirtualCamera {
  /** cam: { id, outlet_id, zone }, discipline: 0..1 (branch hygiene culture), seed: optional for reproducible scenes */
  constructor(cam, { discipline = 0.96, seed } = {}) {
    this.cam = cam;
    this.d = discipline;
    this.rnd = mulberry32(seed ?? seedOf(cam.id));
    this.people = [];
    this.objects = [];
    this.n = 0;
    this.awayUntil = 0; // whole line steps away (station unattended episode)
    const staffCount = { kitchen: 3, pass: 2, front: 2, entrance: 1 }[cam.zone] || 0;
    for (let i = 0; i < staffCount; i++) this.people.push(this.newStaff(cam.zone === 'front' ? 'floor' : cam.zone === 'entrance' ? 'host' : 'station', 0));
  }

  r(a, b) { return a + this.rnd() * (b - a); }
  chance(p) { return this.rnd() < p; }
  pick(list) { let x = this.rnd(), acc = 0; for (const [v, w] of list) { acc += w; if (x < acc) return v; } return list.at(-1)[0]; }
  id(prefix) { return `${this.cam.id}:${prefix}${++this.n}`; }

  newStaff(sub, ts) {
    return { id: this.id('s'), role: 'staff', sub, until: ts + this.r(...DWELL[sub]) * 1000, hairnet: true, apron: true, gloves: true, phoneUntil: 0, lapseUntil: 0, washed: true };
  }
  newGuest(sub, ts, stay) { return { id: this.id('g'), role: 'guest', sub, until: ts + stay * 1000 }; }

  /** Advance the scene to ts (ms) and return one frame. demand 0..1.5 scales guest traffic. */
  frame(ts, demand = 1) {
    const dt = this.lastTs ? (ts - this.lastTs) / 1000 : 1;
    this.lastTs = ts;
    const z = this.cam.zone, lapse = 1 - this.d;   // lapse ~ 0.015 (excellent) .. 0.1 (poor)
    const hour = new Date(ts).getHours();
    const open = hour >= 7 && hour < 23;

    // ---- staff behaviour (ground truth) ----
    if (z === 'kitchen' || z === 'pass') {
      if (this.awayUntil < ts && this.chance(lapse * 0.004 * dt)) this.awayUntil = ts + this.r(60, 170) * 1000;   // everyone off the line
      for (const s of this.people) {
        if (ts >= s.until) {
          const next = this.awayUntil > ts ? 'door' : this.pick(MOVES[z][s.sub] || MOVES[z].station);
          // after raw protein or coming back in, most people wash; poor discipline skips the sink
          s.sub = (next === 'sink' && s.sub !== 'station' && this.chance(lapse * 3)) ? 'station' : next;
          s.until = ts + this.r(...(s.sub === 'sink' && this.chance(lapse * 2) ? [6, 14] : DWELL[s.sub])) * 1000;
        }
        if (this.awayUntil > ts && s.sub === 'station') { s.sub = 'door'; s.until = this.awayUntil; }
        if (s.lapseUntil < ts && this.chance(lapse * 0.01 * dt)) { s.lapseUntil = ts + this.r(20, 120) * 1000; s.lapseKind = this.pick([['hairnet', 0.45], ['gloves', 0.35], ['apron', 0.2]]); }
        for (const k of ['hairnet', 'gloves', 'apron']) s[k] = !(s.lapseUntil > ts && s.lapseKind === k);
        if (s.phoneUntil < ts && this.chance(lapse * 0.006 * dt)) s.phoneUntil = ts + this.r(8, 60) * 1000;
      }
      if (!this.objects.some((o) => o.cls === 'spill') && this.chance(lapse * 0.002 * dt)) this.objects.push({ id: this.id('o'), cls: 'spill', until: ts + this.r(5, 240) * 1000 });
    }

    if (z === 'storage') {
      if (!this.people.length && this.chance((open ? 0.012 : 0.0004 + lapse * 0.002) * dt)) {
        const p = this.newGuestLike(ts);
        this.people.push(p);
        if (this.chance(0.7)) this.objects.push({ id: this.id('l'), cls: 'label', until: p.until, expired: this.chance(lapse * 1.5), text: '' });
      }
      if (!this.objects.some((o) => o.cls === 'spill') && this.chance(lapse * 0.0008 * dt)) this.objects.push({ id: this.id('o'), cls: 'spill', until: ts + this.r(5, 200) * 1000 });
    }

    if (z === 'entrance') {
      if (open && this.chance(0.02 * demand * dt)) this.people.push(this.newGuest('door', ts, this.r(20, 90)));
      const host = this.people.find((p) => p.role === 'staff');
      if (host && ts >= host.until) { host.sub = host.sub === 'host' ? 'floor' : 'host'; host.until = ts + (host.sub === 'host' ? this.r(...DWELL.host) : this.r(5, 40 + lapse * 900)) * 1000; }
      for (const g of this.people.filter((p) => p.role === 'guest' && p.sub === 'door')) {
        if (host?.sub === 'host' && this.chance(0.25 * dt)) { g.sub = 'floor'; g.until = ts + 3000; }
      }
    }

    if (z === 'front') {
      const tables = this.people.filter((p) => p.role === 'guest');
      if (open && tables.length < 4 && this.chance(0.01 * demand * dt)) this.people.push(this.newGuest('table', ts, this.r(900, 3600)));
      for (const s of this.people.filter((p) => p.role === 'staff')) {
        if (ts >= s.until) { s.sub = s.sub === 'table' ? 'floor' : this.chance(0.5) ? 'table' : 'floor'; s.until = ts + (s.sub === 'table' ? this.r(...DWELL.table) : this.r(30, 150 + lapse * 3000)) * 1000; }
        if (s.phoneUntil < ts && this.chance(lapse * 0.004 * dt)) s.phoneUntil = ts + this.r(8, 50) * 1000;
      }
    }

    this.people = this.people.filter((p) => (p.role === 'staff' && !p.visitor) || ts < p.until);
    this.objects = this.objects.filter((o) => ts < o.until);

    // ---- detector + tracker output (what a real model would report) ----
    const seen = (truth) => (this.chance(0.18) ? null : this.chance(0.04) ? !truth : truth);   // occlusion / false flip
    const conf = () => Math.round(this.r(0.62, 0.98) * 100) / 100;
    const people = this.people.filter(() => !this.chance(0.03)).map((p) => ({
      id: p.id, role: p.role, sub: p.sub, conf: conf(),
      attrs: p.role === 'staff'
        ? { hairnet: seen(p.hairnet), gloves: p.sub === 'station' ? seen(p.gloves) : null, apron: seen(p.apron), phone: p.phoneUntil > ts }
        : { hairnet: null, gloves: null, apron: null, phone: false },
    }));
    const objects = this.objects.filter(() => !this.chance(0.05)).map((o) => ({ id: o.id, cls: o.cls, conf: conf(), ...(o.cls === 'label' ? { expired: o.expired, text: o.expired ? 'USE BY: yesterday' : 'USE BY: +2 days' } : {}) }));
    const crowd = CROWD[z] ? Math.round(this.r(...CROWD[z]) * (z === 'front' ? Math.min(1.2, demand) : demand)) : 0;
    return { ts, hour, outlet_id: this.cam.outlet_id, camera_id: this.cam.id, zone: z, crowd, people, objects };
  }

  newGuestLike(ts) { return { id: this.id('s'), role: 'staff', visitor: true, sub: 'store', until: ts + this.r(...DWELL.store) * 1000, hairnet: true, apron: true, gloves: true, phoneUntil: 0, lapseUntil: 0 }; }
}
