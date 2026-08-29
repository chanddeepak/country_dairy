# Checkout and identity — the plan

Supersedes `docs/cashfree-integration.md`, which planned a payment gateway.
What is actually being built is larger than that: **the mobile number becomes
the identity for the whole site**, Cashfree runs the checkout — address, offers
and payment — and WhatsApp carries everything we say to a customer afterwards.

Source of truth. If the code and this document disagree, one of them is a bug.

---

## 1. The shape, in one paragraph

A customer is a **mobile number**. They sign in with an OTP we send. At
checkout, Cashfree's One Click Checkout takes over: it verifies the phone,
collects or recalls the address, applies whatever offer is best, and takes the
money. For a customer we already know we prefill the phone we verified. For a
guest we create the account afterwards from the number Cashfree confirmed, sign
them in, and land them on their order without a registration form ever
appearing. Everything after that — order confirmed, dispatched, delivered —
arrives on WhatsApp.

Nobody creates an account on purpose. Nobody types an address twice.

---

## 2. What is already built and proven

Five commits, all on `dev`, verified against the Cashfree sandbox rather than
inferred:

| | |
| --- | --- |
| `CASHFREE` on `PaymentProvider`, migration applied | dev database |
| `CashfreeService` — create, fetch, get-extended, webhook verify | probed live |
| `POST /orders/webhook/cashfree` + 6 specs | tampered body, replay, missing timestamp all refused |
| `POST /orders/checkout` branches on `ENABLE_CASHFREE_CHECKOUT` | 4 specs, Razorpay fallback intact |
| `POST /orders/confirm`, return page, real `cashfree.checkout()` | modal opens with our cart |

**Also already built, and better than expected:** `sendOtp` / `verifyOtp` in
`auth.service.ts`. Codes are bcrypt-hashed with a five minute expiry, five
sends per phone per fifteen minutes, five verify attempts, single use. And
`verifyOtp` already calls `resolveUserForIdentity(AuthProvider.PHONE, phone,
{ phone })` — it **find-or-creates the user by phone**, which is exactly what
guest account creation needs. There is a `// TODO: dispatch via MSG91` where
the send belongs. Everything except the send exists.

`User.phone` is `String? @unique` and `passwordHash` is nullable, so a customer
can exist with a phone and nothing else. **No schema change is needed for
phone-as-identity.**

---

## 3. What sandbox taught us that no document says

**One Click Checkout cannot collect an address without doing the login.**
Bisected against otherwise identical orders:

| features sent | result |
| --- | --- |
| `checkoutCollectAddress` + `checkoutAuthenticate` | renders |
| `checkoutCollectAddress` alone | blank, throws `RangeError: Invalid currency code :` |
| `checkoutAuthenticate` alone | blank, throws |

There is no documented `DENY` action and no documented third feature value —
their reference lists exactly these two, with the non-exhaustive phrase "such
as". `customer_uid` exists on the customer object but nothing documents it
skipping the OTP. **So the login step cannot be turned off inside OCC.**

**The extended order response, read from live sandbox** — the real shape, not a
guess:

```json
{
  "billing_address": null,
  "shipping_address": null,
  "offer": null,
  "order_amount": 1650,
  "charges": { "shipping_charges": 0, "cod_handling_charges": 0 },
  "cart": { "items": [ … ] },
  "customer_details": { "customer_id": "…", "customer_phone": "…", "customer_uid": null },
  "cf_order_id": "214148631971776"
}
```

`shipping_address` and `billing_address` are **top-level**, null until Cashfree
collects them. Address fields inside them are `address_line_one`,
`address_line_two`, `pin_code` — not `address1`, `address2`, `pincode`. The
guessed names type-checked, read `undefined` from every field, and silently
kept our address instead of the customer's. Fixed in `47476e8`. Third time on
this project a plausible field name has compiled green and dropped data at
runtime.

**Order numbers cannot be their order id.** `generateOrderNumber` is
`max(orderNumber) + 1` over surviving rows, so deleting an order frees its
number; Cashfree ids are permanent and answer a reuse with `409
order_already_exists`. Their id is now `CD-2026-00009-0bd64070`.

### 3.1 The blank modal was a stopwatch problem

**The bisect above is retracted as evidence.** Driving the real SDK against
sandbox on 29 August, the One Click Checkout modal renders correctly — but it
takes **15–20 seconds** to paint. Every "blank, throws" observation came from
screenshotting at six or thirteen seconds.

