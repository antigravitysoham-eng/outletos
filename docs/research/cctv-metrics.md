# What CCTV can actually measure (November 2026)

**Conclusion:** at 2 fps on existing restaurant CCTV, metrics of the form "a person or large object present in a zone, over time" are reliable. Checks that depend on small objects (gloves, hairnets, phones, label text), or that infer intent (a greeting, a proper hand-wash), are not reliable in real time. OutletOS now classifies every vision check into one of four tiers and only alerts on the reliable ones.

**Why it comes down to pixels on target:**
- A 1080p camera with a 2.8 mm lens gives about 200 px/m at 4 m.
- A nano detector downscales each frame to 384–640 px, which leaves about 40–65 px/m.
- At that density, at 4 m from the camera:

| Target | Size the detector sees | Reliable threshold |
|---|---|---|
| Gloved hand | about 6×13 px | 32×32 px (COCO's "small object" cut-off, where nano detectors are weakest) |
| Head covering | about 11 px | 32×32 px |
| Use-by text | 0.4–0.8 px characters | 10–20 px characters for OCR |

Use-by OCR from a ceiling camera is therefore out of reach by more than an order of magnitude.

The reference points are IEC 62676-4: detect at 25 px/m, recognise at 125 px/m, identify at 250 px/m.

## The four tiers in the product

| Tier | Checks | Behaviour |
|---|---|---|
| **Real-time** (alerts on repetition) | Station staffed (coverage %), after-hours cold-store entry, walk-in door open > 3 min, unattended counter while a guest waits, queue wait (Little's law), dishes waiting at the pass, zone occupancy, camera health | Page the right person on repetition: 2 high-severity or 3 medium-severity events in 15 min |
| **KPI** (aggregate) | Time to first staff approach (proximity, not a "greeting"), first table visit, uniform % | Reported as p50/p90 or a percentage. Alerts start only after per-site validation (`vision_validated`). |
| **Audit** (human review) | Hair covering, gloves, phone use (aggregate, opt-in), sink visit after raw handling | Sent to a supervisor review queue. Never alerted automatically and never ranked per person. Real-time only on cameras that pass a pixel-density test (≥125 px/m at the head, ≥250 px/m at the hands). |
| **Dropped** | Use-by label OCR, clear-liquid spill detection | Accepted on the API for compatibility but never scored. Use-by labels move to a scan workflow at the prep station. Spills need thermal cameras or manual checks. |

## Metric definitions (as implemented)

| Metric | Definition | Reporting |
|---|---|---|
| Station coverage % | Staffed seconds ÷ open seconds. A station counts as staffed after 5 s of presence and unstaffed after 30 s of absence (hysteresis). | Per station, per shift |
| Queue wait | W ≈ L̄ ÷ service rate (Little's law) | p50 and p90 per 15 min |
| Pass dwell | Time a plate stays in the pass polygon, from appearing to being picked up. Requires plate training per site. | p50 and p90; count over 2 min |
| Walk-in door | Door-state classifier | Open seconds per hour; count over 3 min |
| Unattended counter | Guest zone occupied while the staff zone has been empty for ≥ 30 s | Count of events |
| After-hours access | A person in the cold-store door zone for ≥ 3 s outside opening hours | Count of events |
| Time to first staff approach | From a guest's entry until a staff member is within 1.5 m for 3 s | p50 and p90 per daypart |
| Camera compliance (KPI) | Passed ÷ all checks, using the real-time and KPI tiers only | % per period |

## How to validate before switching alerts on

1. **Shadow mode.** Run for 2 weeks per site before any alerts are switched on.
2. **Build a labelled sample** covering every camera × daypart × lighting condition (day, night, IR).
   - Double-label 10% of it and require agreement of κ ≥ 0.8.
3. **Sample sizes:**
   - Event detectors: at least 150–200 positive events plus at least 100 h of footage without events.
   - Continuous metrics: report bias, mean absolute error (MAE) and the share of readings within tolerance.
4. **Accuracy targets:**

| Use | Target |
|---|---|
| Real-time alerts | Precision ≥ 90%, recall ≥ 80% |
| Aggregate KPIs | Daily error ≤ 5% |
| Audit tier | Precision ≥ 70% (a human confirms every flag) |

5. **Drift checks.** Review 50 random snapshots per camera every month. Re-calibrate if agreement drops by more than 5 points.

## Privacy

**India: DPDP Act 2023**
- Process video at the edge and discard frames.
- Store only aggregates and anonymous track statistics.
- Put up signage.
- Keep clips 7–30 days, with faces blurred.
- Use no facial recognition for staff.

**EU and UK: GDPR**
- Lawful basis is legitimate interest, supported by a DPIA.
- Employee consent is generally not a valid basis.

**EU AI Act**
- Emotion recognition at work is prohibited.
- Per-person performance scoring is likely high-risk.

**Rule for all regions:** keep staff metrics at the station or shift level.

## Sources

Axis IEC 62676-4 pixel-density whitepaper; MDPI Sensors 25(22):6893; MATEC 2022; Frontiers Comp. Sci. 2025 (phone detection); arXiv 2509.09111 (FPI-Det); JAMIA 2020 / Stanford PAC (hand hygiene with dedicated sensors); arXiv 2309.02666 and ByteTrack issue #394 (tracking at low fps); arXiv 2411.10072 (overhead people counting); arXiv 2510.08770 (spills); PMC6068511 (fall detection on real-world data); arXiv 2607.03131 (smoke temporal confirmation); EDPB Guidelines 3/2019; ICO "Monitoring workers" (2023). Accuracy figures marked as estimates in the research must be confirmed in a pilot. Vendor accuracy claims (Wobot, Staqu, Agot, PreciTaste) are unverified.
