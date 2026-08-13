# Browser automation

Playwright, covering the storefront, the admin console and the API in one
suite. This is the executable half of [QA_TEST_PLAN.md](./QA_TEST_PLAN.md) —
that document is the specification, these are the cases that run.

## Why Playwright

Three origins: storefront on `:3000`, admin on `:5173`, API on `:4000`. A case
routinely needs two at once — sign in as a customer, then check what the
console shows about that customer. Playwright drives multiple origins in one
test as a matter of course; Cypress fights exactly that.

It also lets one suite drive the UI, call the API directly for setup and for
assertions the interface cannot make, and query Postgres through Prisma for the
database validations the QA plan specifies. So a case reads: click the thing,
see the screen, check the row.

## Running it

The three apps must already be running — see [RUNNING.md](./RUNNING.md).

```bash
npm run e2e              # everything
npm run e2e:storefront   # one project
npm run e2e:admin
npm run e2e:api
npm run e2e:ui           # watch mode, time-travel debugger
npm run e2e:report       # last HTML report
```

Filter by tag: `npx playwright test --grep @money`, and likewise `@security`,
`@auth`, `@flags`, `@responsive`.

## How it is put together

| Path | What it is |
|---|---|
| `playwright.config.ts` | Projects, timeouts, storage-state paths |
| `e2e/global.setup.ts` | Waits for the apps, signs each role in once |
| `e2e/global.teardown.ts` | Removes the run-scoped accounts |
| `e2e/fixtures/db.ts` | Prisma client, tracked fixtures, guarded cleanup |
| `e2e/fixtures/api.ts` | API client, user factories, sellable-variant lookup |
| `e2e/fixtures/actions.ts` | Selectors and shared flows, in one place |
| `e2e/storefront/`, `e2e/admin/`, `e2e/api/` | The cases |

Case names carry their QA plan id — `C6 · no price anywhere renders as NaN` is
§4 C6 — so a failure points at a documented expectation rather than only at a
line number.

## Rules worth keeping

**Never touch a real account.** Every spec creates its own customer with a
run-unique email. Reusing whichever customer happens to be first in the
database is how four test orders once ended up in a real person's order
history.

**Every id list goes through `only()`.** Prisma reads a `deleteMany` whose `in`
filter is `undefined` as *no filter*, and deletes every row. A cleanup
referencing a key its object does not have is therefore not a no-op — it is a
truncate. That emptied this project's User table once.

**Poll the database, do not read it once.** Add to cart is optimistic: the
confirmation appears before the server has acknowledged anything. Asserting
immediately measures the round trip's speed rather than its correctness.

**Wait for readiness, do not assert it.** A Next dev server recompiles on the
first request after a change and can take tens of seconds. That is not the same
as being down, and failing there aborts a whole run over a cold start.

**One worker.** Every project shares one database, and specs move stock, place
orders, and sign roles in and out. Two workers passed individually and failed
together — the worst possible property for something meant to gate production.
Isolating data per worker would buy the parallelism back; until then, slow and
honest.

**Selectors live in `actions.ts`.** The forms associate no labels with their
inputs, so a role-and-name selector matches nothing and fails only once the
action timeout expires — which turned one broken run into sixteen minutes
instead of thirteen seconds. Prefer a `data-testid`, added to the component,
over a text selector that breaks when the copy is edited.

## What it found on its first run

Two real defects, neither of which the API tests could see:

- The product detail page had no stock awareness at all. A sold-out variant was
  fully buyable there, and the customer only found out at checkout when the API
  refused the order.
- The same page invented prices where the API sent none — the same fault that
  had already been removed from the server and from the listing mapper.

## Still to write

Coverage is the highest-risk paths, not yet the full 185 cases. In rough order
of what should come next: checkout and payment (§5), orders, reorder and
invoicing (§6), account management including erasure (§7), reviews (§8),
delivery and the driver round (§13), the admin catalogue (§11), and the
responsive and accessibility passes (§19).
