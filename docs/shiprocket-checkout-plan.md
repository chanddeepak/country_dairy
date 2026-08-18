# Shiprocket Checkout (Fastrr) — full checkout integration plan

Written against the four public Postman collections, read directly rather
than summarised from the marketing pages. Nothing here is built.

The two Google Drive links Shiprocket sent are for a **Shopify backend** and
do not apply to us.

## Does full checkout include login?

Yes. Their checkout UI handles OTP login and address autofill itself — that is
the product. The separate "S2S Login" and "Login Iframe" collections exist for
merchants who want the login and address network *without* handing over
checkout. Which of the two to use is settled in `## Login: use their iframe,
not S2S` below — the answer is not the one this document originally gave.

## How the flow works

**Base URLs**

| | |
| --- | --- |
| Staging API | `https://fastrr-api-dev.pickrr.com` |
| Production API | `https://checkout-api.shiprocket.com` |
| Staging UI assets | `https://customcheckoutfastrr.netlify.app/assets/js/channels/shopify.js` |
| Production UI assets | `https://checkout-ui.shiprocket.com/assets/js/channels/shopify.js` |

**Auth, both directions:** header `X-Api-Key`, plus `X-Api-HMAC-SHA256` — a
base64 HMAC-SHA256 of the request body using the API secret. Their webhooks to
us carry the same, and are rejected with 511 on mismatch, so ours should
behave the same way.

**The sequence**

1. Customer clicks Checkout. Our API calls
   `POST /api/v1/access-token/checkout` with
   `{cart_data: {items: [{variant_id, quantity}]}, redirect_url, timestamp}`.
   Response gives `result.token` and `result.data.order_id`.
2. Our page calls `HeadlessCheckout.addToCart(event, token, {fallbackUrl})`
   from their script. Their UI takes over: login, address, payment.
3. On success the customer returns to `redirect_url?oid=…&ost=SUCCESS`.
4. **Shiprocket POSTs the finished order to our registered webhook** — items,
   both addresses, `payment_type` (PREPAID / CASH_ON_DELIVERY),
   `payment_status`, `payments[]` with `txn_id` and gateway, `shipping_charges`,
   `rto_prediction`, `edd`.
5. We create the order, decrement stock, issue the invoice number.

`fallbackUrl` must be our own checkout URL — it is what customers hit if their
checkout server is down. That is a good reason **not** to delete our existing
checkout when this goes in.

## What Shiprocket needs from us

### 1. Three catalogue endpoints, in their shape

They pull our catalogue. We must expose, behind the same API-key + HMAC auth:

- `GET  …/products?page=1&limit=100`
- `GET  …/collections?page=1&limit=100`
- `GET  …/collection-products?collection_id=…&page=1&limit=100`

The response shape is Shopify's, not ours:

```
product : id, title, body_html, handle, vendor, product_type, tags,
          status, created_at, updated_at, image, options, variants[]
variant : id, title, price, compare_at_price, sku, quantity, taxable,
          option_values{}, grams, weight, weight_unit, image{src}
```

Two things follow from that:

- **`variant.quantity` means they hold our stock levels.** Not a live check at
  checkout, but a sync — so oversell is possible during the window between a
  sale and the next sync, not wide open.
- `grams` / `weight` are needed for shipping rates. We already store
  `weightGrams` on the variant, so this is a mapping not a data gap.

### 2. Numeric IDs — the one real schema change

> "products[].id and products[].variants[].id must be unique. Both ids should
> be of long data-type"

Ours are UUIDs. We need a stable numeric surrogate key on `Product` and
`ProductVariant`, because Shiprocket will store it and send it back in
webhooks. A Postgres `BIGSERIAL` column with a unique index, mapped both ways.

It has to be **stable forever** — if a number is ever reused for a different
product, their orders point at the wrong thing.

### 3. A registered webhook URL

Public, HMAC-verified, and **idempotent** — their documentation says
"Webhooks may be sent more than once". They also recommend a periodic job
against `POST /api/v1/custom-platform-order/details` as a failsafe for orders
whose webhook never arrived.

### 4. Optional, not for a first pass

Product/collection change webhooks from us to them
(`/wh/v1/custom/product`, `/wh/v1/custom/collection`) to keep the catalogue
fresh without waiting for their pull. Loyalty points APIs — we have no loyalty
scheme.

## What we need from Shiprocket

1. **Staging `X-Api-Key` and API secret** — nothing can be built without them.
2. Production credentials, later.
3. Webhook URL registration on their side.
4. **Per-order pricing.** It appears in none of the documentation.
5. Who is merchant of record, and how settlement and refunds reach our bank.
   Their `payments[].gateway` shows "Razorpay", but whose Razorpay account?
