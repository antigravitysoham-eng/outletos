# OutletOS (working name): Research and Build Plan
*Centralized command center for multi-outlet restaurants: sales, people, kitchen vision, food safety and cost on one screen.*
Date: 2026-11-17

---

## 1. Market research: what already exists

| Category | Players | What they do well | What they miss |
|---|---|---|---|
| **POS-centric suites** | Toast, Square, Lightspeed, TouchBistro, Restroworks (ex-Posist, 25k+ outlets), Petpooja, Syrve, HungerRush | Billing, menu, multi-outlet sales reports, region/brand grouping | Know almost nothing about people, kitchen behaviour or equipment. Reports, not live ops |
| **Back-office / ops** | Restaurant365, SynergySuite, Operandio, Xenia ($12M Series A), MarketMan | Inventory, recipes, checklists, tasks, accounting | Rely on manual input. No vision, weak real-time |
| **Workforce / attendance** | 7shifts, Petpooja Payroll (face scanner), Salarybox | Shifts, face/geo attendance, payroll (PF/ESI/TDS) | Separate login. Not tied to sales or ticket times |
| **Kitchen vision AI** | Wobot.ai, Pushpak AI (800+ WOW! Momo outlets, 4.5k cameras), Staqu Jarvis, Palona, Plainsight, Agot | Reuse CCTV for hygiene (gloves, caps, handwash), cleaning, order checks | Point solutions. Insights live outside the ops dashboard |
| **IoT food safety** | SmartSense, ComplianceMate, GlacierGrid, Datoms | Fridge/freezer temperature, automated HACCP logs, alerts | Hardware-locked. Siloed |

**The gap (our wedge):** an owner with 10 outlets has 5–8 apps today. Nobody **fuses** POS, attendance, cameras and sensors into one event stream and explains *why* something happened. Example: "Outlet 4 sales −18% at lunch: 2 chefs absent, average ticket time +9 min, 3 hygiene flags."

Pricing reference: vision add-ons run about $50 per month per site on top of $500–1,000 in camera hardware. Reusing existing CCTV removes the hardware cost.

---

## 2. Must-have insights we can automate

### A. Sales and revenue (from POS and aggregators)
- Live sales per outlet, brand and region; today compared with the same weekday last week
- Average order value, covers, table turns, hourly heatmap
- Channel mix: dine-in, takeaway, Swiggy, Zomato, own app
- Outlet leaderboard; **anomaly alerts** when sales fall outside the forecast band
- Void, discount and refund abuse detection (a common fraud area)

### B. Cost and profitability
- **Prime cost %** (food + labour ÷ revenue). Target ≤60–65%
- Food cost %: theoretical (recipe × sales) vs actual (stock movement). Typical range is 28–35%
- Labour %: about 20–30% of sales. Sales per labour hour

### C. People (attendance and productivity)
- Face or geo-fenced selfie check-in. Device webhooks for existing biometric machines
- Late arrivals, no-shows, early exits, overtime, buddy-punch prevention
- Staff on floor vs staff scheduled vs staff needed (from the sales forecast)
- **Camera-verified presence**: is the chef actually at the station?

### D. Kitchen vision (edge AI on existing CCTV)
- Station occupancy: chef present or idle, station unmanned during rush
- Hygiene and PPE: cap or hairnet, gloves, apron, mask, handwash events
- Cleanliness: floor mopping intervals, spills, waste-bin overflow
- Phone use or smoking in the kitchen; unauthorized person in the kitchen or store room
- Customer side: queue length at counter, wait time, table occupancy
- Order and plating verification (later phase)

### E. Speed of service
- KOT-to-serve ticket time (target about 15–18 min), delayed-order alerts
- Bottleneck station detection (vision + KDS timestamps)

### F. Food safety and equipment (IoT)
- Fridge and freezer temperatures with automatic HACCP logs, so paper logs cannot be faked
- Door-left-open, power cut, gas leak, fryer oil quality
- FSSAI licence and audit expiry reminders

### G. Inventory and waste
- Stock levels, low-stock auto-reorder, expiry tracking
- Waste logging. Industry estimates put losses at 4–10% of purchased inventory
- Prep forecasting: what to prep by hour

### H. Customer voice
- Google, Zomato and Swiggy rating and review aggregation with sentiment, per outlet
- Complaint spikes linked to the outlet, shift and staff on duty

### I. Compliance and tasks
- Opening and closing checklists with photo proof, audit scores, SOP adherence

---

## 3. Innovation layer (what makes us different)
1. **Outlet Health Score (0–100)**: one number per outlet built from sales, cost, people, hygiene, speed, safety and reviews. Red, amber and green on a map.
2. **Root-cause engine**: correlates signals across sources ("why is this outlet red?") instead of showing separate charts.
3. **AI copilot**: ask "Which outlet wasted most paneer this week?" in plain language (Claude API over our event store).
4. **Owner on WhatsApp**: 10 pm daily digest plus critical real-time alerts. No need to open the app.
5. **Virtual mystery audit**: cameras score SOP compliance continuously, replacing monthly manual audits.
6. **Privacy-first vision**: video never leaves the outlet. Only events and blurred snapshots go to the cloud.

