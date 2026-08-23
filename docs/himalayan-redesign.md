# Himalayan redesign, migration plan

**Branch:** `feature/himalayan-redesign`, cut from `dev` at `41e7000`.
**Status:** nothing built. This document is the source of truth for the work.

The design is approved from the concept at
`claude.ai/code/artifact/9df55861-7ea2-4fcc-9068-11bf930d55e8`. That concept is a
mock. It uses typeset text where the real logo goes, invents a review score, and
shows categories we do not stock. Everything below reconciles it with what is
actually in `dev`.

**Rule for every task in this document:** the redesign changes how the storefront
looks, never what it does. A flow that works on `dev` works identically when this
merges, on the same URL, with the same data.

---

## 1. The design system

Decided, not open for re-litigation while building. Anything not listed here is a
judgement call to be made in the moment and then added to this table.

### Colour

| Token | Hex | Used for |
| --- | --- | --- |
| `forest` | `#1E3A2B` | Navigation, dark bands, footer, primary buttons |
| `pine` | `#2F5741` | Secondary dark surfaces |
| `ivory` | `#FBF8F1` | The page ground, most of the site |
| `cream` | `#F3EDE1` | Alternating section ground |
| `sand` | `#E6DCC9` | Image placeholders, dividers |
| `earth` | `#6B5340` | Category grounds, tertiary surfaces |
| `terra` | `#B4593C` | Sparingly, category grounds only |
| `brass` | `#B08D42` | The single accent: eyebrows, the italic in a headline, hover |
| `ink` | `#241E17` | Body text |
| `ink-soft` | `#6A6156` | Secondary text |
| `line` | `#E0D7C6` | Hairlines |

The existing brand green `#3A6038` and gold `#C59B27` are **superseded** by
`forest` and `brass`. They are close relatives, not a different brand. Anything
still referencing the old two after migration is a miss.

### Type

| Role | Face | Notes |
| --- | --- | --- |
| Display | **Newsreader**, 300 and 400 | Headlines, brand statements, product names. Italic in `brass` for emphasis |
| UI and body | **Jost**, 300 to 600 | Navigation, prices, buttons, forms, tables, everything transactional |

Both from Google Fonts, loaded via `next/font` rather than a `<link>`, so there is
no render-blocking request and no silent fallback.

Numerals in prices, quantities and any column of figures get
`font-variant-numeric: tabular-nums`.

### The contour signature

Himalayan topographic lines, drawn on `<canvas>` and redrawn on resize. Never
hand-authored SVG path data, which cannot adapt to a container.

Placement: solid-colour grounds only. Very faint over photography, masked so it
fades in from the middle. It is a watermark, not a texture.

Respects `prefers-reduced-motion` by not animating.

---

## 2. What exists in `dev` today

Counted, not assumed, on 21 August 2026.

### Storefront routes, all of which must survive at the same URL

| Route | Redesign work |
| --- | --- |
| `/` | Rebuilt. The largest single piece |
| `/products` | Restyled. Filter drawer and category chips keep working |
| `/products/[slug]` | Restyled. Gallery, variants, tabs, reviews all keep working |
| `/category/[slug]` | Restyled. Type filters keep working |
| `/checkout` | Restyled only. Do not touch the logic |
| `/checkout/shiprocket-return` | Restyled only |
| `/account` | Restyled. Tabs, addresses, orders, queries |
| `/orders/[orderId]` | Restyled |
| `/orders/[orderId]/invoice` | **Leave alone.** It is a printable document, not a page |
| `/purity/[batch]` | Restyled |

### Components, 20 across 9 folders

`layout/` Navbar, Footer, CategoryBar · `home/` HeroSection, ProductShelf,
AboutSection, ValueBanner · `product/` ProductCard, ProductGallerySlider,
FilterDrawer, ReviewSection, ReviewCard, ReviewForm, ReviewSummary,
LabReportPanel · `cart/` CartDrawer · `modals/` AuthModal, SubscriptionModal ·
`account/` QueriesTab · `address/` StateSelect · `ui/` Badge, StarRating ·
`ContactForm`

