# Running Country Dairy locally

## Start everything

The API must be running before the admin console or storefront will show data.

```bash
# terminal 1 — API (start this first)
cd apps/api && npm run start:dev

# terminal 2 — admin console
cd apps/admin && npm run dev

# terminal 3 — storefront
cd apps/web && npm run dev
```

The API prints what it is actually doing on startup:

```
Country Dairy API — http://localhost:4000/api
  env:     development
  origins: https://countrydairy.in, https://www.countrydairy.in (+ any localhost port)
  db:      configured
  payments: MOCK MODE — no real charges
```

If you do not see that banner, the API is not up and every console page will
show "Could not reach the API server".

## Sign in

| App | Credentials |
|---|---|
| Admin console | `admin@countrydairy.in` / `ChangeMe#2026` |
| Storefront | Register any email at checkout |

Change the admin password:

```bash
SEED_ADMIN_PASSWORD='your-password' npm run db:seed
```

---

## "Could not reach the API server. Failed to fetch"

`Failed to fetch` is a **network-level** failure — the browser never got a
response. It is not an API error. Work through these in order.

### 1. Is the API running?

```bash
lsof -ti:4000        # prints a PID if something is listening
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/api/catalog/products
```

`200` means the API is fine and the problem is on the browser side. Nothing
listening means start the API.

### 2. Is something else on port 4000?

```bash
lsof -i:4000                  # what is actually holding the port
lsof -ti:4000 | xargs kill -9 # free it, then restart the API
```

### 3. Is CORS rejecting your origin?

Any `localhost` / `127.0.0.1` port is accepted outside production, so this
should not bite in development. To confirm, watch the API log for:

```
[CORS] blocked origin: http://…
```

Reproduce the browser's request, substituting the port your admin console is
actually served on:

```bash
curl -s -D - -o /dev/null \
  -H "Origin: http://localhost:5173" \
  http://localhost:4000/api/catalog/products | grep -i "access-control"
```

You want `Access-Control-Allow-Origin` echoing your origin back.

### 4. Is the console pointed somewhere else?

`apps/admin` reads `VITE_API_URL`, then `VITE_API_BASE_URL`, then falls back to
`http://localhost:4000/api`.

```bash
ls apps/admin/.env*
```

`.env.staging` points at `https://staging-api.countrydairy.in` and is only
loaded with `vite --mode staging`. If you have a plain `.env` overriding the
API URL, that is the cause.

### 5. Is the database reachable?

```bash
npm run db:status
```

A `db: MISSING DATABASE_URL` line in the startup banner means the root `.env`
was not picked up.

---

## Empty catalog after a fresh clone or reset

```bash
npm run db:seed
```

Restores packaging options, feature flags, the admin account, and the catalog
captured in `packages/database/prisma/content-backup.json`.

Confirm what is actually stored:

```bash
npm run db:studio
```

---

## Verifying a change

```bash
npm run verify        # unit + smoke + contract, all three
```

| Command | Needs API running | Covers |
|---|---|---|
| `npm test` | no | Pricing maths, IST reporting windows |
| `npm run smoke` | yes | Full journey, access control, DB writes |
| `npm run test:contract` | yes | Storefront ↔ API payload contract |

Both live suites create and then delete their own data.

---

## Database changes

```bash
# 1. edit packages/database/prisma/schema.prisma
# 2.
npm run db:migrate -- --name what_you_changed
```

**Never run `prisma db push`.** It writes to the database without recording a
migration, which is what caused the drift that required a baseline reset.
`npm run db:status` will tell you if the two have diverged.

For a rename or a type change, generate the SQL first and edit it before it
runs, otherwise Prisma will drop and recreate the column and lose the data:

```bash
npm run db:migrate -- --create-only --name rename_x
# edit the generated .sql, then
npm run db:deploy
```

---

## Feature flags

Flags live in the `FeatureFlag` table, not in code. Toggle them in the admin
console under Feature Flags, or directly:

```bash
npm run db:studio
```

The storefront reads them through `StoreConfigContext`, so a change takes
effect on the next page load. Unknown flags read as **off**.

> `ENABLE_WEBSITE_PAYMENT` is on in development while Razorpay is still in mock
> mode, where signature verification is bypassed. Do not ship that combination
> to production.
