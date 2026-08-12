# Country Dairy — QA Test Plan

Every flow built to date, across the storefront, the admin console and the API.
Written to be executed by hand and then automated. Each case gives the steps, the
expected result, and the database check that proves it actually happened —
because a screen that says "Saved" and a row that changed are not the same claim.

**Covers:** 102 API routes · 8 storefront pages · 21 admin pages · 8 feature flags
**Automated equivalent:** `npm run verify` (427 checks). This document is the
superset; the automated suite covers the API and data layer, this adds the UI.

---

## 1. Before you start

### Environments

| Piece | Local | Notes |
|---|---|---|
| API | `http://localhost:4000/api` | `cd apps/api && npm run start:dev` |
| Storefront | `http://localhost:3000` | `cd apps/web && npm run dev` |
| Admin | `http://localhost:5173` | `cd apps/admin && npm run dev` |
| Database | Supabase Postgres | `npm run db:studio` to browse |

A single round trip to the database costs roughly 700ms from outside the region.
Treat anything under about 2s as normal locally; do not raise latency bugs
without comparing against that floor.

### Accounts

| Role | Credentials | Reaches |
|---|---|---|
| Super admin | `admin@countrydairy.in` / `ChangeMe#2026` | Everything |
| Catalog manager | create in User Management | Catalog, CMS, lab reports, reviews |
| Order manager | create in User Management | Orders, customers, delivery, courier |
| Delivery driver | create in User Management | My Deliveries only |
| Customer | register on the storefront | Storefront only |

> Change the super admin password before any deployment. The old JWT secret is
> in git history, so any token minted before rotation must be treated as
> compromised.

### Feature flags

Several suites depend on flags. Check the current state in **Admin → Storefront
CMS & Flags** before reporting a missing feature as a bug.

| Flag | Default | Gates |
|---|---|---|
| `ENABLE_CART` | on | Cart icon, add to cart, checkout |
| `ENABLE_USER_ACCOUNTS` | on | Sign in, account page |
| `ENABLE_WEBSITE_PAYMENT` | on | Online payment at checkout |
| `ENABLE_PRODUCT_RATINGS` | on | Review section and form |
| `ENABLE_SUBSCRIPTIONS` | off | Subscriptions tab and modal |
| `ENABLE_WALLET` | off | Wallet tab, balance, wallet ledger |
| `ENABLE_OTP_LOGIN` | off | Phone login option |
| `ENABLE_GOOGLE_LOGIN` | off | Google sign-in button |

**A flag that is off must hide the feature entirely, not merely disable it.**
Showing a wallet the store does not have is a bug in its own right.

### Test data hygiene

Every automated script creates and removes its own fixtures. When testing by
hand, prefix anything you create with `QA-` so it is identifiable, and remove it
afterwards. Never run destructive cases against production.

### Reading the DB checks

Run these in `npm run db:studio` or any SQL client. `:email`, `:orderId` and
similar are placeholders for the values you used.

---

## 2. Storefront — Authentication & session

### A1 · Register a new customer
**Steps** — Open `/`, click the account icon, choose *Register*. Enter a name, an
unused email, and a password of at least 8 characters. Submit.
**Expected** — Modal closes, header shows the account initial, cart merges any
guest items.
**DB** —
```sql
select id, name, email, role, "isActive", "emailOptIn", "smsOptIn", "whatsappOptIn"
from "User" where email = :email;
```
Expect one row, `role = CUSTOMER`, `isActive = true`, all three opt-ins `true`.
```sql
select provider, "providerId" from "AuthIdentity" where "userId" = :userId;
```
Expect one row, `provider = EMAIL`.

### A2 · Password is never stored in the clear
**DB** — `select "passwordHash" from "User" where email = :email;`
**Expected** — A bcrypt hash beginning `$2a$` or `$2b$`, cost 12. Never the
password itself.

### A3 · The same email cannot register twice
**Steps** — Register with an email already in use.
**Expected** — "Email already in use". No second account.
**Variants that must all be refused** — the same address in different casing
(`USER@x.com`), and with leading or trailing whitespace.
**DB** — `select count(*) from "User" where lower(email) = lower(:email);` → 1.

### A4 · Password rules
| Input | Expected |
|---|---|
| 7 characters | Refused, minimum 8 |
| 8 characters | Accepted |
| Empty | Refused |

### A5 · Sign in
**Steps** — Sign out, sign in with the credentials from A1.
**Expected** — Signed in; cart and addresses restored.
**DB** — `select "lastLoginAt" from "User" where email = :email;` → updated.

### A6 · Wrong password
**Expected** — "Invalid email or password". The message must be identical for an
unknown email and a wrong password, so it cannot be used to discover which
addresses have accounts.

### A7 · Session survives a reload
**Steps** — Sign in, refresh, navigate to `/account`.
**Expected** — Still signed in. **No sign-in modal flash** at any point.

### A8 · An expired or rejected token signs the customer out
**Steps** — In DevTools, replace `localStorage.cd_token` with a malformed value.
Reload `/account`.
**Expected** — "Your session has ended", a Sign In button, and **no** tabs, name,
orders or addresses rendered from stale storage.
**DB** — none; this is entirely client behaviour plus a 401.

