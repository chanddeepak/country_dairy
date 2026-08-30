# What is left

Everything not yet done, as of 30 August 2026. Two halves: the launch
checklist audited against the running site, and the work already tracked
elsewhere that is still open.

Statuses are **done**, **partial**, **missing**, or **unmeasured**. Every one
was checked against the code or the running storefront on the date above —
nothing here is assumed.

---

## 1. The launch checklist

| # | Item | | Evidence |
| --- | --- | --- | --- |
| 1 | Privacy policy | **drafted** | `/privacy`, prerendered. Needs the facts listed below before it is true |
| 2 | Terms page | **drafted** | `/terms`, prerendered. Same caveat |
| 3 | Clear CTA | **done** | "Add to cart" on cards and detail, "Checkout Now" in the drawer |
| 4 | FAQ | **drafted** | `/faq`, prerendered. Plain headings, not an accordion, so the answers are indexable |
| 5 | robots.txt | **done** | `src/app/robots.ts`. Serves live; disallows `/account`, `/checkout`, `/orders/`, `/api/` and points at the sitemap |
| 6 | sitemap.xml | **done** | `src/app/sitemap.ts`. 6 URLs: home, /products, every nav category, every live product. An unreachable API returns the static routes rather than failing the build |
| 7 | Custom 404 | **done** | `src/app/not-found.tsx`, on-brand, `noindex`, with a way back. Still a true 404 status. `error.tsx` and `global-error.tsx` added alongside it |
| 8 | Alt text | **done** | **All 23 image tags carry alt.** An earlier count of "one gap" was wrong — the 24th match was the word `<Image>` inside a comment |
| 9 | Analytics | **partial** | First-party `page_view` via `PageViewTracker` → `trackStorefrontEvent`. **No third-party vendor** (no GA, GTM, Plausible, PostHog) |
| 10 | Meta titles | **done** | `products/[slug]/layout.tsx` gives every product its own, preferring the `metaTitle` column that existed and was never read. Root sets a `%s | Country Dairy` template |
| 11 | Meta description | **done** | Same layout: `metaDescription`, else tagline, else story, trimmed to 160 characters on a word boundary |
| 12 | Social share | **done** | Open Graph and Twitter cards on home, category and product. Product uses its own primary photo; the rest fall back to the site image. Category needed its image repeated — **a route's `openGraph` replaces the root's rather than merging**, so omitting it shipped no picture at all |
| 13 | Favicon | **done** | `public/favicon.ico`, `src/app/icon.png`, `apple-icon.png`, plus `icons` in root metadata |
| 14 | Canonical URLs | **done** | `metadataBase` from `SITE_URL` (`NEXT_PUBLIC_SITE_URL`, default `https://countrydairy.in` — the apex, since CORS allows both it and www) and a canonical on home, category and product |
| 15 | Cookie consent | **missing** | No banner, no consent component |
| 16 | Mobile version | **partial** | Responsive classes throughout (183 breakpoint uses) and Next's default viewport tag. **Not tested on a real device** |
| 17 | Accessibility | **partial** | `lang="en"` set, every image has alt. The `<h1>` finding was **misdiagnosed** — see below. Button labelling still not properly audited |
| 18 | Test forms | **partial** | e2e covers auth, checkout, account and support. `ContactForm` and `ReviewForm` have no coverage |
| 19 | Broken links | **partial** | Every nav and footer link resolves (`/`, `/products`, `/account`, `/category/ghee`, `/account?tab=orders` all 200). No site-wide crawl has been run |
| 20 | Performance | **unmeasured** | No Lighthouse run, and this build's output carried no bundle sizes. Two known drags: **7 files use raw `<img>`** instead of `next/image`, and **all 11 route pages are client components** |

### The `<h1>` finding, corrected

Every one of those pages **does** have an `<h1>` in its source. What they do
not have is any content in the response.

Verified against a production `next start`, not the dev server: the body of a
product page is the announcement bar, the nav, the words **"Loading product
details"**, and the footer — 812 characters. The product's title, price,
description and reviews are not in the HTML at all. The title appears exactly
four times in the document and **all four are in `<head>`** — `<title>`,
`og:title`, `twitter:title`, `og:image:alt`.

The cause is architectural: **all route pages are client components that fetch
their own data**, so the server ships a shell. That is why the heading is
missing, and the missing heading is the symptom rather than the fault.

What this does and does not cost:

- **Search snippets and social previews are fine.** They read `<head>`, which
  is server-rendered, and that is now complete.
- **Content indexing is second-pass.** Google executes JavaScript, so pages
  will be indexed, but later and less reliably than server-rendered HTML.
  Crawlers that do not run JS see nothing.
- **Screen readers are fine after hydration** and see no page heading before
  it.

Fixing it properly means moving data fetching server-side, page by page —
`/products/[slug]` first, since it is the page that matters for search. That
is a real refactor and is **not** attempted here.

### One thing the checklist does not mention

`/phase1-proof` was publicly reachable and returned 200, though its own comment
said "Deleted before this branch merges." **Now deleted.**

### The policy pages need facts only you have

Four pages now exist — `/privacy`, `/terms`, `/shipping-and-returns` and
`/faq` — linked from the footer and listed in the sitemap. They are written
from what the code actually does: the ₹500 free-delivery threshold, GST-
inclusive pricing, sign-in by mobile code, Cashfree taking the payment,
per-order address snapshots, account erasure.

**Eighteen facts in them are decisions rather than code**, and each renders as
a highlighted `[marker]` so none can go live unnoticed:

