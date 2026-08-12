# Country Dairy — Build Status

Living document. Updated as work lands, so a fresh session can resume without
re-deriving context. Anything marked **Verified** has been exercised against a
running API and a real database, not just compiled.

> Supersedes `docs/admin_impl_plan/tasks.md`, which claimed 40/40 tasks
> complete while 12 admin pages were still static demo arrays.

**Branch:** `feature/admin-console-integration` (identical to local `dev`)
**Last updated:** 2026-08-10 (session 3)

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

See [QA_TEST_PLAN.md](./QA_TEST_PLAN.md) for the full manual and automation
test plan across web, admin and API.

See [RUNNING.md](./RUNNING.md) for how to start the apps and diagnose
"Could not reach the API server".

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
| payments | ⚠️ Razorpay in **mock mode** locally; webhooks built and signature-verified. Production boot refuses mock mode |
| lab-reports | ✅ Batch reports, publish/hide, QR batch lookup |
| delivery | ✅ Route sheets by pincode, driver assignment, driver round |

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
| TrustBadgesCMS | ✅ Live CRUD with ordering and visibility |
| AuditLog | ✅ Live, filterable, before/after diffs |
| PurityLabCMS | ✅ Live CRUD, PDF upload, publish/hide |
| Routes | ✅ Live route sheets grouped by pincode, driver assignment |
| DriverView | ✅ Live round, mark delivered, record failed attempt |
| Logistics | ✅ Live consignment recording. Automatic Delhivery booking needs an account we do not have — the page says so |
| **Wallets** | ❌ Static, behind `ENABLE_WALLET` (deferred by decision) |

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
| Lab report panel | ✅ On the product page, hidden when nothing is published |
| `/purity/[batch]` | ✅ Where the QR code on the jar lands |

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
| `ENABLE_WEBSITE_PAYMENT` | **on** | Razorpay is in mock mode locally. Production will not boot without live keys, so this can no longer ship unsafely |
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
| `npm run test:catalog` | Product CRUD + audit trail | **26 passing** |

- `pricing.spec.ts` (19): GST extraction, discounts, delivery thresholds, paise
- `reporting-window.spec.ts` (11): IST boundaries, month rollover, bucket alignment
- `scripts/smoke-test.js`: access control, checkout, stock ledger, order
  lifecycle, moderation, analytics ingest, CMS persistence, staff guards
- `scripts/storefront-contract-test.js`: replays what apps/web actually sends;
  the "legacy payload rejected" checks pin breaks found during the variant
  migration
- `scripts/catalog-audit-test.js`: the admin's core workflow — create and edit
  a product — plus the audit trail and its redaction of secrets

The smoke and contract suites need the API running and clean up after
themselves.

---

## 5. Known Gaps & Risks

| Gap | Impact |
|---|---|
| Razorpay in mock mode | Cannot take real money |
| No payment webhooks | Client-side verify alone will miss async confirmations |
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

**Audit context travels in AsyncLocalStorage.** The alternative was threading a
userId parameter through every service method that might record an entry,
which is easy to forget on the next one. `AuditService.record` never throws —
a failed audit write must not roll back the operation it describes — and it
redacts passwords, tokens and signatures.

**Variants are updated in place, not replaced.** Editing a product used to
delete every variant and recreate it, which detached order history and emptied
customers' carts. Variants that have been sold are deactivated rather than
deleted when removed from the editor.

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

Everything on the previous list has landed. What remains:

1. **Mobile** — live data, fix the `EXPO_PUBLIC_` env prefix, EAS build. Also
   16 pre-existing TS errors from Expo SDK type drift (`app-tabs.tsx`,
   `use-theme.ts`), unrelated to this work.
2. **Pagination** for Orders, Customers and Audit lists. Reviews and lab
   reports are done; the others still fetch up to 200 rows.
3. **Wallet** — behind `ENABLE_WALLET`, deferred by decision.
4. **OTP login** — needs an SMS provider (MSG91), deferred by decision.
5. **Hero LCP** (UI_AUDIT C5) — the hero image is not preloaded.

### Blocked on something only you can provide

| Item | Needs |
|---|---|
| Live payments | Razorpay live keys + a webhook secret from the dashboard |
| Automatic courier booking | A Delhivery account and API credentials |
| OTP login | An MSG91 (or similar) account |
| Google sign-in | `GOOGLE_CLIENT_ID` |

### Production checklist

- [ ] Change the admin password. The old JWT secret is in git history, so any
      token issued before rotation must be treated as compromised.
- [ ] Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.
      The API refuses to boot in production without real keys.
- [ ] Set `ALLOWED_ORIGINS` — the localhost allowance is development-only.
- [ ] Co-locate the API with the database, or move Postgres to `ap-south-1`.
      A single round trip to the current Seoul pooler costs ~710ms, which is
      the floor under every uncached request.

---

## 8. Test Suite

`npm run verify` — 427 checks against a running API and the real database.

| Suite | Checks | Covers |
|---|---|---|
| `npm test` | 37 | Pricing, GST, IST reporting windows |
| `npm run smoke` | 59 | Auth, catalog, cart, checkout, access control |
| `npm run test:contract` | 18 | Storefront ↔ API request/response shapes |
| `npm run test:catalog` | 26 | Catalog integrity, no invented values |
| `npm run test:media` | 19 | Upload, MIME limits, URL resolution |
| `npm run test:lab` | 40 | Lab reports, published/unpublished boundary |
| `npm run test:delivery` | 34 | Route sheets, driver isolation, completion |
| `npm run test:webhook` | 34 | Signatures, idempotency, refunds, mismatches |
| `npm run test:address` | 41 | Address CRUD, ownership, profile, password change |
| `npm run test:session` | 21 | Duplicate email, expired/forged tokens, deactivation |
| `npm run test:cleanup` | 36 | Media lifecycle, orphan sweep, media route guards |
| `npm run test:account` | 62 | Reorder, consent, GST invoicing, account erasure |

The API must be running. Each suite creates and removes its own fixtures.
