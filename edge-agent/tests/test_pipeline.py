"""End-to-end smoke test of the real edge agent without a camera or model weights:
stub frames + a stub detector (a cook at the station holding a phone, no hairnet) go through the real tracker,
zone assignment, rules, outbox (SQLite store-and-forward) and HTTP contract into a running OutletOS server.

    python edge-agent/tests/test_pipeline.py http://localhost:8787 <api-key>
"""
import os
import sys
import tempfile
import time

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import agent  # noqa: E402
from outbox import Outbox  # noqa: E402

api, key = sys.argv[1], sys.argv[2]


class StubReader:
    def read(self):
        return np.zeros((360, 640, 3), np.uint8)


def base(frame):      # person standing in the "station" polygon, phone in hand
    return [("person", 0.91, (100, 120, 220, 350)), ("cell phone", 0.8, (150, 200, 175, 230))]


def ppe(frame):       # PPE head says: no hair covering
    return [("no_hairnet", 0.85, (130, 125, 190, 160)), ("apron", 0.8, (110, 200, 210, 300))]


cfg = {"outlet_id": "r1", "fps": 2, "model": "stub-detector"}
cam = {"id": "r1-hotline", "zone": "kitchen", "rtsp": "stub",
       "subzones": {"station": [[0, 0.3], [0.7, 0.3], [0.7, 1], [0, 1]], "sink": [[0.7, 0.3], [1, 0.3], [1, 1], [0.7, 1]]}}
db = os.path.join(tempfile.mkdtemp(), "outbox.db")
out = Outbox(api, key, db, agent.VERSION)
w = agent.CameraWorker.__new__(agent.CameraWorker)
w.cam, w.cfg, w.base, w.ppe, w.out, w.dry = cam, cfg, base, ppe, out, False
w.reader = StubReader()
w.tracker = agent.Tracker(prefix="r1-hotline:")
w.rules = agent.CameraRules({"id": cam["id"], "outlet_id": "r1", "zone": "kitchen"})
w.frames, w.latency, w.last_beat, w.last_display, w.labels_read = 0, 0.0, 0.0, 0.0, {}

for _ in range(16):            # 8 seconds at 2 fps: enough for the phone (5 s) and PPE (6 s window) rules
    w.step()
    time.sleep(0.5)

queued = out.db.execute("SELECT kind, COUNT(*) FROM q GROUP BY kind").fetchall()
print("queued before send:", dict(queued))
sent = out.flush_once()
left = out.db.execute("SELECT COUNT(*) FROM q").fetchone()[0]
print(f"sent {sent} items to {api}; left in outbox: {left}")
assert sent > 0 and left == 0