### A9 · A deactivated account cannot keep using its token
**Steps** — Sign in as a customer. In the admin console or the database set
`isActive = false`. Wait 15 seconds (a 10s user cache). Act in the storefront.
**Expected** — Signed out. The API returns **401, not 403** — 403 means
"authenticated but not allowed here" and must not end a session.

### A10 · Sign out
**Expected** — Header returns to signed-out, `cd_token` and `cd_user` removed
from localStorage, cart falls back to guest.

### A11 · Hidden login methods
**Precondition** — `ENABLE_OTP_LOGIN` and `ENABLE_GOOGLE_LOGIN` off.
**Expected** — No phone-login tab, no Google button anywhere in the modal.

---

## 3. Storefront — Catalogue & product

### B1 · Homepage loads
**Steps** — Open `/`.
**Expected** — Hero carousel, product shelf, value banner, footer. No console
errors. No placeholder or lorem text.

### B2 · Hero carousel
**Expected** — Auto-advances roughly every 10 seconds; pauses on hover;
indicators are clickable and each has a hit area of at least 24×24px; the active
indicator is visually distinct.

### B3 · Only live products are listed
**DB** — `select title, status from "Product" where status <> 'LIVE';`
**Expected** — None of those appear on `/products`, and their slugs return 404.

### B4 · Category filter
**Steps** — Use the category chips on `/products`.
**Expected** — Chips reflect the real taxonomy from the database, not hardcoded
names. Filtering narrows the grid; "All" restores it.

### B5 · Search
**Steps** — Search a known product word, then nonsense.
**Expected** — Matching products; a clear empty state for nonsense — never a
blank page.

### B6 · Product card content
**Expected** — Image, title, price, MRP with the discount when one applies, star
rating with count, size label. **Never `₹NaN`, `₹undefined`, `₹0` or a blank
price.**

### B7 · Out of stock
**Precondition** — Set a variant's `stockQuantity` to 0.
**Expected** — The card shows out of stock and cannot be added to the cart.
**DB** — `select "stockQuantity" from "ProductVariant" where id = :id;` → 0.
This case guards a real past bug where missing stock defaulted to 50 and a
sold-out product rendered as buyable.

### B8 · Manual out-of-stock override
**Precondition** — `Product.forceOutOfStock = true` with stock still positive.
**Expected** — Shown as unavailable regardless of stock.

### B9 · Product detail page
**Steps** — Open a product.
**Expected** — Gallery with working thumbnails, variant selector, price updating
per variant, description, specifications, nutrition table when present, reviews.

### B10 · Variant switching
**Steps** — Switch between sizes.
**Expected** — Price, MRP, discount, SKU, stock state and the gallery's active
image all update together. The URL carries the variant so the link is shareable.

### B11 · Nutrition and specifications
**Expected** — Rendered from the product's own data. The section is **hidden
entirely** when empty, never shown with "undefined" rows.

### B12 · Lab report block
**Precondition** — A published lab report exists for the product.
**Expected** — Batch number, test date, lab name, the parameter table, and a
link to the PDF when one is attached. **Hidden entirely when nothing is
published** — the page must not claim testing it cannot evidence.
**DB** — `select "batchNumber", "isPublished" from "LabReport" where "productId" = :id;`

### B13 · An unpublished report stays invisible
**Precondition** — Set `isPublished = false` on that report.
**Expected** — Vanishes from the product page. `GET /lab-reports/product/:id`
does not return it.

---

## 4. Storefront — Cart

### C1 · Add to cart as a guest
**Steps** — Signed out, add a product.
**Expected** — Cart badge increments immediately; drawer shows the correct name,
size and price.
**DB** — none; guest cart lives in `localStorage.cd_guest_cart`.

### C2 · Add to cart signed in
**DB** —
```sql
select "variantId", quantity from "CartItem" where "userId" = :userId;
```
**Expected** — One row per variant with the right quantity.

### C3 · Guest cart merges on sign-in
**Steps** — Add items as a guest, then sign in.
**Expected** — Items move into the account cart; nothing is lost or duplicated.

### C4 · Two sizes of one product coexist
**Steps** — Add 500ml and 1L of the same product.
**Expected** — Two separate lines.
**DB** — Two `CartItem` rows with different `variantId` and the same `productId`.
This guards a past key of `[userId, productId]` that made it impossible.

### C5 · Quantity changes
**Steps** — Increase and decrease from the drawer.
**Expected** — Line total and cart total recalculate. Reducing to zero removes
the line.

### C6 · Cart totals
**Expected** — Every figure is a number. **No `₹NaN` anywhere** — the drawer and
the checkout page must agree, and both must match the API.

### C7 · Stock ceiling
**Steps** — Try to add more than `stockQuantity`.
**Expected** — Refused with a clear message naming the product and size.

### C8 · Cart survives a reload
**Expected** — Signed in, the cart is refetched from the API and matches.

---

## 5. Storefront — Checkout & payment

### D1 · Checkout requires sign-in
**Steps** — Guest, press Checkout in the drawer.
**Expected** — Sign-in prompt; the cart is preserved through it.

### D2 · Checkout button works from every page
**Pages** — home, `/products`, `/products/[slug]`, `/account`, `/purity/[batch]`.
**Expected** — All navigate to `/checkout`. This case exists because two of them
previously did nothing at all.

