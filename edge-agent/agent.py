"""
OutletOS edge vision agent: runs inside the restaurant on a small box and sends only events (never video).

Pipeline per camera (the simulator's virtual edge agent runs the same stages and the same rules.json):

  RTSP sub-stream (via go2rtc/MediaMTX re-stream)  ->  latest-frame reader (no buffering lag)
  -> detector (ONNX: person/phone + PPE/spill/label head)  ->  ByteTrack-style tracker (anonymous ids)
  -> zone assignment (foot point in named polygons)  ->  rules.py (shared rules.json)
  -> OCR on triggers (use-by labels, 7-segment displays)  ->  SQLite outbox  ->  POST /api/v1/vision
  + heartbeat per camera every 60 s (fps, latency, model, agent version)

    pip install -r requirements.txt
    python agent.py --config config.json             # real cameras
    python agent.py --config config.json --source 0  # every camera replaced by a webcam (or a video file path)
    python agent.py --config config.json --dry-run   # print events instead of sending them
"""
import argparse
import json
import threading
import time

import cv2

import detector as det
import ocr
from outbox import Outbox
from rules import RULES, CameraRules
from tracker import Tracker

VERSION = f"outletos-edge/{RULES['version']}"


def point_in_poly(x, y, poly):
    inside, j = False, len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]; xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-9) + xi:
            inside = not inside
        j = i
    return inside


class LatestFrame:
    """Reads RTSP on its own thread and keeps only the newest frame, so a slow model never builds up seconds of lag."""

    def __init__(self, src):
        self.src = int(src) if str(src).isdigit() else src
        self.cap, self.frame, self.ok = cv2.VideoCapture(self.src), None, False
        threading.Thread(target=self._loop, daemon=True).start()

    def _loop(self):
        while True:
            ok, f = self.cap.read()
            if not ok:
                self.ok = False
                time.sleep(2)
                self.cap.release(); self.cap = cv2.VideoCapture(self.src)  # reconnect
                continue
            self.ok, self.frame = True, f

    def read(self):
        return self.frame if self.ok else None


