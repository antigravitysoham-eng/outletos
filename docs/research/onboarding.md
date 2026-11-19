# Onboarding research (November 2026)

**What I looked at:**
- **Restaurant platforms:** Toast, Square for Restaurants, Lightspeed K-Series, Foodics, Petpooja, Restroworks, TouchBistro, Clover, Loyverse.
- **Workforce and back office:** 7shifts, Deputy, MarketMan, Restaurant365.
- **SaaS benchmarks:** Stripe Connect, Shopify setup guide, Linear, Notion, Gusto, Rippling.
- **Tax rules:** checked against IRAS, ZATCA, FSSAI orders, Delhi High Court (CCPA service-charge ruling, 2025), and German VAT 2026 commentary.

## Principles we adopted
1. **Country first, everything else defaulted.** The country sets currency and decimal places, number grouping (lakh/crore for India), tax engine, whether prices include tax, legal receipt IDs, fiscal year, rounding and service-charge norms. The user reviews all of this on one card instead of filling in a form.
2. **A short wizard, then a persistent checklist.** Every step can be skipped. A step only blocks go-live when the law requires its data on receipts (for example GSTIN and FSSAI in India, TRN in the UAE, VAT number plus QR in Saudi Arabia).
3. **Set up the group once; outlets inherit it.** A "same for all outlets" toggle copies settings, and each outlet can still override. Settings can be cloned from another outlet, and a bulk grid handles 20–200 outlets.
4. **Structure before people.** Entities, outlets, areas and roles are set up first, then staff are imported (the 7shifts, Deputy and R365 order).
5. **Profile-driven defaults (the Lightspeed pattern).** The outlet type switches the floor plan on or off and sets the staffing template, KDS routing and modules.
6. **Import instead of typing.** Menus can come from a template, CSV/Excel, or a copy from another outlet. Imported data lands in a review grid before it is saved.
7. **Live previews make it feel premium.** The receipt preview updates with tax lines, legal IDs and rounding, and the floor-plan preview updates with table names and seats.
8. **Sample data in setup mode.** A sample-activity mode lets the owner see value on day one. The go-live checklist tracks readiness for each outlet.
9. **Non-blocking compliance (the Stripe approach).** Missing data blocks only the capability that needs it, never the whole account.

## Mistakes we designed against
- Asking for everything up front.
- Typing menus in by hand.
- Adding people before outlets and roles exist.
- Copying menus per outlet instead of using one master menu with versions.
- Assuming US conventions (prices without tax, MM/DD dates, million-style grouping).
- Adding service charge automatically where it is regulated. India's CCPA guidelines, upheld by the Delhi High Court on 28 March 2025, allow it only as optional.

## Key tax facts encoded in `server/src/countries.js`

All values can be edited in setup.

| Country | Restaurant tax | Prices shown | Notes |
|---|---|---|---|
| India | GST 5% without input tax credit (CGST 2.5% + SGST 2.5%) | Usually exclusive | Bills must carry the FSSAI licence number (since 1 Oct 2021) and SAC 9963. Service charge must be optional. |
| UAE | VAT 5% | Inclusive (mandatory) | TRN on invoices. Hotels may add fees. |
| Saudi Arabia | VAT 15% | Inclusive | ZATCA QR code on simplified invoices. Phase 2 requires registering each device. |
| UK | VAT 20% | Inclusive | Service charge is discretionary. Tips Act 2023 applies. |
| Germany | 7% on food from 1 Jan 2026; drinks 19% | Inclusive | Tills must have a TSE fiscal module. |
| France | TVA 10% on site, 20% on alcohol | Inclusive | Tills must be NF525 certified. |
| Singapore | GST 9% | Prices may be shown "++" where service charge applies | |
| Australia | GST 10% | Inclusive (mandatory) | ABN on invoices. Fiscal year runs July to June. |
| US | Sales tax set per outlet by jurisdiction | Exclusive | Tipping culture. |

The full source list is in the research hand-off. Items marked [VERIFY] there still need confirming, chiefly:
- UAE simplified-invoice fields
- EU fiscalisation rules for each country
- Saudi price-display regulation
