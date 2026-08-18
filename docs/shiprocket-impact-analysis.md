# Shiprocket Checkout — what changes on our side

Companion to `shiprocket-checkout-plan.md`. That one describes their API; this
one is our codebase measured against it: what already exists and can be
reused, what has to be new, and what the flag looks like.

The headline: **most of it already exists.** The genuinely new work is a
numeric id, a catalogue feed in someone else's shape, and one webhook.

## The flag

Our own checkout is not going anywhere. Shiprocket's own script requires a
`fallbackUrl` pointing at "merchant's native checkout URL" for when their
server is down — so keeping ours is not caution, it is a documented
requirement of theirs.

`FLAG` in `feature-flags.service.ts` already carries `ENABLE_CART`,
`ENABLE_WEBSITE_PAYMENT` and the rest, editable from the console with a 30s
cache. One more key:

```ts
SHIPROCKET_CHECKOUT: 'ENABLE_SHIPROCKET_CHECKOUT',
```

Off: the Checkout button behaves exactly as today. On: it fetches a token and
hands over to their script, with our checkout still reachable as the fallback.
Nothing is deleted, and switching back is a toggle rather than a deploy.

## Reused as-is

| What | Where | Why it fits |
| --- | --- | --- |
| Feature flags | `feature-flags.service.ts`, `GET /cms/feature-flags` | Console-editable, already cached and read by the storefront |
| HMAC verification | `razorpay.service.ts` | `crypto.timingSafeEqual` with the length-mismatch guard already written; Shiprocket needs the same thing with a base64 digest instead of hex |
| Raw-body handling | Razorpay webhook route | An HMAC over a re-serialised body is a different body. This problem is already solved once |
| `Order` | schema | Carries `shippingAddress` Json, `subtotal`, `taxAmount`, `deliveryCharges`, `totalAmount`, `couponCode`, `shippingCarrier`, `trackingNumber`, `confirmedAt/shippedAt/deliveredAt`, `invoiceNumber` |
| `Payment` | schema | `gatewayOrderId`, `gatewayPaymentId` (unique), `gatewaySignature`, `refundedAmount`, `failureReason`, `rawPayload` — maps onto their `payments[]` without change |
| `OrderItem` | schema | Snapshot fields already: `productTitle`, `variantSizeLabel`, `sku`, `unitPrice`, `hsnCode`, `gstRate` |
| Invoice series | orders service | Stays ours. We remain seller of record |
| Stock decrement | `orders.service.ts` | The conditional decrement (`stockQuantity: { gte: quantity }`) is reused by the webhook |
| `weightGrams` | `ProductVariant` | Their feed wants `grams` and `weight` — a mapping, not a data gap |
| Catalogue read | `catalog.service.ts` | The product+variant query exists; only the response shape differs |
| Order tracking UI | web and mobile | Their webhook fills the same fields the tracking screens already read |

`Payment.gatewayPaymentId` being unique is quietly useful — it gives webhook
idempotency a natural key without inventing one.

## New work

### 1. Numeric ids — the only unavoidable schema change

> "products[].id and products[].variants[].id must be unique. Both ids should
> be of long data-type"

Ours are UUIDs. Add a `BIGSERIAL` alongside, on both tables:

```prisma
model Product {
  id         String @id @default(uuid())
  externalId BigInt @unique @default(autoincrement())
}
```

The UUID stays the primary key — nothing internal changes. The number exists
solely so Shiprocket has something to store and send back, and it must never
be reused: a recycled number points their existing orders at a different jar.

### 2. Catalogue feed — three endpoints, their shape

New controller, thin, reading through the existing catalogue service. The
work is the mapping, not the query: `body_html`, `handle`, `vendor`,
`product_type`, `compare_at_price`, `option_values`, `grams`, `weight_unit`.

Behind `X-Api-Key` + HMAC, not public.

Note their variant payload includes `quantity`, so our stock reaches them by
sync. That narrows the oversell window; it does not close it.

### 3. The order webhook — the largest piece

Verify HMAC → check idempotency → upsert customer → create order → decrement
stock → issue invoice → record payment.

**`Order.userId` is required, and a Shiprocket customer has no account with
us.** Their webhook carries phone and email; `User.phone` and `User.email` are
both unique, so the honest answer is an upsert: find or create a customer from
the webhook, exactly as a guest support ticket is attributed today. That keeps
orders owner-scoped, keeps the account page working, and means the customer
can later sign in and find their order waiting.

Making `userId` optional would be the smaller change and the worse one — it
would put a null through every owner-scoped query we have tested.

### 4. Reconciliation job

Periodic sweep against `POST /custom-platform-order/details` for orders whose
webhook never arrived. Their documentation recommends it; our experience with
Razorpay says take that seriously.

### 5. Checkout handover on the storefront

Fetch token from our API, call `HeadlessCheckout.addToCart(event, token,
{fallbackUrl})`, load their script. Small, but it is where the flag is read.

## What does not fit, and needs a decision

- **Subscriptions.** Their checkout is one-shot. Standing orders stay on our
  flow whatever happens.
- **Cart.** Our server-side cart still holds the items; we only hand them the
  list at the moment of checkout. Nothing changes there.

## Coupons: theirs, decided

Discounts are Shiprocket's while the flag is on. Their webhook reports the
whole breakdown, so nothing is lost by not owning it:

```
coupon_codes[]           coupon_discount     prepaid_discount
total_discount           subtotal_price      total_amount_payable
discount_detail.discount_data[]  -> code, mode, amount, provider
```

Three consequences.

**Our `discountAmount` is one number and theirs is several.** A prepaid
discount and a coupon discount arriving separately collapse into a single
figure on the order. The breakdown must survive somewhere or the checkout
summary starts disagreeing with the invoice — `Payment.rawPayload` is a Json
column and already exists for exactly this kind of thing.

**`coupon_codes` is an array; our `couponCode` is one string.** Their checkout
allows more than one. Store the first in `couponCode` for display and keep the
full list in the raw payload, or the second code silently disappears.

**`Order.couponId` stays null.** It is a foreign key to our `Coupon` table and
their codes are not in it. The column is already optional, so nothing breaks —
but any report that joins through `couponId` will under-count, and that is the
sort of thing discovered a quarter later.

### The operational trap

Two coupon systems now exist, and only one is live at a time.

With the flag on, a coupon created in our console does nothing — the customer
never touches our checkout. Staff will create one, test it, and find it
ignored, exactly as the trust badge editor was ignored for months.

Whoever builds this should hide or clearly label the console's Coupons page
when the flag is on. A dead admin page is worse than a missing one: somebody
maintains it believing it works.

Our own `Coupon` table stays regardless, because our checkout remains the
fallback their script insists on.

## Answer for Shiprocket

> Our stack is a custom build: Next.js storefront, NestJS API, PostgreSQL —
> not WordPress. We will provide the three catalogue endpoints in the
> documented shape and a registered webhook URL, both authenticated with
> `X-Api-Key` and `X-Api-HMAC-SHA256`. We need a **staging API key and secret**
> to begin, and confirmation on three points: per-order pricing, whose
> Razorpay account settles the payment,. Coupons and discounts will be
> managed in Shiprocket's dashboard rather than ours.
