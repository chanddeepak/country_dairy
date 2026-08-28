# Checkout and identity — the plan

Supersedes `docs/cashfree-integration.md`, which planned a payment gateway.
What is actually being built is larger than that: **the mobile number becomes
the identity for the whole site**, Cashfree takes the payment, and WhatsApp
carries everything we say to a customer afterwards.

Source of truth. If the code and this document disagree, one of them is a bug.

---

## 1. The shape, in one paragraph

A customer is a **mobile number**. They sign in with an OTP we send. At
checkout, if we already know them, Cashfree opens straight on payment because
we hand over the phone we have already verified. If we do not know them, they
buy as a guest and Cashfree's One Click Checkout does the OTP, the address and
the payment — then we create their account from the number Cashfree confirms,
sign them in, and they are on their order page without ever filling a
registration form. Everything after that — order confirmed, dispatched,
delivered — arrives on WhatsApp.

Nobody logs in twice. Nobody types an address twice. Nobody creates an account
on purpose.

---

## 2. What is already built and proven

Five commits, all on `dev`, all verified against the Cashfree sandbox rather
than inferred:

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

## 3. Four things sandbox taught us that no document says

**One Click Checkout cannot collect an address without doing the login.**
Sending `checkoutAuthenticate` alone renders a blank panel and throws
`RangeError: Invalid currency code :` from inside Cashfree's own bundle.
Bisected against three otherwise identical orders:

| features sent | result |
| --- | --- |
| `checkoutCollectAddress` + `checkoutAuthenticate` | renders |
| `checkoutCollectAddress` alone | blank, throws |
| `checkoutAuthenticate` alone | blank, throws |
| no `products` block at all | **straight to payment options** |

So OCC is all-or-nothing, and the last row is the important one.

**Omitting the OCC block gives a logged-in customer a one-step checkout.** With
`customer_phone` set and no `products` block, their modal opens on *"Payment
Options for +91 98765 43210"* — UPI QR, wallets, cards, netbanking. No login
step, no address step. This is the whole reason a returning customer never sees
a second OTP.

**Their address fields are not what a reasonable person would guess.**
`address_line_one`, `address_line_two`, `pin_code` — not `address1`,
`address2`, `pincode`. The guess type-checked and read `undefined` from every
field, silently keeping our address instead of the customer's. Fixed in
`47476e8`. Third time on this project a plausible field name has compiled green
and been dropped at runtime.

**Order numbers cannot be their order id.** `generateOrderNumber` is
`max(orderNumber) + 1` over surviving rows, so deleting an order frees its
number; Cashfree ids are permanent and answer a reuse with `409
order_already_exists`. Their id is now `CD-2026-00009-0bd64070`.

---

## 4. Identity

### 4.1 The rule

**The mobile number is the account.** Email is a contact detail, not a login.
Existing email-and-password accounts keep working — nothing is taken away — but
new customers arrive by phone and that is the path the site is designed around.

### 4.2 Where a phone can come from

| Source | Verified by |
| --- | --- |
| Navbar sign-in | our OTP |
| Checkout sign-in | our OTP |
| Guest checkout | **Cashfree's OTP**, confirmed server-side before we trust it |

In every case the number is verified before it becomes an account. We never
create an account from a number somebody merely typed.

### 4.3 Collisions

`User.phone` is unique, so find-or-create has to decide what happens when a
guest's number already belongs to an account:

- **Phone matches an existing account** — attach the order to it. Do not create
  a second account, and do not sign the buyer in as that person unless the
  claim token in §5.2 says this browser placed the order.
- **Phone is new** — create the account, no password, no email unless Cashfree
  gave us one.
- **An email account exists with no phone** — leave it alone. Linking is the
  customer's to do from their account page, not ours to guess.

---

## 5. The flows

### 5.1 Guest buys — the headline flow

```
  browser                     our API                    Cashfree
     | add to cart (local)
     | Checkout
     |------------------------->| create Order (PENDING) for a guest
     |                          | POST /pg/orders  + cart_details + OCC block
     |                          |------------------------------->|
     |<-- sessionId + claim ----|<---------- payment_session_id --|
     |
     | cashfree.checkout({ paymentSessionId })
     |------------------------------------------------------->|
     |            mobile -> OTP -> address -> payment          |
     |<---------------------------------- return_url + claim --|
     |
     |  POST /orders/confirm { claim }
     |------------------------->| verify order is PAID at Cashfree
     |                          | GET /orders/{id}/extended
     |                          | find-or-create user by phone
     |                          | write their address onto the order
     |                          | issue our JWT
     |<---- order + session ----|
     |
     |  lands on /orders/{id}, signed in           WhatsApp: order confirmed
```

