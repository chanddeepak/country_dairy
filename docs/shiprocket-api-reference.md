# Shiprocket Checkout — every endpoint, both directions

Compiled from Shiprocket's public Postman collections, fetched as raw JSON and
read request by request. Where something is quoted it is their wording.

**Sources** (supplied by Shiprocket, 21 August 2026):

| Collection | Link |
| --- | --- |
| Full Checkout / custom website | `documenter.getpostman.com/view/25617008/2sB34bL3ig` |
| Custom website (staging examples) | `documenter.getpostman.com/view/31751679/2sAYHxmPGf` |
| Login iframe | `documenter.getpostman.com/view/16356653/2s9YeN397y` |
| S2S login and address | `documenter.getpostman.com/view/16356653/2s9Ykod1qw` |

The two Google Drive documents they also sent are Shopify-backend flows and do
not apply to us.

**Verified against those collections:** `X-Api-Key` and `X-Api-HMAC-SHA256`
appear on every authenticated request in both checkout collections — 8 of 16
and 5 of 13 respectively, the rest being seller-side endpoints and redirects.
The scheme we implemented is theirs.

Two things this document exists to make unambiguous:

1. **Traffic goes both ways.** Shiprocket calls us as much as we call them, and
   the endpoints we have to *provide* are the larger half of the work.
2. **Which of these we have actually built.** Marked in every table.

---

## 1. Environments

| | Staging | Production |
| --- | --- | --- |
| API | `https://fastrr-api-dev.pickrr.com` | `https://checkout-api.shiprocket.com` |
| Checkout UI script | `https://customcheckoutfastrr.netlify.app/assets/js/channels/shopify.js` | `https://checkout-ui.shiprocket.com/assets/js/channels/shopify.js` |
| Login iframe script | — | `https://checkout-ui.shiprocket.com/assets/js/channels/login.js` |

Our side: `SHIPROCKET_ENV=production` selects the production API, and
`SHIPROCKET_BASE_URL` overrides both. Unset means staging, because staging is
the safe default to fail into.

## 2. Authentication — identical in both directions

| Header | Value |
| --- | --- |
| `X-Api-Key` | The API key |
| `X-Api-HMAC-SHA256` | base64( HMAC-SHA256( raw request body, API secret ) ) |

Three details that decide whether this works at all:

- The digest is over the **exact bytes sent**, not over a re-serialised object.
  Two `JSON.stringify` calls can order keys differently and every signature
  fails silently.
- A `GET` has no body, so the digest is over the **empty string**. Our
  catalogue endpoints are signed that way.
- A mismatch is answered **`511`**, not 401 — their documented code. We return
  511 for the same reason: a 500 would suggest the fault was ours.

---

## 3. Endpoints **we call** at Shiprocket

| Endpoint | Purpose | Built? |
| --- | --- | --- |
| `POST /api/v1/access-token/checkout` | Mint a token that opens their checkout window | **Yes** |
| `POST /api/v1/custom-platform-order/details` | Fetch one order — the failsafe when a webhook is missed | **Yes**, unused until reconciliation lands |
| `POST /api/v1/custom-platform-order/details/list` | **Every order in a date window** — `startDate`, `endDate`, `status`, `page`, `limit` | **Yes**, the reconciliation endpoint |
| `POST /api/v1/custom-platform-order/details/transactions` | Transactions on an order | No |
| `POST /api/v1/external/refund/initiate` | Refund an order — `{order_id, amount}` | **Yes**, unused |
| `POST /api/v1/external/refund/reports` | Refund reporting | No |
| `POST /api/v1/access-token/login` | Token for the login iframe (`{address: true, timestamp}`) | No |
| `POST /api/v1/customer-data` | Phone + addresses for a logged-in customer | No |
| `POST /api/v1/access-token/s2s-login/initiate` → `/verify` | Server-side OTP login, *without* their checkout | No — and see the note below |
| `POST /api/v1/customer-rto-risk` | RTO risk score for a customer | No |
| `POST /wh/v1/custom/product` | Tell them a product changed, rather than waiting for their pull | No |
| `POST /wh/v1/custom/collection` | Tell them a collection changed | No |

### `access-token/checkout` — the one that matters

```jsonc
// request
{
  "cart_data": { "items": [ { "variant_id": 1, "quantity": 2 } ] },
  "redirect_url": "https://countrydairy.in/checkout/shiprocket-return",
  "timestamp": "2026-08-21T09:15:00.000Z"
}

// response
{ "result": { "token": "…", "data": { "order_id": "…" } } }
```

`variant_id` is the id from our feed, **sent as a number (long)**.