6. Whether the checkout UI can carry our branding, and how far.

## Can we do a proof of concept?

**Yes.** They publish a full staging environment — API at
`fastrr-api-dev.pickrr.com`, UI assets on the Netlify host. The only blocker
is credentials.

A worthwhile PoC, in order:

1. Get staging key + secret.
2. Stand up the three catalogue endpoints returning our one real product in
   their shape, with numeric ids faked at first if the migration is not done.
3. Call `access-token/checkout` and confirm a token comes back.
4. Put their script behind a "Checkout with Shiprocket" button on a branch —
   not replacing our checkout.
5. Complete one staging order and confirm the webhook lands, verifies, and is
   idempotent when replayed.

That is a day or two once keys exist, and it answers the questions that no
amount of reading will: what their UI looks like with our catalogue in it, and
whether the webhook carries everything an invoice needs.

## Work breakdown, if we proceed

| | Rough size |
| --- | --- |
| `BIGSERIAL` ids + migration + backfill | small, but touches core tables |
| Three catalogue endpoints, Shopify shape | medium |
| API-key + HMAC auth, both directions | small |
| `access-token/checkout` call + button + script | small |
| Order webhook: verify, map, create order, decrement stock, invoice, idempotency | **largest piece** |
| Reconciliation job against Order/Details | small |
| Tests across the lot | medium |

## Risks worth naming

- **Payment ownership moves to them.** Our Razorpay integration, its webhook
  and its signature verification are tested and working. This replaces that
  path, and refunds become an API call to Shiprocket.
- **Two checkouts at once.** The fallback URL means ours has to keep working
  regardless, so this adds a path rather than replacing one.
- **The invoice.** We remain seller of record and must keep issuing a
  consecutive series. The webhook is where that happens, so its idempotency is
  not a nicety — a double-delivered webhook must not burn two invoice numbers.
- **Subscriptions.** Their checkout is one-shot. Standing dairy orders will
  need our own flow whatever happens here.

## Login: use their iframe, not S2S

Corrects a recommendation made twice earlier in this document's history. There
are three products here, not two, and the difference decides whether a
customer types their phone number once or twice.

| | Runs where | Does their checkout inherit the session? |
| --- | --- | --- |
| **Login iframe** (`login.js`) | the browser, on their domain | **Yes** |
| **S2S login** | our server, back channel | **No** |
| Login inside checkout | their checkout window | n/a — it is the checkout |

### Why the iframe and not S2S

```
POST /api/v1/access-token/login   { address: true, timestamp }  -> token
  load  checkout-ui.shiprocket.com/assets/js/channels/login.js
  dialog: phone + OTP, and optionally address selection
  dialog returns an authorised token
POST /api/v1/customer-data        { token }  -> phone + full address
```

That dialog is served from `checkout-ui.shiprocket.com` — the same host that
serves the checkout UI. Logging in there establishes the customer's session
with Shiprocket **in the browser**, so when checkout opens it is the same
origin and the same session, and the phone step is skipped.

S2S does the same authentication over a back channel from our server. We would
learn who the customer is, and the browser would never have met Shiprocket —
so their checkout would still ask for the number. Correct for a merchant who
wants the identity without their UI; wrong for us, because avoiding the second
ask is the entire point.

`address: true` on the token request lets the dialog do address selection too,
so their chosen address is known before checkout opens.

### Confirmation

Signing in on anveshan.farm asks for a mobile number, the OTP arrives from
Shiprocket, and checkout does not ask again. Observed on the live site.

The endpoints, the script host and the flow are read from their collection.
That the session carries into checkout is inference from the shared origin —
the documentation does not state it. The observation above is the evidence,
and it is better evidence than the documentation would have been.

### What this means for us

- Our email/password sign-in is replaced by their dialog, or kept only as a
  fallback. New customers never set a password.
- `User.phone` becomes the identity anchor. It is already unique.
- Whether they arrive through checkout or the site, it is one person and one
  order history.
- Task #4, OTP login with MSG91, can be closed. It would cost an SMS contract
  to build a worse version of what the dialog does.
- Now is the cheapest possible moment: production holds two accounts, a driver
  and one customer. There is no migration.

## The cheaper alternative, if full checkout is ever reconsidered

`POST /api/v1/access-token/s2s-login/initiate` → `…/verify` →
`…/customer-data` → `…/customer-rto-risk`

Four endpoints. OTP login, addresses from their cross-merchant network, and an
RTO risk score — while we keep our checkout, Razorpay, invoice series, stock
guard and subscription path. No catalogue sync, no numeric-id migration, no
payment handover.

Note this is the *server-side* login, which is the right shape only when their
checkout is not in the picture. Alongside full checkout it is the wrong one:
see the login section above.
