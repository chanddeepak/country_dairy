# Cashfree checkout theme

Values for the checkout branding screens, taken from the storefront's own
tokens in `apps/web/src/app/globals.css` so their window and our site do not
disagree about what the brand looks like.

**Enter these without the `#`** — Cashfree's fields take bare hex.

Every pairing below was measured. The ratio column is the contrast of that
colour against what sits behind it; WCAG AA wants **4.5:1** for text and
**3:1** for a border or other non-text control.

## Header

| Field | Value | |
| --- | --- | --- |
| Header Colour | `1E3A2B` | forest — the site header and footer |
| Header Text Colour | `FFFFFF` | 12.39:1 |

## Layout and typography

| Field | Value | |
| --- | --- | --- |
| Corner Radius | `4` | **not 12.** The storefront uses `rounded-sm` 216 times and `rounded-md`/`lg` zero times — it is a squared-off, editorial look, and a 12px radius would make their window the roundest surface in the journey. Use `2` to match even more tightly |
| Primary Text Colour | `241E17` | ink — 16.5:1 |
| Secondary Text Colour | `6A6156` | ink-soft — 6.07:1 |

## 1. Primary buttons

| Field | Value | |
| --- | --- | --- |
| Active · Button Colour | `1E3A2B` | forest, as on our own Checkout button |
| Active · Text Colour | `FFFFFF` | 12.39:1 |
| Disabled · Button Colour | `F3EDE1` | cream |
| Disabled · Text Colour | `6A6156` | 5.21:1 |

**Why cream and not sand for the disabled fill.** `E6DCC9` was the obvious
brand choice and it lands at **4.47:1** — just under AA. Disabled controls are
formally exempt from the requirement, but a customer who cannot read why a
button is unavailable is not helped by the exemption.

## 2. Secondary buttons

| Field | Value | |
| --- | --- | --- |
| Active · Text Colour | `1E3A2B` | 12.39:1 |
| Active · Border Colour | `1E3A2B` | 12.39:1 |
| Disabled · Text Colour | `6A6156` | 6.07:1 |
| Disabled · Border Colour | `E0D7C6` | line — deliberately faint |

## 3. Tertiary buttons

| Field | Value | |
| --- | --- | --- |
| Active · Text Colour | `1E3A2B` | 12.39:1 |
| Disabled · Text Colour | `6A6156` | 6.07:1 |
| Button Shadow | **off** | nothing on the storefront carries a drop shadow. If the toggle cannot be turned off, `E0D7C6` is the least intrusive |

## Why forest and not the brass

Brass is the brand's accent, and it is the wrong choice for a button that has
to carry white text: `FFFFFF` on `B08D42` measures **3.12:1** and fails. Brass
works as *text* on a light ground — `856428` on white is 5.45:1 — which is why
the site uses it for eyebrows and small labels rather than for filled buttons.

The storefront's own primary button is `bg-forest` with white text, and its
secondary is a forest outline. The values above are the same two decisions, so
the gateway's window continues the checkout rather than interrupting it.

## Still to set in that console

The **brand name** currently reads `testMerchantName` and needs to be the real
one before anything goes live, and the **logo** upload beside it is empty.
Both are the first things a customer sees when the payment window opens.
