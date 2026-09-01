# Switching on crash reporting and the stock sweep

Both are built, committed and **inert**. Each needs one value pasted into a
dashboard; neither needs a code change or a deploy from me.

They were two of the four P0 launch blockers in the audit. This is the half of
each that could be done without your accounts.

---

## 1. Crash reporting

Today a customer hitting an error on the storefront is invisible — the handler
writes to `console.error`, which nobody reads. Payment bugs are exactly the
class customers do not report; they just leave.

**Steps**

1. Create a free Sentry account and two projects: one **Next.js**, one **Node**.
2. Copy the DSN from each.
3. Set them:

| Where | Key | Value |
| --- | --- | --- |
| Render → API service | `SENTRY_DSN` | the Node project's DSN |
| Vercel/Render → storefront | `SENTRY_DSN` | the Next.js DSN |
| Vercel/Render → storefront | `NEXT_PUBLIC_SENTRY_DSN` | the same Next.js DSN |

The `NEXT_PUBLIC_` one is compiled into the browser bundle. That is fine and
intended — a DSN is write-only by design. **Never put an auth token in a
`NEXT_PUBLIC_` variable.**

**What was chosen for you, and why**

- `tracesSampleRate: 0` — performance tracing costs money and answers a
  question nobody is asking yet. Errors are the point. Raise it when there is
  traffic worth sampling.
- `sendDefaultPii: false` — this app handles mobile numbers, delivery
  addresses and order totals. The default would attach request bodies and
  headers to every report, which is how a crash tracker quietly becomes a copy
  of the customer database.
- **Session replay off.** It records what a customer types, which here includes
  their phone number and address.

**Checking it works:** trigger any error on the live site and confirm it
appears in Sentry within a minute. The reference shown to the customer on the
error screen is the `digest`, and it is attached as a tag — so a customer can
quote a code and you can find the exact trace.

---

## 2. The stock sweep

Stock held by an unpaid checkout is never released. There is no scheduler in
the app, and the free Render plan sleeps, so it cannot schedule itself. A
previous run found twenty abandoned orders holding stock; running the new
endpoint by hand a moment ago released four more.

The symptom is a product reading "out of stock" when there is plenty on the
shelf — with no signal that anything is wrong.

**Steps**

1. Generate a secret: `openssl rand -hex 32`
2. Set it in **both** places, identically:

| Where | Key |
| --- | --- |
| Render → API service | `CRON_SECRET` |
| GitHub → repo → Settings → Secrets → Actions | `CRON_SECRET` |

3. Add one more GitHub secret: `API_BASE_URL`, e.g. `https://api.countrydairy.in`
4. GitHub → Actions → **Expire abandoned orders** → *Run workflow* to test it
   once by hand.

After that it runs every 15 minutes on its own.

**Until both secrets exist the workflow exits without calling anything**, so
merging it changes nothing.

**How the door is held shut**

- The secret is compared in **constant time**, so the endpoint cannot be probed
  character by character.
- With `CRON_SECRET` unset the route is **closed, not open**. An empty secret
  matching an empty header is the usual way this pattern fails, and there is a
  test named after it.
- The route **takes no body**. The staff version accepts `olderThanMinutes`;
  this one does not, so there is no parameter to set to zero and turn a routine
  ping into a mass cancellation.
- It is a separate controller from `OrdersController`, which carries a
  class-level `AuthGuard` — a method-level guard adds to that rather than
  replacing it, so a cron route declared there would have needed a staff JWT
  as well, which is the thing this exists to avoid.

Proven by hand across every case:

```
CRON_SECRET unset   no header / empty / guessed  -> 401, 401, 401
CRON_SECRET set     no header                    -> 401
                    wrong secret                 -> 401
                    same-length near miss        -> 401
                    correct secret               -> 201 {"examined":4,"released":4}
```

---

## Still blocked on you, and not covered here

Rotating the leaked `DATABASE_URL` and `JWT_SECRET`; requesting production
activation for One Click Checkout; the WhatsApp number that unblocks customer
sign-in. Those need your dashboards and cannot be prepared from the repository.