What is now actually seen, with our live sandbox keys and a real cart:

- The modal opens with our line item and amount on the left.
- **`customer_phone` is prefilled.** The first screen reads *"Enter your mobile
  number"* with the number already filled and *"This helps us pre-fill your
  saved details"*. §6.2 works as designed.
- Continue moves to *"6-digit OTP sent to +91 …"*, offering resend **via SMS and
  WhatsApp**.

So §4.1 — that OCC is all-or-nothing and a signed-in customer must be OTP'd
twice — rests on a measurement that has been withdrawn. **Re-run the feature
bisect with a 30-second wait before treating it as a constraint.**

### 3.2 The full flow, proven end to end (29 August)

**The sandbox OTP is `111000`** — the same code their test-data page documents
for cards. It is not documented for the OCC login step, but it works there.
That unblocked everything below, which had never once run.

A real sandbox order, guest checkout from the storefront, paid through their
net-banking simulator:

| | |
| --- | --- |
| Order | CD-2026-00019, CONFIRMED / PAID |
| Account created from the phone Cashfree verified | `+91 8800573313`, no email, no password |
| Claim token | consumed, single use held |
| Address | `source: cashfree` — **their saved address for that number**, name and pincode included |
| `rawPayload` | stored: cart, offer, charges, billing_address, customer_details, shipping_address |
| Their `order_amount` vs ours | 1450 = 1450 |
| `charges` | `{shipping_charges: 0, cod_handling_charges: 0}` |

So §6.1 works exactly as designed: a stranger buys, and lands signed in on their
own order without ever seeing a registration form.

**Two things the payload changed:**

`customer_details.customer_phone` comes back as `"+91 8800573313"` — with a
space and the country code. `normaliseIndianPhone` strips non-digits and keeps
the last ten, so it survived; worth knowing before anyone simplifies it.

**The email and name come from the address, never from `customer_details`.**
A real payment returned:

| field | value |
| --- | --- |
| `customer_details.customer_email` | `test123@gmail.com` — Cashfree's placeholder |
| `customer_details.customer_name` | `Cashfree Customer` — also a placeholder |
| `shipping_address.email` | the customer's actual address |
| `shipping_address.name` | the customer's actual name |

`customer_details` is Cashfree's own record and is filled with defaults for a
guest, because we send no email for someone we have never met. The address block
is what the customer confirmed. Reading the obvious field would have written a
placeholder into a real account, so confirm takes both from
`shipping_address`, falling back to `billing_address`.

They are filled in only where the account has a gap — never overwritten. What a
customer has already told us outranks anything a gateway returns, and a checkout
address may be someone else's entirely (a gift, an office). The email is also
checked for uniqueness first: `User.email` is unique, so writing one that
belongs to another account would throw, and quietly claiming their address would
be worse than failing.

Note also that the lookup still keys on the **phone**. `resolveUserForIdentity`
matches on email first when it has one, and only the phone is verified here —
matching on an email could attach a stranger's order to whoever owns it.

**Q5 answered: verified end to end.** A re-run of confirm against the real paid
order produced an account with the phone, `deepak07chand@gmail.com` and `Neha` —
not the placeholders.

**Still unexercised: the totals rewrite (C1, C2).** `offer` was null because no
offer is configured in their dashboard, so their amount matched ours exactly and
the apportionment code never ran. Create a test offer before trusting it.

**Sandbox does not deliver the OTP.** The modal says it sent one; nothing
arrives, on SMS or WhatsApp, and a resend changes nothing. Their test-data page
documents `111000` for cards and `777777` for cardless EMI and no code at all
for this step, which is consistent with sandbox never sending. Everything past
this point — account creation, the address write, the totals rewrite — is
therefore still unexercised, and a live ₹1 order is the only way to reach it.

The sandbox merchant profile also has no business name or logo, so the modal
shows a placeholder "Business Name". A dashboard setting, not our integration.

---

## 4. Coupons are theirs now

We have a complete coupon system on the API — `Coupon` with percentage/fixed,
max discount, min order, usage limit, per-user limit and a date window, resolved
at `orders.service.ts:113` before the gateway order is created, with
`usageCount` incremented at line 207.

**The storefront has never had a coupon box.** The only mention of "coupon" in
`apps/web/src` is line 377 of the order detail page, displaying
`order.couponCode` after the fact. `couponCode` is never sent from the browser.
The API accepts it; nothing calls it. Coupons have never worked on the site.