| Page | Needs |
| --- | --- |
| Privacy | legal entity, GSTIN, data retention period, response window, grievance officer |
| Terms | legal entity, GSTIN, **FSSAI licence number**, jurisdiction |
| Shipping & Returns | packing days, dispatch window, local and courier timelines, damage-report window, return window, who pays return postage, refund processing time |
| FAQ | whether COD is offered, opened shelf life |

The FSSAI number is not optional — a food business selling online in India has
to display it. And a lawyer should read these before launch; they are an
honest, specific draft, not legal advice.

**One inconsistency they surfaced:** the announcement bar says "Free shipping
over ₹499" while `FREE_DELIVERY_THRESHOLD` is 500. For whole-rupee baskets the
two agree, so nothing is broken today — but the policy pages state ₹500,
because that is what the code charges on.

### Why 1, 2 and 4 may block more than SEO

Payment gateways generally want a live privacy policy, terms, and refund,
cancellation and shipping policies before they activate a production merchant
account. **One Click Checkout is still awaiting production activation**, so
these pages are worth confirming against Cashfree's own activation
requirements rather than treating them as a marketing nicety.

### What is left on this list

**Cookie consent**, a **Lighthouse run**, **device testing**, coverage for
`ContactForm` and `ReviewForm`, a **link crawl**, and the server-rendering
refactor described above — plus filling in the eighteen facts.

---

## 2. Still open from the build

### Security

**`apps/api/.env.disabled` is tracked in git with a live `DATABASE_URL` and
`JWT_SECRET`, and nothing has been rotated.** Supabase connection strings also
went into a chat transcript in an earlier session. Anyone with repository
history holds the database and can mint valid tokens. Untracking the file does
not fix this — the values have to be rotated.

### Waiting on a decision or an account

| | |
| --- | --- |
| WhatsApp number (A1) | `+91 99978 01112` is on the WhatsApp Business *app*; moving it to the Cloud API removes it from that app |
| OCC production activation (Q6d) | The dashboard still offers "Request Activation". Only Test is live |
| What OCC costs (Q1–Q3, Q7, Q8) | Published nowhere. Also fees on the Offers Engine, COD, and refunds |
| Coupons | Only `TESTFLAT200` exists, in sandbox |
| Production customers | Dev is clean. The email-only accounts that can no longer sign in are a production question |

### Build work

- **E2b — schedule the sweep.** There is no scheduler: no `@Cron`, no
  `ScheduleModule`, nothing in `render.yaml`. Stock is only released when
  someone presses "Release held stock" on the consignment desk. Render's free
  plan sleeps, so it needs an external ping.
- **Real OTP delivery.** Sign-in still runs on `OTP_DEV_CODE`. `LogChannel`
  throws in production by design, so phone sign-in does not work there at all.
- **D1–D3** — order confirmed, dispatched/delivered, payment failed.
- **E3** refunds, **E4** COD, and **guest order tracking** — a guest cannot
  reach the retry button, because the order page requires a session.

### Production readiness

Migrations have not been applied to production, there is no
`ENABLE_EMAIL_LOGIN` row there, **E6** (live credentials, mock mode blocked in
production) and **E7** (full green, real sandbox payment, `next build`) are
both open.

### Never tested

A **declined payment** — the sandbox's FAILED control refuses automated
clicks. The **webhook winning the race** against the browser's return. And
**production**, entirely.

### Specs that outlived their features

Three changes this session removed something a storefront spec still drove,
and each was committed on a green **API** run — which never loads
`e2e/storefront/*`. They failed unnoticed until the storefront project was run:

| Change | Left behind |
| --- | --- |
| Email sign-in switched off | `session.spec.ts` A1/A3, `journey.spec.ts` |
| Account Addresses tab removed | `account-address.spec.ts` — **deleted**, the tab is gone for good |
| Our checkout page retired | three `checkout.spec.ts` cases — **gated**, since the page is still the rollback path |

Both projects need running before a UI change is called done.

### Loose ends

- `PATCH /auth/profile` answers **500 instead of 400** for `{"name": null}`
  and `{"emailOptIn": null}`. `@IsOptional()` skips null, so `.trim()` throws
  and Prisma rejects the boolean. Nothing is written either way.
- The comment above `phone` in `auth.dto.ts` still calls email the login
  identity.
- Phase B, C and D checkboxes in `checkout-and-identity.md` are unticked
  though the work is done and tested.

### Left behind by the Shiprocket removal

The integration is gone — module, routes, hooks, specs, scripts and docs, and
the `Order.shiprocketOrderId` column with it. **Before that migration reaches
production, confirm the column is empty there:**

```sql
SELECT count(*) FROM "Order" WHERE "shiprocketOrderId" IS NOT NULL;
```

Dev returned 0 and the integration never ran outside a flag that stayed off,
so it should be 0 everywhere. The drop is not reversible.

The three `externalId` columns were **kept**. They are generic
`autoincrement()` numeric ids, they are what the BigInt `toJSON` shim in
`main.ts` exists for, and nothing about them is Shiprocket-specific. A comment
in `cashfree.service.ts` still cites the Shiprocket integration as the source
of a lesson; that is history, and it stays.

Seven docs still mention it and were **not** rewritten — `cashfree-integration.md`
(18 mentions, already superseded by `checkout-and-identity.md`),
`himalayan-redesign.md` (5), `requirements.md` (3), and one or two mentions each
in `api-security.md`, `category-hierarchy-plan.md`, `checkout-and-identity.md`
and `lld.md`. Most read as history rather than instruction, but anyone treating
`requirements.md` or `lld.md` as current will find an integration that no longer
exists.
