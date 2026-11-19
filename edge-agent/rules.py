"""
Vision rule engine: tracked detections in, canonical vision events out.

Line-for-line twin of server/src/vision/rules.js (the simulator's virtual edge agent). Both load
rules.json, so a real camera and the simulator emit identical events for the same scene.
`npm run test:parity` runs one recorded scene through both and compares the output.

Frame (output of detector + tracker + zone assignment):
  { ts, hour, outlet_id, camera_id, zone, crowd?,
    people:  [{ id, role: 'staff'|'guest', sub, conf, attrs: { hairnet, gloves, apron, phone } }],   # attrs: True | False | None
    objects: [{ id, cls: 'spill'|'label', conf, expired?, text? }] }
"""
import json
import os

RULES = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "rules.json"), encoding="utf-8"))
PPE = ("hairnet", "gloves", "apron")
NEG_INF = float("-inf")


def in_hours(h, window):
    start, end = window
    return (h >= start or h < end) if start > end else (start <= h < end)


def secs(ms):
    return int(ms // 1000)


def new_track():
    return {"obs": {"hairnet": [], "gloves": [], "apron": []}, "phone_since": None, "needs_wash": False, "dirty_since": None,
            "wash_start": None, "wait_since": None, "greeted": False, "late": False, "table_since": None, "last": 0}


class CameraRules:
    def __init__(self, camera, rules=RULES):
        self.cam = camera                      # { id, outlet_id, zone }
        self.R = rules["rules"]
        self.checks = rules["zones"].get(camera["zone"], {}).get("checks", [])
        self.tracks = {}
        self.cool = {}
        self.ok_at = {}
        self.station = {"empty_since": None, "alerted": False, "last_ok": NEG_INF}
        self.spill = {"since": None, "alerted": False, "seen": None}
        self.person_at = NEG_INF

    def cooldown(self, key, s, ts):
        if key in self.cool and ts - self.cool[key] < s * 1000:
            return False
        self.cool[key] = ts
        return True

    def due_ok(self, check, s, ts):
        if check in self.ok_at and ts - self.ok_at[check] < s * 1000:
            return False
        self.ok_at[check] = ts
        return True

    def process(self, frame):
        ts, R = frame["ts"], self.R
        people, objects = frame.get("people") or [], frame.get("objects") or []
        count = len(people) + (frame.get("crowd") or 0)
        staff = [p for p in people if p.get("role") != "guest"]
        events = []

        def emit(type_, ok, conf=0.9, zone=None, track=None, dur=None, text=None):
            e = {"outlet_id": self.cam["outlet_id"], "camera_id": self.cam["id"], "type": type_, "ok": ok, "confidence": conf,
                 "people": count, "ts": ts, "zone": zone if zone is not None else self.cam["zone"], "track_id": track, "duration_s": dur}
            if text:
                e["text"] = text
            events.append(e)

        for p in people:
            t = self.tracks.get(p["id"]) or new_track()
            t["last"] = ts
            self.tracks[p["id"]] = t
        for tid in [k for k, t in self.tracks.items() if ts - t["last"] > 10_000]:
            del self.tracks[tid]

        attrs = lambda p: p.get("attrs") or {}

        for check in self.checks:
            if check == "station":
                s, staffed = self.station, any(p["sub"] == "station" for p in staff)
                if staffed:
                    if s["alerted"]:
                        emit("station", True, zone="station", dur=secs(ts - s["empty_since"])); s["last_ok"] = ts
                    elif ts - s["last_ok"] >= R["station"]["report_ok_every_s"] * 1000:
                        emit("station", True, zone="station"); s["last_ok"] = ts
                    s["empty_since"], s["alerted"] = None, False
                else:
                    if s["empty_since"] is None:
                        s["empty_since"] = ts
                    if not s["alerted"] and ts - s["empty_since"] >= R["station"]["absent_after_s"] * 1000:
                        emit("station", False, zone="station", dur=secs(ts - s["empty_since"])); s["alerted"] = True

            elif check in PPE:
                compliant = None
                for p in staff:
                    if check == "gloves" and p["sub"] != "station":
                        continue
                    v = attrs(p).get(check)
                    if v is None:
                        continue
                    obs = self.tracks[p["id"]]["obs"][check]
                    obs.append((ts, v))
                    while obs and ts - obs[0][0] > R["ppe"]["window_s"] * 1000:
                        obs.pop(0)
                    if len(obs) < R["ppe"]["min_observations"]:
                        continue
                    bad = sum(1 for _, x in obs if not x) / len(obs)
                    if bad >= R["ppe"]["bad_ratio"]:
                        if self.cooldown(f"{check}:{p['id']}", R["ppe"]["cooldown_s"], ts):
                            emit(check, False, conf=p["conf"], zone=p["sub"], track=p["id"])
                    elif compliant is None:
                        compliant = p
                if compliant and self.due_ok(check, R["ppe"]["report_ok_every_s"], ts):
                    emit(check, True, conf=compliant["conf"], zone=compliant["sub"], track=compliant["id"])

            elif check == "phone":
                calm = len(staff) > 0
                for p in staff:
                    t = self.tracks[p["id"]]
                    if attrs(p).get("phone"):
                        calm = False
                        if t["phone_since"] is None:
                            t["phone_since"] = ts
                        if ts - t["phone_since"] >= R["phone"]["min_dwell_s"] * 1000 and self.cooldown(f"phone:{p['id']}", R["phone"]["cooldown_s"], ts):
                            emit("phone", False, conf=p["conf"], zone=p["sub"], track=p["id"], dur=secs(ts - t["phone_since"]))
                    else:
                        t["phone_since"] = None
                if calm and self.due_ok("phone", R["ppe"]["report_ok_every_s"], ts):
                    emit("phone", True, zone=staff[0]["sub"])

            elif check == "handwash":
                for p in staff:
                    t = self.tracks[p["id"]]
                    if p["sub"] in R["handwash"]["triggers"]:
                        t["needs_wash"], t["dirty_since"], t["wash_start"] = True, ts, None
                        continue
                    if p["sub"] == "sink":
                        if t["wash_start"] is None:
                            t["wash_start"] = ts
                        if t["needs_wash"] and ts - t["wash_start"] >= R["handwash"]["sink_min_dwell_s"] * 1000:
                            emit("handwash", True, conf=p["conf"], zone="sink", track=p["id"], dur=secs(ts - t["wash_start"])); t["needs_wash"] = False
                        continue
                    t["wash_start"] = None
                    if t["needs_wash"] and p["sub"] == "station" and ts - t["dirty_since"] >= R["handwash"]["grace_s"] * 1000:
                        emit("handwash", False, conf=p["conf"], zone="station", track=p["id"], dur=secs(ts - t["dirty_since"])); t["needs_wash"] = False

            elif check == "access":
                if people:
                    if in_hours(frame["hour"], R["access"]["restricted_hours"]):
                        if self.cooldown("access", R["access"]["cooldown_s"], ts):
                            emit("access", False, conf=people[0]["conf"], zone=people[0]["sub"], track=people[0]["id"])
                    elif self.due_ok("access", R["access"]["cooldown_s"], ts):
                        emit("access", True, zone=people[0]["sub"])

            elif check == "label":
                for o in objects:
                    if o["cls"] != "label":
                        continue
                    if o.get("expired"):
                        if self.cooldown(f"label:{o['id']}", R["label"]["cooldown_s"], ts):
                            emit("label", False, conf=o["conf"], zone="store", track=o["id"], text=o.get("text"))
                    elif self.cooldown(f"label-ok:{o['id']}", R["label"]["cooldown_s"], ts):
                        emit("label", True, conf=o["conf"], zone="store", track=o["id"], text=o.get("text"))

            elif check == "spill":
                s = self.spill
                hit = next((o for o in objects if o["cls"] == "spill"), None)
                if hit:
                    s["seen"] = ts
                    if s["since"] is None:
                        s["since"] = ts
                    if not s["alerted"] and ts - s["since"] >= R["spill"]["min_persist_s"] * 1000:
                        emit("spill", False, conf=hit["conf"], zone="floor", dur=secs(ts - s["since"])); s["alerted"] = True
                elif s["seen"] is None or ts - s["seen"] >= R["spill"]["clear_after_s"] * 1000:
                    if s["alerted"]:
                        emit("spill", True, zone="floor", dur=secs(ts - s["since"])); self.ok_at["spill"] = ts
                    elif self.due_ok("spill", R["station"]["report_ok_every_s"], ts):
                        emit("spill", True, zone="floor")
                    s["since"], s["alerted"], s["seen"] = None, False, None

            elif check == "greeted":
                host = any(p["sub"] in ("host", "door") for p in staff)
                for p in people:
                    if p.get("role") != "guest":
                        continue
                    t = self.tracks[p["id"]]
                    if p["sub"] != "door" or t["greeted"]:
                        continue
                    if t["wait_since"] is None:
                        t["wait_since"] = ts
                    if host:
                        t["greeted"] = True
                        if not t["late"]:
                            emit("greeted", True, conf=p["conf"], zone="door", track=p["id"], dur=secs(ts - t["wait_since"]))
                    elif not t["late"] and ts - t["wait_since"] >= R["greeted"]["max_wait_s"] * 1000:
                        emit("greeted", False, conf=p["conf"], zone="door", track=p["id"], dur=secs(ts - t["wait_since"])); t["late"] = True

            elif check == "guest":
                served = any(p["sub"] == "table" for p in staff)
                for p in people:
                    if p.get("role") != "guest" or p["sub"] != "table":
                        continue
                    t = self.tracks[p["id"]]
                    if t["table_since"] is None:
                        t["table_since"] = ts
                    if served:
                        if self.cooldown(f"guest-ok:{p['id']}", R["guest"]["cooldown_s"], ts):
                            emit("guest", True, conf=p["conf"], zone="table", track=p["id"], dur=secs(ts - t["table_since"]))
                        t["table_since"] = ts
                    elif ts - t["table_since"] >= R["guest"]["table_wait_s"] * 1000 and self.cooldown(f"guest:{p['id']}", R["guest"]["cooldown_s"], ts):
                        emit("guest", False, conf=p["conf"], zone="table", track=p["id"], dur=secs(ts - t["table_since"]))

            elif check == "person":
                if ts - self.person_at >= R["person"]["report_every_s"] * 1000:
                    emit("person", True, zone=self.cam["zone"]); self.person_at = ts
        return events