**Decision: use Cashfree's Offers Engine**, managed at Payments → One Click
Checkout → Offers in their dashboard. Flat and percentage discounts, cashbacks,
BxGy, free gifts, bank/BIN offers, no-cost EMI, caps and per-customer limits,
auto-applied rather than typed in. More than we would ever build.

Our `Coupon` model and `resolveCoupon` become dead code. **Left in place, not
deleted** — removing them is not part of this work.

Two limits on confidence: `GET /pg/offers` returns 404 on our sandbox account,
so the Create/Get Offer API that marketing pages mention is not reachable at
that path, and dashboard management is the only route confirmed. And the offers
menu sits *under* One Click Checkout — bank/BIN offers surface on plain PG too,
but a merchant promo code needs OCC's cart UI.

### 4.1 This forces OCC on every order

Coupons live inside Cashfree's checkout UI, so we cannot skip that UI. Every
order goes through OCC, including for a customer who has already signed in with
our OTP. **They will be OTP'd again by Cashfree.** That is the price of the
offers engine, accepted deliberately.

Whether Cashfree remembers a returning browser and skips its own OTP is unknown,
and is one of the things the first real sandbox payment will show.

### 4.2 Their amount wins

An offer changes the amount *after* we have created the order. We create at
₹1650, Cashfree applies ₹200, the customer pays ₹1450 — and `charges` can add
shipping and COD handling on top, so the divergence goes both ways.

**Decision: `confirmCashfreeOrder` rewrites the order totals from the extended
response**, the way it already rewrites the shipping address. Cashfree's figure
is the one money moved on, so it is the one the invoice must show.

The fiddly part is GST. Our `gstRate` is per product, so a gateway-applied
discount has to be apportioned across line items before tax can be recomputed.
This is the part that will be wrong quietly if it is wrong, so it gets its own
tests with worked examples rather than a round-number happy path.

The existing `@money` spec asserts `payment.amount === order.totalAmount`. It
will fail once offers are live, and it is right to — it is catching exactly
this. It gets rewritten to assert against Cashfree's reported amount.

---

## 5. Identity

### 5.1 The rule

**The mobile number is the account.** Email is a contact detail, not a login.
Existing email-and-password accounts keep working, but new customers arrive by
phone and that is the path the site is designed around.

### 5.2 Where a phone can come from

| Source | Verified by |
| --- | --- |
| Navbar sign-in | our OTP |
| Checkout sign-in | our OTP |
| Guest checkout | **Cashfree's OTP**, confirmed server-side before we trust it |

We never create an account from a number somebody merely typed.

### 5.3 Collisions

`User.phone` is unique, so find-or-create has to decide what happens when a
guest's number already belongs to an account:

- **Phone matches an existing account** — attach the order to it. Do not create
  a second account, and do not sign the buyer in as that person unless the claim
  token in §6.3 says this browser placed the order.
- **Phone is new** — create the account, no password, no email unless Cashfree
  gave us one.
- **An email account exists with no phone** — leave it alone. Linking is the
  customer's to do from their account page, not ours to guess.

---

## 6. The flows

### 6.1 Guest buys

```
  browser                     our API                    Cashfree
     | add to cart (local)
     | Checkout
     |------------------------->| create Order (PENDING) for a guest
     |                          | POST /pg/orders + cart_details + OCC block
     |                          |------------------------------->|
     |<-- sessionId + claim ----|<---------- payment_session_id --|
     |
     | cashfree.checkout({ paymentSessionId })
     |------------------------------------------------------->|
     |      mobile -> OTP -> address -> offer applied -> pay   |
     |<---------------------------------- return_url + claim --|
     |
     |  POST /orders/confirm { claim }
     |------------------------->| verify order is PAID at Cashfree
     |                          | GET /orders/{id}/extended
     |                          | rewrite totals from amount + offer + charges
     |                          | write their address onto the order
     |                          | find-or-create user by phone
     |                          | store rawPayload
     |                          | issue our JWT
     |<---- order + session ----|
     |
     |  lands on /orders/{id}, signed in           WhatsApp: order confirmed
```

They never saw a registration form, and they have an account.

### 6.2 Signed-in customer

Identical, except we pass the phone we already verified so Cashfree prefills it,
and we pass the address we hold so their form starts filled. They still complete
Cashfree's OTP (§4.1).

### 6.3 The claim token

