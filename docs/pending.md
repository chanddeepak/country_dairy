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
| 15 | Cookie consent | **decided: none needed** | The site sets **no cookies at all** — verified, no `Set-Cookie` from either server and no `document.cookie` in the source. Only functional browser storage: `cd_token`, `cd_user`, `cd_guest_cart`, `cd_pending_checkout`, `cd_claim_…`. A consent gate over strictly necessary storage would imply tracking that does not happen. The privacy page lists each key instead. **Revisit the moment any analytics or ad script is added** |
| 16 | Mobile version | **tested under emulation** | 11 cases in `responsive.spec.ts` on a Pixel 7 profile. No page scrolls sideways, the menu opens, the filter drawer settles inside the screen, the gallery strip scrolls rather than clips, and no tap target breaks WCAG 2.5.8 spacing. **Not a real handset** — see below |
| 17 | Accessibility | **done, by measurement** | Lighthouse accessibility **100** on home, the shop listing and the policy pages. Three real defects were found and fixed: `role="dialog"` on an `<aside>`, headings skipping h1→h3 on both listings and the product page, and an unlabelled sort `<select>` |
| 18 | Test forms | **done** | `forms.spec.ts` — seven cases across both. Contact: empty submit files nothing, an unreachable server says so, a server rejection is shown, fields clear after sending. Review: a rating is required, a post lands with the right stars, and the verified badge follows the purchase |
| 19 | Broken links | **done** | Crawled from the homepage against a production server: **9 internal URLs, 0 broken.** The number is the finding — see below |
| 20 | Performance | **measured, improved, not finished** | Lighthouse on a production build: **Performance 78, Accessibility 100, Best Practices 100, SEO 100.** Was 61 before the icon fix below |

### Performance: one fix, and what is left

Measured with Lighthouse against `next start`, not the dev server.

| | Before | After |
| --- | --- | --- |
| Performance | 61 | **78** |
| Largest Contentful Paint | 10.9 s | **5.3 s** |
| Total Blocking Time | 450 ms | **20 ms** |
| Largest single resource | 990 KB | **71 KB** |

**The fix was one file.** `logo-icon.png` was a 1592×988 PNG weighing 990 KB,
and it was being served as the favicon, the shortcut icon *and* the Apple touch
icon — on every page. It was also committed three times over (`public/images/`,
`src/app/icon.png`, `src/app/apple-icon.png`), about 3 MB of icons in the
repository. They are now fitted into transparent squares at 192, 180 and a
multi-size 48px `.ico`: 22 KB, 20 KB and 4.9 KB.

**LCP did not improve as much as expected.** Server-rendering the hero moved
Performance 78 → **81** and CLS 0.1 → **0**, but LCP only went 5.3 → 5.1 s. A
CDN `preconnect` cut the image's own download from 530 ms to 132 ms and left
the score unchanged at 80–81, inside run-to-run noise.

The remaining cost is **Load Delay, around 3–4 s** — the gap between the page
loading and the browser starting on the image, even though it is now in the
HTML and preloaded. Under Lighthouse's simulated slow 4G the JavaScript bundle
and two font files compete for the same bandwidth. Cutting or deferring that
bundle is the next lever; more image work is not.

### What the link crawl showed, and what closed it

The first crawl reached **9 URLs, 0 broken** — and a crawler that does not run
JavaScript **could not discover a single product page**, because the links were
not in the HTML. The sitemap was the only path to them.

After server-rendering both listings: **12 URLs, 0 broken**, and product pages
are reachable from the homepage for the first time. The `?variant=` links they
carry canonicalise back to the clean product URL, so the two do not compete.

### The phone, and the project that ran nothing

`storefront-mobile` has existed in `playwright.config.ts` for some time,
configured to grep for `@responsive`. **Nothing carried that tag, so it ran
zero tests** — the same shape as a feature flag with no row, which this
codebase has been caught by before.

It now runs 11. What they found: **nothing broken.** No page scrolls sideways,
the menu opens, the filter drawer settles fully inside the screen, the gallery
thumbnails scroll rather than clip, and every tap target satisfies WCAG 2.5.8.

Two things looked like defects and were not, which is why they were measured
rather than fixed on sight:

- Product thumbnails sit past the right edge — but inside a container with
  `overflow-x: auto`, so they scroll. Clipped, they would be unreachable.
- Ten footer and breadcrumb links are under 24×24px. WCAG allows that when a
  24px circle centred on the target reaches no other target; measured across
  33 targets, **zero violations**. Padding them out would have been a change
  that fixed nothing.

The horizontal-scroll check was proved by injecting a 150vw element into
`/faq`: that page fails, the other five still pass.

Two of my own mistakes, both caught by running it:

