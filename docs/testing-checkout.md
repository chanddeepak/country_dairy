# Checkout, tested

What was actually driven through a browser against the Cashfree sandbox on
29 August 2026, what it proved, and what is still untested.

Every row below was run by driving the real storefront — adding to the basket,
opening Cashfree's modal, completing their OTP, entering an address and paying
through their net-banking simulator — then reading the database to see what
landed. Screenshots for each step are in the run artefacts.

**The sandbox OTP for the One Click Checkout login step is `111000`.** It is the
code their test-data page documents for cards, and it is documented nowhere for
this step, but it works. Nothing else unblocks the flow.

---

## What passed

| # | Scenario | Verified |
| --- | --- | --- |
| 1 | Guest, number never seen before | Account created from the phone Cashfree verified — with the email and name from the **address**, not the placeholder in `customer_details`. Order PAID, claim token consumed. |
| 2 | Guest, number that already has an account | **One account, not two.** The second purchase attached to the existing customer. |
| 3 | Signed in with our OTP, own number | Number prefilled in Cashfree, order created against their account. |
| 4 | **Signed in, ordering for someone else** | The important one — see below. |
| 5 | No saved address anywhere | Cashfree's address form collects one; the order ships to it with `source: cashfree`. |
| 6 | **Discounted order** | Totals rewritten from what was charged, GST recomputed. See below. |
| 7 | Abandoned at the payment screen | Order stays PENDING and unowned, and the claim token is **not** consumed — the customer may still pay. |
| 8 | Entry from home, listing and product detail | All three open Cashfree in place, URL unchanged. |
| 9 | Admin WhatsApp button | Opens `wa.me` with the right number, name, order number and the **reconciled** total. |

---

## 4. Ordering for someone else

The rule: *what a customer told us outranks what a gateway returns; checkout
details describe the delivery, not the buyer.*

Customer `+91 9766170764`, signed in with our OTP, paid for a delivery to
"Recipient Person" in Mumbai with a different email. Afterwards:

```
customer A account -> email: null | name: null
customer A orders  -> CD-2026-118, CD-2026-119
order CD-2026-119  -> ships to: Recipient Person | Mumbai | source: cashfree
```

The buyer's account absorbed **none** of the recipient's details, and the order
stayed in the buyer's history rather than moving to the person it ships to.
Reassigning it would have been worse than the bug it avoids — the customer who
paid would lose the order.

Locked in by `confirm-ownership.spec.ts`, whose eight cases were checked by
sabotaging the guard: three fail when it is removed.

---

## 6. The discounted order, and the bug it found

A flat ₹200 offer (`TESTFLAT200`, auto-apply) was created in their dashboard,
and this is what it exposed:

| | |
| --- | --- |
| `GET /orders/{id}` → `order_amount` | **1450** — what we asked for |
| `GET /orders/{id}/payments` → `payment_amount` | **1250** — what was taken |

**`order_amount` does not move when an offer applies.** The reconciliation code
had been written, unit-tested and committed reading `order_amount`, so it
compared 1450 against 1450, concluded nothing had changed, and left the order at
the undiscounted figure with ₹155.36 of GST — an invoice overstating the price
and the tax by sixteen percent, with nothing looking wrong anywhere.

All 56 unit tests passed throughout. Seven worked examples proved the
apportionment arithmetic was right, and proved nothing about which field was
feeding it.

After reading `payment_amount` instead:

```
our original line total : ₹1450
subtotal   ₹1450   discount ₹200
tax (incl) ₹133.93  TOTAL   ₹1250   payment ₹1250
1250 - 1250/1.12 = 133.93  ✓
```

---

## Still untested

- **Refunds**, and what a refund means once an offer has been applied.
- **COD**, where no money moves through the gateway.
- **The webhook winning the race** against the browser's return. The guard is
  proven in isolation; the two have not been made to collide for real.
- **Production.** One Click Checkout is activated in Test and **not** in
  Production, which shows a "Request Activation" button. Everything above is
  sandbox only.
- **Real messages.** No OTP or order notification has ever been delivered to a
  phone; `OTP_DEV_CODE` carries sign-in, and the admin WhatsApp button needs a
  human to press send.

---

## What the run turned up in passing

**Twenty abandoned orders were holding stock.** Every checkout that was started
and not paid for kept its jars reserved, for ever, because nothing releases
them — `restockAndCancel` only runs on an explicit cancellation and there is no
scheduler in the application at all. Cleared by hand after this run. This is
task E1 and it is not hypothetical.

**Cashfree remembers a browser.** A second checkout from the same browser
skipped the mobile and OTP steps entirely and opened on the saved address. So a
returning customer is not necessarily OTP'd twice, and the friction in §4.1 of
the plan is smaller than it looked.

**Their placeholders are convincing.** A real payment returned
`customer_name: "Cashfree Customer"` and `customer_email: "test123@gmail.com"`
in `customer_details`, while the address block held the customer's actual name
and email. Reading the obvious field would have written that placeholder into a
real account.

---

## Sandbox test data

Everything below is Cashfree's own test data. It only works against
`sandbox.cashfree.com` — none of it moves money.

**The One Click Checkout login step: `111000`.** This is the one that matters
and the one they do not document. It is listed for cards, works on the OCC login
too, and nothing else gets past that screen. Sandbox does not deliver a real SMS,
so waiting for one is waiting for nothing.

**Cards** — expiry `03/2028`, CVV `123`, name `Test`, then OTP `111000`:

| Card | Number |
| --- | --- |
| Visa debit | `4706131211212123` |
| Visa credit | `4444333322221111` |
| Mastercard debit | `5409162669381034` |
| Mastercard credit | `5105105105105100` |
| RuPay debit | `6074825972083818` |

**UPI** — the outcome is chosen by the VPA:

| VPA | Simulates |
| --- | --- |
| `testsuccess@gocash` | paid |
| `testfailure@gocash` | declined |
| `testinsufficientfunds@gocash` | not enough balance |
| `testtimeoutbank@gocash` | bank timeout |
| `testfraud@gocash` | risk rejection |

**Net banking** is the easiest to drive and needs no card details at all. Pick
any bank and their simulator opens with buttons for **SUCCESS**, **PENDING**,
**USER_DROPPED** and **FAILED**, plus an OTP box that takes `111000`. This is
what the scenario runs above use, deliberately: automating card numbers into a
payment form is not something worth doing when a plain success/failure page
exists.

**Cardless EMI and Paylater**: phone `8714268343`, PAN digits `1234`, OTP
`777777`.

**To test a failed payment**, choose FAILED in the net-banking simulator or pay
with `testfailure@gocash`. The order should stay PENDING with
`paymentStatus: FAILED` — deliberately retryable — and the abandoned-order sweep
cancels it and returns the stock an hour later.

---

## Running it again

The driver lives in the run artefacts rather than the repo, since it depends on
sandbox state and a live Cashfree offer. The parts worth keeping:

- A **fresh browser context per scenario** — Cashfree remembers an
  authenticated browser, so reusing one silently skips the OTP step.
- **Wait 20 seconds** before screenshotting their modal. It takes 15–20 seconds
  to paint, and a screenshot at six shows a blank box. Two wrong conclusions in
  this project came from exactly that.
- Their iframe's `src` attribute is **empty** in the DOM even though the frame
  has navigated, so `iframe[src*=...]` matches nothing. Find it by frame URL.
- Field ids on their address form: `customer_name`, `zip_code`, `city`,
  `address_line_one`, `address_line_two`, `email`. Read off the live form, not
  guessed — guessing their field names has produced three silent-drop bugs here.
