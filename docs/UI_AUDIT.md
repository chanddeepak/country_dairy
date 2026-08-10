# UI Audit — Storefront & Admin Console

Findings from driving both apps in a real browser against a running API and the
live database, 2026-08-10.

**Status:** A, B1, C1–C3, D1, D2 fixed and re-verified in the browser. B2 (slow
dashboard), B3 and C4–C5 remain.

**Environment:** API `:4000`, storefront `:3000`, admin `:5173`
**Automation at time of audit:** 132 checks passing (31 unit, 57 smoke, 18
contract, 26 catalog). Every issue below is something the API-level suites do
not cover — they are UI-layer faults.

Severity: 🔴 blocks a user · 🟠 wrong or misleading · 🟡 polish

---

## A. Feature flags not respected in the UI

The flags are correct in the database and the API enforces them. The UI still
advertises the disabled features.

### ✅ A1 — Login offers Mobile and Google, and defaults to Mobile
`apps/web/src/components/modals/AuthModal.tsx:14`

```ts
const [activeTab, setActiveTab] = useState<'mobile' | 'email' | 'google'>('mobile');
```

`ENABLE_OTP_LOGIN` and `ENABLE_GOOGLE_LOGIN` are both off, and the API returns
403 for either. A customer opening the sign-in modal lands on the Mobile tab by
default — the one method guaranteed to fail. Email is available but is the
second tab.

**Fix:** read the flags, render only enabled methods, and default to the first
enabled one. If only one is enabled, drop the tab strip entirely.

### ✅ A2 — Sign-in modal promises a wallet
`apps/web/src/components/modals/AuthModal.tsx:124`

> "Sign in to view your wallet balance and manage orders."

`ENABLE_WALLET` is off. There is no wallet.

### ✅ A3 — Navbar renders a wallet balance badge
`apps/web/src/components/layout/Navbar.tsx:163-166`

Shows `₹{walletBalance}` for signed-in users regardless of the flag.

### ✅ A4 — Admin sidebar shows "Wallet Ledger"
`apps/admin/src/components/layout/Sidebar.tsx:88`

Visible with `ENABLE_WALLET` off. The page behind it is still demo data.

### ✅ A5 — Admin sidebar shows three unbuilt pages
`Sidebar.tsx` — "Delhivery Shipping", "Driver Delivery App", "Milk Route
Sheets". All still static demo data with no backend. They look operational.

---

## B. Admin console

### ✅ B1 — "Authentication token missing" on first sign-in
`apps/admin/src/App.tsx:73`

The catalog fetch effect has `[]` dependencies and lives in `AdminMainContent`,
which mounts **before** the user signs in — the `if (!isAuthenticated) return
<Login/>` guard is inside the same component, so the effect fires on page load
with no token, gets a 401, and sets the error banner. It never re-runs after
login, so the banner persists and the catalog stays empty until a manual
reload.

Reproduced: sign in → red banner "Could not reach the API server.
Authentication token missing" plus an empty catalog. Reload → correct.

**Fix:** gate the effect on the token, and re-run it when authentication state
changes.

### 🟠 B2 — Dashboard takes 10–15 seconds
`apps/api/src/analytics/analytics.service.ts`

Measured: the endpoint alone is **~2.9s** server-side, and React StrictMode
fires it twice in development. Contributors:

- Seven parallel queries including two `$queryRaw` against the remote Supabase
  pooler.
- `getStockAlerts()` loads **every** active variant and filters in JavaScript
  rather than in SQL.
- `getDashboard` awaits `getStockAlerts()` inside its own `Promise.all`, so the
  stock query is serialised behind the rest.

**Fix:** filter stock alerts in SQL (`stockQuantity <= lowStockThreshold`),
collapse the event aggregates into a single grouped query, and consider a short
cache.

### 🟡 B3 — Product editor is dark, the rest of the console is light
`apps/admin/src/pages/ProductEditor.tsx`

Jarring theme switch mid-flow. `AddProductWizard` is the same.

---

## C. Storefront

### ✅ C1 — Product cards show an empty rating: `⭐ ()`
`apps/web/src/app/products/page.tsx:47-80`, `components/home/ProductShelf.tsx`

The API returns `averageRating: 5, totalReviews: 1`, but the client mapping
never copies those two fields onto the object it builds, so
`product.averageRating?.toFixed(1)` renders nothing and `({product.totalReviews})`
renders `()`.

Visible on every card on `/products` and the homepage shelf. The product detail
page is correct because it uses a different code path.

### ✅ C2 — Client-side invented defaults, again
`apps/web/src/app/products/page.tsx:66-77`

```ts
price: String(defaultVariant?.sellingPrice || p.price || 100),
originalPrice: String(defaultVariant?.mrpPrice || p.originalPrice || 120),
stockQuantity: v.stockQuantity ?? 50,
```

Same class of bug as the ₹100 checkout fault, moved to the client. The stock
default is the dangerous one: **a variant with 0 stock reads as 50**, so an
out-of-stock product renders as buyable and the out-of-stock overlay never
appears. The customer only discovers it at checkout.

### ✅ C3 — No way to write a review unless already signed in
`apps/web/src/app/products/[slug]/page.tsx:766`

```tsx
{user && token && (<ReviewForm … />)}
```

A logged-out visitor sees "No reviews yet. Be the first to share your
experience!" with **no button**. Nothing invites them to sign in and review.

### 🟠 C4 — Category filter shows the wrong taxonomy
`/products` renders chips "All" and "Ghee". The real categories are Dairy,
Oils and Honey. The filter is derived from product text rather than the
`Category` table.

### 🟡 C5 — Hero image is slow to appear on first paint
Homepage renders a grey block before the banner loads. Next flags it as the
LCP element and asks for `loading="eager"`.

---

## D. Media uploads — requested features, not yet built

### ✅ D1 — Reviews cannot take photos or video
`apps/web/src/components/product/ReviewForm.tsx:29`

```ts
body: JSON.stringify({ rating, title, comment, mediaUrls: [] }),
```

`mediaUrls` is hardcoded empty. There is no file input. The schema
(`ProductReview.mediaUrls String[]`) and the API DTO already accept up to five
URLs, so this is purely a missing UI plus an upload call.

### ✅ D2 — Admin cannot upload product video
`apps/admin/src/components/common/ImageUploader.tsx:121,192`

```ts
if (!file.type.startsWith('image/')) { … }
accept="image/jpeg,image/png,image/webp"
```

Images only. Supporting video needs:
- `ProductImage` generalised to product media with a `mediaType`
  (`IMAGE` | `VIDEO`) column, or a separate `ProductVideo` model
- upload path that skips WebP canvas compression for video
- a size ceiling and a poster/thumbnail frame
- storefront gallery able to play a video item

---

## Fix order

Grouped so related code is touched once.

| # | Items | Why first |
|---|---|---|
| 1 | C2, B1 | ✅ done |
| 2 | A1–A5 | ✅ done |
| 3 | C1, C3 | ✅ done — C4 (category chips) still open |
| 4 | D1, D2 | ✅ done |
| 5 | B2 | open — dashboard performance |
| 6 | B3, C4, C5 | open — polish |

---

## Not defects

Recorded so they are not re-investigated:

- **"milk" product has placeholder text** ("dsfdsg dsfdsbgd dsfdsfgds") and a
  peanut-butter photo — test data entered through the console, not a bug.
- **Product images appear blank at first** — lazy loading; they resolve on
  scroll.
- **Dashboard reads 25 store visits / 4 product views** — real analytics rows
  generated by this audit session. The pipeline works.
