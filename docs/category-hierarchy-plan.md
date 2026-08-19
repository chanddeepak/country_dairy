# Categories and types

Rewritten 19 August 2026. The first version of this document was wrong twice
over, and both corrections are worth keeping.

## What changed, and why

**The nesting is not Dairy → Ghee.** It is **Ghee → Desi, Cultured, Buffalo,
Herbal** — types of a thing, at the narrow end. Two Brothers' own ghee page
filters by exactly that, with counts, and neither they nor Anveshan nest
anything in their navigation. Nobody shops by "Dairy"; people shop by "ghee",
and then by which kind.

**And `Category.parentId` already existed** — self-relation, index and all,
unused since the schema was written, along with `imageUrl` which an earlier
version of this document claimed was missing. Both were asserted from grepping
for particular fields rather than reading the model. Only `showInNav` was
genuinely absent.

## The model

```
Category(id, name, slug, description, imageUrl, iconName, displayOrder,
         isActive, externalId, parentId?, showInNav)
```

| Level | Examples | Where it shows |
| --- | --- | --- |
| Category — `parentId` null | Ghee, Oils, Honey | The nav bar, or its dropdown |
| Type — `parentId` set | Desi Ghee, Cultured Ghee, Mustard | Checkboxes on the category page |

A category with no types has no children. Nothing pretends to be its own
subcategory, which is the special case a separate subcategory table would have
forced into every query.

`showInNav` decides what is promoted to the bar rather than the dropdown. A
merchandising choice, not a structural one — hence a flag, not a level.

Products point at **one** category: the specific one. The parent is derived.
Storing both would let them disagree, and nothing would stop it.

## Navigation

Flat, as both comparables have it: two or three promoted, the rest in one
"Shop by category" dropdown, then "Shop all". No tree. Their catalogues are far
larger than ours and they still do not nest here.

## The category page

`/category/ghee` — a real route, not `/products?category=…`, so it has its own
title for search, a clean URL to advertise, and somewhere for
`Category.description` to finally appear.

Types are **checkboxes with counts**, multi-select. A type with no products
shows greyed at (0) rather than being hidden: it tells a customer the thing
exists and is coming, and it cannot be ticked, so it can never produce an empty
grid.

Counts come from the same query that fills the grid. A count that disagrees
with the results is worse than no count.

## The console

The product form lists **types**, grouped by category, and sets the category
itself. Whoever adds a product picks "Desi Ghee", not "Ghee" and then "Desi
Ghee". A category with no types is pickable directly.

## Latency

The nav tree is a handful of rows that change monthly. Cached in the API with
a short TTL, the way `FeatureFlagsService` already does it, and invalidated
when a category is written. The storefront fetches it in the layout with
`revalidate`, so moving between pages costs no database work.

## Order of work

1. `showInNav` — done
2. Console: parent picker on categories, type picker on the product form — done
3. API: nav tree and per-category counts, both cached — done
4. Storefront: the bar, then `/category/[slug]` with type filters — done
5. Shiprocket: `collection-products` resolving a parent to its descendants —
   still blocked on staging credentials

### Two things the build taught us

**The count on the page is not the count from the API.** The grid shows one
card per size, so a shelf holding one product in two jars is two cards. The
sidebar reads its numbers from the array that fills the grid; the nav tree's
`productCount` is for the bar, where it counts products and nothing contradicts
it.

**The 404 has to come from the layout.** `/category/[slug]/page.tsx` is a
client component — checkboxes, cart drawer, auth modal — so its `notFound()`
runs after hydration, when the 200 has already been sent. A crawler would
record a real page at a URL that does not exist. The layout is a server
component and does the existence check there; it distinguishes "no such
category" from "could not reach the API", because 404-ing a real shelf over a
failed fetch would quietly delete pages from search results.

## Not doing

- Deeper than two levels
- A product in more than one category
- Campaign and content links in the bar (Gift Hampers, Farm Life). Both
  comparables carry them; they are pages, not categories, and adding them as
  plain links when there is something to promote beats building a nav CMS now.
