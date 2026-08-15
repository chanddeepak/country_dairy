# Command reference

Every command this project is driven with, in one place. Grouped by what you
are trying to do rather than by which tool it belongs to.

Run everything from the repo root unless a command says otherwise.

- [Running the apps](#running-the-apps) · [Mobile](#mobile-app)
- [Checking what is up](#checking-what-is-up)
- [Database](#database) · [Migrations](#creating-a-migration) · [Storage](#storage) · [Payments](#payments) · [Environment](#environment)
- [Tests — the fast ones](#tests--the-fast-ones)
- [Tests — browser and end-to-end](#tests--browser-and-end-to-end)
- [Watching a run happen](#watching-a-run-happen)
- [When a test fails](#when-a-test-fails)
- [Long runs without sitting and watching](#long-runs-without-sitting-and-watching)
- [Build and lint](#build-and-lint)
- [Git](#git)
- [Finding things](#finding-things)
- [Ports and URLs](#ports-and-urls)
- [Credentials](#credentials)

---

## Running the apps

The API must be up before the storefront or console will show anything. Three
terminals, or `npm run dev` for all of them at once through Turborepo.

```bash
npm run dev                              # everything, via turbo

cd apps/api   && npm run start:dev       # terminal 1 — API      :4000
cd apps/admin && npm run dev             # terminal 2 — console  :5173
cd apps/web   && npm run dev             # terminal 3 — storefront :3000
```

The API prints a banner on startup naming its env, allowed origins, database
and payment mode. No banner means it is not up, and every console page will say
"Could not reach the API server". See [RUNNING.md](./RUNNING.md) for the
troubleshooting ladder.

Production mode locally, when a dev-server behaviour is suspected of hiding
something:

```bash
cd apps/api   && npm run build && npm run start:prod
cd apps/web   && npm run build && npm run start
cd apps/admin && npm run build && npm run preview
```

Attach a debugger to the API:

```bash
cd apps/api && npm run start:debug       # then chrome://inspect, or the IDE
```

### Mobile app

Expo, and not yet wired to live data — see task #13.

```bash
cd apps/mobile
npm run dev                              # Expo dev server + QR code
npm run ios                              # iOS simulator
npm run android                          # Android emulator
npm run web                              # in a browser
npm run build                            # typecheck only (tsc --noEmit)
```

---

## Checking what is up

The end-to-end suite refuses to start unless all three answer, so this is
usually the first thing to run when a run fails at setup.

```bash
# all three at once — 200, 404, 200 is healthy
for p in 3000 4000 5173; do
  printf "port %s: " "$p"
  curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:$p"
done

# the API's root is 404 by design — this is the real check
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/api/catalog/products
```

`:4000` returning 404 at the root is expected — the API is mounted under
`/api`, and nothing is served at `/`.

```bash
lsof -i :4000                            # what is holding a port
kill -9 $(lsof -t -i:4000)               # free it
```

---

## Database

```bash
npm run db:studio                        # Prisma Studio, browse and edit rows
npm run db:status                        # migrations applied vs pending
npm run db:generate                      # regenerate the client after a schema edit
npm run db:seed                          # reseed catalogue, admin, hero banners
npm run db:deploy                        # apply pending migrations
```

Seed a specific admin password:

```bash
SEED_ADMIN_PASSWORD='your-password' npm run db:seed
```

### Creating a migration

`npm run db:migrate` is `prisma migrate dev`, which prompts. In a non-TTY it
fails, and when it decides a reset is needed it will offer to drop the database
— which is not something to find out mid-command. From an agent or a script,
generate the SQL and deploy it in two explicit steps instead:

```bash
# 1 · diff the schema against the live database, as SQL
npx dotenv -e .env -- npx prisma migrate diff \
  --from-schema-datasource packages/database/prisma/schema.prisma \
  --to-schema-datamodel packages/database/prisma/schema.prisma \
  --script > packages/database/prisma/migrations/<timestamp>_<name>/migration.sql

# 2 · read the SQL, then apply it
npm run db:deploy
npm run db:generate                      # regenerate the client afterwards
```

Read the generated SQL before deploying. A `DROP COLUMN` in there is the
warning you get.

### Storage

Media lives in Supabase Storage across four buckets: `hero-banners`,
`products`, `review-media`, `lab-reports`. The API deletes the old object when
one is replaced, so the buckets do not accumulate orphans.

```bash
npm run test:media                       # upload, delete, orphan sweep
npm run test:cleanup                     # old file removed when one is replaced

curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/media/orphans          # what is unreferenced

curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"dryRun":true}' \
  http://localhost:4000/api/media/orphans/sweep    # dry run first, always
```

Both endpoints are staff-only.

### Payments

Razorpay runs in **mock mode** whenever keys are absent — gateway ids come back
as `order_mock_*` and signature checks are bypassed. That is what lets the e2e
suite pay for an order through the real endpoint. The API banner says which
mode it is in.

```bash
npm run test:webhook                     # signature verification + idempotency
```

Going live means setting `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and
`RAZORPAY_WEBHOOK_SECRET`. The webhook secret is set in the Razorpay dashboard
under Settings → Webhooks and is **not** the same value as the key secret;
without it every webhook is rejected, and a customer who closes the browser
after paying leaves their order unconfirmed.

### Environment

One `.env` at the repo root, read by every workspace through `dotenv -e`.

| Variable | For |
|---|---|
| `DATABASE_URL` | Prisma, through the Supabase pooler |
| `DIRECT_URL` | Migrations, bypassing the pooler |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Storage uploads and deletes |
| `SUPABASE_ANON_KEY` | Public reads |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Live payments; absent means mock mode |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook signature verification |
| `SEED_ADMIN_PASSWORD` | Password `db:seed` gives the admin |

`apps/web/.env.staging` and `apps/admin/.env.staging` hold the deployed API URL
for those builds.

---

## Tests — the fast ones

Script-based checks that talk to the API directly. Seconds each, and the first
thing to run after touching a service.

```bash
npm test                                 # API unit tests (Jest, apps/api)
npm run verify                           # every script check below, in order

cd apps/api && npm run test:watch        # re-run on save while working
cd apps/api && npm run test:cov          # coverage report
cd apps/api && npm run test:debug        # --inspect-brk, runInBand

npm run smoke                            # API is alive and answering
npm run test:contract                    # storefront's expectations of the API
npm run test:catalog                     # catalogue read/write audit
npm run test:media                       # upload, delete, orphan sweep
npm run test:lab                         # lab reports
npm run test:delivery                    # routes, driver assignment
npm run test:webhook                     # Razorpay webhook signature + idempotency
npm run test:address                     # address CRUD and ownership
npm run test:session                     # tokens, expiry, deactivation
npm run test:cleanup                     # media cleanup on replace/delete
npm run test:account                     # reorder, erasure, preferences, invoice
```

`npm run verify` is the gate to run before committing anything that touches the
API.

---

## Tests — browser and end-to-end

Playwright. Drives the storefront and console in a real browser, calls the API
directly, and asserts against Postgres. **All three apps must already be
running.**

```bash
npm run e2e                              # the whole suite
npm run e2e:api                          # API + database cases only
npm run e2e:storefront                   # storefront, real browser
npm run e2e:admin                        # admin console, real browser
```

By file, by name, by tag:

```bash
npx playwright test e2e/api/money.spec.ts
npx playwright test e2e/storefront/journey.spec.ts --project=storefront

npx playwright test --grep @money        # also: @security @auth @flags @responsive
npx playwright test --grep-invert @money

npx playwright test -g "invoice"         # match the test's name
npx playwright test --list               # what would run, without running it
```

Projects, and which specs each one picks up:

| Project | Runs | Notes |
|---|---|---|
| `setup` | `global.setup.ts` | Waits for the apps, signs each role in once |
| `api` | `e2e/api/*.spec.ts` | No browser. HTTP + Prisma assertions |
| `storefront` | `e2e/storefront/*.spec.ts` | Chromium, desktop |
| `storefront-mobile` | the `@responsive` ones only | Pixel 7 viewport |
| `admin` | `e2e/admin/*.spec.ts` | Chromium, desktop |
| `teardown` | `global.teardown.ts` | Removes run-scoped accounts |

Selecting a project runs `setup` automatically — it is declared as a
dependency, so there is no need to name it.

---

## Watching a run happen

```bash
npm run e2e:ui                           # Playwright UI: pick tests, watch, time-travel
npx playwright test --headed             # watch the real browser click through
npx playwright test --headed --project=storefront -g "journey"
npx playwright test --debug              # step through with the inspector
npx playwright test --headed --slow-mo=500   # slow enough to follow by eye
```

`--ui` is the one to reach for while writing a test. `--headed` is the one to
reach for when someone asks whether it is really clicking.

Record a new test by clicking through the app:

```bash
npx playwright codegen http://localhost:3000
```

---

## When a test fails

```bash
npm run e2e:report                       # HTML report from the last run
npx playwright show-trace e2e/.artifacts/<test-dir>/trace.zip
```

The trace viewer is the fastest way to a diagnosis: it has a DOM snapshot at
every step, the network log, and the console. Screenshots, traces and an
`error-context.md` land in `e2e/.artifacts/` per failing test.

```bash
npx playwright test --retries=1          # confirm a suspected flake
npx playwright test --repeat-each=3      # hammer one test
npx playwright test --workers=1          # the default here, and why is below
```

**The suite runs single-worker on purpose.** Every project shares one database,
and specs move stock, place orders and sign roles in and out. Two workers
passed individually and failed together — the worst possible property for
something meant to gate a release.

---

## Long runs without sitting and watching

The full suite takes minutes, not seconds — the database is a region away and
every assertion pays for the trip. Send it to the background and let it tell
you.

```bash
# run it, keep the terminal
npx playwright test --reporter=line > /tmp/e2e.log 2>&1 &

# get told when it finishes
until grep -qE "[0-9]+ (passed|failed)" /tmp/e2e.log; do sleep 10; done; echo done

# just the verdict and the failures
grep -E "[0-9]+ (passed|failed)|✘|Error:" /tmp/e2e.log | tail -20
```

Two runs must never overlap. They share one database, and the second will
delete fixtures the first is still using. Chain them instead:

```bash
until grep -qE "[0-9]+ (passed|failed)" /tmp/first.log; do sleep 10; done
npx playwright test --project=storefront --reporter=line
```

`--reporter=line` is the one to use for a logged run — the default reporter
redraws in place and turns a log file into thousands of escape codes.

---

## Build and lint

```bash
npm run build                            # turbo build across all workspaces
npm run lint
npm run clean                            # git clean -xdf node_modules
npx tsc --noEmit --project apps/web      # typecheck one app without building
```

---

## Git

The mobile app is a nested checkout and shows as dirty constantly, so it is
excluded rather than committed by accident.

```bash
git add -A ':!apps/mobile'
git status --short
git log --oneline -10

# a commit message with backticks, ?? or parentheses breaks a zsh heredoc —
# write it to a file instead
git commit -F /tmp/commitmsg.txt
```

`e2e/.artifacts/` and `e2e/.report/` are gitignored. `git add -A` will refuse
them by name; leave them out.

---

## Finding things

```bash
npx playwright test --list               # every case the suite knows about
grep -rn "data-testid" apps/web/src      # what the specs can hook onto
find apps/web/src/app -name "page.tsx"   # every storefront route that exists
```

That last one is worth knowing: a test asserted against `/orders` for a while,
which does not exist — order history is a tab on `/account`. Checking the
routes is faster than reading a timeout.

---

## Ports and URLs

| What | URL |
|---|---|
| Storefront | http://localhost:3000 |
| API | http://localhost:4000/api |
| Admin console | http://localhost:5173 |
| Prisma Studio | http://localhost:5555 |

Override for a run against something other than localhost:

```bash
E2E_WEB_URL=... E2E_API_URL=... E2E_ADMIN_URL=... npm run e2e
```

---

## Credentials

| App | Who | Credentials |
|---|---|---|
| Admin console | seeded admin | `admin@countrydairy.in` / `ChangeMe#2026` |
| Storefront | any customer | register through the site |

The e2e suite never signs in as a real customer — every spec registers its own
throwaway account with a run-unique address, because a spec that writes to
whichever customer happens to be first in the database puts test orders in
someone's real order history. It has happened here.

Anything the suite reads can also live in the root `.env` — `playwright.config.ts`
loads it — which is the tidier place for a password you would otherwise retype
on every run:

```bash
E2E_ADMIN_PASSWORD="whatever you seeded with"
```

Override the admin the suite uses:

```bash
E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... npm run e2e
```

---

## Related

- [RUNNING.md](./RUNNING.md) — starting the apps, and what to do when one will not talk to another
- [E2E_AUTOMATION.md](./E2E_AUTOMATION.md) — how the browser suite is built and the rules it follows
- [QA_TEST_PLAN.md](./QA_TEST_PLAN.md) — the 185 manual cases the automation is drawn from