### The eight flags that gate storefront behaviour

`ENABLE_CART`, `ENABLE_USER_ACCOUNTS`, `ENABLE_PRODUCT_RATINGS`,
`ENABLE_SUBSCRIPTIONS`, `ENABLE_WALLET`, `ENABLE_OTP_LOGIN`,
`ENABLE_GOOGLE_LOGIN`, `ENABLE_SHIPROCKET_CHECKOUT`

Every one of these hides or shows real UI. The redesign must render correctly
with each **on and off**. A design that only works with the cart enabled is not
done.

### The data actually in the database

| | Count |
| --- | --- |
| Categories | 4 (Ghee with one type, plus Oils, Honey, More) |
| Products | 1 |
| Variants | 2 |
| Trust badges | 3 |
| Hero banners | 4 |
| **Product reviews** | **0** |
| Orders | 6 |
| Users | 27 |

---

## 3. Where the concept and the reality disagree

Four places. Each needs a decision before the section it affects is built.

### 3.1 The logo is not what the mock shows

`apps/web/public/images/logo-icon.png` is **1592x988, RGB, no alpha channel**, a
dark green wordmark on solid white. The mock typeset "COUNTRY DAIRY" in
Newsreader instead.

On the forest navigation the real file renders as a white rectangle.

**Needed:** a reversed logo (ivory wordmark, transparent background) for dark
surfaces, and an alpha-cut version of the existing green wordmark for light
surfaces. Both as SVG if the original artwork exists, otherwise PNG at 3x.
Until those exist the navigation cannot be finished.

### 3.2 There are no reviews

The concept shows a review section with three quotes, and product cards showing
`4.8 (126)`. **The database holds zero reviews.** Those numbers were invented for
the mock and must not ship.

**Decision needed.** Either seed genuine reviews with permission, or the review
section and the rating on the card render only when reviews exist. The second is
the honest default and is what will be built unless told otherwise.

### 3.3 Three of the four categories are empty

Oils, Honey and More From the Hills have no products. The concept renders them as
tinted contour tiles marked as arriving, which is deliberate and honest, and it
delivers the brief's requirement that the site not look like a ghee-only shop.

Keep that treatment. When a category gains its first product, the tile becomes a
photograph automatically, driven by `productCount` from the nav tree.

### 3.4 The hero banners carry their text as pixels

`HeroBanner` **already** has `title`, `subtitle`, `ctaText`, `ctaLink`,
`badgeText`, an `imageHasText` flag and a JSON text-layout column. The schema is
not the problem.

All four rows have `imageHasText = false` and titles that are blank or a single
space, while the artwork itself carries "Country Dairy / Pure Himalayan Goodness"
and four benefit icons burned in.

So this is a **content problem, not a code problem**: clean artwork with no text,
and the real headline typed into the `title` field.

**Needed:** hero photography without lettering, at 2560px wide, desktop and
mobile crops. This is the single largest asset dependency in the project.

---

## 4. UX flows that must keep working

Each row is a flow a customer can complete on `dev` today, and the test that
proves it still works. **No flow may regress.** If a redesign makes one of these
tests fail, the design changes, not the test.

| # | Flow | Proven by |
| --- | --- | --- |
| F1 | Browse the homepage, filter by category chip, open a product | `home-filter.spec.ts` |
| F2 | Browse the shop, filter by size in the drawer, clear from the chip | `products-filter.spec.ts` |
| F3 | Open a category page, filter by type, see counts that match the grid | `category-page.spec.ts` |
| F4 | Reach every category from the nav bar, on desktop and phone | `category-bar.spec.ts` |
| F5 | Open a product, switch variant, read the tabs | `product-tabs.spec.ts`, `shop-variants.spec.ts` |
| F6 | Add to cart as a guest, then sign in and keep the basket | `guest-cart.spec.ts`, `cart.spec.ts` |
| F7 | Register, sign in, stay signed in across a reload | `session.spec.ts` |
| F8 | Add an address with PIN lookup filling town and state | `account-address.spec.ts`, `checkout.spec.ts` |
| F9 | Complete checkout and see the order | `checkout.spec.ts`, `journey.spec.ts` |
| F10 | Express checkout with Shiprocket, behind its flag | `shiprocket-checkout.spec.ts` |
| F11 | Ask a question, read the reply in the account | `support.spec.ts` |
| F12 | See a sold-out size, and the provenance seal and batch report | `stock-visibility.spec.ts`, `provenance-seal.spec.ts` |