The guest confirm route cannot require a session — there isn't one yet. If it
took an order id instead, **anyone who guessed an order id would be handed a
session as that customer**, and our order numbers are sequential.

So checkout mints a token: random, single use, short lived, stored against the
order, returned to the browser and carried in `return_url`. `POST
/orders/confirm` takes the token, not the id.

### 6.4 Navbar sign-in

Phone → OTP → signed in. The email and password form stays for accounts that
already have one, below the phone field rather than beside it.

### 6.5 Order tracking

Signed in: `/account?tab=orders`. The list is `where: { userId }` with no status
filter (`orders.service.ts:811`) and the account page already renders `<Badge
status={order.paymentStatus} />`, so failed and pending orders show up with no
extra work.

From WhatsApp: the confirmation links to `/orders/{id}`, and an unsigned browser
is asked for the phone on the order and OTP'd. No public lookup by order number
— sequential ids make that enumerable.

### 6.6 When payment does not complete

- The order stays `PENDING`. Stock stays held.
- `Payment.failureReason` and `Payment.rawPayload` are written. **Both columns
  exist on the model today and nothing writes to either.**
- The return page polls `confirm` for a few seconds, then says *"we have not
  seen the payment yet"* — never *"failed"*. The webhook may still be coming.
- `PAYMENT_USER_DROPPED_WEBHOOK` records the attempt without failing the order.
- **A signed-in customer sees the failed order in their list** and can retry it.
- **A guest whose payment failed still gets an account.** Cashfree verified the
  phone before payment, so the number is trustworthy even though no money moved.
  They can sign in by OTP, see the failed order, and pay it.

**Decided and built: an abandoned checkout releases its stock after an hour.**

Every checkout decrements stock inside the transaction that creates the order,
so two customers cannot both take the last jar — and nothing ever put it back.
A single run of nine test scenarios left twenty orders holding stock, which on a
live shop is inventory reserved against orders nobody will ever pay for.

`expireAbandonedOrders` sweeps them, and **asks Cashfree before releasing
anything.** A PENDING order is not proof of abandonment: the customer may have
paid while the browser closed or the webhook went astray. One that turns out to
be paid is settled rather than cancelled, which makes the sweep the
reconciliation pass as well.

**A failed payment is included, and is the easier one to miss.** A decline sets
`paymentStatus: FAILED` and deliberately leaves the order PENDING so the
customer can retry — cancelling immediately would release stock they are about
to buy back. But nothing released it afterwards either, so a sweep looking only
at PENDING payments would hold those jars for ever. Both states are swept; only
the cancellation reason differs.

**Still needs a trigger.** There is no scheduler in the application, and the
free Render plan sleeps after fifteen minutes idle, so an in-process cron would
not fire dependably. `POST /orders/admin/expire-abandoned` is staff-guarded and
safe to call repeatedly; a Render cron job, a GitHub Action or any uptime pinger
can drive it.

### 6.7 The race

The browser's return and the webhook both settle the order, and either may land
first. Both go through the same guard — if `paymentStatus` is already `PAID`, do
nothing. Proven for the webhook path; the confirm path has the same check.

### 6.8 There is no checkout page

Clicking Checkout opens Cashfree. Nothing of ours sits in between, because
nothing our page collected was needed before payment:

| What it collected | Why it can go |
| --- | --- |
| Address | Cashfree collects it and returns it on `/extended` |
| Coupon | Never had a box (§4); offers are Cashfree's now |
| Delivery charge | `calculateDeliveryCharge(subtotal)` — free over ₹500, else ₹40. Subtotal only; never reads the pincode |
| `deliveryType` | Not a customer choice. See below |

`deliveryType` is `LOCAL | COURIER` — our own van or a courier. It is a
fulfilment routing flag the desk sets, already optional with a `LOCAL` default
at `orders.controller.ts:94`, already reassignable through
`setDeliveryTypeAdmin`. The code has said so all along
(`orders.service.ts:1012`): *"Nothing decides this at checkout — the storefront
cannot know whether an address is inside the van's area — so the desk decides
per order."*

**And there is no serviceability check anywhere.** An earlier draft claimed it
ran before payment against a known pincode. It does not exist. Pincode is read
only in `delivery.service.ts` to group route sheets for a delivery day, after
the order exists. Nothing has ever blocked an order by location.

So the only thing the page still supplies is `addressId`, which has to become
optional for guest checkout regardless — B8.

