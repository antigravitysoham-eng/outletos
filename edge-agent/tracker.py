"""
ByteTrack-style multi-object tracker (dependency-free). Gives each person a stable anonymous id across frames
so rules can reason over time (dwell at the sink, phone held for 5 s, PPE majority over 6 s). No identity, no faces.

Two-stage association, as in ByteTrack: high-confidence detections first, then low-confidence ones are used to keep
existing tracks alive through partial occlusion (steam, a passing colleague). For moving cameras or heavy crowds,
swap in BoT-SORT / OC-SORT from Roboflow's `trackers` package (Apache-2.0) behind the same update() signature.
"""


def iou(a, b):
    x1, y1, x2, y2 = max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3])
    inter = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / union if union > 0 else 0.0


class Tracker:
    def __init__(self, high=0.5, low=0.2, match_iou=0.3, max_age_s=3.0, prefix="t"):
        self.high, self.low, self.match_iou, self.max_age = high, low, match_iou, max_age_s
        self.tracks, self.next_id, self.prefix = {}, 1, prefix

    def _match(self, track_ids, dets):
        pairs = sorted(((iou(self.tracks[t]["box"], d[1]), t, j) for t in track_ids for j, d in enumerate(dets)), reverse=True)
        used_t, used_d, out = set(), set(), []
        for score, t, j in pairs:
            if score < self.match_iou or t in used_t or j in used_d:
                continue
            used_t.add(t); used_d.add(j); out.append((t, j))
        return out, [t for t in track_ids if t not in used_t], [j for j in range(len(dets)) if j not in used_d]

    def update(self, dets, now):
        """dets: [(conf, box, payload)] -> [(track_id, conf, box, payload)] for tracks seen this frame."""
        hi = [d for d in dets if d[0] >= self.high]
        lo = [d for d in dets if self.low <= d[0] < self.high]
        out = []
        m1, rest, new_hi = self._match(list(self.tracks), hi)
        for t, j in m1:
            self.tracks[t].update(box=hi[j][1], seen=now); out.append((t, *hi[j]))
        m2, _, _ = self._match(rest, lo)
        for t, j in m2:
            self.tracks[t].update(box=lo[j][1], seen=now); out.append((t, *lo[j]))
        for j in new_hi:
            tid = f"{self.prefix}{self.next_id}"; self.next_id += 1
            self.tracks[tid] = {"box": hi[j][1], "seen": now}; out.append((tid, *hi[j]))
        for t in [t for t, v in self.tracks.items() if now - v["seen"] > self.max_age]:
            del self.tracks[t]
        return out
