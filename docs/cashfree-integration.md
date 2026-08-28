# Cashfree One Click Checkout — the plan

> **Superseded by `docs/checkout-and-identity.md`.**
>
> This document planned a payment gateway. What is being built turned out to be
> larger: the mobile number becomes the identity for the whole site, and
> WhatsApp carries everything we say to a customer afterwards.
>
> Kept because sections 2, 3 and 11 are still accurate and worth reading — the
> comparison against Shiprocket, what we build against, and the guardrails. The
> tasks and the address question in section 4 are answered elsewhere: One Click
> Checkout cannot collect an address without doing the login, so the choice
> section 4 poses does not exist.

**Scope: web only.** Mobile is deferred — see section 9.

---

## 1. Where we actually are

Worth stating plainly, because it changes what this job is:

**There is no working online payment on the site today.** The API has a real
Razorpay path in `apps/api/src/orders/razorpay.service.ts`, but the browser
never opens a real gateway. `apps/web/src/app/checkout/page.tsx` sets
`showMockRazorpay` and renders a modal we drew ourselves. There is no
`checkout.js`, no `window.Razorpay`, nothing.

So this is not a migration away from something that works. It is building the
first real payment flow, and Cashfree is a choice rather than a replacement.

What does exist and is sound:

| | |
| --- | --- |
| `POST /orders/checkout` | Creates the order, prices it, returns a gateway order id |
| `POST /orders/verify-payment` | Verifies a signature and settles the order |
| `POST /orders/webhook/razorpay` | Async confirmation |
| `Payment` model | `provider`, `gatewayOrderId`, `gatewayPaymentId`, `gatewaySignature`, `rawPayload` — already provider-agnostic |
| `Order.shippingAddress Json` | The authoritative destination, snapshotted so editing a saved address cannot rewrite past orders |

That last row is the reason this integration is not painful. See section 4.

---

## 2. Why Cashfree, measured against Shiprocket

The Shiprocket integration is 1,324 lines across 11 files, and most of it exists
to serve *them*: a Shopify-shaped catalogue at `/api/shiprocket/products`,
`/collections` and `/collection-products`, HMAC-signed on every request. Our own
handover doc calls that "the larger half of the work". It also added three
`externalId BigInt` columns to `Product`, `ProductVariant` and `Category`,
purely because their team required ids of type `long`.

**Cashfree needs none of that.** The cart travels inline on the create-order
call:

```jsonc
"cart_details": {
  "cart_items": [{
    "item_id": "cd-ghee-1l",            // a plain string, no id-type constraint
    "item_name": "A2 Desi Ghee, 1 Litre",
    "item_original_unit_price": 1650,
    "item_discounted_unit_price": 1450,
    "item_quantity": 1,
    "item_currency": "INR"
  }]
},
"products": {
  "one_click_checkout": {
    "enabled": true,
    "conditions": [{ "action": "ALLOW", "key": "features",
      "values": ["checkoutCollectAddress", "checkoutAuthenticate"] }]
  }
}
```

No feed to serve. No inbound endpoints for them to call. No stable-long-id
requirement.

**And Cashfree is the gateway.** OCC sits on their own PG — their docs are
explicit that "you must have an existing Cashfree web or app checkout
integration before enabling OCC". One integration gets the checkout experience
and the money. Settlement is ours, in 24–48h, and we are the merchant of
record — which is still open question #2 on the Shiprocket doc and has never
been answered.

---

## 3. What we build against

| Layer | Package | Notes |
| --- | --- | --- |
| API | `cashfree-pg` | Official Node SDK, TypeScript, ships `PGVerifyWebhookSignature()` |
| Web | `@cashfreepayments/cashfree-js` | `load({mode})` then `cashfree.checkout({ paymentSessionId, redirectTarget })` |

Base URLs: `https://sandbox.cashfree.com/pg` and `https://api.cashfree.com/pg`.
Auth headers: `x-client-id`, `x-client-secret`, `x-api-version: 2023-08-01`.

The SDK shipping a webhook verifier matters. On Shiprocket I hand-rolled the
HMAC and got the raw-body detail wrong the first time; a signature over a
re-serialised object fails silently and intermittently, because two
`JSON.stringify` calls can order keys differently.

**Unverified, and to be checked against sandbox before designing around it:**
the Node SDK's README documents `PGCreateOrder` and `PGFetchOrder` but does not
confirm the OCC fields or the **Get Order Extended** endpoint. They are probably
pass-through, and Get Order Extended may simply not be wrapped. "Probably" is
how `variant_id` went out with the wrong type to Shiprocket twice.

