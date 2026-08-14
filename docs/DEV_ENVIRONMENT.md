# The dev environment

A deployed copy of `dev`, for testing a change before the pull request that
promotes it to `main`. Production tracks `main` and is not touched by anything
here.

```
feature branch ──▶ dev ──▶ [dev environment]  ──PR──▶ main ──▶ [production]
                            test here first              only after review
```

Three pieces, matching production: the API on Render, and the storefront and
admin console on Vercel.

---

## Before anything else: a separate database

The dev API must point at its **own** Supabase project, not production's.

The API applies migrations against whatever `DATABASE_URL` names, and this
repository's test suites create and delete customers, orders and products by
design. A dev deploy aimed at the production database would do that to real
records, and no amount of care afterwards undoes it.

Create a second Supabase project, then:

```bash
DATABASE_URL='<dev pooler url>' DIRECT_URL='<dev direct url>' npm run db:deploy
DATABASE_URL='<dev pooler url>' SEED_ADMIN_PASSWORD='<something>' npm run db:seed
```

---

## 1. API — Render

[`render.yaml`](../render.yaml) declares the service, so this is a blueprint
import rather than a form to fill in.

1. Render → **New** → **Blueprint** → pick this repository.
2. It reads `render.yaml` and proposes **country-dairy-api-dev**, tracking the
   `dev` branch with auto-deploy on.
3. Render prompts for every variable marked `sync: false`. Fill in the **dev**
   Supabase values.
4. **Leave the Razorpay keys unset.** Absent keys put the gateway in mock mode,
   so a test order on dev cannot take real money. Set test keys only when the
   payment integration itself is what you are testing.

Health check is `/api/catalog/products`. The service is up when that returns
200 — the root path returns 404 by design, since the API is mounted under
`/api`.

## 2. Storefront and admin — Vercel

Both are already git-driven through [`vercel.json`](../vercel.json), which uses
`turbo-ignore` so a push that changes neither app does not rebuild it.

For each of the two Vercel projects:

1. **Settings → Git → Production Branch** stays `main`. Do not change it.
2. Add `dev` as a **preview branch**. Every push to `dev` then builds a preview
   at a stable URL, and `main` continues to own production.
3. **Settings → Environment Variables**, scoped to **Preview** only, so these
   never leak into a production build:

| Storefront (`apps/web`) | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://country-dairy-api-dev.onrender.com/api` |
| `NEXT_PUBLIC_SUPABASE_URL` | dev project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | dev anon key |
| `NEXT_PUBLIC_ENV` | `staging` |

| Admin (`apps/admin`) | Value |
|---|---|
| `VITE_API_URL` | `https://country-dairy-api-dev.onrender.com/api` |
| `VITE_SUPABASE_URL` | dev project URL |
| `VITE_SUPABASE_ANON_KEY` | dev anon key |
| `VITE_ENV` | `staging` |
| `VITE_ENABLE_HERO_LAYOUT_EDITOR` | `true` — unfinished, and this is where it is meant to be looked at |

The `.env.staging` files in each app hold the same keys and are the reference
for what a deployed build expects.

## 3. CORS

The API allows the production origins and any localhost port. A deployed
preview is neither, so the dev API needs the preview URLs added — see
`PROD_ORIGINS` in `apps/api/src/main.ts`. Until that is done the console loads
and every request fails, which looks like an API outage and is not one.

---

## Testing against it

The end-to-end suite takes its targets from the environment, so it can be
pointed at the deployed dev environment rather than localhost:

```bash
E2E_STOREFRONT_URL=https://<preview>.vercel.app \
E2E_ADMIN_URL=https://<admin-preview>.vercel.app \
E2E_API_URL=https://country-dairy-api-dev.onrender.com/api \
E2E_ADMIN_EMAIL=admin@countrydairy.in \
E2E_ADMIN_PASSWORD='<dev password>' \
npm run e2e
```

Two things to know before running it there:

- **It writes.** The suite creates and deletes customers, orders and products.
  That is fine against a dev database and is the reason a separate one is not
  optional.
- **Render's starter plan sleeps.** The first request after an idle period
  takes tens of seconds to wake the service. The readiness check waits up to
  two minutes, so a run may look stalled at the start and then proceed.

## Promoting to production

```bash
git checkout main && git pull
git merge dev            # or open the PR on GitHub and merge there
git push origin main
```

Vercel and Render both deploy from `main` on push. Run the migrations against
the production database first if the change includes any — a deploy that
expects a column the database does not have fails on the first request, not at
build time.
