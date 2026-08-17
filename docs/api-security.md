# API security — findings and outstanding work

Audited 17 August 2026 against `apps/api`. The question asked was blunt:
**can anyone with the URL read from or write to the database?** The short
answer is no, apart from a handful of deliberate exceptions — but there are
four gaps worth closing before this takes real traffic.

Nothing in this document has been fixed. It is a list, in the order I would
do it.

## What is already right

Every route that mutates data sits behind `AuthGuard`. Admin surfaces add
`RolesGuard` with an explicit `@Roles(...)`, so a customer token cannot reach
them.

Reads are owner-scoped where they need to be:

- `GET /orders/:id` resolves through `getOrderById(user.id, id)` — another
  customer's order is not reachable by guessing an id.
- Support threads return **404 rather than 403** for someone else's ticket, so
  ids cannot be probed for existence.

The Razorpay webhook is the one public endpoint that moves money, and it is
done properly: HMAC verified with `crypto.timingSafeEqual`, and it refuses to
act on an unverified signature rather than logging and continuing.

### Unauthenticated writes, all deliberate

| Route | Why it is public |
| --- | --- |
| `POST /auth/email/register`, `/email/login`, `/admin/login`, `/google`, `/send-otp`, `/verify-otp` | Necessarily so |
| `POST /support/contact` | The contact form — most people with a question have not bought anything yet |
| `POST /analytics/track` | Storefront traffic is anonymous; the service accepts a fixed set of event names |
| `POST /orders/webhook/razorpay` | Signature-verified, see above |

### Public reads, by design

Catalogue, categories, CMS content, hero banners, feature flags, lab reports,
reviews, PIN code lookup. All of it is on the storefront anyway.

## Outstanding

### 1. No rate limiting anywhere — the real gap

There is no `@nestjs/throttler`, no `APP_GUARD`, no `express-rate-limit`.
Verified by grep: nothing.

That means `/auth/email/login` and `/auth/admin/login` can be attempted as
fast as the network allows, which is credential stuffing with no speed limit,
and `/support/contact` and `/analytics/track` can be used to fill tables.

The fix is a global throttler with a tighter limit on the auth routes. An
afternoon's work, and the single highest-value thing on this page.

### 2. `GET /cms/settings/:key` reads any key

```ts
@Get('settings/:key')
async getSetting(@Param('key') key: string) {
  return this.cmsService.getSetting(key);
}
```

No guard, no allow-list. `StoreSetting` is empty today so nothing leaks — but
the first person to store an API key or an internal flag in that table makes
it world-readable, and they will have no reason to think they have done
anything dangerous. Restrict it to a known list of public keys.

### 3. No security headers

No `helmet`, and nothing set by hand in `main.ts`.

### 4. Exact stock levels are public

`stockQuantity` appears verbatim in the catalogue payload. Not a
vulnerability, but anyone can poll it daily and derive your exact sales
volume. In-stock / low / out tells a customer everything they need and a
competitor nothing.

## One thing not to rely on

**CORS is not protecting the API from anything except browsers.** The config
in `main.ts` correctly rejects unknown origins, but it allows requests with no
`Origin` header:

```ts
if (!origin) {
  callback(null, true);
}
```

Every curl, every script and every server-to-server call arrives without one.
That is the right behaviour — the mobile app and Shiprocket's webhooks depend
on it — but it means CORS is a browser convenience, not a boundary. The
guards are the boundary.

## Related

Shiprocket Checkout will add another public, HMAC-verified webhook. Whatever
is decided about rate limiting should cover it, and its order creation has to
be idempotent — their documentation warns that webhooks may be delivered more
than once.
