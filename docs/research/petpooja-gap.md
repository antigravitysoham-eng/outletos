# Petpooja and competitor feature research (November 2026)

**Scope:** Petpooja's official product, pricing, outlet-type and add-on pages, plus its blog. Competitors: Restroworks, UrbanPiper, Gofrugal, LimeTray, DotPe/Rista, Hyperpure, Toast, Square, Lightspeed, Revel, Beyond and Compeat/R365. TrustRadius blocked automated access (HTTP 403), so I used its compare pages and G2/Capterra lists instead.

**Legend:**
- **P** = Petpooja has it.
- **C** = only competitors have it.
- Coverage status is tracked in `docs/research/coverage.md`.

## Petpooja modules

### POS / billing
- Multi-terminal billing, with no limit on terminals.
- Areas, each with its own menu, price, tax and service charge.
- Tables: merge, move and split.
- KOT routed by station.
- Split bill by %, by amount, or by food vs drinks.
- Discounts and coupons, with reasons required.
- Combos, variants and add-ons.
- Complimentary / NC bills, with reasons, settled to house or staff.
- Cancel reasons are printed on the KOT.
- Audit and leakage panel covering:
  - cancellations and modifications
  - moved KOTs
  - unbilled KOTs
  - waivers
  - reprints
  - edits after printing
- Tender allocation is mandatory, and customer credit is supported.
- Day end with a custom cut-off time.
- Expense and payout entry.
- Offline billing for up to 5 days.
- E-bill by SMS or WhatsApp.
- Bill printed with the FSSAI licence number and GSTIN.

### Menu
- Per-channel and per-area pricing.
- Daypart (time-based) availability.
- Stock-based item on/off.
- Virtual brands.
- Menu pushed to every aggregator in one action.

### Inventory
- Multi-stage recipes with automatic stock deduction.
- Raw materials with low-stock alerts.
- Central kitchen: requests, supply, returns, and production costing.
- Purchase orders and stock transfers.
- FIFO costing.
- Wastage and pilferage tracking.
- Expiry tracking.
- Consumption reports.
- E-way bills.

### Purchase Manager
- Live price comparison across Hyperpure, DMart and local vendors.
- Vendor rate cards.
- "Best Match" cart that picks the lowest price.

### Online orders
- 150+ channels: Zomato, Swiggy, Magicpin, ONDC and others.
- All online orders on a single screen.
- Rider integrations, with OTP check-in for riders.
- Reconciliation add-on covering:
  - missing orders
  - status mismatches
  - amount variances
  - commissions
  - TCS
  - payout cycles

### Front of house
- Captain app.
- KDS.
- QR scan-and-order with OTP verification, and scan-to-pay.
- Self-service kiosk.
- Token display.
- Waiter-calling button.
- Table reservations, which include:
  - Zomato / District / EazyDiner sync
  - deposits
  - waitlist
- Digital menu boards.
- Call centre that routes orders to the right outlet.

### CRM and marketing
- Unified guest database, with 100+ labels.
- Loyalty:
  - points and cashback
  - a wallet with OTP-verified redemption
  - expiry rules
- SMS and WhatsApp campaigns: birthday, win-back, referral.
- Feedback by QR code.
- Reputation management, with AI-drafted replies.

### Reports
- 90+ standard reports (listed below).
- Dynamic custom reports.
- Reports sent by email on a schedule.
- AI "Ask me anything" over the data.
- AI day summary.

### Payments
- UPI dynamic QR with a soundbox that settles the order automatically.
- Card machines (EDC).
- Supported gateways: Pine Labs, Paytm, Razorpay, PhonePe and others.

### Staff
- **Attendo:**
  - Attendance by biometric, face or geo-location.
  - Rosters and leave.
  - Payroll with PF, ESIC, PT and LWF deductions.
- **Stepwise:**
  - SOP tasks with photo or geo proof.
  - AI verification of that proof.

### India compliance
- GST:
  - CGST/SGST split under SAC 9963.
  - Composition-scheme bill of supply.
  - A new bill series each financial year.
- E-invoice IRN generation.
- GSTR-1 register.
- Tally sync.
- Service charge off by default.

## Reports Petpooja offers

| Area | Reports |
|---|---|
| Sales | Day-end summary, bill settlement, item sales, hourly sales |
| Multi-outlet | Locality-wise consolidation |
| Tax | Item-wise tax, GSTIN IRN, GSTR-1 |
| Leakage | Discounted orders with reason, cancelled orders, KOT modifications, reprint count, after-print modifications, complimentary orders, cash drawer |
| Online | Order summary, commissions, reconciliation, platform margin |
| Inventory | Consumption and wastage, purchase summary, recipe cost trend |
| Staff | Biller/captain item summary, waiter performance, call-centre agent |
| Guests | Customer summary, loyalty |
| Bar | Happy hour |
| Reservations | Bookings, no-show rate |

## Features only competitors offer (C)

### Restroworks
- AI menu edits.
- Master/child menus with pilot rollouts and undo.
- Kitchen production planning that forecasts per item, re-run every 15 minutes.
- AI auto-indent (automatic stock requisitions).
- Purchase control:
  - three-way match (PO, goods received note, invoice)
  - approval chains
  - invoice OCR
- AI theft and anomaly scoring of voids, discounts and comps.
- Franchise management: royalty and governance.
- Theoretical-vs-actual food cost.

### UrbanPiper
- AI voice ordering.
- Order-lifecycle observability.
- Prices by aggregator and fulfilment mode.

### Gofrugal
- Native general ledger and P&L.
- Price guards against selling below cost.
- Batch traceability.
- Forced head-office sync.

### LimeTray
- Tiered loyalty.
- Branded app with push notifications.
- Cloud telephony.

### Toast
- Tip pooling.
- Payroll.
- xtraCHEF invoice OCR.
- Catering with banquet event orders (BEOs).
- Delivery dispatch.
- Gift cards.
- Benchmarking.

### Square
- Tip pooling.
- Shift swaps.
- Auto-86 (items marked sold out automatically).
- Voice ordering.

### Lightspeed
- Service pacing (Tempo).
- Benchmarks.
- Menu engineering.
- Multi-currency.

### Beyond and R365
- Labour forecasting.
- KPI alerts.
- Budgets vs actuals.
- Accounts payable and bank reconciliation.
- Manager logbook.

Full source list: see the research transcript summary in the project README → Research sources.