---

## 4. Architecture: lightweight and integration-first

```
 ┌──────────── OUTLET (edge) ────────────┐        ┌────────────── CLOUD ──────────────┐
 │ CCTV (RTSP) ─► Vision Agent (Python,  │        │  Ingest API (REST + Webhooks +    │
 │                YOLO, mini-PC/Jetson)  │─events─►│  MQTT)  ─► Event Store (Postgres │
 │ Biometric / Face device ─────────────►│        │  + TimescaleDB)                   │
 │ Temp sensors (MQTT) ─────────────────►│        │        │                          │
 └───────────────────────────────────────┘        │  Rules & Alerts ─► WhatsApp/Email │
 POS (Petpooja/Restroworks/Toast…) ─webhook/poll─►│  Insights + Health Score + AI     │
 Aggregators, Google reviews ──connectors────────►│  REST/WebSocket API               │
                                                   └──────────────┬───────────────────┘
                                                                  ▼
                                               Web dashboard (React PWA, mobile-ready)
```

**Design principles**
- **Everything is an event**: `{outlet_id, source, type, ts, payload}`. Any new system plugs in by sending events.
- **Connector SDK**: each integration (POS, device, camera, sensor) is a small adapter file. Generic webhook and CSV import work from day one.
- **Open API**: OpenAPI-documented REST, outbound webhooks and API keys per tenant, so other tools can consume our data.
- **Hierarchy and RBAC**: Brand → Region → Outlet → Station. Roles: Owner, Area Manager, Outlet Manager, Staff.
- **One-command deploy**: Docker Compose; runs on a ₹1,500/month VPS for the MVP.

**Stack (recommended)**
- Backend: Node.js + TypeScript (Fastify) *or* Python FastAPI (shares a language with the vision agent). **Recommend FastAPI.**
- DB: PostgreSQL (+ TimescaleDB extension for time series)
- Realtime: WebSockets / SSE
- Frontend: React + Vite + Tailwind + Recharts, installable PWA
- Edge vision: Python, Ultralytics YOLO, OpenCV, RTSP; sends events only
- Notifications: WhatsApp Cloud API, email
- AI: Claude API for the copilot and daily summaries

---

## 5. Phased roadmap

| Phase | Scope | Outcome |
|---|---|---|
| **0 – MVP (4–6 wks)** | Tenant hierarchy, auth/RBAC, event ingest API, live multi-outlet dashboard, POS ingest (webhook + CSV + 1 native adapter), attendance (geo-selfie PWA + device webhook), rules and alerts, **built-in data simulator** so it demos with zero hardware | A working app on one screen |
| **1 – Vision and IoT (4–6 wks)** | Edge vision agent: station presence, PPE, queue length, cleanliness. MQTT temperature sensors, HACCP logs | "Eyes in every kitchen" |
| **2 – Intelligence (4 wks)** | Outlet Health Score, root-cause engine, sales and prep forecasting, review aggregation, WhatsApp digest, AI copilot | Insights, not just data |
| **3 – Scale** | Inventory and waste, recipe costing, connector marketplace, franchise mode, white-label | Product ready to sell |

---

## 6. Risks and compliance
- **Employee privacy (India DPDP Act 2023)**: explicit consent for face data, CCTV signage, data retention limits, on-device processing, face embeddings instead of stored photos.
- **Surveillance pushback**: position it as SOP coaching and present positive scores too, not only violations.
- **Integration friction**: many Indian POS systems have limited APIs, so CSV import and webhooks are the fallback.
- **Vision accuracy**: kitchens have steam and poor lighting. Start with robust detections (person, cap, gloves) and add more later.

---

## 7. Sources
- https://www.7shifts.com/blog/multi-location-restaurant-visibility/
- https://operandio.com/multi-unit-management/
- https://www.xenia.team/articles/restaurant-operations-management
- https://www.restroworks.com/blog/?p=21938
- https://pushpak.ai/solutions/qsr-monitoring
- https://wobot-marketing-assets.wobot.ai/wobot.ai/Feature+Page/Case_Study.pdf
- https://news.microsoft.com/en-in/features/kitchens-in-the-cloud-ai-is-restoring-consumer-trust-in-the-food-delivery-business/
- https://www.ultralytics.com/blog/streamlining-operations-using-vision-ai-in-restaurants
- https://www.eatery.club/en/blog/palona-ai-converts-security-cameras-into-operational-tools
- https://pos.toasttab.com/blog/on-the-line/7-critical-restaurant-benchmarks
- https://www.touchbistro.com/blog/important-restaurant-benchmarks
- https://blog.petpooja.com/industry-business-guides/best-face-recognition-attendance-systems-india/
- https://salarybox.in/blog/best-staff-management-software-for-restaurants-and-qsr-chains-in-india-2026/
- https://www.glaciergrid.com/resources/research-and-impact/restaurant-automation-food-waste-compliance
- https://www.smartsense.co/food-service/restaurants
