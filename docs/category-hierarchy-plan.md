# Category hierarchy — two levels

Decided 19 August 2026. Nothing built yet.

Categories are a flat list today: Ghee, Oils, Honey, each unrelated to the
others. The model wanted is one level of nesting, with a product attached to
the leaf.

```
Dairy ──┬── Ghee          Oils ──┬── Mustard
        ├── Milk                 └── Coconut
        └── Paneer         Honey
```

A product belongs to **Ghee**, never to Dairy. That is what makes the parent
worth having: "Dairy" then means "everything beneath Dairy" and stays true as
the catalogue grows, instead of being a label somebody has to remember to keep
in step.

## Schema

Self-relation on `Category`, additive:

```prisma
model Category {
  parentId String?
  parent   Category?  @relation("CategoryTree", fields: [parentId], references: [id])
  children Category[] @relation("CategoryTree")

  @@index([parentId, displayOrder])
}
```

Existing rows become top-level with `parentId` null, so nothing breaks and no
backfill is needed.

**Two levels only.** Not because deeper is hard, but because a dairy with one
product does not need a tree, and every screen that renders a tree is harder
than one that renders two rows. Enforce it in the service — a category whose
parent already has a parent is rejected — rather than leaving it to
convention.

## Storefront

Two rows on `/products`, which is the long-term shape:

- **Top row**: top-level categories, plus All. Selecting one shows everything
  beneath it.
- **Second row**: appears only once a parent with children is selected, and
  lists those children. Selecting one narrows further.

The second row must not appear for a parent with no children — an empty row
that flickers in and out is worse than no row.

Both rows derive from the data, never a hardcoded list. That is what caused
the Ghee filter to empty the shelf: a label in the source disagreed with the
database. A chip should exist only because something is under it.

The homepage shelf stays single-row and top-level. It is a window, not a
catalogue.

## Admin

- Parent picker on the category form, listing only top-level categories, and
  excluding the category being edited so nothing can parent itself.
- The categories list shows "Dairy › Ghee" so the shape is visible at a
  glance.
- A parent with children cannot be deleted while they exist — offer to move
  them up a level instead of cascading a delete nobody intended.
- The product form's category picker should show leaves, since that is where
  products attach, with the parent as context.

## Shiprocket

Their collections are flat, so both levels are sent as collections:

- A **leaf** collection returns its own products.
- A **parent** collection returns everything beneath it.

`GET /shiprocket/collection-products?collection_id=…` already takes one id;
it needs to resolve descendants when that id is a parent. Nothing about the
feed's shape changes.

Categories already carry `externalId`, so both levels have the numeric id
their sync requires.

## Order of work

1. Migration and schema — additive, safe to ship alone
2. Admin: parent picker, list display, delete guard
3. Storefront: two-row filter on `/products`
4. Shiprocket: descendant resolution in `collection-products`
5. Tests: a parent chip shows the union of its children; a leaf chip shows
   only its own; no empty second row; a two-level limit that actually refuses

Steps 1 and 2 are useful on their own — the hierarchy can be entered and seen
before any storefront change ships.

## Not doing

- Deeper than two levels
- Products attached to a parent as well as a leaf. One home per product; a
  product in two places is a product that disagrees with itself.
- Category images. `Category` has no image column and their collection feed
  sends an empty `src` today. Add it only when a design calls for it.