---

## 4. The one real decision: which way the address flows

`POST /orders/checkout` today requires `addressId` — a UUID for an address we
already hold. OCC collects the address *inside* Cashfree and returns it after
payment. The two models point in opposite directions.

**Option A — let Cashfree collect it.** Enable `checkoutCollectAddress`. The
customer types nothing they have typed before, which is the entire point of the
product. Our order is created before we know where it ships.

**Option B — keep our address step.** Do not enable the feature. Small change,
but we are then paying for a one-click checkout and not using it.

**Recommendation: A**, and the model already accommodates it. `Order.addressId`
is nullable and `Order.shippingAddress` is a JSON snapshot rather than a
foreign key, so an order can exist before its destination is known and be
filled in afterwards without touching the schema.

This also matches the decision already taken for Shiprocket: *"Lets have orders
entry in our table. Once shiprocket gives us back the response the status from
shiprocket... If nothing came from shiprocket we have a entry that is not
processed by shiprocket."* Same shape here — the row exists first, the gateway
confirms it second, and a reconciliation pass catches whatever never confirmed.

**What A costs us**, stated honestly: serviceability and delivery-type logic
currently runs before payment against a known pincode. Under A it runs after.
Either we accept an order we cannot deliver and refund it, or we constrain
Cashfree with pincode blocking, which OCC supports. That needs deciding before
T5.

---

## 5. The flow, end to end

```
browser                    our API                     Cashfree
   |  POST /orders/checkout   |
   |------------------------->|
   |                          | create Order (PENDING, no address yet)
   |                          | POST /pg/orders  { cart_details, products.occ }
   |                          |--------------------------->|
   |                          |<--- payment_session_id ----|
   |<-- { orderId, sessionId }|
   |
   | cashfree.checkout({ paymentSessionId })
   |----------------------------------------------------->|
   |                    customer logs in, picks address, pays
   |<----------------------------------- return_url ------|
   |  POST /orders/confirm    |
   |------------------------->| GET /pg/orders/{id}/extended
   |                          |--------------------------->|
   |                          |<-- address, payment, offers|
   |                          | fill shippingAddress, mark PAID
   |<------ order ------------|

        and independently, the safety net:
                              |<--- POST /orders/webhook/cashfree
                              | verify sig, settle if not already settled
```

Two things settle the order: the return trip and the webhook. Whichever lands
first wins, and the second must be a no-op. Idempotency is on
`Payment.gatewayOrderId`, which is already indexed and unique-ish by usage.

---

## 6. What changes, file by file

| File | Change |
| --- | --- |
| `packages/database/prisma/schema.prisma` | `CASHFREE` added to `PaymentProvider`. Migration. |
| `apps/api/src/orders/cashfree.service.ts` | **New.** Mirrors `razorpay.service.ts`: create order, fetch extended, verify webhook. Reuses its `safeEqual`. |
| `apps/api/src/orders/orders.service.ts` | `checkout()` takes an optional `addressId`; builds `cart_details` from the cart |
| `apps/api/src/orders/dto/orders.dto.ts` | `CheckoutDto.addressId` becomes optional; new `ConfirmOrderDto` |
| `apps/api/src/orders/orders.controller.ts` | `POST /orders/confirm` replaces `verify-payment` for Cashfree |
| `apps/api/src/orders/webhook.controller.ts` | `POST /orders/webhook/cashfree` beside the Razorpay one |
| `apps/api/src/config/env.ts` | `CASHFREE_CLIENT_ID`, `CASHFREE_CLIENT_SECRET`, `CASHFREE_ENV` |
| `apps/web/src/app/checkout/page.tsx` | Mock modal out, `cashfree.checkout()` in |
| `apps/web/src/context/AppContext.tsx` | `verifyPayment` → `confirmOrder` |
| `render.yaml` | Two more `sync: false` secrets |

`razorpay.service.ts` stays for now. It is 178 lines, it is not in anyone's way,
and deleting a payment path in the same change that adds one is how you end up
with neither.

---

## 7. Tasks

### Phase 1 — prove the gateway, no OCC

| # | Task | Done when |
| --- | --- | --- |
| C1 | Sandbox credentials into Render as `sync: false` | API starts, no secret in the repo |
| C2 | `CASHFREE` on `PaymentProvider` + migration | `prisma migrate` clean on dev |
| C3 | `CashfreeService`: create order, fetch order | API spec creates a sandbox order and reads it back |
| C4 | Webhook route + signature verification | Spec: a tampered body is rejected, a real one settles once |
| C5 | Web: real `cashfree.checkout()`, mock modal deleted | A sandbox card completes an order end to end |

