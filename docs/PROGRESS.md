# Country Dairy — Build Status

Living document. Updated as work lands, so a fresh session can resume without
re-deriving context. Anything marked **Verified** has been exercised against a
running API and a real database, not just compiled.

> Supersedes `docs/admin_impl_plan/tasks.md`, which claimed 40/40 tasks
> complete while 12 admin pages were still static demo arrays.

**Branch:** `feature/admin-console-integration` (identical to local `dev`)
**Last updated:** 2026-08-09 (session 2)

---

## 1. Credentials & Environment

| Item | Value |
|---|---|
| Admin login | `admin@countrydairy.in` / `ChangeMe#2026` — **change this** |
| API | `http://localhost:4000/api` |
| Admin console | Vite dev server, `http://localhost:5173` |
| Storefront | Next.js, `http://localhost:3000` |

Seed a different admin password:

```bash
SEED_ADMIN_PASSWORD='your-password' npm run db:seed
```

### Database commands (run from repo root)

| Command | Purpose |
|---|---|
| `npm run db:migrate -- --name what_changed` | Create and apply a migration |
| `npm run db:deploy` | Apply pending migrations (production) |
| `npm run db:status` | Check the DB and migrations agree |
| `npm run db:studio` | Browse data |
| `npm run db:seed` | Reference data + restore catalog backup |

**Never run `prisma db push`.** It writes to the database without recording a
migration. That is what caused the drift requiring a baseline reset, and
`db:status` is the early warning if it happens again.

---

## 2. Current State by Area

### API — `apps/api`

| Module | State |
|---|---|
| auth | ✅ Email+password, staff login, AuthIdentity provider linking. OTP and Google behind flags |
| catalog | ✅ Public reads pinned to LIVE; admin routes role-guarded |
| cart | ✅ Variant-based, stock-checked |
| orders | ✅ Real pricing, GST, stock decrement, state machine, admin endpoints |
| users | ✅ Staff CRUD, customers, drivers |
| reviews | ✅ Moderation queue, verified purchase, approved-only on storefront |
| analytics | ✅ Ingest + dashboard, IST day buckets |
| cms | ✅ Hero, trust badges, feature flags, store settings |
| media | ✅ Supabase Storage, WebP |
| subscriptions | ⚠️ Works, wallet billing behind `ENABLE_WALLET` |
| payments | ⚠️ Razorpay in **mock mode**; no webhooks yet |

### Admin console — `apps/admin`

| Page | State |
|---|---|
| Login / Auth | ✅ Real server-side auth |
| Overview | ✅ Real analytics, stock alerts, top products |
| Inventory / ProductEditor / AddProductWizard | ✅ Live API |
| HeroManager, CategoryCMS, FeatureFlags | ✅ Live API |
| Orders | ✅ Live, tax invoice, state machine, driver assignment |
| Customers | ✅ Live, order history, lifetime spend |
| Reviews | ✅ Live moderation |
| UserManagement | ✅ Live staff CRUD |
| WhatsAppCMS | ✅ Live, config stored in `StoreSetting` |
| **TrustBadgesCMS** | ❌ Static (API exists, page not wired) |
| **PurityLabCMS** | ❌ Static (LabReport model exists, no endpoints) |
| **AuditLog** | ❌ Static (model exists, nothing writes to it) |
| **Wallets** | ❌ Static, behind `ENABLE_WALLET` |
| **Routes / Logistics / DriverView** | ❌ Static, no Delhivery integration |

### Storefront — `apps/web`

| Area | State |
|---|---|
| Home, hero, product shelf | ✅ Live API |
| Product listing & detail | ✅ Live API |
| Analytics tracking | ✅ page_view, product_view, whatsapp_order_click |
| Cart / accounts / checkout | ✅ Variant-based, contract-tested end to end |
| WhatsApp ordering | ✅ Number + templates read from the database |
| Feature flags | ✅ Read from the database via `StoreConfigContext` |
| Reviews UI | ✅ Gated by `ENABLE_PRODUCT_RATINGS` |

> `apps/web/AGENTS.md`: this Next.js (16.2.10) differs from training data. Read
> `node_modules/next/dist/docs/` before writing web code.

### Mobile — `apps/mobile`

❌ Static `FALLBACK_PRODUCTS`, zero API calls. Deferred to last.
Pre-existing build failure: 16 TS errors from Expo SDK type drift
(`app-tabs.tsx`, `use-theme.ts`) — unrelated to this work.

---

## 3. Feature Flags

Stored in the `FeatureFlag` table, read via `GET /cms/feature-flags/map`.
Unknown flags default to **off**, so a missing row cannot open a feature.

| Flag | Default | Notes |
|---|---|---|
| `ENABLE_CART` | **on** | |
| `ENABLE_USER_ACCOUNTS` | **on** | |
| `ENABLE_WEBSITE_PAYMENT` | **on** | ⚠️ Razorpay is still in mock mode — do not enable in production until live keys and webhooks are in place |
| `ENABLE_SUBSCRIPTIONS` | off | |
| `ENABLE_PRODUCT_RATINGS` | **on** | Gates review submission |
| `ENABLE_WALLET` | off | Deferred by decision |
| `ENABLE_OTP_LOGIN` | off | Deferred; needs an SMS provider |
| `ENABLE_GOOGLE_LOGIN` | off | Needs `GOOGLE_CLIENT_ID` |

---

## 4. Verified Behaviour

Exercised against a running API and the real database.

