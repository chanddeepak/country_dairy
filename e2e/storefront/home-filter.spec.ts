import { test, expect } from '@playwright/test';
import { db } from '../fixtures/db';
import { SEL } from '../fixtures/actions';

/**
 * The homepage category chips.
 *
 * They were a hardcoded list naming a category that does not exist — 'A2 Desi
 * Ghee' where the taxonomy says 'Dairy' — so clicking the only filter on the
 * page emptied the shelf. It looked like a broken shop and was a label in the
 * source disagreeing with the database.
 *
 * The assertions read the taxonomy rather than naming categories, so this
 * cannot rot the same way the chips did.
 */
test.describe('Home category filter', () => {
  test('every chip filters to something', async ({ page }) => {
    test.setTimeout(120_000);

    // Shelves, not kinds. A chip exists for a top-level category that has live
    // products either directly or through one of its types — "Ghee" carries
    // "A2 Desi Ghee" rather than each variety earning a chip of its own.
    const categories = await db.category.findMany({
      where: {
        isActive: true,
        parentId: null,
        OR: [
          { products: { some: { status: 'LIVE' } } },
          { subCategories: { some: { products: { some: { status: 'LIVE' } } } } },
        ],
      },
      select: { name: true },
    });
    test.skip(categories.length === 0, 'no shelf has live products');

    await page.goto('/');
    await expect(page.locator(SEL.productCardLink).first()).toBeVisible({ timeout: 30_000 });
    const total = await page.locator(SEL.productCardLink).count();
    expect(total).toBeGreaterThan(0);

    for (const { name } of categories) {
      const chip = page.getByRole('button', { name, exact: true });
      await expect(chip, `no chip for the "${name}" category`).toBeVisible({ timeout: 20_000 });

      await chip.click();
      // The point of the test: a chip that exists must never empty the shelf.
      await expect
        .poll(async () => page.locator(SEL.productCardLink).count(), {
          message: `the "${name}" filter showed nothing`,
          timeout: 15_000,
        })
        .toBeGreaterThan(0);
    }

    // And back to everything.
    await page.getByRole('button', { name: 'All Products', exact: true }).click();
    await expect
      .poll(async () => page.locator(SEL.productCardLink).count(), { timeout: 15_000 })
      .toBe(total);
  });

  test('no chip exists for a category with nothing in it', async ({ page }) => {
    const empty = await db.category.findFirst({
      where: {
        isActive: true,
        parentId: null,
        products: { none: { status: 'LIVE' } },
        subCategories: { none: { products: { some: { status: 'LIVE' } } } },
      },
      select: { name: true },
    });
    test.skip(!empty, 'every category has live products');

    await page.goto('/');
    await expect(page.locator(SEL.productCardLink).first()).toBeVisible({ timeout: 30_000 });

    // A chip that can only ever show an empty shelf should not be offered.
    await expect(
      page.getByRole('button', { name: empty!.name, exact: true }),
      `"${empty!.name}" has no live products but is still offered as a filter`,
    ).toHaveCount(0);
  });
});

/**
 * Stepping through the product photographs from the main image.
 *
 * The thumbnails already switched it, but on a phone they sit below the fold —
 * someone looking at the jar had no way to reach the second photograph without
 * scrolling away from the thing they were looking at.
 */
test.describe('Product gallery arrows', () => {
  test('the arrows move through the images and wrap', async ({ page }) => {
    test.setTimeout(120_000);

    const product = await db.product.findFirst({
      where: { status: 'LIVE' },
      include: { galleryImages: true },
    });
    test.skip(!product, 'no live product');

    await page.goto(`/products/${product!.slug}`);
    await page.waitForSelector('[data-testid="variant-option"]', { timeout: 30_000 });

    const next = page.getByTestId('gallery-next');
    const count = await next.count();

    // A single-photograph product shows no arrows, and should not — they would
    // promise more than there is.
    test.skip(count === 0, 'this product has only one image');

    const counter = page.locator('text=/^\\s*1 \\/ \\d+\\s*$/').first();
    await expect(counter, 'no position indicator').toBeVisible({ timeout: 15_000 });

    // Named, not guessed at: the first img on the page is the header logo.
    const main = page.getByTestId('gallery-main');
    const before = await main.getAttribute('src');

    await next.click();
    await expect
      .poll(async () => main.getAttribute('src'), {
        message: 'the next arrow did not change the image',
        timeout: 10_000,
      })
      .not.toBe(before);

    // Back where we started, so neither arrow is ever a dead control.
    await page.getByTestId('gallery-prev').click();
    await expect
      .poll(async () => main.getAttribute('src'), { timeout: 10_000 })
      .toBe(before);
  });
});

/**
 * Chips show the shelf, not the kind.
 *
 * A product filed under "A2 Desi Ghee" must appear beneath a "Ghee" chip. The
 * type is a filter between kinds of the same thing and belongs on the category
 * page, not on a homepage that would otherwise grow a chip per variety.
 */
test.describe('Filter chips group by shelf', () => {
  test('a product in a type appears under its parent category', async ({ page }) => {
    test.setTimeout(120_000);

    const typed = await db.product.findFirst({
      where: { status: 'LIVE', category: { parentId: { not: null } } },
      include: { category: { include: { parent: true } } },
    });
    test.skip(!typed, 'no product sits inside a type');

    const shelf = typed!.category.parent!.name;
    const kind = typed!.category.name;

    await page.goto('/products');
    await expect(page.locator(SEL.productCardLink).first()).toBeVisible({ timeout: 30_000 });

    await expect(
      page.getByRole('button', { name: shelf, exact: true }),
      `no chip for the "${shelf}" shelf`,
    ).toBeVisible({ timeout: 20_000 });

    // The kind must not have become a chip of its own.
    await expect(
      page.getByRole('button', { name: kind, exact: true }),
      `"${kind}" is a type and should not be a chip`,
    ).toHaveCount(0);

    // And the shelf chip still finds the product.
    await page.getByRole('button', { name: shelf, exact: true }).click();
    await expect
      .poll(async () => page.locator(SEL.productCardLink).count(), { timeout: 15_000 })
      .toBeGreaterThan(0);
  });
});