- The drawer assertion fired mid-animation. `toBeVisible` is satisfied on the
  first frame of a 250ms slide, so it measured the drawer still off the edge.
  It polls now — the claim is that it fits once open, not at every frame.
- The desktop project matched the same files and ran the phone cases at
  1280px, failing on a hamburger that is not supposed to exist there. It
  carries `grepInvert: /@responsive/` now, mirroring the mobile project's grep.

**What emulation does not cover.** A Pixel 7 profile is a viewport, a pixel
ratio, a user agent and touch. It will not catch iOS Safari's address bar
fighting a full-height layout, a font that falls back differently on a real
handset, touch latency, or anything about how the Cashfree payment window
behaves inside a real mobile browser. **The payment flow on a real phone
remains untested**, and it is the one journey where being wrong costs money.

### The two forms, and two defects found writing the tests

`ContactForm`'s happy path was already covered in `support.spec.ts`; nothing
around it was, and `ReviewForm` had no coverage at all despite being the only
place a customer publishes something other people read.

Seven cases now, in `forms.spec.ts`. The contact ones are mostly about
failure: an empty submit files nothing, an unreachable server says so rather
than pretending to have sent it, a server rejection is shown, and the fields
clear afterwards so the next message is not the last one again.

**The review pair is the one worth explaining.** Asserting
`isVerifiedPurchase: false` for a reviewer who bought nothing proves nothing on
its own — a column that is always false would satisfy it. So a second case buys
the product first and expects `true`. Between them they can only pass if the
badge is actually derived from a paid order, which is what the badge claims.

The rating guard was checked by removing it: the test fails without it.

Two defects surfaced while making the form testable by role, both invisible to
Lighthouse because the form sits behind a sign-in and a modal:

- **The star buttons had no accessible name.** Five identical unlabelled
  buttons, so a screen reader offered no way to tell which rating was which.
  Interactive stars now name themselves and expose `aria-pressed`; a read-only
  rating is a single `role="img"` reading "4 out of 5 stars" rather than five
  controls describing the markup.
- **The Title and Comment labels were not associated with their inputs** — no
  `htmlFor`, no `id`.

### The listings, and one measurement I got wrong

`/products` and `/category/[slug]` now render their cards — names, prices,
discount badges — on the server, seeded into the same client components that
still own filtering, sorting and the cart drawer. Both fetch with
`cache: 'no-store'`, decided up front this time: a card shows price and
sold-out state, which is exactly the data that, cached for five minutes on the
product page, kept a sold-out variant on sale.

**I reported the shop listing at Performance 50 with 1,800 ms of blocking
time. That was wrong** — it was measured while the Playwright suite was running
on the same machine, competing for CPU. Measured cleanly it is **82, with 20 ms
of blocking**. A number taken under load is not a finding.

### The old crawl note

Nothing is broken — and only **nine URLs are reachable**: `/`, `/products`,
`/account`, `/category/ghee`, the four policy pages, and one image.

A crawler that does not run JavaScript **cannot discover a single product page
from the homepage**, because the product links are not in the HTML. The sitemap
is currently the only path to them. That is the same finding as the section
below, arrived at from the other direction.

### Server rendering: done for the two pages that matter

Home and the product page now render their content on the server.

| | Home | Product page |
| --- | --- | --- |
| `<h1>` in the response | 0 → **1** | 0 → **1** |
| Body text | 3,521 → **3,649** chars | 812 → **2,485** chars |
| "Loading product details" | — | **gone** |
| Hero image in HTML | no → **yes** | — |

The shape is a server shell around a client island: `page.tsx` fetches and
passes the data in, the existing client component keeps the gallery, variant
picker, cart drawer and modals, and seeds its state from the prop instead of
starting empty and filling in from an effect. Home is now statically
prerendered with a five-minute revalidate; the product page stays dynamic.

**A regression this caused, and the spec that caught it.** The first version
cached the product fetch for five minutes, which meant a sold-out variant
stayed on sale for five minutes — `cart.spec.ts` B7 failed with "a sold-out
variant was still buyable". Titles tolerate staleness; stock does not, and
both come from the same call, so the fetch is `cache: 'no-store'`.

Still client-rendered, deliberately: `/account`, `/checkout`, `/orders/*` —
all behind a session, none of them things a crawler should see. `/products`
and `/category/[slug]` listings have not been converted.

### The `<h1>` finding, corrected

*(Kept for the record — this is what the work above fixed.)*

Every one of those pages **does** have an `<h1>` in its source. What they did
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

**Seventeen facts in them are decisions rather than code**, and each renders as
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

**Device testing** and coverage for `ContactForm` and `ReviewForm`.

The listings are done — see below — so the crawl path is closed.

Plus the seventeen business facts, which have their own worksheet:
[business-facts-needed.md](business-facts-needed.md).

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