### The selector contract

47 `data-testid` attributes are a contract between the storefront and the suite.
**Renaming or removing one breaks a test that is protecting a real flow.** They
carry no styling and never need to change for a visual redesign.

If a redesign genuinely removes an element that carries one, the flow itself has
changed, which is out of scope for this branch and needs a separate decision.

Full list, do not edit without cause:

```
account-city account-pincode-note account-postal-code add-address add-to-cart
address-city address-form address-pincode applied-filter ask-a-question
auth-modal cart-count category-bar category-bar-link category-bar-more
category-bar-skeleton checkout-now confirm-payment contact-body contact-email
contact-form contact-name contact-subject filter-apply filter-close
filter-drawer filter-open gallery-main gallery-next gallery-prev
mobile-category-link mobile-menu-toggle open-auth open-cart pincode-note
place-order product-card-link qty-decrease qty-increase query-body query-reply
query-row shiprocket-checkout shiprocket-error signup-name toggle-register
variant-option
```

---

## 5. Admin console changes

The console is not being redesigned. It needs changes only where it feeds the new
storefront.

| # | Page | Change | Why |
| --- | --- | --- | --- |
| A1 | `HeroManager` | Make `title` and `subtitle` required and prominent; warn when artwork is uploaded while they are empty | The new hero renders real text. An empty title now means an empty headline, not a poster |
| A2 | `HeroManager` | Surface `imageHasText` clearly, with guidance that the new design wants artwork without lettering | Currently invisible in the UI while the artwork disagrees with it |
| A3 | `CategoryCMS` | Add the category image field to the form | `Category.imageUrl` exists, is null on all four rows, and the new collection tiles want it |
| A4 | `CategoryCMS` | Keep `iconName` visible | The nav bar and filters already render it |
| A5 | `TrustBadgesCMS` | Review the three badges against the new "what we hold ourselves to" section | Six principles in the design, three badges in the database |
| A6 | `ProductEditor` | Nothing required | Product fields already carry everything the new cards render |

Not in scope: restyling the console itself.

---

## 6. Assets required

Ordered by how much they block.

| # | Asset | Blocks | Notes |
| --- | --- | --- | --- |
| S1 | Reversed logo, ivory on transparent | The navigation, every page | See 3.1 |
| S2 | Logo with alpha, green on transparent | Light surfaces, invoice, emails | See 3.1 |
| S3 | Hero photography without lettering, 2560px, desktop and mobile | The homepage hero | The largest dependency |
| S4 | Category images for Dairy and Oils | The collection tiles | `Category.imageUrl` |
| S5 | Process photography: curd, churn, simmer | The product story section | Can ship without, section degrades to type |
| S6 | Kitchen and family lifestyle shots | Everyday rituals | Existing shots are usable for now |

Every product image currently in the gallery has marketing copy or the pack's back
label burned in. Ten images, and finding clean crops meant cropping around text.
**A photography shoot is the highest-leverage thing outside this branch.**

---

## 7. Tasks

In order. Each task states how it is verified. A task is not done until its
verification passes.

### Phase 1, foundation

| # | Task | Verified by |
| --- | --- | --- |
| T1 | Add design tokens as CSS custom properties in one place; wire Newsreader and Jost through `next/font` | Both faces render, no FOUT, no `<link>` to Google |
| T2 | Build the contour canvas as a reusable component with resize handling and reduced-motion support | Renders at three widths without stretching |
| T3 | Produce and commit the two logo variants | Logo legible on forest and on ivory |
| T4 | Restyle shared primitives: buttons, inputs, `Badge`, `StarRating` | Nothing else changes yet; full suite still green |