class CameraWorker:
    def __init__(self, cam, cfg, base, ppe, out, dry):
        self.cam, self.cfg, self.base, self.ppe, self.out, self.dry = cam, cfg, base, ppe, out, dry
        self.reader = LatestFrame(cfg.get("source_override", cam["rtsp"]))
        self.tracker = Tracker(prefix=f"{cam['id']}:")
        self.rules = CameraRules({"id": cam["id"], "outlet_id": cfg["outlet_id"], "zone": cam["zone"]})
        self.frames, self.latency, self.last_beat, self.last_display, self.labels_read = 0, 0.0, 0.0, 0.0, {}

    def subzone(self, box, w, h):
        foot = ((box[0] + box[2]) / 2 / w, box[3] / h)
        for name, poly in (self.cam.get("subzones") or {}).items():
            if point_in_poly(*foot, poly):
                return name
        return RULES["zones"][self.cam["zone"]]["subzones"][0]

    def step(self):
        frame = self.reader.read()
        if frame is None:
            return
        t0 = time.time()
        h, w = frame.shape[:2]
        dets = self.base(frame)
        extra = self.ppe(frame) if self.ppe else []
        persons = [(c, b, None) for n, c, b in dets if n == "person"]
        phones = [b for n, c, b in dets if n == "cell phone"]
        ppe_dets = [d for d in extra if d[0] in det.PPE_CLASSES]
        people = []
        for tid, conf, box, _ in self.tracker.update(persons, t0):
            attrs = det.attach_ppe(box, ppe_dets)
            attrs["phone"] = any(box[0] <= (p[0] + p[2]) / 2 <= box[2] and box[1] <= (p[1] + p[3]) / 2 <= box[3] for p in phones)
            # Front-of-house: a detected apron/uniform marks staff; everyone else is a guest
            role = "staff" if self.cam["zone"] in ("kitchen", "pass", "storage") or attrs["apron"] else "guest"
            people.append({"id": tid, "role": role, "sub": self.subzone(box, w, h), "conf": round(conf, 2), "attrs": attrs})
        objects = []
        for i, (n, c, b) in enumerate(d for d in extra if d[0] in ("spill", "label")):
            o = {"id": f"{self.cam['id']}:{n}{i}", "cls": n, "conf": round(c, 2)}
            if n == "label":
                key = tuple(int(v) // 40 for v in b)                     # same label in roughly the same place -> read once
                if key not in self.labels_read:
                    x1, y1, x2, y2 = map(int, b)
                    self.labels_read[key] = ocr.read_label(frame[max(0, y1):y2, max(0, x1):x2]) or {"expired": False, "text": ""}
                o.update(expired=self.labels_read[key]["expired"], text=self.labels_read[key]["text"])
            objects.append(o)
        ts = int(t0 * 1000)
        events = self.rules.process({"ts": ts, "hour": time.localtime(t0).tm_hour, "outlet_id": self.cfg["outlet_id"], "camera_id": self.cam["id"],
                                     "zone": self.cam["zone"], "people": people, "objects": objects})
        for e in events:
            e["source"] = VERSION
        self.emit("event", events)

        disp = self.cam.get("display")                                    # camera reading a legacy fridge/oven display
        if disp and t0 - self.last_display >= disp.get("every_s", 60):
            x, y, dw, dh = disp["roi"]
            val = ocr.read_display(frame[y:y + dh, x:x + dw], disp.get("digits", 3))
            if val is not None:
                self.emit("reading", [{"sensor_id": disp["sensor_id"], "value": val, "ts": ts, "source": "ocr"}])
            self.last_display = t0

        self.frames += 1
        self.latency = 0.8 * self.latency + 0.2 * (time.time() - t0) * 1000
        if t0 - self.last_beat >= RULES["heartbeat_s"]:
            self.emit("heartbeat", [{"outlet_id": self.cfg["outlet_id"], "camera_id": self.cam["id"], "ts": ts, "fps": self.cfg.get("fps", RULES["fps"]),
                                     "latency_ms": round(self.latency), "frames": self.frames, "model": self.cfg.get("model"),
                                     "agent": VERSION, "status": "online" if self.latency < 1000 / RULES["fps"] else "degraded"}])
            self.last_beat, self.frames = t0, 0

    def emit(self, kind, items):
        if not items:
            return
        if self.dry:
            for i in items:
                print(kind, json.dumps(i))
        else:
            self.out.put(kind, items)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default="config.json")
    ap.add_argument("--source", help="override every camera (0 = webcam, or a video file)")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    cfg = json.load(open(a.config, encoding="utf-8"))
    if a.source is not None:
        cfg["source_override"] = a.source
    base = det.load(cfg.get("model", "rf-detr-nano.onnx"), conf=cfg.get("conf", 0.45))
    ppe = det.load(cfg.get("ppe_model"), classes=cfg.get("ppe_classes"), conf=cfg.get("ppe_conf", 0.5)) if cfg.get("ppe_model") else None
    out = None if a.dry_run else Outbox(cfg["api"], cfg["api_key"], cfg.get("outbox", "outbox.db"), VERSION, **RULES["batch"])
    if out:
        threading.Thread(target=out.run_forever, daemon=True).start()
    workers = [CameraWorker(c, cfg, base, ppe, out, a.dry_run) for c in cfg["cameras"]]
    fps = cfg.get("fps", RULES["fps"])
    print(f"{VERSION}: {len(workers)} cameras at {fps} fps on {getattr(base, 'provider', '?')} -> {cfg['api']}")
    while True:
        t0 = time.time()
        for w in workers:
            try:
                w.step()
            except Exception as e:
                print(f"[{w.cam['id']}] {e}")
        time.sleep(max(0, 1 / fps - (time.time() - t0)))


if __name__ == "__main__":
    main()
