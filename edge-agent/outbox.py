"""
Store-and-forward outbox. Events are written to a local SQLite file first, then sent in batches over HTTPS.
If the restaurant's internet drops, nothing is lost: the queue drains when the link returns (oldest first),
with exponential backoff. Only JSON leaves the site, never video.

MQTT (Mosquitto / EMQX, QoS 1 with persistent sessions) is a drop-in alternative transport for groups that already
run a broker; the payload is the same contract.
"""
import json
import sqlite3
import threading
import time
import urllib.request


class Outbox:
    def __init__(self, api, key, path="outbox.db", agent="outletos-edge", max_events=50, max_wait_s=5):
        self.api, self.key, self.agent = api.rstrip("/"), key, agent
        self.max_events, self.max_wait = max_events, max_wait_s
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.db.execute("CREATE TABLE IF NOT EXISTS q (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT, body TEXT)")
        self.db.commit()
        self.lock = threading.Lock()
        self.backoff = 1

    def put(self, kind, items):
        if not items:
            return
        with self.lock:
            self.db.executemany("INSERT INTO q(kind, body) VALUES (?, ?)", [(kind, json.dumps(i)) for i in items])
            self.db.commit()

    def _post(self, path, payload):
        req = urllib.request.Request(f"{self.api}{path}", data=json.dumps(payload).encode(), method="POST",
                                     headers={"Content-Type": "application/json", "x-api-key": self.key, "User-Agent": self.agent})
        urllib.request.urlopen(req, timeout=10).read()

    def flush_once(self):
        with self.lock:
            rows = self.db.execute("SELECT id, kind, body FROM q ORDER BY id LIMIT ?", (self.max_events,)).fetchall()
        if not rows:
            return 0
        events = [json.loads(b) for _, k, b in rows if k == "event"]
        beats = [json.loads(b) for _, k, b in rows if k == "heartbeat"]
        readings = [json.loads(b) for _, k, b in rows if k == "reading"]
        if events or beats:
            self._post("/api/v1/vision", {"events": events, "heartbeats": beats})
        if readings:
            self._post("/api/v1/readings", readings)
        with self.lock:
            self.db.execute(f"DELETE FROM q WHERE id IN ({','.join('?' * len(rows))})", [r[0] for r in rows])
            self.db.commit()
        return len(rows)

    def run_forever(self):
        while True:
            try:
                sent = self.flush_once()
                self.backoff = 1
                if sent < self.max_events:
                    time.sleep(self.max_wait)
            except Exception as e:
                print(f"[outbox] send failed ({e}); retrying in {self.backoff}s, queued events are kept on disk")
                time.sleep(self.backoff)
                self.backoff = min(self.backoff * 2, 120)