### Phase 2, the storefront chrome

| # | Task | Verified by |
| --- | --- | --- |
| T5 | Rebuild `Navbar`: transparent over the hero, ivory on scroll, real logo, full-screen mobile menu | `category-bar.spec.ts`, `mobile-menu-toggle` still works |
| T6 | Restyle `CategoryBar` into the new system | F4 |
| T7 | Rebuild `Footer` with the contour ground | Links unchanged |

### Phase 3, the homepage

| # | Task | Verified by |
| --- | --- | --- |
| T8 | `HeroSection`: real text from `HeroBanner.title` and `subtitle`, slow drift, contour, mobile crop | F1; renders correctly when `title` is empty |
| T9 | Brand statement section | Visual |
| T10 | Collection: four categories, photographs where stocked, contour tiles where not | Driven by the nav tree, not hardcoded |
| T11 | `ProductShelf` and `ProductCard` in the new system, four elements not nine | F1, F5; rating hidden when no reviews |
| T12 | Ghee story section with the spec list | Visual |
| T13 | The five-step journey band | Visual, and legible on a phone |
| T14 | Six principles | Visual |
| T15 | Rooted in Devbhoomi | Visual |
| T16 | Everyday rituals | Visual |
| T17 | Reviews, rendering only when reviews exist | Section absent today, appears when seeded |
| T18 | Closing band and CTA | Visual |

### Phase 4, the rest of the storefront

| # | Task | Verified by |
| --- | --- | --- |
| T19 | `/products`, including the filter drawer and chips | F2 |
| T20 | `/category/[slug]` | F3 |
| T21 | `/products/[slug]`: gallery, variants, tabs, lab report, reviews | F5, F12 |
| T22 | `CartDrawer` and `AuthModal` | F6, F7 |
| T23 | `/checkout`, styling only | F8, F9, F10 |
| T24 | `/account` and its tabs | F7, F8, F11 |
| T25 | `/orders/[orderId]` and `/purity/[batch]` | F12 |

### Phase 5, admin and close

| # | Task | Verified by |
| --- | --- | --- |
| T26 | Admin changes A1 to A5 | `category-taxonomy.spec.ts` stays green |
| T27 | Every page at 390px, 768px, 1440px | No horizontal scroll anywhere |
| T28 | Every flag on and off | Twelve flows, both states |
| T29 | Full suite plus `next build` | Green, and the build succeeds |
| T30 | Lighthouse on the homepage | LCP under 2.5s with the hero image |

---

## 8. Guardrails

Things that end the branch badly if ignored.

1. **No URL changes.** Slugs, routes and anchors stay exactly as they are.
2. **No `data-testid` changes** without a decision recorded in this document.
3. **No flow changes.** This branch restyles. Behaviour changes belong elsewhere.
4. **No invented content.** No fake ratings, fake counts, fake testimonials, fake
   certifications. If the data does not exist, the element does not render.
5. **No new dependencies** without a note here saying why.
6. **Console-editable content stays editable.** Hero text, badges, categories and
   product copy are the team's to change, never hardcoded back into the source.
7. **The Shiprocket work on `dev` keeps working.** The express checkout button,
   the return page and the catalogue feed are all live on this branch.
8. **Run `next build`, not just `tsc`.** A page can compile and type-check and
   still fail to build; that has already happened once on this project.

---

## 9. Open questions

| # | Question | Blocks |
| --- | --- | --- |
| Q1 | Seed real reviews, or hide the section until there are some? | T11, T17 |
| Q2 | Who produces the logo variants and the clean hero artwork? | T3, T8 |
| Q3 | Do the three trust badges become the six principles, or coexist? | A5, T14 |
| Q4 | Does the redesign ship behind a flag for staged rollout, or as one merge? | T29 |

Until Q1 is answered the build assumes: no reviews, no ratings, nothing rendered.
