# Country Dairy × Shiprocket Checkout — integration handover

**For:** the Shiprocket / Fastrr integration team
**From:** Country Dairy engineering
**Date:** 21 August 2026
**Status:** our side is built and behind a feature flag. We need dev
credentials to switch it on and complete testing.

---

## 1. What we have built

We are a **custom platform** — not Shopify, not WooCommerce. We have
implemented the custom-platform catalogue contract and the order webhook from
your documentation.

All four endpoints are live and authenticated exactly as your documentation
specifies.

### Base URLs

| Environment | API base |
| --- | --- |
| Development | `https://country-dairy-api-dev.onrender.com/api` |
| Production | *supplied when we go live* |

### 1.1 Catalogue endpoints (you pull from us)

| Method | Path | Query |
| --- | --- | --- |
| `GET` | `/shiprocket/products` | `page`, `limit` |
| `GET` | `/shiprocket/collections` | `page`, `limit` |
| `GET` | `/shiprocket/collection-products` | `collection_id`, `page`, `limit` |

Responses follow the Shopify-shaped contract in your custom-platform
documentation:

```
product : id, title, body_html, handle, vendor, product_type, tags,
          status, created_at, updated_at, image, options, variants[]
variant : id, title, price, compare_at_price, sku, quantity, taxable,
          option_values{}, grams, weight, weight_unit, image{src}
```

Notes on our implementation, so nothing surprises you:

- **Ids are numeric and permanent.** Per your requirement that ids be of long
  data-type, every product, variant and collection carries a stable
  `BIGINT`. These are never reused, so an id in an old order always resolves to
  the same item.
- **Only live products are published.** Draft and archived products never
  appear, so nothing in your checkout can be bought that we do not sell.
- **Empty collections are omitted.** A collection we return always contains at
  least one purchasable product.
- **Image URLs are absolute**, fully qualified with our CDN host.
- **`grams` and `weight` are populated per variant** for your shipping rates.
- **`quantity` is our live stock at the time you pull.** See §4.1 — we would
  like to understand your sync frequency.

### 1.2 Order webhook (you post to us)

| Method | Path |
| --- | --- |
| `POST` | `/shiprocket/webhook/order` |

- **Idempotent on `fastrr_order_id`.** Your documentation notes webhooks may be
  sent more than once; a repeat is safely ignored rather than creating a second
  order.
- We verify the HMAC over the **raw request body** before parsing anything.
- We read: line items, billing and shipping addresses, `payment_type`,
  `payment_status`, `payments[]` (`txn_id`, gateway), `shipping_charges`,
  `rto_prediction`, `edd`.

Please register this URL against our account.

### 1.3 Authentication — as documented

Both directions use:

| Header | Value |
| --- | --- |
| `X-Api-Key` | our shared API key |
| `X-Api-HMAC-SHA256` | base64( HMAC-SHA256( raw body, API secret ) ) |

- A `GET` carries no body, so we compute the digest over the empty string.
- On mismatch we return **`511`**, matching your documented behaviour.

---

## 2. What we need from you

### 2.1 To finish development — blocking

1. **Staging API key and API secret.** Nothing further can be tested; this is
   the only thing holding us up.
2. **Confirmation of the staging base URL** we should call.
   We are using `https://fastrr-api-dev.pickrr.com`.
3. **Registration of our dev webhook URL**:
   `https://country-dairy-api-dev.onrender.com/api/shiprocket/webhook/order`
4. **A staging test order** we can use to verify the webhook end to end.

Please send credentials through a secure channel — not email or chat.

### 2.2 Before go-live

5. Production API key and secret, and production webhook registration.
6. Confirmation that our catalogue passes your sync validation.

---

## 3. Commercial and operational questions

These are not in the documentation and we need answers before launch.

1. **Pricing.** What does SR Checkout cost us, per order or otherwise?
2. **Merchant of record.** Who is it on a Shiprocket-checkout order?
3. **Settlement.** `payments[].gateway` shows Razorpay — whose account, and how
   and when do funds reach our bank?
4. **Refunds.** What is the API or process, and who initiates?
5. **Branding.** How far can the checkout carry Country Dairy's identity?
6. **Coupons.** We plan to use coupons configured in your dashboard, and to
   *not* send `cart_discount`, on our reading that specifying it applies only
   that fixed discount and disables dashboard coupons for the order. Please
   confirm.

---

## 4. Two behaviours we would like confirmed

### 4.1 Catalogue sync frequency and stock

Your checkout prices from the catalogue you have synced, so between a sale and
your next pull our stock figure is stale. We already re-check stock on our side
before requesting a checkout token, which closes most of that window.

- How often do you pull the catalogue?
- Do you support our pushing changes to `/wh/v1/custom/product` and
  `/wh/v1/custom/collection` to keep it fresh? We are willing to implement
  these.

### 4.2 Login and the customer session

We understand the **login iframe** (`login.js`) establishes the customer's
session in the browser on `checkout-ui.shiprocket.com`, so your checkout does
not ask for the phone number again — whereas **S2S login** authenticates over a
back channel and would leave your checkout asking a second time.

Please confirm, as it decides which we implement.

---

## 5. Our taxonomy, so the feed reads correctly

We sell a small catalogue with two levels:

| Level | Example | How it reaches you |
| --- | --- | --- |
| Category | Ghee | a **collection** |
| Type | A2 Desi Ghee | the product's **`product_type`** |

So `collections` returns *Ghee*, and `collection-products?collection_id=<Ghee>`
returns every product filed under Ghee **and** under its types. We deliberately
do not expose types as collections, which would list the same items twice under
two names.

---

## 6. Contact

Technical questions on this integration: Country Dairy engineering, via our
existing thread with Abhishek.