### D3 · Add a delivery address at checkout
**Steps** — Add an address with a valid 6-digit PIN and 10-digit mobile.
**DB** —
```sql
select line1, city, state, "postalCode", phone, "isDefault"
from "Address" where "userId" = :userId;
```
**Expected** — Saved with the entered values. The first address becomes default.

### D4 · Address validation
| Field | Bad input | Expected |
|---|---|---|
| PIN | `00123`, `1234`, `abcdef` | Refused, must be 6 digits not starting 0 |
| Mobile | `12345`, `5123456789` | Refused, must start 6–9 and be 10 digits |
| Line 1 | 2 characters | Refused |

### D5 · Order summary is the API's, not the browser's
**Expected** — Subtotal, GST, delivery and total come from the server. Compare
the on-screen total against the `checkout` response.

### D6 · GST is extracted, not added
**Precondition** — A basket mixing rates, e.g. ghee at 12% and milk at 0%.
**Expected** — Prices are tax-inclusive: the total equals the sum of line
prices, and the tax shown is the portion contained within them.
**DB** —
```sql
select "productTitle", "gstRate", "unitPrice", quantity, "taxAmount", "lineTotal"
from "OrderItem" where "orderId" = :orderId;
```
Check `taxAmount ≈ lineTotal − lineTotal / (1 + gstRate/100)`.

### D7 · Place an order
**DB** —
```sql
select "orderNumber", status, "paymentStatus", subtotal, "taxAmount",
       "totalAmount", "shippingAddress"
from "Order" where id = :orderId;
```
**Expected** — `orderNumber` is human-readable, totals match the summary, and
`shippingAddress` is a **snapshot** — later editing the saved address must not
change it.

### D8 · Stock decrements once, at checkout
**Steps** — Note `stockQuantity`, place an order for 2.
**Expected** — Stock falls by exactly 2.
**DB** — `select "stockQuantity" from "ProductVariant" where id = :id;`

### D9 · Cart clears after a successful order
**DB** — `select count(*) from "CartItem" where "userId" = :userId;` → 0.

### D10 · Two buyers race for the last unit
**Steps** — Set stock to 1. Have two sessions check out simultaneously.
**Expected** — Exactly one order succeeds; the other sees a clear "sold out
while you were checking out". **Stock must never go negative.**
**DB** — `select "stockQuantity" from "ProductVariant" where id = :id;` → 0.

### D11 · Payment replay is idempotent
**Steps** — Submit the same payment verification twice.
**Expected** — The second returns the already-confirmed order. No second
`Payment` row, no second stock decrement.
**DB** — `select count(*) from "Payment" where "orderId" = :orderId;` → 1.

### D12 · The pending payment row is settled, not duplicated
**DB** — After payment, that single `Payment` row has `status = PAID` and a
`gatewayPaymentId`. A leftover `PENDING` row alongside a `PAID` one is a bug.

### D13 · WhatsApp ordering
**Precondition** — WhatsApp enabled in Admin → WhatsApp CMS.
**Expected** — The cart drawer offers "Prefer to order on WhatsApp?"; the link
opens with the number and message template from the database, with the cart
items substituted.

---

## 6. Storefront — Orders, reorder and invoice

### E1 · Order list
**Steps** — `/account?tab=orders`.
**Expected** — Every order for this customer, newest first, showing the
**order number** (not a truncated UUID), date, total, and status badges.
**Never `₹undefined`.**

### E2 · Order detail
**Expected** — Items, quantities, the address it shipped to, status timeline,
and totals. Tracking details when a carrier has been recorded.

### E3 · Another customer's order is not reachable
**Steps** — Open `/orders/{someoneElsesOrderId}`.
**Expected** — "Order not found" — the same response as a genuinely missing
order, so ids cannot be probed.

### E4 · Reorder — everything still available
**Steps** — Press *Buy again*.
**Expected** — "N items added to your cart" and a link to checkout.
**DB** — `select "variantId", quantity from "CartItem" where "userId" = :userId;`
matches the original order's lines.

### E5 · Reorder twice
**Expected** — Quantities add up; no duplicate rows.
**DB** — Still one `CartItem` row per variant.

### E6 · Reorder when something is sold out
**Precondition** — Set a variant in that order to `stockQuantity = 0`.
**Expected** — That line is listed as unavailable with the reason "sold out",
and the rest are still added. **Nothing is silently substituted.**

### E7 · Reorder with partial stock
**Precondition** — Order was for 2; set stock to 1.
**Expected** — 1 added, and the message says how many were wanted versus added.

### E8 · Reorder after a price change
**Precondition** — Change the variant's `sellingPrice`.
**Expected** — The new price is stated against the old one **before** checkout.

### E9 · Reorder a delisted product
**Precondition** — Set the product's `status` to `ARCHIVED`.
**Expected** — Reported as no longer sold.

### E10 · Invoice on a paid order
**Steps** — On a paid order, press *Invoice*.
**Expected** — A printable invoice showing seller identity, GSTIN and FSSAI when
set, buyer, place of supply, HSN per line, taxable value, tax, and total.
**DB** —
```sql
select "invoiceNumber", "invoicedAt" from "Order" where id = :orderId;
```
Expect a number shaped `CD/2026-27/00001` and a timestamp.

