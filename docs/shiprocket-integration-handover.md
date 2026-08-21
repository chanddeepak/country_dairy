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

Both directions use the same scheme:

| Header | Value |
| --- | --- |
| `X-Api-Key` | the API key |
| `X-Api-HMAC-SHA256` | base64( HMAC-SHA256( raw request body, API secret ) ) |

- A `GET` carries no body, so the digest is over the **empty string**. Our
  catalogue endpoints are signed and verified that way.
- The digest must be over the **exact bytes sent**. Re-serialising a parsed
  object can reorder keys and the signature will not match.
- On mismatch we return **`511`**, matching your documented behaviour.

**These endpoints cannot be opened in a browser.** Without the two headers the
guard answers 511, so a URL pasted into an address bar returns nothing. They
are intended to be called server to server, which is how your sync will reach
them.

#### Please confirm this scheme

We implemented the above from your Fastrr / custom-platform Postman
collections. Your support documentation for SR Checkout does not restate it, so
we would like it confirmed in writing before we rely on it in production:

1. Are `X-Api-Key` and `X-Api-HMAC-SHA256` the correct header names?
2. Is the HMAC base64, SHA-256, over the raw request body, keyed with the
   shared secret — and over the empty string for a `GET`?
3. Is `511` the status you expect on a mismatch?

If any of these differ, it is a small change on our side and much cheaper to
make now than after your first sync fails.

#### Which credentials, in which direction

There are two directions and we want to remove any ambiguity, because this is
the sort of thing that stalls an integration for a week.

| Direction | Whose credentials | Our position |
| --- | --- | --- |
| **You → us** (catalogue pulls) | the pair **our** endpoints verify | **we have generated a pair and will send it to you securely.** Configure your sync with it and our endpoints will accept your requests immediately. |
| **Us → you** (checkout token, order lookup) | the pair **your** API verifies | we need these from you — this is what blocks us. |

We note that for Shopify merchants these values appear pre-populated in your
checkout dashboard, because Shopify issues them and you read them during the
connection. As a custom platform we are in Shopify's position for the inbound
direction, which is why we are offering the pair rather than asking for it.

**If your custom-platform onboarding issues that pair instead, tell us and we
will use yours.** Our implementation reads one key and one secret from
configuration, so switching is a configuration change and not a code change.
Either arrangement works; we only need to know which.

---

## 2. What we need from you

### 2.1 To finish development — blocking

1. **Staging API key and shared secret** — see §1.3. Nothing further can be
   tested; this is the only thing holding us up. We understand these are
   generated on your side and visible in the checkout dashboard.
2. **Confirmation of the authentication scheme** — the three questions in §1.3.
3. **Confirmation of the staging base URL** we should call.
   We are using `https://fastrr-api-dev.pickrr.com`.
4. **Registration of our dev webhook URL**:
   `https://country-dairy-api-dev.onrender.com/api/shiprocket/webhook/order`
5. **A staging test order** we can use to verify the webhook end to end.

Please provide the above details. Also, let us know if something more needs to be done from our end for this integration.
 
### 2.2 Before go-live

6. Production API key and secret, and production webhook registration.
7. Confirmation that our catalogue passes your sync validation.

---

## 3. Commercial and operational questions

These are not in the documentation and we need answers before launch.

1. **Pricing.** What does SR Checkout cost us, per order or otherwise?
2. **Merchant of record.** Who is it on a Shiprocket-checkout order?
3. **Settlement.** `payments[].gateway` shows Razorpay — whose account, and how
   and when do funds reach our bank?
4. **Refunds.** What is the API or process, and who initiates?
5. **Branding.** How far can the checkout carry Country Dairy's identity?
6. **Coupons.**  Please confirm how coupon integration works. Is it via sending `cart_discount` from our as part of order or we can configure coupons in your dashboard?

---

## 4. Two behaviours we would like confirmed

### 4.1 Catalogue sync frequency and stock

Your checkout prices from the catalogue you have synced, so between a sale and
your next pull our stock figure is stale. We already re-check stock on our side
before requesting a checkout token, which closes most of that window.

- How often do you pull the catalogue?
- Do you support our pushing changes to `/wh/v1/custom/product` and
  `/wh/v1/custom/collection` to keep it fresh?

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