### 6.9 Shipping must be charged once, by one of us

We compute ₹40 under ₹500 and bake it into the `order_amount` we send. Cashfree
also has `charges.shipping_charges` and shipping profiles in their dashboard.
Both configured means the customer pays shipping twice.

**Decision: keep ours, configure no shipping profile in Cashfree.** The rule
already exists and is one line. If that ever changes, it changes in one place,
not two.

---

## 7. Notifications

### 7.1 There are none today

No mailer, no SMS, no WhatsApp send anywhere in the API. The "Order on WhatsApp"
link is a `wa.me` the customer taps; it sends from their phone. `whatsappOptIn`
is a preference with nothing behind it.

**So nobody currently receives an order confirmation.** A launch blocker
independent of everything else here.

### 7.2 WhatsApp first, and why that reverses an earlier recommendation

Meta moved to per-message pricing in July 2025. For India:

| Category | Rate |
| --- | --- |
| Authentication (OTP) | ₹0.115 – 0.13 |
| Utility (order updates) | ₹0.115 – 0.13 |
| Marketing | ₹0.86 |
| Replies within a 24-hour service window | free |

**Shipping updates are utility messages, and they cost.** A dispatch or
delivery notification is business-initiated, so it is a paid utility template at
₹0.115–0.13, not free. Only replies inside 24 hours of the *customer* messaging
us are free. Small money at our volumes, but it is not zero.

WhatsApp OTP is **cheaper than SMS** (MSG91 ≈ ₹0.15) and needs **no DLT
registration**. An earlier note in this project said WhatsApp was three to four
times SMS; that was wrong and is corrected here.

### 7.3 What WhatsApp needs

1. Meta Business Manager, business verified — GST certificate and incorporation
   documents.
2. **A phone number not in use on the consumer WhatsApp app.** The footer's
   +91 99978 01112 is almost certainly on a handset today. Moving it to the API
   means losing the app on that number, so a second number is usually right.
3. Cloud API direct, or a BSP (AiSensy, Interakt, Gupshup, MSG91).
4. Template approval — free, hours.
5. A webhook for delivery receipts and inbound messages.

### 7.3a Why not SMS first

SMS looks like the cheaper, simpler start. It is neither.

| | WhatsApp Cloud API | SMS (MSG91) |
| --- | --- | --- |
| Per OTP | ₹0.115 – 0.13 | ₹0.15 |
| Setup cost | ₹0 | **~₹11,800** DLT |
| Setup time | Business verification | DLT approval after paperwork |
| Failure mode | Template rejected loudly | **Blocked silently** on a byte mismatch |

The code for SMS is one HTTP POST, so it *reads* easier. DLT is the real gate,
and a template differing by one character is dropped by the operator with no
error — a horrible thing to debug during a launch.

The decisive argument is that WhatsApp is needed for shipping updates anyway.
SMS first means building two integrations and paying ₹11,800 for the worse one.

SMS keeps one genuine advantage — it reaches a phone without the app — so it
stays on the list as a fallback, below.

### 7.3b Configuration

Unset, the API falls back to the log channel: it prints codes in development
and **refuses to send in production** rather than returning success while
sending nothing. A sign-in that silently posts no message strands every
customer at the code screen with nothing in any log.

| Variable | Default |
| --- | --- |
| `WHATSAPP_PHONE_NUMBER_ID` | — |
| `WHATSAPP_ACCESS_TOKEN` | — |
| `WHATSAPP_OTP_TEMPLATE` | `otp_login` |
| `WHATSAPP_OTP_LANGUAGE` | `en` |
| `WHATSAPP_API_VERSION` | `v21.0` |
| `OTP_DAILY_LIMIT` | `500` |
| `OTP_DEV_CODE` | unset — **see below** |

`OTP_DEV_CODE` fixes the sign-in code so the flow can be walked before a message
channel exists. It is a master key to every account on the site, so it is
guarded rather than merely discouraged: the API **refuses to boot** with it set
alongside `CASHFREE_ENV=production`, warns at startup, and warns on every code
it issues. Unset it and real random codes resume with no other change.

### 7.4 SMS, later

Fallback for customers who do not receive WhatsApp. MSG91 ≈ ₹0.15, plus **DLT
registration**: Principal Entity ≈ ₹5,900, header ≈ ₹5,900, 24–48 hours, and
every template registered byte-exact or the operator blocks it silently. Worth
doing once volume justifies it, not before launch.

