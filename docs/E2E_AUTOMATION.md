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

Every command for running, watching and debugging these is in
[COMMANDS.md](./COMMANDS.md).

## The journey spec

`storefront/journey.spec.ts` is the one that takes no shortcut. Every other
spec plants a session in localStorage, seeds a cart over the API, or reaches a
product by deep link — reasonable when a case is about one screen, but it means
nothing exercises the seams between screens, which is where integration
actually breaks.

That one registers by typing, browses to the shelf and clicks through to the
catalogue, opens a product by clicking its card, picks the size by clicking the
selector, raises the quantity in the drawer, fills the address form, pays, and
then finds the order in its own history. It asserts that the variant the
customer clicked is the variant they were sold — a default quietly winning
there is a bug nobody notices until delivery.

It is the slowest test in the suite and the one worth keeping green.

## Where the line between UI and API sits

The money cases (§5, §6) run against the API and assert on Postgres, not
through a browser. GST extraction, a gap-free invoice series and two buyers
racing for the last unit are not things a screen can show, and driving them
through Chromium would only make them slower and flakier without testing
anything more. What the browser is for is the part only a browser can answer —
whether a customer can actually get from a full cart to a paid order — which is
`storefront/checkout.spec.ts`.

## What it has found

Three real defects so far, none of which the unit tests could see:

- The product detail page had no stock awareness at all. A sold-out variant was
  fully buyable there, and the customer only found out at checkout when the API
  refused the order.
- The same page invented prices where the API sent none — the same fault that
  had already been removed from the server and from the listing mapper.
- Reordering an archived product called it "not available right now", which
  invites the customer back for something that is never coming back. Permanent
  and temporary now read differently.

One near-miss worth recording: a test that timed out mid-checkout had its
abandoned request land *after* cleanup swept, so the run failed with a foreign
key error that pointed at the fixture instead of the timeout. Cleanup now
re-sweeps immediately before deleting users, and it restores the stock an
order consumed — otherwise every run leaves the catalogue emptier than it
found it.

## Still to write

Coverage is the highest-risk paths, not yet the full 185 cases. In rough order
of what should come next: account management including erasure (§7), reviews
(§8), delivery and the driver round (§13), the admin catalogue (§11), and the
responsive and accessibility passes (§19).
