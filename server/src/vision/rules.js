// Vision rule engine: tracked detections in, canonical vision events out.
// This file is a line-for-line twin of edge-agent/rules.py (the real edge agent) and both read
// edge-agent/rules.json, so the simulator and a real camera produce the same events for the same scene.
// `npm run test:parity` proves it by running one recorded scene through both implementations.
//
// Frame (output of detector + tracker + zone assignment):
//   { ts, hour, outlet_id, camera_id, zone, crowd?,
//     people:  [{ id, role: 'staff'|'guest', sub, conf, attrs: { hairnet, gloves, apron, phone } }],   // attrs: true | false | null
//     objects: [{ id, cls: 'spill'|'label', conf, expired?, text? }] }
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RULES = JSON.parse(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../../edge-agent/rules.json'), 'utf8'));
const PPE = ['hairnet', 'gloves', 'apron'];

const inHours = (h, [start, end]) => (start > end ? h >= start || h < end : h >= start && h < end);
const secs = (ms) => Math.floor(ms / 1000);

export class CameraRules {
  constructor(camera, rules = RULES) {
    this.cam = camera;                       // { id, outlet_id, zone }
    this.R = rules.rules;
    this.checks = rules.zones[camera.zone]?.checks ?? [];
    this.tracks = new Map();
    this.cool = new Map();                   // key -> last emit ts
    this.okAt = new Map();                   // check -> last periodic ok ts
    this.station = { emptySince: null, alerted: false, lastOk: -Infinity };
    this.spill = { since: null, alerted: false, seen: null };
    this.personAt = -Infinity;
  }

  cooldown(key, s, ts) {
    if (this.cool.has(key) && ts - this.cool.get(key) < s * 1000) return false;
    this.cool.set(key, ts);
    return true;
  }

  dueOk(check, s, ts) {
    if (this.okAt.has(check) && ts - this.okAt.get(check) < s * 1000) return false;
    this.okAt.set(check, ts);
    return true;
  }

  process(frame) {
    const { ts } = frame, R = this.R;
    const people = frame.people || [], objects = frame.objects || [];
    const count = people.length + (frame.crowd || 0);
    const staff = people.filter((p) => p.role !== 'guest');
    const events = [];
    const emit = (type, ok, { conf = 0.9, zone = null, track = null, dur = null, text = null } = {}) => events.push({
      outlet_id: this.cam.outlet_id, camera_id: this.cam.id, type, ok, confidence: conf, people: count, ts,
      zone: zone ?? this.cam.zone, track_id: track, duration_s: dur, ...(text ? { text } : {}),
    });

    for (const p of people) {
      const t = this.tracks.get(p.id) ?? { obs: { hairnet: [], gloves: [], apron: [] }, phoneSince: null, needsWash: false, dirtySince: null, washStart: null, waitSince: null, greeted: false, late: false, tableSince: null };
      t.last = ts;
      this.tracks.set(p.id, t);
    }
    for (const [id, t] of [...this.tracks]) if (ts - t.last > 10_000) this.tracks.delete(id);

    for (const check of this.checks) {
      if (check === 'station') {
        const s = this.station, staffed = staff.some((p) => p.sub === 'station');
        if (staffed) {
          if (s.alerted) { emit('station', true, { zone: 'station', dur: secs(ts - s.emptySince) }); s.lastOk = ts; }
          else if (ts - s.lastOk >= R.station.report_ok_every_s * 1000) { emit('station', true, { zone: 'station' }); s.lastOk = ts; }
          s.emptySince = null; s.alerted = false;
        } else {
          if (s.emptySince === null) s.emptySince = ts;
          if (!s.alerted && ts - s.emptySince >= R.station.absent_after_s * 1000) { emit('station', false, { zone: 'station', dur: secs(ts - s.emptySince) }); s.alerted = true; }
        }
      } else if (PPE.includes(check)) {
        let compliant = null;
        for (const p of staff) {
          if (check === 'gloves' && p.sub !== 'station') continue;
          const v = p.attrs?.[check];
          if (v === null || v === undefined) continue;
          const obs = this.tracks.get(p.id).obs[check];
          obs.push([ts, v]);
          while (obs.length && ts - obs[0][0] > R.ppe.window_s * 1000) obs.shift();
          if (obs.length < R.ppe.min_observations) continue;
          const bad = obs.filter(([, x]) => !x).length / obs.length;
          if (bad >= R.ppe.bad_ratio) {
            if (this.cooldown(`${check}:${p.id}`, R.ppe.cooldown_s, ts)) emit(check, false, { conf: p.conf, zone: p.sub, track: p.id });
          } else if (compliant === null) compliant = p;
        }
        if (compliant && this.dueOk(check, R.ppe.report_ok_every_s, ts)) emit(check, true, { conf: compliant.conf, zone: compliant.sub, track: compliant.id });
      } else if (check === 'phone') {
        let calm = staff.length > 0;
        for (const p of staff) {
          const t = this.tracks.get(p.id);
          if (p.attrs?.phone) {
            calm = false;
            if (t.phoneSince === null) t.phoneSince = ts;
            if (ts - t.phoneSince >= R.phone.min_dwell_s * 1000 && this.cooldown(`phone:${p.id}`, R.phone.cooldown_s, ts)) emit('phone', false, { conf: p.conf, zone: p.sub, track: p.id, dur: secs(ts - t.phoneSince) });
          } else t.phoneSince = null;
        }
        if (calm && this.dueOk('phone', R.ppe.report_ok_every_s, ts)) emit('phone', true, { zone: staff[0].sub });
      } else if (check === 'handwash') {
        for (const p of staff) {
          const t = this.tracks.get(p.id);
          if (R.handwash.triggers.includes(p.sub)) { t.needsWash = true; t.dirtySince = ts; t.washStart = null; continue; }
          if (p.sub === 'sink') {
            if (t.washStart === null) t.washStart = ts;
            if (t.needsWash && ts - t.washStart >= R.handwash.sink_min_dwell_s * 1000) { emit('handwash', true, { conf: p.conf, zone: 'sink', track: p.id, dur: secs(ts - t.washStart) }); t.needsWash = false; }
            continue;
          }
          t.washStart = null;
          if (t.needsWash && p.sub === 'station' && ts - t.dirtySince >= R.handwash.grace_s * 1000) { emit('handwash', false, { conf: p.conf, zone: 'station', track: p.id, dur: secs(ts - t.dirtySince) }); t.needsWash = false; }
        }
      } else if (check === 'access') {
        if (people.length) {
          if (inHours(frame.hour, R.access.restricted_hours)) { if (this.cooldown('access', R.access.cooldown_s, ts)) emit('access', false, { conf: people[0].conf, zone: people[0].sub, track: people[0].id }); }
          else if (this.dueOk('access', R.access.cooldown_s, ts)) emit('access', true, { zone: people[0].sub });
        }
      } else if (check === 'label') {
        for (const o of objects) {
          if (o.cls !== 'label') continue;
          if (o.expired) { if (this.cooldown(`label:${o.id}`, R.label.cooldown_s, ts)) emit('label', false, { conf: o.conf, zone: 'store', track: o.id, text: o.text }); }
          else if (this.cooldown(`label-ok:${o.id}`, R.label.cooldown_s, ts)) emit('label', true, { conf: o.conf, zone: 'store', track: o.id, text: o.text });
        }
      } else if (check === 'spill') {
        const s = this.spill, hit = objects.find((o) => o.cls === 'spill');
        if (hit) {
          s.seen = ts;
          if (s.since === null) s.since = ts;
          if (!s.alerted && ts - s.since >= R.spill.min_persist_s * 1000) { emit('spill', false, { conf: hit.conf, zone: 'floor', dur: secs(ts - s.since) }); s.alerted = true; }
        } else if (s.seen === null || ts - s.seen >= R.spill.clear_after_s * 1000) {
          if (s.alerted) { emit('spill', true, { zone: 'floor', dur: secs(ts - s.since) }); this.okAt.set('spill', ts); }
          else if (this.dueOk('spill', R.station.report_ok_every_s, ts)) emit('spill', true, { zone: 'floor' });
          s.since = null; s.alerted = false; s.seen = null;
        }
      } else if (check === 'greeted') {
        const host = staff.some((p) => p.sub === 'host' || p.sub === 'door');
        for (const p of people) {
          if (p.role !== 'guest') continue;
          const t = this.tracks.get(p.id);
          if (p.sub !== 'door' || t.greeted) continue;
          if (t.waitSince === null) t.waitSince = ts;
          if (host) { t.greeted = true; if (!t.late) emit('greeted', true, { conf: p.conf, zone: 'door', track: p.id, dur: secs(ts - t.waitSince) }); }
          else if (!t.late && ts - t.waitSince >= R.greeted.max_wait_s * 1000) { emit('greeted', false, { conf: p.conf, zone: 'door', track: p.id, dur: secs(ts - t.waitSince) }); t.late = true; }
        }
      } else if (check === 'guest') {
        const served = staff.some((p) => p.sub === 'table');
        for (const p of people) {
          if (p.role !== 'guest' || p.sub !== 'table') continue;
          const t = this.tracks.get(p.id);
          if (t.tableSince === null) t.tableSince = ts;
          if (served) { if (this.cooldown(`guest-ok:${p.id}`, R.guest.cooldown_s, ts)) emit('guest', true, { conf: p.conf, zone: 'table', track: p.id, dur: secs(ts - t.tableSince) }); t.tableSince = ts; }
          else if (ts - t.tableSince >= R.guest.table_wait_s * 1000 && this.cooldown(`guest:${p.id}`, R.guest.cooldown_s, ts)) emit('guest', false, { conf: p.conf, zone: 'table', track: p.id, dur: secs(ts - t.tableSince) });
        }
      } else if (check === 'person') {
        if (ts - this.personAt >= R.person.report_every_s * 1000) { emit('person', true, { zone: this.cam.zone }); this.personAt = ts; }
      }
    }
    return events;
  }
}