They never saw a registration form, and they have an account.

### 5.2 The claim token

The guest confirm route cannot require a session — there isn't one yet. If it
took an order id instead, **anyone who guessed an order id would be handed a
session as that customer**, and our order numbers are sequential.

So checkout mints a token: random, single use, short lived, stored against the
order, returned to the browser and carried in `return_url`. `POST
/orders/confirm` takes the token, not the id. Presenting it proves this browser
is the one that placed the order.

### 5.3 Returning customer, already signed in

```
  Checkout -> we have their phone and address
           -> create order, POST /pg/orders WITHOUT the OCC block
           -> modal opens on payment options
           -> pay -> confirm -> done
```

One tap from cart to payment. No OTP, no address, because we already have both.

### 5.4 Returning customer, signed out

The checkout offers "sign in with your mobile" before paying. Signing in turns
this into §5.3. Declining turns it into §5.1 — and if the phone they give
Cashfree matches their existing account, the order lands there anyway.

### 5.5 Navbar sign-in

Phone → OTP → signed in. The email and password form stays for accounts that
already have one, below the phone field rather than beside it.

### 5.6 Order tracking

Signed in: `/account?tab=orders`, as now. From WhatsApp: the confirmation
carries a link to `/orders/{id}`, and if the browser is not signed in it asks
for the phone on the order and OTPs it. No public lookup by order number —
sequential ids make that enumerable.

### 5.7 When payment does not complete

Abandoned at the modal, or a failed card:

- The order stays `PENDING`. Stock stays held.
- The return page polls `confirm` for a few seconds, then says *"we have not
  seen the payment yet"* — never *"failed"*. The webhook may still be coming.
- `PAYMENT_USER_DROPPED_WEBHOOK` records the attempt without failing the order.
- Reconciliation (C11) sweeps orders left PENDING and asks Cashfree.

**Not yet decided: when a PENDING order releases its stock.** Today it never
does, so an abandoned checkout holds a jar for ever.

### 5.8 The race

The browser's return and the webhook both settle the order, and either may land
first. Both go through the same guard — if `paymentStatus` is already `PAID`,
do nothing. Proven for the webhook path; the confirm path has the same check.

---

## 6. Notifications

### 6.1 There are none today

No mailer, no SMS, no WhatsApp send anywhere in the API. The "Order on
WhatsApp" link is a `wa.me` the customer taps; it sends from their phone.
`whatsappOptIn` is a preference with nothing behind it.

**So nobody currently receives an order confirmation.** That is a launch
blocker independent of everything else here.

### 6.2 WhatsApp first, and why that reverses an earlier recommendation

Meta moved to per-message pricing in July 2025. For India:

| Category | Rate |
| --- | --- |
| Authentication (OTP) | ₹0.115 – 0.13 |
| Utility (order updates) | ₹0.115 – 0.13 |
| Marketing | ₹0.86 |
| Replies within a 24-hour service window | free |

WhatsApp OTP is **cheaper than SMS** (MSG91 ≈ ₹0.15) and needs **no DLT
registration**. An earlier note in this project said WhatsApp was three to four
times SMS; that was wrong and is corrected here.

It is also the better channel for this brand: customers already message the
WhatsApp ordering number, a confirmation can carry the jar photograph and a
batch link, and any conversation they start makes our replies free for 24 hours.

### 6.3 What WhatsApp needs

1. Meta Business Manager, business verified — GST certificate and incorporation
   documents.
2. **A phone number not in use on the consumer WhatsApp app.** The footer's
   +91 99978 01112 is almost certainly on a handset today. Moving it to the API
   means losing the app on that number, so a second number is usually right.
3. Cloud API direct, or a BSP (AiSensy, Interakt, Gupshup, MSG91). A BSP costs a
   markup and gives the team an inbox.
4. Template approval — free, hours. Authentication templates are
   format-constrained; utility templates are freer.
5. A webhook for delivery receipts and inbound messages.

### 6.4 SMS, later