### 7.5 Messages to write

| When | Category |
| --- | --- |
| Sign-in code | authentication |
| Order confirmed, with the batch link | utility |
| Dispatched, with tracking | utility |
| Delivered | utility |
| Payment failed, with a way back | utility |

---

## 8. Tasks

C1–C8 from the superseded doc are done.

### Phase A — identity

| # | Task | Done when |
| --- | --- | --- |
| A1 | WhatsApp Business onboarding: number, verification, templates | A test OTP arrives on a real phone |
| A2 | ~~Send channel behind an interface, WhatsApp first~~ **done** | Boots as `Message channel: log`; `sendOtp` dispatches through it |
| A3 | ~~**Rate limit by IP and a daily ceiling**~~ **done** | Proven live: 6th send to one phone and 11th from one IP both refused |
| A4 | Navbar sign-in becomes phone-first | Email form still present for existing accounts |
| A5 | `ENABLE_OTP_LOGIN` on | Flag has a row and the console can switch it |

### Phase B — checkout

| # | Task | Done when |
| --- | --- | --- |
| B1 | Claim token minted at checkout, carried in `return_url` | Single use, short lived |
| B2 | Guest `POST /orders/confirm` takes the token, not the id | Spec: a guessed order id gets nothing |
| B3 | Order creatable without a signed-in user | `Order.userId` nullable, or a pre-created guest row |
| B4 | Find-or-create by phone, collision rules from §5.3 | Spec covers all three cases |
| B5 | Auto sign-in on confirm | Guest lands on their order, signed in |
| B6 | Prefill phone and address for signed-in customers | Their Cashfree form starts filled |
| B7 | **Our checkout page removed** — Checkout opens Cashfree directly | §6.8 |
| B8 | `addressId` optional on `POST /orders/checkout` | Guest and signed-in both create orders without one |

### Phase C — money

| # | Task | Done when |
| --- | --- | --- |
| C1 | **Rewrite order totals from the extended response** | `totalAmount` matches what Cashfree charged |
| C2 | **Apportion a gateway discount across line items, recompute GST** | Worked examples in tests, not round numbers |
| C3 | Apply `charges.shipping_charges` and `cod_handling_charges` | Order total reconciles to the paisa |
| C4 | Persist `offer` on the order | Admin can see which offer applied |
| C5 | Write `rawPayload` and `failureReason` | Both columns stop being empty |
| C6 | Rewrite the `@money` spec against Cashfree's amount | Green with an offer applied |
| C7 | Create one test offer in their dashboard | An end-to-end discounted order reconciles |

### Phase D — notifications

| # | Task | Done when |
| --- | --- | --- |
| D1 | Order confirmed message | Arrives with the batch link |
| D2 | Dispatched and delivered messages | Fire from the status change |
| D3 | Payment failed message with a way back | Arrives once, not per retry |

### Phase E — launch

| # | Task | Done when |
| --- | --- | --- |
| ~~E1~~ | ~~Stock release for abandoned orders~~ **done** | Sweep asks the gateway first, then releases; 8 specs |
| ~~E2~~ | ~~Reconciliation for orders never confirmed~~ **done** — same sweep | A paid-but-unconfirmed order is settled, not cancelled |
| E2b | **Schedule the sweep.** No scheduler exists and the free Render plan sleeps after 15 minutes idle, so it needs an external ping | Stock frees itself without a person |
| E3 | Refunds — and what a refund means with an offer applied | Admin can trigger one |
| E4 | COD, if taken | Order settles with no money through the gateway |
| E6 | Live credentials, production guard honoured | Mock mode cannot start in production |
| E7 | Full suite, real sandbox payment, `next build` | Green |

---

## 9. Open questions

