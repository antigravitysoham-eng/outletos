"""Replays the recorded scene (fixture.json, produced by server/scripts/vision-parity.mjs) through the
edge agent's rule engine and checks it emits exactly the events the simulator's engine emitted."""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from rules import CameraRules, RULES  # noqa: E402

fx = json.load(open(os.path.join(HERE, "fixture.json"), encoding="utf-8"))
assert fx["rules_version"] == RULES["version"], "rules.json changed since the fixture was recorded"
engines = {c["id"]: CameraRules(c) for c in fx["cameras"]}
got = []
for f in fx["frames"]:
    got.extend(engines[f["camera_id"]].process(f))

expected = fx["events"]
norm = lambda e: json.dumps(e, sort_keys=True)
mismatch = next((i for i, (a, b) in enumerate(zip(got, expected)) if norm(a) != norm(b)), None)
if len(got) != len(expected) or mismatch is not None:
    i = mismatch if mismatch is not None else min(len(got), len(expected))
    print(f"PARITY FAILED at event {i}: python={len(got)} js={len(expected)}")
    print("  python:", got[i] if i < len(got) else None)
    print("  js:    ", expected[i] if i < len(expected) else None)
    sys.exit(1)
print(f"PARITY OK: {len(got)} events identical across {len(fx['frames'])} frames and {len(fx['cameras'])} cameras (rules {RULES['version']})")
