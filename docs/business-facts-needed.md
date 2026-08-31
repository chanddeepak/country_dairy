# Facts the policy pages need

`/privacy`, `/terms`, `/shipping-and-returns` and `/faq` are written and live.
**22 facts in them are decisions only you can make**, and each one renders on
the page as a highlighted `[marker]` — so nothing reads as finished until it
is answered.

Fill in the **Your answer** column, tell me, and I will put them in. Or edit
the pages directly: search for `<Pending>` in `apps/web/src/app/*/page.tsx`.

Nothing here is invented. Where a common practice exists I have said so, but
the answer is yours — a made-up return window on a page whose whole job is
being trusted is worse than a visible blank.

---

## 1. Legally required

These are not preferences. A food business selling online in India has to
publish them.

| # | Fact | Where it appears | Your answer |
| --- | --- | --- | --- |
| 1 | **FSSAI licence number** | Terms | |
| 2 | **Legal entity name** — the registered name, e.g. "Country Dairy Foods Pvt Ltd" or a proprietorship's registered name | Privacy, Terms | |
| 3 | **GSTIN** | Privacy, Terms | |
| 4 | **Grievance officer** — name and email. Required under the IT Rules; it can be a director or the owner | Privacy | |

## 2. Needed before a gateway will activate you

One Click Checkout is still awaiting production activation, and this is the
part of the site that review looks at.

| # | Fact | Where it appears | Your answer | Notes |
| --- | --- | --- | --- | --- |
| 5 | **Return window** — how many days a sealed, unopened jar can come back | Shipping & Returns | | 7 days is the common default |
| 6 | **Who pays return postage** when the return is a change of mind | Shipping & Returns | | Usually the customer, unless the fault was yours |
| 7 | **Damage-report window** — how long to report a leaking or wrong item | Shipping & Returns | | 48 hours with a photograph is typical for food |
| 8 | **Refund processing time** — from approval to your sending it | Shipping & Returns | | Distinct from the 5–7 working days the bank then takes |
| 9 | **Whether COD is offered** | FAQ | | Currently unbuilt (task E4). "No" is a valid answer today |

## 3. Delivery promises

Say only what you can keep — these become the standard a complaint is measured
against.

| # | Fact | Where it appears | Your answer |
| --- | --- | --- | --- |
| 10 | **Packing days** — every day, or particular ones? | Shipping & Returns | |
| 11 | **Dispatch window** — how long after an order before it leaves | Shipping & Returns | |
| 12 | **Local delivery timeline** — the Tanakpur round | Shipping & Returns | |
| 13 | **Courier timeline** — rest of India | Shipping & Returns | |

## 3b. Added after comparing against Anveshan and Two Brothers

Both competitors carry these and we did not. The natural-variation clause is
the one with money attached.

| # | Fact | Where it appears | Your answer | Notes |
| --- | --- | --- | --- | --- |
| 18 | **CIN**, if the entity is a registered company | Privacy | | Both competitors publish theirs |
| 19 | **Whether an unboxing video is required** for a missing-item claim | Shipping & Returns | | Two Brothers requires one; it settles disputes but adds friction |
| 20 | **Claim response time** | Shipping & Returns | | Anveshan commits to 24–48 hours |
| 21 | **Whether return-to-origin costs are passed on**, and how much | Shipping & Returns | | Anveshan charges reverse logistics on refused or undeliverable orders |
| 22 | **Whether returns are replacement-only** rather than refund | Shipping & Returns | | Two Brothers replaces and does not refund. Ours currently offers both |

## 4. The rest

| # | Fact | Where it appears | Your answer | Notes |
| --- | --- | --- | --- | --- |
| 14 | **Data retention period** for invoices | Privacy | | Tax law sets the floor — commonly 8 years for GST records |
| 15 | **Response window** for a privacy request | Privacy | | 30 days is the usual commitment |
| 16 | **Jurisdiction** — whose courts apply | Terms | | Typically where the business is registered |
| 17 | **Opened shelf life** of a jar of ghee | FAQ | | Whatever your own testing supports |

---

## Two things to fix while you are here

**The free-delivery figure disagrees with itself.** The announcement bar says
"Free shipping over ₹499"; `FREE_DELIVERY_THRESHOLD` in the pricing code is
`500`. Whole-rupee baskets land the same either way, so nothing is broken
today, and the policy pages state ₹500 because that is what the code charges
on. Worth making the banner say the same number.

**A lawyer should read all four before launch.** They are specific and honest
about what the system actually does, which is the hard part — but they are not
legal advice, and the four items in §1 carry statutory consequences.

## What the pages already state correctly

Taken from the code, not assumed, so these need no decision:

- Free delivery at ₹500 and above, a flat ₹40 below it
- Prices include GST, and a discounted order is taxed on what was charged
- Sign-in is by one-time code to a mobile number; there is no password
- Cashfree takes the payment; card and UPI details never reach our servers
- Each order keeps its own copy of the delivery address
- Closing an account erases the person and keeps the invoice, with the street
  and phone stripped out of it
- **No cookies are set at all** — only browser storage for the session, the
  basket and an interrupted checkout