This was briefly changed to a string, because every example they publish quotes
it — `"35"`, `"1244539923890450"` — in the checkout request and in the webhook
coming back. Then their tech team's own words surfaced, to another merchant:
*"Product id, Variant id and Collection id should be of data-type long instead
of string."* An instruction beats a sample, and our feed already emits them
unquoted, so one shape holds throughout.

Their webhook sends them back quoted; our parser compares as strings and
handles either. Worth confirming with them if a checkout call is ever rejected
for a malformed cart — it is the first thing I would suspect.

The browser never sees it: our endpoint takes our own variant id and
translates.

`cart_data` also accepts `custom_attributes` (an arbitrary key/value bag) and
`mobile_app` (boolean). Neither is used yet.

**`cart_discount` is deliberately never sent.** Their documentation: *"If
specified, only this fixed discount is applied"* — passing it switches off the
coupons configured in their dashboard for that order. Sending ours instead is
what `ENABLE_SHIPROCKET_OUR_COUPONS` is for, and it is off.

### S2S login vs the login iframe

Both authenticate a customer, and only one is right alongside their checkout:

| | Runs where | Does their checkout inherit the session? |
| --- | --- | --- |
| **Login iframe** (`login.js`) | the browser, on `checkout-ui.shiprocket.com` | **Yes** |
| **S2S login** | our server, back channel | **No** |

The iframe is served from the same host as the checkout, so signing in there
establishes the session in the browser and the checkout does not ask for the
phone number a second time. S2S learns who the customer is while the browser
has never met Shiprocket — correct for a merchant who wants their identity
network without their UI, wrong for us.

Confirmed on anveshan.farm: sign-in asks for a mobile number, the OTP comes
from Shiprocket, and checkout does not ask again.

---

## 4. Endpoints **Shiprocket calls** at us

This is the half they have asked us for. All are live.

| Endpoint | What it returns | Built? |
| --- | --- | --- |
| `GET /api/shiprocket/products?page=&limit=` | Catalogue in Shopify's shape | **Yes** |
| `GET /api/shiprocket/collections?page=&limit=` | Categories as collections | **Yes** |
| `GET /api/shiprocket/collection-products?collection_id=&page=&limit=` | Products in one collection | **Yes** |
| `POST /api/shiprocket/webhook/order` | A finished, paid order | **Yes** |

### Catalogue shape — theirs, not ours

```
product : id, title, body_html, handle, vendor, product_type, tags,
          status, created_at, updated_at, image, options, variants[]
variant : id, title, price, compare_at_price, sku, quantity, taxable,
          option_values{}, grams, weight, weight_unit, image{src}
```

Their explicit requirement, quoted:

> "products[].id and products[].variants[].id must be unique. Both ids should
> be of long data-type"

Ours were UUIDs, so `Product`, `ProductVariant` and `Category` each carry an
`externalId BIGSERIAL UNIQUE`. It has to be **stable forever**: if a number is
ever reused for a different product, their existing orders point at the wrong
thing.

Two consequences worth stating plainly:

- **`variant.quantity` means they hold our stock levels**, refreshed by their
  sync rather than checked live at checkout. Oversell is possible in the window
  between a sale and the next sync — narrow, not wide open. Our token endpoint
  re-checks stock before handing them a basket, which closes most of it.
- `grams` / `weight` drive their shipping rates. We already store `weightGrams`
  per variant, so this was a mapping and not a data gap.

**A collection is a shelf, never a type.** Ghee is a collection; "A2 Desi Ghee"
travels as `product_type` on each product, which is what that field is for.
`collection-products` resolves a shelf to itself *and* its types.

### The order webhook

They send items, both addresses, `payment_type` (`PREPAID` /
`CASH_ON_DELIVERY`), `payment_status`, `payments[]` with `txn_id` and gateway,
`shipping_charges`, `rto_prediction` and `edd`.

Their documentation warns: **"Webhooks may be sent more than once."** Ours is
idempotent on `fastrr_order_id`, because a redelivered webhook must not create
a second order, take stock twice, or burn another invoice number.

They also recommend polling `custom-platform-order/details` as a failsafe for
orders whose webhook never arrived. That is the reconciliation job, not yet
built.

---

## 5. What is still unknown

Not in any collection, and it needs a human answer:

1. **Per-order pricing.** Their commercials appear nowhere in the documentation.
2. **Merchant of record**, and how settlement reaches our bank.
   `payments[].gateway` shows "Razorpay" — but whose Razorpay account?
3. ~~Refunds.~~ **Answered by the collections**: `external/refund/initiate`
   takes `{order_id, amount}`, so refunds are theirs to make and not ours
   through Razorpay — which follows, since the money never reached our gateway
   account.
4. **How far their checkout can carry our branding.**
5. **Subscriptions.** Their checkout is one-shot; standing dairy orders will
   need our own flow regardless.