### Purchase flow
- Register → cart → address → checkout → pay → order confirmed
- Basket of 1× ghee (₹1450) + 2× milk (₹95) billed **₹1640**, not the ₹240 the
  old flat-rate bug produced
- GST across mixed rates: ₹155.36 (ghee 12%, milk 0%)
- Stock decremented 100→99 and 300→298
- Cart cleared after payment; payment replay is idempotent
- Order snapshot holds title, SKU, HSN, unit price at purchase time

### Concurrency
- Two buyers racing for the last jar: **1 order, 1 rejection, stock 0** —
  never negative

### Access control
| Attempt | Result |
|---|---|
| Browser-forged SUPER_ADMIN JWT | 401 |
| Any email with no password | 401 |
| Unauthenticated product write | 401 |
| Customer hitting `/orders/admin/all` | 403 |
| Catalog manager reading staff list | 403 |
| Deactivating the last super admin | 403 |
| `?status=DRAFT` enumeration | Ignored, LIVE only |

### Reviews
- Submitted → PENDING → hidden from storefront → approved → visible, avg 5.0
- Verified purchase derived from a paid order

### Analytics
- 27 events ingested → totals, IST day buckets, device split, top products
- Exactly one row per event (no double-write)
- Stock alert fires at each variant's own threshold

### Tests

Run everything: `npm run verify`

| Command | What it covers | Status |
|---|---|---|
| `npm test` | Unit tests (pricing, reporting windows) | **31 passing** |
| `npm run smoke` | End-to-end against a live API + DB | **57 passing** |
| `npm run test:contract` | Storefront ↔ API payload contract | **18 passing** |

- `pricing.spec.ts` (19): GST extraction, discounts, delivery thresholds, paise
- `reporting-window.spec.ts` (11): IST boundaries, month rollover, bucket alignment
- `scripts/smoke-test.js`: access control, checkout, stock ledger, order
  lifecycle, moderation, analytics ingest, CMS persistence, staff guards
- `scripts/storefront-contract-test.js`: replays what apps/web actually sends;
  the "legacy payload rejected" checks pin breaks found during the variant
  migration

The smoke and contract suites need the API running and clean up after
themselves.

---

## 5. Known Gaps & Risks

| Gap | Impact |
|---|---|
| Razorpay in mock mode | Cannot take real money |
| No payment webhooks | Client-side verify alone will miss async confirmations |
| No audit logging | `AuditLog` table exists; nothing writes to it |
| No Delhivery integration | Courier fulfilment is manual |
| Mobile WhatsApp number still hardcoded | `apps/mobile` has `918291939317`; web now reads the DB. Fix when mobile is wired up |
| `ProductEditor` 843 / `AddProductWizard` 883 lines | Source of most recent bug-fix commits |
| No browser-level E2E tests | Contract is tested at the payload level, not in a real browser |
| `ENABLE_WEBSITE_PAYMENT` on with mock Razorpay | Fine locally; must not ship to production this way |
| Old JWT secret in git history | Any token issued before rotation should be treated as compromised |

---

## 6. Decision Log

**Own JWT auth, not Supabase Auth.** Supabase Auth's payoff is client-direct DB
access under RLS; this project has a NestJS API and does not use RLS, so it
would take the coupling for none of the benefit. `AuthIdentity` gives
multi-provider login without a migration when Apple sign-in is needed.
*Revisit if the storefront ever talks to Postgres directly.*

**Baseline migration reset.** The DB had drifted from migrations via
`db push`; incremental migrations on a stale baseline would fail on any fresh
database. Content was exported and restored (`content-backup.json`).
*One-time. All future changes are incremental.*

**Packaging as a lookup table, not an enum.** Adding vessels for oil or honey
is an admin action rather than a migration + redeploy.

**Availability derived, not stored.** `ProductStatus` is lifecycle only
(`DRAFT`/`LIVE`/`ARCHIVED`); `forceOutOfStock` is the manual override. Storing
`OUT_OF_STOCK` as a status guaranteed drift against real stock.

**Order lines are immutable.** Snapshots of title, SKU, HSN and price so
renaming or archiving a product cannot rewrite past invoices.

**Products with sales are archived, not deleted.** `deleteProduct` previously
ran `orderItem.deleteMany`, erasing revenue history.

**Reporting days are IST.** "Revenue today" means today in India.

**Feature flags and WhatsApp config live in the database.** Hardcoded
constants meant the storefront and admin console could disagree about what was
switched on, and the WhatsApp number had already diverged between web and
mobile.

**WhatsApp ordering stays, as a secondary CTA.** It converts customers who
will not enter card details, avoids the gateway fee, and suits hyperlocal
delivery that needs a conversation. Primary placement is the cart drawer
("Prefer to order on WhatsApp?"), where it catches an abandoning shopper.

---

## 7. Next Up

1. **TrustBadgesCMS + PurityLabCMS** — wire to API (badges) and build LabReport
   endpoints (certificates)
3. **Audit logging** — write on product/hero/variant/flag mutations, surface in
   AuditLog page
4. **Consumer web** — enable cart, accounts, checkout, order tracking; verify
   end to end
5. **Live Razorpay** — credentials, webhooks, idempotency, refunds
6. **Routes / Logistics / DriverView** — delivery manifests, Delhivery, OTP
   confirmation
7. **Refactor** — split ProductEditor/AddProductWizard, unify config loading
8. **Mobile** — live data, fix `EXPO_PUBLIC_` env prefix, EAS build
