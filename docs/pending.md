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
| 1 | Privacy policy | **missing** | `/privacy` → 404. No policy content anywhere in `apps/web` |
| 2 | Terms page | **missing** | `/terms` → 404 |
| 3 | Clear CTA | **done** | "Add to cart" on cards and detail, "Checkout Now" in the drawer |
| 4 | FAQ | **missing** | `/faq` → 404 |
| 5 | robots.txt | **missing** | `/robots.txt` → 404. No `src/app/robots.ts` |
| 6 | sitemap.xml | **missing** | `/sitemap.xml` → 404. No `src/app/sitemap.ts` |
| 7 | Custom 404 | **missing** | No `not-found.tsx` anywhere; Next's default page. The **status code is correct** — an unknown URL returns 404, not 200 |
| 8 | Alt text | **partial** | 24 image tags, **23 carry alt**. One gap: `components/home/HeroSection.tsx:78` |
| 9 | Analytics | **partial** | First-party `page_view` via `PageViewTracker` → `trackStorefrontEvent`. **No third-party vendor** (no GA, GTM, Plausible, PostHog) |
| 10 | Meta titles | **partial** | Root and `/category/[slug]` only. **Every product page serves the homepage title** |
| 11 | Meta description | **partial** | Same two places, same gap |
| 12 | Social share | **missing** | No `og:` tags on home or product. Category has `og:title` and `og:description` only — **no `og:image`**, so a shared link previews with no picture |
| 13 | Favicon | **done** | `public/favicon.ico`, `src/app/icon.png`, `apple-icon.png`, plus `icons` in root metadata |
| 14 | Canonical URLs | **missing** | No `rel="canonical"` on any page, and no `metadataBase` |
| 15 | Cookie consent | **missing** | No banner, no consent component |
| 16 | Mobile version | **partial** | Responsive classes throughout (183 breakpoint uses) and Next's default viewport tag. **Not tested on a real device** |
| 17 | Accessibility | **partial** | `lang="en"` set, alt text good. **Four of five key pages have no `<h1>`** — home, product detail, category and account all return zero; only `/products` has one. Button labelling not properly audited |
| 18 | Test forms | **partial** | e2e covers auth, checkout, account and support. `ContactForm` and `ReviewForm` have no coverage |
| 19 | Broken links | **partial** | Every nav and footer link resolves (`/`, `/products`, `/account`, `/category/ghee`, `/account?tab=orders` all 200). No site-wide crawl has been run |
| 20 | Performance | **unmeasured** | No Lighthouse run, and this build's output carried no bundle sizes. Two known drags: **7 files use raw `<img>`** instead of `next/image`, and **all 11 route pages are client components** |

### Two things the checklist does not mention

**`/phase1-proof` is publicly reachable** and returns 200. Its own comment says
"Deleted before this branch merges." It was not.

**There is no error boundary** — no `error.tsx` and no `global-error.tsx`
anywhere — so a render error shows Next's default screen.

### Why 1, 2 and 4 may block more than SEO

Payment gateways generally want a live privacy policy, terms, and refund,
cancellation and shipping policies before they activate a production merchant
account. **One Click Checkout is still awaiting production activation**, so
these pages are worth confirming against Cashfree's own activation
requirements rather than treating them as a marketing nicety.

### The cheapest fixes first

`robots.ts`, `sitemap.ts` and `not-found.tsx` are three small files. Canonical
URLs and Open Graph are a `metadataBase` plus an `openGraph` block in the root
metadata. Per-product titles need a `layout.tsx` beside the product page — the
same trick `/category/[slug]` already uses to get its own metadata out of a
client page.

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
