# OutletOS

One platform to run and watch every outlet in a restaurant group. It covers:
- **Front of house:** point of sale with GST/VAT invoices and KOTs, reservations.
- **Kitchen and supply:** inventory with recipes, purchasing and 86.
- **People and premises:** workforce, CCTV vision on reliable metrics only, cold chain.
- **Finance:** day end, tax register, Tally export, aggregator reconciliation, leakage audit.
- **Reports:** KPIs, KRIs and forecasts, with a single **Outlet Health Score** per site.
- **AI agents:** Maître plus seven specialists, answering within each person's access.
- **Telegram assistant:** ask for sales, reports, alerts and live status from Telegram, scoped to your role; approve alert acknowledgements from the chat.

New groups set everything up in a guided onboarding: any country, any number of outlets, different floors, menus and teams in each.

It doesn't depend on any POS. Any POS, attendance device, camera system, sensor or review platform plugs in through one canonical event API, a no-code webhook mapper, or a CSV import.

## Run it

Requires **Node 22.13+** (uses Node's built-in SQLite, so there is no database to install).

```bash
npm install
npm run build          # build the web app
npm start              # Global demo        http://localhost:8787  (USD, New York · London · Paris · Dubai · Mumbai · Singapore)
npm run start:india    # India demo         http://localhost:8788  (INR, GST, Mumbai · Delhi · Bengaluru · Hyderabad · Pune · Kolkata)
npm run start:new      # New workspace      http://localhost:8789  (empty: sign up and run the onboarding wizard)
```

Development with hot reload: `npm run dev` (web on :5173, API on :8787) or `npm run dev:india`.

| Instance | What is different |
|---|---|
| **Global** | Restaurants 1–6 in six countries, US-dollar reporting, international menu. |
| **India** | Rupees with lakh/crore formatting. GST 5% split CGST/SGST, with GSTIN and FSSAI on bills. Indian menu, recipes and wages. Swiggy, Zomato, ONDC and Magicpin. UPI-first payments. Asia/Kolkata time. |
| **New workspace** | No data. The first visitor creates the owner account and configures country, outlets, floors and tables, menu, team, modules and integrations. Sample activity is optional. |

On first start the demo instances create 6 branches (**Restaurant 1–6**). Each builds **4 weeks of history**: orders, kitchen tickets, shifts, sensor readings, camera checks, reviews, stock counts, purchases, reservations and audit events. That is enough for week-over-week comparisons and weekday-aware forecasts. Today since midnight is also generated. It then keeps generating live orders, kitchen tickets, clock-ins, camera detections, sensor readings, reviews and returning-guest arrivals. If the server was offline for more than 15 minutes, it rebuilds a fresh day on start.

## Sign in, roles and access

Demo accounts (local only, password `demo1234`) are listed on the sign-in screen:

| Account | Role | Sees |
|---|---|---|
| `owner` | Owner | Everything, all branches, manages the team |
| `area.east` | Area Manager | Sales, costs and operations for Restaurants 4–6 only |
| `manager.r1`, `manager.r5` | Branch Manager | Their own branch: sales, costs, staff, guests, kitchen |
| `chef.r1` | Head Chef | Kitchen, cameras, food safety, kitchen staff. No sales or costs |
| `cook.r1` | Line Cook | Only the Grill station's tickets and alerts |
| `host.r1` | Host | Guest arrivals, preferences and suggestions (phones masked), reviews |
| `auditor` | Food Safety Auditor | Read-only hygiene, cameras and cold chain, all branches |
| `it.admin` | IT / Integrations | API keys, connectors, camera streams. No business data |
| `cashier.r1` | Cashier / Captain | POS (orders, KOT, settle), reservations, guests. Discounts over 25% and NC bills need a manager |

**RBAC** (role → permissions) and **ABAC** (branch scope, region, station, department, alert category, masked fields) are both enforced on the server in `server/src/policy.js`. They apply to every API response and every live event, so a hidden field is never sent to the browser. Owners add people and assign roles and branches under **Team & Access**.

## Staffing productivity

The Dashboard and the Staff page track:
- **TPPH:** orders per labour hour. Target 3.0 (kitchen-only view 4.8); override with `TARGET_TPPH`.
- **Labour hours per order** and **guests per labour hour**.
- **Sales per labour hour.** Sales roles only.
- **Labour cost.** Finance roles only.
- **An hour-by-hour chart:** staff on shift vs recommended headcount, with each hour marked overstaffed or understaffed.

## Returning guests

The entrance camera recognises guests who opted in to face matching; everyone else is matched by loyalty QR, phone or reservation. `server/src/guests.js` turns their order history into suggestions for the team: allergy warnings, their usual order, new dishes matching their taste, pairings, welcome-back offers for lapsed guests, visit milestones, birthdays, VIP handling and seating preference.

## AI agents

Open **AI Agents** in the sidebar, or tap **Ask Maître** on any page. **Maître**, the orchestrator agent, takes a plain-English question, delegates to the right specialist agents in parallel, and merges their reports into one short answer with the figures and their baselines.

| Agent | Module | Example question |
|---|---|---|
| Maître | All (orchestrator) | "Give me today's briefing", "Why is the weakest branch behind?" |
| Revenue Analyst | Sales, channels, menu mix, prime cost | "How are sales vs yesterday?" |
| Kitchen Ops | Ticket times, station bottlenecks | "Which station is slowest right now?" |
| Vision & Operations | Station coverage, queues, pass waits, access (PPE as audit) | "Which station is going uncovered?" |
| Guest Experience | Regulars, allergies, suggestions, reviews | "Tell me about Nora Haddad" |
| Workforce Planner | TPPH, over/under-staffing, lateness | "Are we overstaffed right now?" |
| Food Safety (HACCP) | Cold chain and corrective actions | "What do we do if the freezer is warm?" |
| Incident Manager | Alerts, health scores, acknowledgement | "Acknowledge the speed alerts" |

**How it stays safe**
- **Same access as the user.** Agents read only through `server/src/agents/tools.js`. Each tool needs one permission and runs with the signed-in user's principal, so RBAC/ABAC, station scoping and phone masking apply unchanged. A question about a branch or domain outside the role gets an explicit "not available" answer.
- **Actions need approval.** Data tools are read-only. The Incident Manager can only *propose* acknowledging alerts; the user approves on a card, which calls the normal acknowledge route.
- **Grounded answers.** Numbers come only from tool results. Every specialist can search the group playbook (`server/src/agents/knowledge.js`: HACCP limits, speed targets, TPPH rules, escalation). Replace it with your own SOPs.
- **Audited.** Every run (user, question, agents, tools, engine, duration) is stored in `agent_runs` and available at `GET /api/agents/runs`.

**Engines.** Without configuration the built-in **local engine** answers (keyword routing plus grounded composers), and no data leaves the server. Set `ANTHROPIC_API_KEY` to switch to the **Claude engine**: Maître and each specialist run as Claude tool-use loops on `claude-opus-5-5`, with server-side refusal fallback. If the API is unreachable, the agents fall back to the local engine and say so.

| Variable | Default | Effect |
|---|---|---|
| `ANTHROPIC_API_KEY` | unset | Enables the Claude engine (tool results for each question are sent to the Anthropic API) |
| `OUTLETOS_AGENT_MODEL` | `claude-opus-5-5` | Model for Maître and the specialists |
| `OUTLETOS_AGENT_ENGINE` | auto | `local` forces the local engine even when a key is set |

Endpoints: `GET /api/agents` (roster for your role), `GET /api/agents/briefing`, `POST /api/agents/chat` (NDJSON stream of `plan`, `step`, `notice` and `answer` events), `GET /api/agents/runs`.

## Stack (deliberately small)

| Layer | Choice | Why |
|---|---|---|
| API | Node + Express | Runs anywhere, one process |
| AI agents | Orchestrator + 7 specialists; local engine or Claude (`@anthropic-ai/sdk`) | Grounded, role-scoped answers; works offline |
| DB | `node:sqlite` (WAL) | Zero setup; swap for Postgres/Timescale at scale |
| Realtime | Server-Sent Events | Works through proxies, no socket server |
| Web | React + Vite + Tailwind + Recharts | Fast, light and dark themes, mobile layout |
| Vision (browser) | TensorFlow.js COCO-SSD | Webcam lab, real detections, lazy-loaded |
| Vision (edge) | Python + YOLO + OpenCV | `edge-agent/` reads RTSP and sends events only |

## Operations back office

| Module | What it does |
|---|---|
| **Point of Sale** | Each area has live table status, time seated and a running total; takeaway and delivery orders sit alongside. KOTs fire per station, and cancelling after a KOT needs a reason. Discounts and NC bills need a reason (managers approve large ones). Split tender across UPI, card, cash, wallet and credit. Tax invoice with GSTIN, FSSAI, SAC 9963 and CGST/SGST, rounded to the rupee, numbered per financial year (`R1/26-27/000001`). VAT-inclusive countries extract tax rather than adding it. |
| **Inventory & Menu** | Stock on hand = last count + purchases − wastage − (sales × recipes). Shows days of cover; reorder points come from usage and vendor lead time. Suggested POs per vendor, with receiving (GRN). Wastage with reasons; physical counts with variance. Group-wide prices with a margin guard; 86 is set per branch and respected by the POS and delivery menus. |
| **Reservations** | Bookings from phone, walk-ins and dining platforms in one day sheet, plus a waitlist, deposits and no-show rate. Seating a booking opens the order on the POS table. |
| **Finance & Compliance** | Day end with a cash count and stored variance. Tax register (taxable value, CGST/SGST or VAT, per GSTIN). Tally XML export (one sales voucher per branch per day). Aggregator reconciliation: commission, 18% GST on commission, 0.5% TCS, and missing or short-paid orders to dispute. Leakage panel with a per-person risk score (a z-score against peers). |

## Reports & analytics

One management report per period: today, yesterday, 7 days or 14 days, compared with the prior period. It exports to CSV or prints to an A4 PDF.

- **Cover and executive summary**, written from the numbers.
- **KPI scorecard**: 23 KPIs, each with target, prior value, change, a red/amber/green status and a 15-day trend.
- **13 key risk indicators**, each with amber and red thresholds, the branches in breach, an owner and a response.
- **Branch league table**, daily or hourly sales against the prior period and budget, channel mix and dayparts.
- **Menu engineering**: Star, Plowhorse, Puzzle or Dog.
- **Forecast**: Holt's linear trend on weekday-adjusted sales with an 80% range, a backtest error (MAPE) and today's projected close with the chance of hitting budget.
- **7-day plan**: forecast orders turned into labour hours needed, and food purchase.

Each role only sees the KPIs it is allowed to. The AI agents answer forecast and scorecard questions using the same report.

## Onboarding (new workspace)

A nine-step wizard with a live receipt and floor-plan preview. It saves after every change and resumes where you left off.

1. **Business**: type, outlet count, current POS, goals.
2. **Country & tax**: 20 country packs. Each pack sets currency and locale, tax rate and whether prices include tax, any tax split, legal IDs with validation, fiscal year, rounding, service-charge rules, local platforms and payment methods.
3. **Outlets**: cards, or a spreadsheet grid with paste from Excel. Each outlet has its own seats, hours, budget and licences.
4. **Floors & tables**: areas, numbered tables, templates, copy to all.
5. **Menu**: costed template converted to local currency, CSV import with a review grid, or build manually.
6. **Team & roles**: roster level per outlet, and invites scoped by role and outlet.
7. **Modules & targets.**
8. **Integrations.**
9. **Review & launch**: a readiness checklist, with sample activity or a clean start.

Launch creates everything in one transaction and shows the team logins once. The research behind the design is in `docs/research/onboarding.md`.

## Telegram assistant

Each person links their own private Telegram chat and then asks in Telegram what they would ask the app. Answers use the same permissions, branch scope and AI agents as the web app.

1. **Admin, once:** create a bot with **@BotFather** (`/newbot`), then paste its token in **Integrations → Telegram assistant**. Choose **long polling** (no public address needed) or **webhook** (production HTTPS).
2. **Everyone:** click **Telegram** in the top bar, open the bot and tap Start (or send `/start CODE`). Codes are single use and expire in 10 minutes.
3. **Ask:** `/sales`, `/report 7d`, `/forecast`, `/alerts` (with an Acknowledge button), `/kitchen`, `/staff`, `/safety`, `/health`, `/branch r1`, `/notify off`, or any question in plain words.

Safeguards:
- Group chats are refused.
- Every message re-checks the user and their role, and deactivated users are disconnected.
- Approvals re-check permission before writing.
- High-severity alerts are pushed only to people who can see them, capped at 12 per hour.

Try it without a real bot: `node server/scripts/telegram-demo.mjs` connects the instance to a local stand-in for the Telegram API and records a conversation. The full guide is the **Telegram Bot Guide** document.

## Integrating real systems

The **Integrations** page has a marketplace of **67 pre-built connectors, India first**: 38 relevant in India. They cover POS (Petpooja, Restroworks, Rista, Toast, Square, Simphony…), delivery (UrbanPiper, Zomato, Swiggy, ONDC, Uber Eats, Deliveroo, Talabat…), accounting (Tally, Zoho Books, GST e-invoicing, QuickBooks, Xero), payments (Razorpay, Paytm, PhonePe, Pine Labs, Stripe, Adyen), CCTV (CP Plus, Hikvision, Dahua, Uniview, Axis, Milestone, Verkada, any ONVIF/RTSP camera), attendance (eSSL, ZKTeco, Matrix COSEC, greytHR, Keka) and IoT.

Each connector records:
- how it connects: webhook, scheduled sync, edge agent, device push, CSV/SFTP or outbound
- the credentials it needs
- whether the vendor API is public or partner-gated
- generated setup steps and a starter field mapping

Secrets are stored server-side and only shown masked. Signed webhooks (HMAC) are verified. eSSL/ZKTeco terminals post punches to `/iclock/cdata`, accepted only from registered serial numbers. NVR connectors generate RTSP sub-stream URLs for the edge agent.

Get the API key from **Integrations**. Every endpoint accepts one object or an array.

| Source | Endpoint |
|---|---|
| POS / billing | `POST /api/v1/orders` · `POST /api/v1/import/orders` (CSV) |
| KDS | `POST /api/v1/tickets` |
| Attendance (face, fingerprint, mobile) | `POST /api/v1/attendance` (by `staff_id` or device `external_id`) |
| CCTV / VMS / edge agent | `POST /api/v1/vision` |
| IoT sensors | `POST /api/v1/readings` |
| Reviews | `POST /api/v1/reviews` |
| **Anything with a webhook** | `POST /api/v1/webhooks/:connectorId`, with a field mapping defined in the UI |

The webhook mapper turns any vendor's JSON into the canonical shape. It supports dot-paths, constants (`"=par"`), value maps, unit scaling (cents to units) and date parsing. The bundled templates are illustrative, so verify field paths against each vendor's live payload.

```bash
curl -X POST localhost:8787/api/v1/orders -H "x-api-key: $KEY" -H "Content-Type: application/json" \
  -d '{"outlet_id":"par","total":1640,"covers":4,"table_no":"T7"}'
```

### Vision: only what CCTV can measure

Research (`docs/research/cctv-metrics.md`) showed that at 2 fps on existing ceiling CCTV, presence-and-time metrics are reliable, and small objects and text are not. Every check now has a tier:

| Tier | Checks | Behaviour |
|---|---|---|
| **Real-time** | Station coverage, after-hours cold-store entry, walk-in door open > 3 min, unattended counter, queue wait, dishes waiting at the pass, occupancy, camera health | Alerts on repetition |
| **KPI** | Time to first staff approach, first table visit, uniform % | Shown as aggregates; alerts only once the site is validated |
| **Audit** | Gloves, hair cover, phone use, sink visit after raw handling | Sent to a review queue, never auto-alerted or ranked per person |
| **Dropped** | Use-by label OCR from CCTV (use a scan station instead), clear-liquid spills | Accepted on the API, never scored |

## Outlet Health Score

0–100, weighted: sales pace 20 · speed of service 20 · hygiene (vision) 20 · brigade attendance 15 · cold chain 15 · guest sentiment 10. Weights are in `server/src/metrics.js`.

## CCTV plan

**Principle:** reuse the cameras already installed. Process video *inside* the restaurant on a small edge box and send only events (JSON) to the cloud. That keeps bandwidth near zero, keeps footage private and stays within data-protection rules.

### Real-time pipeline (edge-agent/)
```
IP camera (RTSP sub-stream) -> go2rtc / MediaMTX re-stream (one camera connection; WebRTC live view on demand)
 -> latest-frame reader, 2 fps -> detector (ONNX Runtime: TensorRT / OpenVINO / CPU, INT8)
 -> tracker (ByteTrack-style anonymous ids) -> zones (foot point in named polygons)
 -> rules.py (edge-agent/rules.json) -> OCR on trigger (use-by labels, 7-segment displays)
 -> SQLite outbox (store-and-forward) -> POST /api/v1/vision {events, heartbeats}
```
- `agent.py` orchestrates the cameras. The pipeline stages live in `detector.py`, `tracker.py`, `rules.py`, `ocr.py` and `outbox.py`.
- Every event carries the zone, an anonymous track id and a duration. Every camera sends a heartbeat each minute. After 3 minutes of silence the camera is marked offline and one alert is raised.

### Models (cheap, effective, licence-safe)
| Job | Model | Licence |
|---|---|---|
| People, phones | RF-DETR-Nano or D-FINE-N / DEIM-N, ONNX INT8 | Apache-2.0 |
| PPE, spills, labels | Same detector fine-tuned on 3–5k frames of your kitchens (start from Roboflow Universe kitchen-PPE sets) | Apache-2.0 |
| Use-by labels, tickets | PaddleOCR PP-OCRv5 mobile, run only on a detected label crop | Apache-2.0 |
| Fridge/oven displays | ssocr on a fixed crop, PaddleOCR fallback | GPL tool (separate process) |
| Number plates | fast-alpr + fast-plate-ocr | MIT |
| Optional second opinion | Qwen3-VL-2B/4B on a blurred snapshot of high-severity events | Apache-2.0 |

Ultralytics YOLO11/YOLO26 works for development (pass a `.pt` path), but it is AGPL-3.0. Shipping it in a closed product needs an Enterprise licence.

**Edge hardware**

| Box | Approx. price | Cameras at 2 fps |
|---|---|---|
| Raspberry Pi 5 + Hailo-8L | ≈ $200–250 | 2–4 |
| Intel N100 + OpenVINO | ≈ $150–250 | 4–8 |
| Jetson Orin Nano Super | ≈ $249 kit | 8–12 |

Benchmark your own model before buying at scale.

### The simulator is built the same way
The demo has no RTSP or model. Instead, `server/src/vision/scene.js` generates synthetic tracked detections, with detector noise. Everything after that is the edge pipeline:
- `rules.js` is a line-for-line twin of `rules.py`, reading the same `rules.json`.
- `edge-sim.js` batches events and heartbeats.
- Everything posts through the same `ingestVision()` contract as `/api/v1/vision`.

`npm run test:parity` records a scene and replays it through both engines. It requires identical events (848 events across 43,200 frames when last run).

`python edge-agent/tests/test_pipeline.py http://localhost:8787 <api-key>` drives the real agent end to end: stub detections, tracker, rules, outbox, then HTTP.

### Rollout
1. **Pilot one outlet (2–3 weeks).**
   - Audit cameras: one per station, one on the pass, one on the cold-store door, one at the entrance.
   - Install the edge box on the CCTV VLAN and copy `config.example.json` to `config.json`.
   - Draw the zone polygons and set the API key.
   - People, phones, station coverage, after-hours access and greeting work on day one with a COCO model.
2. **Hygiene model (4–6 weeks).** Label 3–5k frames from your kitchens (hairnet/no_hairnet, gloves/no_gloves, apron/no_apron, spill, label). Fine-tune and export to ONNX. Calibrate the thresholds in `rules.json` with the head chef. The simulator and the parity test pick up the same file.
3. **Roll out.**
   - One edge box per outlet.
   - Live view through go2rtc/MediaMTX WebRTC.
   - Existing VMS analytics (Hikvision ISAPI `httpHosts`, Dahua event API) can feed a webhook connector instead of our model.

**Privacy and compliance (India DPDP Act 2023, GDPR in EU outlets)**
- Signage plus written staff notice; purpose limited to food safety and SOPs.
- No face recognition from CCTV for discipline. Attendance uses opt-in face terminals.
- Video never leaves site; snapshots for violations are blurred and expire after 30 days.
- Show staff their positive compliance scores too; position the system as coaching.

## Project layout

```
server/src   index.js (routes) · ingest.js (canonical events, vision tiers) · metrics.js (KPIs, health) · reports.js (KPIs, KRIs, forecast)
             backoffice.js (POS, inventory, reservations, finance) · recipes.js · connectors.js (67-connector catalog)
             setup.js (onboarding) · countries.js (20 country packs) · instance.js (global / india / blank)
             simulator.js · integrations.js (mapper, CSV) · seed.js · db.js · bus.js (SSE) · policy.js
server/scripts  e2e.mjs (150 end-to-end tests) · vision-parity.mjs
server/src/agents   engine.js (Maître, engines, audit) · agents.js (team, scans) · tools.js · knowledge.js
web/src      pages/ (Dashboard, Pos, Reservations, Inventory, Reports, Finance, Agents, Kitchen, Cameras, Guests, Staff, Safety, Alerts, Team, Integrations)
             onboarding/ (Onboarding wizard, steps, live previews)
             components/ (AgentChat, AgentDrawer, CameraFeed, Staffing, ThemePicker, …)
edge-agent   agent.py · detector.py · tracker.py · rules.py + rules.json · ocr.py · outbox.py · tests/
marketing    capture.mjs (headless screenshots for the guides) · make_promo.py
```

## Testing

```bash
node server/scripts/e2e.mjs                                   # 149 API scenarios against the India demo (all roles, all modules, Telegram bot)
node server/scripts/e2e.mjs http://localhost:8787             # same suite against the global demo
node server/scripts/e2e.mjs http://localhost:8789 --onboarding  # 18 onboarding scenarios on a fresh workspace (UAE, VAT-inclusive)
npm run test:parity                                           # JS and Python vision rule engines produce identical events
```

Results are written to `docs/test-results-*.json` and published in the **Test Plan & Results** document. The Telegram tests run against a local stand-in for the Bot API, so they need no bot token or internet access.

Front end:
- Pages are code-split: the first load is 297 KB, or 95 KB gzipped.
- All tabs in a browser share one live connection (Web Locks + BroadcastChannel), so many open tabs don't exhaust the browser's per-host connection limit.

## Not built yet (next)

Production hardening (TLS, SSO/MFA, password reset, forced password change for invited users, rate limiting), multi-tenant data separation, offline POS billing and printer/KDS drivers, QR ordering and captain app, menu OCR import, e-invoice IRN generation, payroll, WhatsApp assistant (the Telegram one is built), more approval-gated agent actions, and agent evals. The gap analysis against Petpooja and its competitors is in `docs/research/petpooja-gap.md`. Demo accounts must be removed before real use. See `PLAN.md` and section 14 of the Technical Product Document.

## Marketing & documentation

All documents are generated from source, so they stay consistent with the product. Rebuild everything (HTML + PDF) with `node docs/build.mjs`, or a single document with e.g. `node docs/build.mjs training`.

| Document | Files | What it is |
|---|---|---|
| Technical Product Document | `docs/OutletOS-Technical-Product-Document.html` / `.pdf` | 19 sections, 16 hand-drawn diagrams. Covers architecture, DFDs, user flows and runtime sequences; AI agents and vision with tiers; operations back office; reporting and forecasting; connectors; instances and onboarding; security, data model, API, deployment and SBOM. |
| Product Training & User Guide | `docs/OutletOS-Product-Training-Guide.html` / `.pdf` | Step-by-step workspace setup (7 steps), then every screen: POS, reservations, inventory, reports, KRIs, forecast, finance, connectors, vision, AI agents and more. Numbered callouts, daily actions, tips, role views and a glossary. |
| Test Plan & Results | `docs/OutletOS-Test-Plan-and-Results.html` / `.pdf` | 167 automated scenarios and 31 browser scenarios, with the latest results and the defects fixed |
| Telegram Bot Guide | `docs/OutletOS-Telegram-Bot-Guide.html` / `.pdf` | Admin setup with @BotFather, linking a chat, commands, real example conversations, what each role can ask, approvals, push alerts, security and troubleshooting |
| Value Proposition | `docs/OutletOS-Value-Proposition.html` / `.pdf` | One-page overview |
| Case Study | `docs/OutletOS-Case-Study.html` / `.pdf` | Two-page illustrative rollout (clearly labelled; replace with pilot data) |
| Promo video | `marketing/OutletOS-Promo.mp4` | HD promo with voice-over; re-render with `python -I marketing/make_promo.py` |

Sources live in `docs/src/` (`technical.mjs`, `training.mjs`, `marketing.mjs`, `testplan.mjs`, `telegram.mjs`, plus the shared `lib.mjs` and `pages.mjs`). Screenshots come from `marketing/shots/` and are re-captured with `node marketing/capture.mjs` (add `--daytime` during trading hours for live-sales screens). Research notes are in `docs/research/`.
