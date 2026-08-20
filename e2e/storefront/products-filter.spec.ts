import { test, expect } from '@playwright/test';
import { db } from '../fixtures/db';
import { SEL } from '../fixtures/actions';

const OPEN_FILTERS = '[data-testid="filter-open"]';
const APPLY_FILTERS = '[data-testid="filter-apply"]';
const APPLIED = '[data-testid="applied-filter"]';

/**
 * The shop page's filter drawer.
 *
 * The category chips stay: on this page a category is how someone browses,
 * where type, size and availability refine what browsing found. The two
 * therefore have to compose — picking a shelf and then a size must narrow
 * rather than fight, which is the thing worth pinning down here.
 */
test.describe('Shop filters', () => {
  test('a size narrows the shop, and the chip puts it back', async ({ page }) => {
    test.setTimeout(90_000);

    await page.goto('/products');
    await expect(page.locator(SEL.productCardLink).first()).toBeVisible({ timeout: 30_000 });
    const all = await page.locator(SEL.productCardLink).count();

    const opener = page.locator(OPEN_FILTERS);
    test.skip((await opener.count()) === 0, 'nothing is filterable in this catalogue');

    await opener.click();
    const sizes = page.locator('[data-testid="filter-size"]');
    test.skip((await sizes.count()) < 2, 'the catalogue sells only one size');

    await sizes.first().check();
    await page.locator(APPLY_FILTERS).click();

    await expect
      .poll(async () => page.locator(SEL.productCardLink).count(), {
        message: 'filtering by size changed nothing on the shop page',
        timeout: 15_000,
      })
      .toBeLessThan(all);

    const chip = page.locator(APPLIED);
    await expect(chip, 'a shut drawer left no sign of what was applied').toHaveCount(1);
    await chip.click();

    await expect
      .poll(async () => page.locator(SEL.productCardLink).count(), { timeout: 15_000 })
      .toBe(all);
  });

  test('a category chip and a drawer filter narrow together', async ({ page }) => {
    test.setTimeout(90_000);

    // A shelf that actually holds something, read from the taxonomy rather than
    // named here — the same rule the rest of these specs follow.
    const shelf = await db.category.findFirst({
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
    test.skip(!shelf, 'no shelf has live products');

    await page.goto('/products');
    await expect(page.locator(SEL.productCardLink).first()).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: shelf!.name, exact: true }).click();
    await expect
      .poll(async () => page.locator(SEL.productCardLink).count(), { timeout: 15_000 })
      .toBeGreaterThan(0);
    const inShelf = await page.locator(SEL.productCardLink).count();

    const opener = page.locator(OPEN_FILTERS);
    test.skip((await opener.count()) === 0, 'nothing is filterable within this shelf');
    await opener.click();

    const sizes = page.locator('[data-testid="filter-size"]');
    test.skip((await sizes.count()) < 2, 'this shelf sells only one size');

    await sizes.first().check();
    await page.locator(APPLY_FILTERS).click();

    // Narrower than the shelf alone, and not empty: the two controls compose
    // instead of one replacing the other.
    await expect
      .poll(async () => page.locator(SEL.productCardLink).count(), {
        message: 'the chip and the drawer did not narrow together',
        timeout: 15_000,
      })
      .toBeLessThan(inShelf);
    expect(await page.locator(SEL.productCardLink).count()).toBeGreaterThan(0);
  });

  test('no filter button appears when there is nothing to filter by', async ({ page }) => {
    // A control that cannot change the page is worse than no control. With one
    // type, one size and everything in stock there is nothing to offer, and the
    // button should not be there promising otherwise.
    const variants = await db.productVariant.count({ where: { isActive: true } });
    test.skip(variants > 1, 'this catalogue has something worth filtering');

    await page.goto('/products');
    await expect(page.locator(SEL.productCardLink).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(OPEN_FILTERS)).toHaveCount(0);
  });
});
