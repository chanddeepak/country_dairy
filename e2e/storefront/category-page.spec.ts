import { test, expect } from '@playwright/test';
import { db } from '../fixtures/db';
import { SEL } from '../fixtures/actions';

const TYPE_FILTER = '[data-testid="type-filter"]';

/**
 * The category page, /category/[slug].
 *
 * Like the homepage chips, every assertion here reads the taxonomy rather than
 * naming a category. Hardcoding 'Ghee' would reproduce exactly the bug this
 * page's sibling spec exists to catch — a label in the source disagreeing with
 * the database.
 *
 * The count beside each type is the thing most likely to rot. The grid shows
 * one card per size, so a shelf holding one product in two jars is two cards;
 * an earlier version took the number straight from the API's product count and
 * rendered "(1)" beside two results.
 */
test.describe('Category page', () => {
  /** Top-level categories that have live products, directly or through a type. */
  async function stockedShelves() {
    return db.category.findMany({
      where: {
        isActive: true,
        parentId: null,
        OR: [
          { products: { some: { status: 'LIVE' } } },
          { subCategories: { some: { products: { some: { status: 'LIVE' } } } } },
        ],
      },
      select: { name: true, slug: true },
    });
  }

  test('a stocked shelf shows its products and names itself', async ({ page }) => {
    test.setTimeout(90_000);

    const shelves = await stockedShelves();
    test.skip(shelves.length === 0, 'no shelf has live products');

    for (const shelf of shelves) {
      await page.goto(`/category/${shelf.slug}`);

      await expect(
        page.getByRole('heading', { name: shelf.name, level: 1 }),
        `the ${shelf.slug} page is not headed with its own name`,
      ).toBeVisible({ timeout: 30_000 });

      // A shelf the database says is stocked must never render empty. This is
      // the whole failure the homepage chips had.
      await expect
        .poll(async () => page.locator(SEL.productCardLink).count(), {
          message: `/category/${shelf.slug} showed nothing`,
          timeout: 20_000,
        })
        .toBeGreaterThan(0);
    }
  });

  test('a product on a type appears on its parent shelf', async ({ page }) => {
    test.setTimeout(60_000);

    // The reason getProducts matches on category OR category.parent: someone
    // browsing "Ghee" expects the jars filed under "A2 Desi Ghee" to be there.
    const type = await db.category.findFirst({
      where: {
        isActive: true,
        parentId: { not: null },
        products: { some: { status: 'LIVE' } },
      },
      select: { name: true, parent: { select: { slug: true, name: true } } },
    });
    test.skip(!type?.parent, 'no type has live products');

    await page.goto(`/category/${type!.parent!.slug}`);
    await expect(page.locator(SEL.productCardLink).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(type!.name, { exact: false }).first()).toBeVisible();
  });

  test('each type count matches what the grid actually shows', async ({ page }) => {
    test.setTimeout(90_000);

    const shelves = await stockedShelves();
    test.skip(shelves.length === 0, 'no shelf has live products');

    for (const shelf of shelves) {
      await page.goto(`/category/${shelf.slug}`);
      await expect(page.locator(SEL.productCardLink).first()).toBeVisible({ timeout: 30_000 });

      const boxes = page.locator(TYPE_FILTER);
      const n = await boxes.count();

      for (let i = 0; i < n; i++) {
        const box = boxes.nth(i);
        if (await box.isDisabled()) continue;

        // The label reads "<name> (<count>)"; take the number from the page
        // itself rather than recomputing it, so the test compares what a
        // customer sees against what they get.
        const label = await box.locator('xpath=..').innerText();
        const claimed = Number(label.match(/\((\d+)\)\s*$/)?.[1] ?? -1);
        expect(claimed, `no count rendered for filter ${i}`).toBeGreaterThanOrEqual(0);

        await box.check();
        await expect
          .poll(async () => page.locator(SEL.productCardLink).count(), {
            message: `filter ${i} on ${shelf.slug} claimed ${claimed} but the grid disagreed`,
            timeout: 15_000,
          })
          .toBe(claimed);
        await box.uncheck();
      }
    }
  });

  test('an empty shelf says so instead of rendering a bare grid', async ({ page }) => {
    const empty = await db.category.findFirst({
      where: {
        isActive: true,
        parentId: null,
        products: { none: { status: 'LIVE' } },
        subCategories: { none: { products: { some: { status: 'LIVE' } } } },
      },
      select: { name: true, slug: true },
    });
    test.skip(!empty, 'every shelf has stock');

    await page.goto(`/category/${empty!.slug}`);

    // A category we have not stocked yet is still a real page — it tells a
    // customer the thing is coming and offers them somewhere to go.
    await expect(page.getByRole('heading', { name: empty!.name, level: 1 })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/coming soon/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('link', { name: /see everything/i })).toBeVisible();
  });

  test('a slug nobody has is a 404, not a page titled with the slug', async ({ page }) => {
    const res = await page.goto('/category/definitely-not-a-category');
    expect(res?.status()).toBe(404);
    await expect(page.getByText(/could not be found/i)).toBeVisible({ timeout: 20_000 });
  });
});