At the end of Phase 1 the site can take a real payment. That alone is further
than we are today.

### Phase 2 — turn on One Click Checkout

| # | Task | Done when |
| --- | --- | --- |
| C6 | `cart_details` built from the real cart | Line items and prices match the order total exactly |
| C7 | `products.one_click_checkout` enabled | Cashfree shows login and address capture |
| C8 | `POST /orders/confirm` reads Get Order Extended | `shippingAddress` filled from their response |
| C9 | Address step made conditional on the web | No double address entry |
| C10 | Serviceability decision from section 4 implemented | Either pincode blocking at Cashfree, or a refund path |

### Phase 3 — launch readiness

| # | Task | Done when |
| --- | --- | --- |
| C11 | Reconciliation for orders that never confirmed | A job finds them and asks Cashfree |
| C12 | Refunds | Confirmed against their API, admin can trigger one |
| C13 | COD, if we take it | Order settles with no money through the gateway |
| C14 | Live credentials, `NODE_ENV=production` guard honoured | Mock mode cannot start in production |
| C15 | Full suite plus a real sandbox transaction | Green |

---

## 8. What happens to Shiprocket

Not decided. Two readings:

- **Checkout only.** Cashfree takes the checkout, Shiprocket keeps logistics —
  AWB, labels, tracking. Then the catalogue feed and the three `externalId`
  columns stay, because their systems still need to identify our products.
- **Entirely.** Then 1,324 lines and the whole `apps/api/src/shiprocket`
  module retire, `ENABLE_SHIPROCKET_CHECKOUT` goes, and the `externalId`
  columns become dead weight we keep anyway, because dropping a unique column
  that production ids point at is not worth the risk.

`ENABLE_SHIPROCKET_CHECKOUT` is already `false`, so nothing has to be switched
off to start.

---

## 9. Mobile

Deferred, deliberately.

`react-native-cashfree-pg-sdk` does not support Expo managed workflow, and
`apps/mobile` is managed: Expo SDK 54, no `ios/` or `android/`, plugins limited
to router, splash, font, web-browser and secure-store.

**Decided: a dev build** (`expo-dev-client` + prebuild) when mobile payments are
taken on. That changes how everyone runs the app locally, so it does not belong
in the same change as the web launch.

---

## 10. Open questions

| # | Question | Blocks |
| --- | --- | --- |
| Q1 | Is OCC activated on the account? Dashboard → Payment Gateway → PG Products → One Click Checkout | Phase 2 entirely |
| Q2 | **What does OCC cost?** Not published anywhere — not on the pricing page, the charges page, or the pricing FAQs | Commercial go/no-go |
| Q3 | Does the 0% GMV offer apply to OCC, or only plain PG? | Same |
| Q4 | What is charged on a COD order, where no money moves through the gateway? | C13 |
| Q5 | Refund and chargeback fees | C12 |
| Q6 | Shiprocket: checkout only, or entirely? | Section 8 |
| Q7 | Serviceability before or after payment? | C10 |

**Q2 is the one to chase first.** The published rate is 1.95% + GST on domestic
payments, 0% for merchants who signed up on or after 21 July 2026 up to ₹20L
cumulative GMV, ending 31 March 2027 or at the cap. None of that mentions One
Click Checkout, which is a separate product behind a dashboard activation.

We have been here before. Shiprocket's per-order pricing "appears nowhere in the
documentation" and is still unanswered after the whole integration was built.
Ask in writing, before C6.

---

## 11. Guardrails

1. **No secret in the repo.** `render.yaml` uses `sync: false`; credentials go
   into the dashboard and are never pasted into chat.
2. **Verify against the raw body.** Cashfree signs `x-webhook-timestamp` +
   the exact bytes received. A digest over a re-serialised object fails
   intermittently and looks like a Cashfree bug for a week.
3. **Mock mode must never start in production.** `razorpay.service.ts` already
   throws rather than degrade to a verifier that accepts every signature.
   `CashfreeService` inherits that rule.
4. **Settle exactly once.** The return trip and the webhook race. The second one
   through is a no-op, or an order gets paid twice, stock moves twice, and an
   invoice number is burnt.
5. **Sandbox until C14.** No live key touches a dev environment.
6. **Verify the SDK's OCC support with a real sandbox call** before building on
   it. See section 3.