| # | Question | Blocks |
| --- | --- | --- |
| Q1 | **What does One Click Checkout cost?** Published nowhere — not the pricing page, the charges page, or the FAQs | Commercial go/no-go |
| Q2 | Does the 0% GMV offer apply to OCC, or only plain PG? | Same |
| Q3 | Is there a fee on the Offers Engine, or on discounted orders? | Same |
| Q4 | Does `order_amount` on the extended response change when an offer applies, or does the discount only appear under `offer`? | C1, C2 |
| ~~Q5~~ | ~~Does Cashfree re-OTP a returning browser?~~ **answered: it remembers.** A second checkout from the same browser skipped mobile and OTP entirely and opened on the saved address | — |
| Q5b | Is the coupon field on Cashfree's payment screen or its login screen? If payment, skipping their OTP for a signed-in customer becomes free again | Whether §4.1 can be reversed |
| Q6 | Is the Create/Get Offer API available on our account? `GET /pg/offers` is 404 | Whether offers can ever be scripted |
| ~~Q6b~~ | ~~Sandbox OTP for the OCC login step~~ **answered: `111000`**, undocumented for this step but it works | — |
| Q6d | **Is One Click Checkout activated in Production?** The dashboard shows Request Activation there and `one-click-checkout-activated` only in Test | Launch |
| Q6e | Should we keep the `customer_email` OCC returns? We discard it today | Whether email is ever a contact channel |
| Q7 | What is charged on a COD order, where no money moves? | E4 |
| Q8 | Refund and chargeback fees, and refunding a discounted order | E3 |
| Q9 | Which WhatsApp number, and does it move off the consumer app? | A1 |
| Q10 | Shiprocket: checkout retired entirely, or kept for logistics? | 1,324 lines and three `externalId` columns |

**Q1 is still the one that matters.** Open since the first draft of the
superseded doc, published nowhere. Shiprocket's per-order pricing was never
answered either, and that integration was built anyway.

---

## 9a. How numbers are issued

Order and invoice numbers used to come from `max(...) + 1` over surviving rows.
Three faults, one of which cost a real payment:

- **Deleting an order freed its number.** Cashfree's ids are permanent, so the
  reissued number came back `409 order_already_exists` and the customer could
  not pay, for a reason nothing on our side would have explained.
- **Two simultaneous checkouts read the same maximum.** The unique index kept
  the data sound, so one customer simply got a 500 and lost their basket, at
  random, under load.
- **It broke permanently at 100,000.** The maximum was found with a *text* sort,
  and `CD-2026-99999` sorts above `CD-2026-100000` — so past 99,999 the query
  returns 99999 for ever and every order collides.

Speed was never the problem: the old query was an index-only scan measured at
0.05 ms and would not have degraded.

**One table, `NumberSeries`, keyed `<series>:<period>`** — `order:2026`,
`invoice:CD/2026-27`. A new series needs a key, not a migration. The increment
is a single `INSERT … ON CONFLICT DO UPDATE … RETURNING`, so there is no window
between reading and writing.

**Two allocation policies, because the two callers need different things:**

| | Orders | Invoices |
| --- | --- | --- |
| Allocated | in its own transaction, committed at once | inside the caller's transaction |
| Lock held | microseconds | until the dispatch commits |
| Gaps | possible, and harmless | impossible — GST requires consecutive |
| Concurrency | checkouts never queue on numbering | dispatches serialise, deliberately |

An abandoned checkout leaves a hole in the order numbering and that costs
nothing. A dispatch that fails after taking an invoice number must give it back,
so that one alone holds the lock.

**Formats changed.** Order numbers lost their zero padding — its only real job
was making a text sort agree with a numeric one, which is the thing that broke.
`CD-2026-21` is also shorter to read out over WhatsApp, which the format exists
for. Invoice numbers keep padding: an auditor reads those, and fixed width is
conventional.

**And they are dated in India.** Render runs UTC, so `getFullYear()` disagreed
with the shop for the first five and a half hours of every year. On 1 April that
is a GST problem — an invoice issued at 02:00 IST would have been filed against
the previous financial year.

**Found while testing this, and not caused by it:** eight simultaneous checkouts
for the same variant exceeded Prisma's 5-second transaction timeout, because the
transaction takes a row lock on the variant and then makes three more round
trips to Singapore. Given headroom for now; the real fix is fewer statements
inside that lock.

---

## 10. Guardrails

1. **No secret in the repo.** `render.yaml` uses `sync: false`.
2. **Verify against the raw body.** Cashfree signs `timestamp + rawBody`.
3. **Mock mode must never start in production.**
4. **Settle exactly once.** The return trip and the webhook race.
5. **Never trust a phone we did not verify**, or one Cashfree has not confirmed
   to us server-side.
6. **Never issue a session from a guessable identifier.** §6.3 exists because
   order numbers are sequential.
7. **Read the field names from a live response, not from memory.** Three
   silent-drop bugs on this project so far.
8. **An OTP endpoint spends real money.** Rate limit it like it does.
9. **Cashfree's amount is the invoice amount.** Ours is a quote until they
   confirm it.