### E11 · The invoice number is stable
**Steps** — Reload the invoice several times.
**Expected** — The same number every time; the series does not advance.

### E12 · The series is consecutive
**Steps** — Invoice three paid orders in turn.
**Expected** — Sequence numbers increment by exactly 1 with no gaps.
**DB** —
```sql
select "invoiceNumber" from "Order"
where "invoiceNumber" is not null order by "invoiceNumber";
```

### E13 · An unpaid order does not consume a number
**Steps** — Try to invoice a `PENDING` order.
**Expected** — Refused with "An invoice is raised once the order is paid for".
**DB** — `invoiceNumber` stays null. **This is why the series stays gap-free.**

### E14 · Intra-state tax split
**Precondition** — Delivery address in Uttarakhand (the seller's state).
**Expected** — CGST and SGST columns, equal halves, no IGST.

### E15 · Inter-state tax
**Precondition** — Delivery address in any other state.
**Expected** — A single IGST column carrying the whole tax; no CGST or SGST.

### E16 · Bill of supply without a GSTIN
**Precondition** — Clear the GSTIN in seller settings.
**Expected** — The document is headed **Bill of Supply**, not Tax Invoice.

### E17 · Printing
**Steps** — Press *Print or save as PDF*.
**Expected** — The print sheet contains only the invoice — no navigation, no
buttons.

### E18 · Another customer's invoice
**Expected** — 404.

---

## 7. Storefront — Account management

### F1 · My Account and My Orders are different pages
**Steps** — From the header menu, open each.
**Expected** — *My Account* lands on Overview; *My Orders* lands on the Orders
tab at `/account?tab=orders`.

### F2 · Tabs are linkable and survive a reload
**Expected** — Each tab has its own URL; refreshing keeps you where you were;
back and forward work.

### F3 · Disabled features have no tab
**Precondition** — `ENABLE_WALLET` and `ENABLE_SUBSCRIPTIONS` off.
**Expected** — No Wallet or Subscriptions tab, and no wallet or subscription
cards on Overview. Typing `?tab=wallet` by hand must **not** open it.

### F4 · Add an address
**Steps** — Addresses → *Add New Address*, fill in and save.
**Expected** — Appears in the list with a DEFAULT badge if it is the first.
**DB** — A row in `Address` with all fields including `line2` when entered.

### F5 · Edit an address
**Expected** — The form prefills with current values; saving updates them; a
partial edit does not blank untouched fields.

### F6 · Set a different default
**Expected** — Exactly one address carries DEFAULT.
**DB** — `select count(*) from "Address" where "userId" = :id and "isDefault";` → 1.

### F7 · Delete an address
**Expected** — Confirmation naming the address; deletion removes it. Deleting
the default **promotes another**, so a customer is never left with addresses but
none selected.

### F8 · One customer cannot touch another's address
**Steps** — Call `PATCH /auth/address/{otherPersonsId}` with your own token.
**Expected** — 404.

### F9 · Profile details
**Steps** — Profile & Security → change name and mobile → Save.
**Expected** — "Saved." The header updates.
**DB** — `select name, phone from "User" where id = :id;`

### F10 · Email is read-only
**Expected** — Shown but not editable, with an explanation. It is the sign-in
identity and changing it needs its own verification flow.

### F11 · A mobile number already on another account
**Expected** — Refused with a clear message, not a raw database error.

### F12 · Change password
**Steps** — Enter the current password and a new one twice.
**Expected** — "Password changed."
**Then** — The old password no longer signs in; the new one does.
**DB** — `passwordHash` has changed.

### F13 · Password change validation
| Case | Expected |
|---|---|
| Wrong current password | Refused — this is what stops a stolen session locking the owner out |
| New shorter than 8 | Refused |
| Confirmation mismatch | Refused |
| New same as current | Refused |

### F14 · Communication preferences
**Steps** — Toggle WhatsApp, SMS and email.
**Expected** — Each saves on toggle with a brief "saving…"; no Save button.
**DB** — `select "emailOptIn", "smsOptIn", "whatsappOptIn" from "User" where id = :id;`
**Then** — Reload the page. The toggles must reflect what was saved, not default
back to on.

### F15 · Close my account — guards
| Case | Expected |
|---|---|
| Wrong password | Refused |
| Confirmation not typed as `CLOSE` | Refused |
| Cancel | Nothing changes |

### F16 · Close my account — erasure
**Precondition** — The account has orders, addresses, a cart and a review with a
photograph.
**Steps** — Confirm closure.
**Expected** — Signed out and returned to the homepage.
**DB — erased:**
```sql
select name, email, phone, "passwordHash", "isActive", "deletedAt",
       "emailOptIn", "smsOptIn", "whatsappOptIn"
from "User" where id = :userId;
```
Expect `name = 'Closed account'`, email/phone/passwordHash **null**,
`isActive = false`, `deletedAt` set, all opt-ins false.
```sql
select
 (select count(*) from "Address"       where "userId" = :userId) as addresses,
 (select count(*) from "CartItem"      where "userId" = :userId) as cart,
 (select count(*) from "ProductReview" where "userId" = :userId) as reviews,
 (select count(*) from "AuthIdentity"  where "userId" = :userId) as identities;
```
All zero.

**DB — kept, and this is deliberate:**
```sql
select "orderNumber", "totalAmount", "invoiceNumber", "shippingAddress"
from "Order" where "userId" = :userId;
```
Orders survive with their money intact — tax law requires the invoice.
`shippingAddress.line1` reads `[erased at customer request]` and `phone` is
empty, but `city`, `state` and `postalCode` remain, because **place of supply is
what decides whether the tax on that invoice was CGST+SGST or IGST**.

**Storage** — The review's uploaded photograph is gone from the `review-media`
bucket.

### F17 · The closed account's token is dead
**Expected** — Any further API call returns 401.

### F18 · The email can be reused
**Steps** — Register again with the same address.
**Expected** — Succeeds, and creates a genuinely new user id.

### F19 · Staff accounts cannot self-close
**Steps** — Call `POST /auth/close-account` with a staff token.
**Expected** — 403. Staff are removed through User Management, so this cannot
delete the last administrator.

---

## 8. Storefront — Reviews

### G1 · Review section hidden when there are none
**Expected** — No empty "0 reviews" block on a product with none.

### G2 · Write a review
**Steps** — Open the form, choose a rating, add a title and comment, submit.
**Expected** — Appears immediately — publication is not gated on moderation.
**DB** —
```sql
select rating, title, status, "mediaUrls" from "ProductReview"
where "userId" = :userId and "productId" = :productId;
```
Expect `status = APPROVED`.

### G3 · Several reviews per product
**Expected** — The same customer can review the same product more than once.

### G4 · Attach photos and video
**Steps** — Attach up to 5 images or videos.
**Expected** — Thumbnails render; video shows a play affordance; the lightbox
opens.
**Never broken image icons** — this guards a real past bug where review media
URLs were not resolved.

### G5 · Attachment limits
| Case | Expected |
|---|---|
| 6 files | Refused, maximum 5 |
| Image over 15MB | Refused |
| Video over 100MB | Refused |
| A `.txt` file | Refused |

### G6 · Edit your own review
**Expected** — Editable; `editedAt` is set and shown.

### G7 · Removing an attachment frees the file
**Steps** — Edit a review to drop one photo.
**Storage** — That object is gone from `review-media`; the kept one remains.

### G8 · Delete your own review
**Expected** — Removed from the page.
**DB** — Row gone. **Storage** — its attachments gone too.

### G9 · You cannot edit or delete someone else's
**Expected** — 403.

### G10 · Pagination
**Precondition** — More than one page of reviews.
**Expected** — Pagination works, and the average rating is computed across
**all** reviews, not just the visible page.

### G11 · Rating aggregate
**DB** — Compare the displayed average and count against
```sql
select avg(rating), count(*) from "ProductReview"
where "productId" = :id and status = 'APPROVED';
```

---

## 9. Storefront — Lab reports and the jar QR code

### H1 · QR landing page
**Steps** — Open `/purity/{batchNumber}` for a published batch.
**Expected** — Product name, test date, lab, the parameter table with permissible
limits, notes, and a link to the product.

### H2 · Unknown batch
**Expected** — A clear "no report for this batch" page, not a crash or a blank.

### H3 · An unpublished batch is not reachable
**Precondition** — `isPublished = false`.
**Expected** — The batch URL returns the not-found page. **Batch numbers are
guessable, so this is a privacy boundary, not a convenience.**

---

## 10. Admin — Access control

### I1 · Sign in
**Steps** — `http://localhost:5173`, sign in as super admin.
**Expected** — Console loads on Overview. No "Could not reach the API server"
banner.

### I2 · A customer cannot sign into the admin console
**Steps** — Use customer credentials.
**Expected** — Refused. A customer account must never receive a staff token.

### I3 · Each role sees only its own navigation
| Role | Must see | Must not see |
|---|---|---|
| Catalog manager | Catalog, Hero, CMS, Lab Reports, Reviews | Orders, Customers, Users, Audit |
| Order manager | Orders, Customers, Courier, Routes | Catalog, Users, Audit |
| Delivery driver | My Deliveries only | Everything else |
| Super admin | Everything | — |

### I4 · A driver lands on a page they can open
**Steps** — Sign in as a driver on a browser previously used by an admin.
**Expected** — Lands on **My Deliveries**, not a 403. The saved tab must be
checked against the role.

### I5 · No false error banners for restricted roles
**Steps** — Sign in as a driver.
**Expected** — No "Could not reach the API server" — the driver simply has no
catalogue access, and the server is fine.

### I6 · Direct access to a forbidden module
**Expected** — A clear "You cannot open this page" panel naming the required
role, styled like the rest of the console.

### I7 · Feature-flagged pages
**Precondition** — `ENABLE_WALLET` off.
**Expected** — No Wallet Ledger in the sidebar.

---

## 11. Admin — Catalogue

### J1 · Product list
**Expected** — Every product with image, category, status, price range, total
stock, subscription toggle, **latest published batch**, and lab-tested state.

### J2 · Create a product through the wizard
**Steps** — *Add New Product*, complete all four steps.
**Expected** — Each step validates before allowing Continue; a completed step can
be revisited; an incomplete one cannot be skipped.
**DB** —
```sql
select p.title, p.slug, p.status, v.sku, v."sellingPrice", v."stockQuantity"
from "Product" p join "ProductVariant" v on v."productId" = p.id
where p.title = :title;
```

### J3 · Prices are never invented
**Steps** — Add a variant and leave the price at zero.
**Expected** — Saving is refused, naming the variant. **No default price is ever
substituted** — this guards a real past bug that shipped a ₹100 fallback.

### J4 · Edit a product
**Expected** — All tabs prefill from the database; the tab counters match.

### J5 · Editing does not destroy variants
**Steps** — Note a variant id, edit an unrelated field, save.
**Expected** — Variant ids are unchanged.
**DB** —
```sql
select id, sku from "ProductVariant" where "productId" = :id order by id;
```
This guards a past bug where saving deleted and recreated every variant,
orphaning order history and emptying customers' carts.

### J6 · Packaging round-trips
**Steps** — Choose a packaging option, save, reopen.
**Expected** — Still selected.
**DB** — `select "packagingCode" from "ProductVariant" where id = :id;`

### J7 · Gallery
**Steps** — Upload images and a video; set a cover; assign an image to a variant.
**Expected** — Video cannot be the catalogue cover; deleting the cover promotes
another image; at most 10 items.

### J8 · Replacing an image frees the old file
**Storage** — The replaced object is gone from the `products` bucket.

### J9 · Delete a product that has never sold
**Expected** — Removed outright; its images are gone from storage.

### J10 · Delete a product that has sold
**Expected** — **Archived, not deleted**, with an explanation. Order history must
survive.
**DB** — `select status from "Product" where id = :id;` → `ARCHIVED`.

### J11 · Categories
**Expected** — Create, rename, reorder and deactivate. A deactivated category
disappears from the storefront chips.

---

## 12. Admin — Orders and fulfilment

### K1 · Order queue
**Expected** — Orders with customer, total, payment state, status; filterable by
status; searchable by order number, name or email.

### K2 · Order detail
**Expected** — Line items with SKU and HSN, the address snapshot, payment
history, status timeline.

### K3 · Status transitions
**Steps** — Move an order through Confirmed → Processing → Shipped → Delivered.
**Expected** — Each step is recorded.
**DB** —
```sql
select status, note, "createdAt" from "OrderStatusHistory"
where "orderId" = :id order by "createdAt";
```

### K4 · Invalid transitions are refused
**Steps** — Try to move a Delivered order back to Pending.
**Expected** — Refused with a clear message.

### K5 · Cancellation restores stock
**Steps** — Cancel a confirmed order.
**Expected** — Stock returns.
**DB** — Compare `stockQuantity` before and after; check `StockMovement`.

### K6 · Assign a driver
**Expected** — The driver appears on the order and on their round.
**DB** — `select "driverId" from "Order" where id = :id;`

### K7 · Tax invoice from the console
**Expected** — The invoice matches what the customer sees, with the same number.

---

## 13. Admin — Delivery

### L1 · Route sheets
**Steps** — Delivery Route Sheets, pick today.
**Expected** — Confirmed **local** orders grouped by pincode. Courier orders must
not appear.

### L2 · Day summary
**Expected** — Stops, routes, unassigned count, and cash to collect.
**Cash to collect must exclude orders already paid online** — charging a
prepaid customer at the door is the failure this prevents.

### L3 · Stop detail
**Expected** — Customer, address, items, phone (tap to call), customer note, and
either "Collect cash ₹N" or "Paid online".

### L4 · Assign a route
**Steps** — Select stops, choose a driver, Assign.
**Expected** — Stops show the driver; the unassigned count falls.
**DB** — `select "driverId" from "Order" where id in (...);`

### L5 · Unassign
**Expected** — Returns the stops to the pool.

### L6 · Only real drivers can be assigned
**Steps** — Attempt to assign to a non-driver via the API.
**Expected** — 400.

### L7 · The driver's round
**Steps** — Sign in as the assigned driver.
**Expected** — Their stops only, with cash to collect summarised.

### L8 · A driver sees only their own work
**Expected** — Another driver's stops are absent, and completing one by id
returns **403**.

### L9 · Mark delivered
**Expected** — Leaves the open round, appears under "Delivered today".
**DB** —
```sql
select status, "deliveredAt", "paymentStatus" from "Order" where id = :id;
```
Cash orders settle to `PAID` on delivery.

### L10 · Delivering twice
**Expected** — Refused.

### L11 · Failed attempt
**Steps** — "Could not deliver", give a reason.
**Expected** — **Stays on the round** so it is attempted again — it must not
vanish into a status nobody watches.
**DB** — A row in `OrderStatusHistory` recording the attempt and reason.

### L12 · Courier consignments
**Expected** — Only non-local orders. Record a carrier and waybill; the customer
can then track it.
**DB** — `select "shippingCarrier", "trackingNumber", status from "Order" where id = :id;`

### L13 · Automatic courier booking is honestly labelled
**Expected** — The page states plainly that automatic booking needs a Delhivery
account and is not connected. **No fabricated waybill numbers** — this replaced
a screen that invented one and printed it on a label no carrier would honour.

### L14 · Packing slip
**Expected** — Prints real order data. On a gift order the price must be hidden.

---

## 14. Admin — Lab reports

### M1 · List
**Expected** — Batches newest first, showing product, test date, lab, parameter
count, and Live or Held back.

### M2 · Add a report
**Steps** — Choose product, batch number, test date, lab, parameters, notes, PDF.
**Expected** — Saved; batch number is upper-cased.
**DB** —
```sql
select "batchNumber", "testDate", "labName", parameters, "isPublished"
from "LabReport" where "batchNumber" = :batch;
```

### M3 · Standard parameter rows
**Expected** — "Use standard rows" offers rows appropriate to the product line —
milk fat and Reichert value for ghee, urea and detergent for milk.

### M4 · Duplicate batch on the same product
**Expected** — Refused (409).

### M5 · Validation
| Field | Bad input | Expected |
|---|---|---|
| Batch | under 3 characters | Refused |
| Test date | empty or malformed | Refused |
| PDF | over 20MB, or not a PDF | Refused |

### M6 · Publish and hide
**Steps** — Hide a published report.
**Expected** — Disappears from the product page and the QR lookup immediately.

### M7 · Replacing the PDF frees the old file
**Storage** — The old object is gone from `lab-reports`.

### M8 · Delete
**Expected** — Confirmation warning that printed QR codes will stop resolving.
**Storage** — The PDF is gone.

### M9 · QR destination
**Expected** — The URL shown matches what `/purity/{batch}` resolves.

---

## 15. Admin — CMS

### N1 · Hero banners
**Expected** — Create, edit, reorder, activate. Separate desktop and mobile
images.

### N2 · Poster versus photograph
**Steps** — Tick "This image already has text on it".
**Expected** — The storefront shows that image whole with **no headline laid over
it**. Unticked, the headline renders as real text over the photograph.
*(Present on `feature/devbhoomi-redesign`.)*

### N3 · Replacing a banner frees the old file
**Storage** — The old object is gone from `hero-banners`.

### N4 · Trust badges
**Expected** — CRUD with ordering and visibility; the storefront reflects it.

### N5 · WhatsApp settings
**Steps** — Change the number and message template.
**Expected** — The storefront uses the new values; placeholders substitute
correctly.
**DB** — `select value from "StoreSetting" where key = 'whatsapp_ordering';`

### N6 · Seller identity for invoices
**Steps** — Set legal name, GSTIN, FSSAI, address, state code, invoice prefix.
**Expected** — Appear on the next invoice. Removing the GSTIN turns it into a
bill of supply.
**DB** — `select value from "StoreSetting" where key = 'seller_identity';`

### N7 · Feature flags
**Steps** — Toggle each flag and reload the storefront.
**Expected** — The gated feature appears or disappears entirely.
**DB** — `select key, "isEnabled" from "FeatureFlag";`

### N8 · An unknown flag reads as off
**Expected** — A feature whose flag row is missing stays hidden — a missing row
must never open a feature.

---

## 16. Admin — Users, customers, audit

### O1 · Staff CRUD
**Expected** — Create, edit and deactivate staff with a role.
**DB** — `select email, role, "isActive" from "User" where role <> 'CUSTOMER';`

### O2 · The last super admin is protected
**Steps** — Try to demote or deactivate the only super admin.
**Expected** — Refused (403). **The console must not be able to lock everyone
out.**

### O3 · Reset a staff password
**Expected** — The new password works; the old one does not.

### O4 · Customer directory
**Expected** — Customers with order count and lifetime spend; searchable.

### O5 · Customer detail
**Expected** — Order history and addresses. A closed account shows as closed with
its personal fields erased.

### O6 · Audit log
**Steps** — Change a product, a flag and an order status, then open Audit.
**Expected** — Entries naming the actor, action, entity and before/after.
**DB** —
```sql
select action, entity, "entityId", "userName", "createdAt"
from "AuditLog" order by "createdAt" desc limit 20;
```

### O7 · Secrets are redacted in the audit trail
**Expected** — No password, token or payment signature appears in any audit
entry, even when the request contained one.

### O8 · Audit filters
**Expected** — Filtering by entity and action works.

---

## 17. Media lifecycle

### P1 · Replaced files are freed
Covered per-surface in J8, M7, N3, G7. In each case the **old object must be
gone** from its bucket.

### P2 · Orphan report
**Steps** — `GET /media/orphans?minAgeHours=0` as super admin.
**Expected** — Lists files no row points at. **Dry run — nothing is deleted.**

### P3 · Referenced files are never listed
**Expected** — A file the catalogue still points at never appears as an orphan.

### P4 · Recent uploads are protected
**Steps** — Upload a file, then run the report with the default 24h.
**Expected** — Not listed. **A file uploaded seconds ago may belong to a form
somebody is still filling in.**

### P5 · Sweep
**Steps** — `POST /media/orphans/sweep` with `minAgeHours: 0`.
**Expected** — Orphans removed; referenced files untouched; bytes freed
reported.

### P6 · Media routes are not public
| Call | Expected |
|---|---|
| `POST /media/delete` anonymously | 401 |
| `POST /media/delete` as a customer | 403 |
| `POST /media/orphans/sweep` as a customer | 403 |
| `POST /media/upload` anonymously | 401 |

These exist because the delete route was once unguarded — media URLs are public
on the storefront, so anyone could have deleted every product image.

---

## 18. Payment webhooks

Run with `RAZORPAY_WEBHOOK_SECRET` set. Sign the raw body with HMAC-SHA256 and
send it as `x-razorpay-signature`.

### Q1 · A valid `payment.captured` confirms the order
**DB** — `status = CONFIRMED`, `paymentStatus = PAID`, `confirmedAt` set.

### Q2 · Stock is not decremented again
**Expected** — Unchanged. Checkout already took it; taking it twice is the bug
this guards.

### Q3 · The cart is cleared
**Expected** — Empty — the browser callback that normally does this is exactly
what failed if the webhook is confirming the order.

### Q4 · Replay is idempotent
**Expected** — Accepted, reported as a duplicate, no second payment row.
**DB** — `select count(*) from "WebhookEvent" where "eventId" = :id;` → 1.

### Q5 · Forged and tampered signatures
| Case | Expected |
|---|---|
| Wrong signature | 400 |
| Signature from a different secret | 400 |
| No signature header | 400 |
| Body altered after signing | 400 |
**And** — the order is untouched in every case.

### Q6 · Underpayment is refused
**Steps** — Send a capture for less than the order total.
**Expected** — Non-2xx; the order stays unpaid; the event is stored with an
error for retry.

### Q7 · `payment.failed`
**Expected** — `paymentStatus = FAILED` with the reason recorded.

### Q8 · A late failure after capture
**Expected** — Accepted but **does not un-pay** a captured order.

### Q9 · Refund
**Expected** — `paymentStatus = REFUNDED`; `refundedAmount` recorded.

### Q10 · Unknown event types
**Expected** — Acknowledged with 200 and reported as unhandled — never a 500.

### Q11 · Production will not start in mock mode
**Steps** — Start the API with `NODE_ENV=production` and mock Razorpay keys.
**Expected** — **Refuses to boot.** Mock mode accepts any signature and must
never run against real customers.

---

## 19. Cross-cutting

### R1 · Responsive
Check every storefront page at 375px, 768px and 1440px.
**Expected** — No horizontal scrolling of the page body; wide tables scroll
inside their own container; navigation collapses to a working mobile menu.

### R2 · Keyboard and screen reader
**Expected** — Every interactive element is reachable by Tab with a visible
focus ring; modals trap focus and close on Escape; images have alt text; form
fields have labels.

### R3 · Touch targets
**Expected** — At least 24×24 CSS px. Carousel indicators are the usual offender.

### R4 · Loading states
**Expected** — Every action taking more than about 300ms shows progress —
sign-in, add to cart, checkout, save, upload, moderation.

### R5 · Error messages are true and actionable
**Expected** — They say what went wrong and what to do. Specifically, **an
expired session must not be reported as invalid input** — a past bug told
customers to check an address that was perfectly valid.

### R6 · No invented data anywhere
**Expected** — A missing value renders as unknown or is hidden. Never a
plausible-looking default: no `₹100` fallback price, no stock of 50 for an
unknown quantity, no locally fabricated address after a failed save.

### R7 · Authorisation matrix
For each protected endpoint, confirm anonymous → 401, wrong role → 403, right
role → 200. The automated suite covers this; spot-check by hand after any change
to guards.

### R8 · Rounding
**Expected** — Money is correct to two decimal places everywhere, and the sum of
line totals equals the order total exactly. Compare the invoice, the order
detail and the database.

---

## 20. Regression checklist before any production deploy

Run in order. Stop on the first failure.

1. `npm run verify` — all 427 checks pass.
2. `npm run db:status` — database and migrations agree.
3. Storefront: register → browse → add to cart → checkout → pay → order appears
   → invoice renders (D1–E17).
4. Concurrency: two buyers, one unit (D10). Stock must not go negative.
5. Admin: create a product with a price → appears on the storefront → edit it →
   variant ids unchanged (J2–J5).
6. Delivery: assign a route → driver sees only their own → mark delivered
   (L4–L9).
7. Money: GST split correct on an intra-state and an inter-state invoice
   (E14–E15).
8. Erasure: close a test account; orders survive, personal data does not (F16).
9. Media: replace an image; the old file is gone (J8).
10. Webhooks: a valid capture confirms; a forged one is refused (Q1, Q5).
11. Confirm `NODE_ENV=production` refuses to boot without live Razorpay keys
    (Q11).
12. Confirm the admin password has been rotated from the seeded default.

---

## 21. Known gaps — not defects

Do not raise these; they are unbuilt or deliberately deferred.

| Area | State |
|---|---|
| OTP / phone login | Deferred — needs an SMS provider |
| Google sign-in | Deferred — needs `GOOGLE_CLIENT_ID` |
| Wallet | Deferred by decision, behind `ENABLE_WALLET` |
| Subscriptions — Pause / Edit / Cancel | Buttons not wired; unreachable while the flag is off |
| Automatic courier booking | Needs a Delhivery account; the page says so |
| Live payments | Razorpay in mock mode locally; production refuses to boot without real keys |
| Mobile app | Static data, no API calls |
| Pagination | Reviews and lab reports only; Orders, Customers and Audit still fetch up to 200 rows |
| Gift hampers, collections, content pages | Schema exists; no UI yet |
| Storefront redesign | On `feature/devbhoomi-redesign`, not merged |