As a fallback for customers who do not receive WhatsApp. MSG91 ≈ ₹0.15, plus
**DLT registration**: Principal Entity ≈ ₹5,900, header ≈ ₹5,900, 24–48 hours,
and every template registered byte-exact or the operator blocks the message
silently. Worth doing once volume justifies it, not before launch.

### 6.5 Messages to write

| When | Category |
| --- | --- |
| Sign-in code | authentication |
| Order confirmed, with the batch link | utility |
| Dispatched, with tracking | utility |
| Delivered | utility |
| Payment failed, with a way back | utility |

---

## 7. Tasks

Carried over from `cashfree-integration.md`: C1–C5 are **done**. C6 and C7 are
done as part of C5. C8 is done. C9, C10, C11, C12, C13, C14, C15 remain and are
renumbered below.

### Phase A — identity

| # | Task | Done when |
| --- | --- | --- |
| A1 | WhatsApp Business onboarding: number, verification, templates | A test OTP arrives on a real phone |
| A2 | Send channel behind an interface, WhatsApp first | `sendOtp` actually sends |
| A3 | **Rate limit by IP and a daily ceiling** | An attacker cycling numbers cannot burn credit |
| A4 | Navbar sign-in becomes phone-first | Email form still present for existing accounts |
| A5 | `ENABLE_OTP_LOGIN` on | Flag has a row and the console can switch it |

### Phase B — guest checkout

| # | Task | Done when |
| --- | --- | --- |
| B1 | Claim token minted at checkout, carried in `return_url` | Token is single use and short lived |
| B2 | Guest `POST /orders/confirm` takes the token, not the id | Spec: a guessed order id gets nothing |
| B3 | Order creatable without a signed-in user | `Order.userId` nullable, or a pre-created guest row |
| B4 | Find-or-create by phone, collision rules from §4.3 | Spec covers all three cases |
| B5 | Auto sign-in on confirm | Guest lands on their order, signed in |
| B6 | Our address step hidden when OCC will collect it | No double entry |

### Phase C — notifications

| # | Task | Done when |
| --- | --- | --- |
| C1 | Order confirmed message | Arrives with the batch link |
| C2 | Dispatched and delivered messages | Fire from the status change |
| C3 | Payment failed message with a way back | Arrives once, not per retry |

### Phase D — launch

| # | Task | Done when |
| --- | --- | --- |
| D1 | Stock release for abandoned orders | §5.7, decided and implemented |
| D2 | Reconciliation for orders never confirmed | A job finds them and asks Cashfree |
| D3 | Refunds | Confirmed against their API, admin can trigger one |
| D4 | COD, if taken | Order settles with no money through the gateway |
| D5 | Serviceability | Pincode blocking at Cashfree, or a refund path |
| D6 | Live credentials, production guard honoured | Mock mode cannot start in production |
| D7 | Full suite, real sandbox payment, `next build` | Green |

---

## 8. Open questions

| # | Question | Blocks |
| --- | --- | --- |
| Q1 | **What does One Click Checkout cost?** Published nowhere — not the pricing page, the charges page, or the FAQs | Commercial go/no-go |
| Q2 | Does the 0% GMV offer apply to OCC, or only plain PG? | Same |
| Q3 | What is charged on a COD order, where no money moves? | D4 |
| Q4 | Refund and chargeback fees | D3 |
| Q5 | Does OCC return an email, or only echo ours? | Whether email is ever a contact channel |
| Q6 | Which WhatsApp number, and does it move off the consumer app? | A1 |
| Q7 | Does Country Dairy already hold a DLT Principal Entity id? | 6.4, if SMS is ever added |
| Q8 | Shiprocket: checkout retired entirely, or kept for logistics? | 1,324 lines and three `externalId` columns |

**Q1 is still the one that matters.** It has been open since the first version
of this plan. Shiprocket's per-order pricing was never answered either, and that
integration was built anyway.

---

## 9. Guardrails

1. **No secret in the repo.** `render.yaml` uses `sync: false`.
2. **Verify against the raw body.** Cashfree signs `timestamp + rawBody`.
3. **Mock mode must never start in production.**
4. **Settle exactly once.** The return trip and the webhook race.
5. **Never trust a phone we did not verify**, or one Cashfree has not confirmed
   to us server-side.
6. **Never issue a session from a guessable identifier.** §5.2 exists because
   order numbers are sequential.
7. **Read the field names from their reference, not from memory.** Three
   silent-drop bugs on this project so far.
8. **An OTP endpoint spends real money.** Rate limit it like it does.
