import { test, expect } from '@playwright/test';
import { db } from '../fixtures/db';
import { SEL } from '../fixtures/actions';

const TYPE_FILTER = '[data-testid="filter-type"]';
const OPEN_FILTERS = '[data-testid="filter-open"]';
const APPLY_FILTERS = '[data-testid="filter-apply"]';

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

      // The filters live in a drawer now, so they have to be asked for.
      const opener = page.locator(OPEN_FILTERS);
      if (await opener.count() === 0) continue; // nothing filterable on this shelf
      await opener.click();
      await expect(page.locator('[data-testid="filter-drawer"]')).toBeVisible({ timeout: 15_000 });

      const boxes = page.locator(TYPE_FILTER);
      const n = await boxes.count();

      for (let i = 0; i < n; i++) {
        const box = boxes.nth(i);
        if (await box.isDisabled()) continue;

        // The row ends with its count; take the number from the page itself
        // rather than recomputing it, so the test compares what a customer sees
        // against what they get. A type with nothing in it reads "Soon" instead
        // of a number and is disabled, so it never gets here.
        const label = await box.locator('xpath=..').innerText();
        const claimed = Number(label.match(/(\d+)\s*$/)?.[1] ?? -1);
        expect(claimed, `no count rendered for filter ${i}`).toBeGreaterThanOrEqual(0);

        await box.check();
        await page.locator(APPLY_FILTERS).click();

        await expect
          .poll(async () => page.locator(SEL.productCardLink).count(), {
            message: `filter ${i} on ${shelf.slug} claimed ${claimed} but the grid disagreed`,
            timeout: 15_000,
          })
          .toBe(claimed);

        // The chip beside the button is how a shut drawer still says what is on.
        await expect(
          page.locator('[data-testid="applied-filter"]'),
          'an applied filter left no trace on the page',
        ).toHaveCount(1);

        await opener.click();
        await box.uncheck();
      }
      await page.locator(APPLY_FILTERS).click();
    }
  });

  test('size is filterable, and clears from the chip beside the button', async ({ page }) => {
    test.setTimeout(90_000);

    // Sizes are not configured anywhere — they are read off whatever jars the
    // shelf holds. This is the group the drawer was chosen for: adding one cost
    // a few lines of data, not another piece of layout.
    const shelf = await db.category.findFirst({
      where: {
        isActive: true,
        parentId: null,
        OR: [
          { products: { some: { status: 'LIVE' } } },
          { subCategories: { some: { products: { some: { status: 'LIVE' } } } } },
        ],
      },
      select: { slug: true },
    });
    test.skip(!shelf, 'no shelf has live products');

    await page.goto(`/category/${shelf!.slug}`);
    await expect(page.locator(SEL.productCardLink).first()).toBeVisible({ timeout: 30_000 });
    const all = await page.locator(SEL.productCardLink).count();

    await page.locator(OPEN_FILTERS).click();
    const sizes = page.locator('[data-testid="filter-size"]');
    test.skip((await sizes.count()) < 2, 'this shelf sells only one size');

    await sizes.first().check();
    await page.locator(APPLY_FILTERS).click();

    // Narrower than everything, and not empty.
    await expect
      .poll(async () => page.locator(SEL.productCardLink).count(), {
        message: 'filtering by size changed nothing',
        timeout: 15_000,
      })
      .toBeLessThan(all);
    expect(await page.locator(SEL.productCardLink).count()).toBeGreaterThan(0);

    // Removing it from the chip is the shortcut that makes a hidden filter
    // bearable: no reopening the drawer to undo one thing.
    const chip = page.locator('[data-testid="applied-filter"]');
    await expect(chip).toHaveCount(1);
    await chip.click();

    await expect
      .poll(async () => page.locator(SEL.productCardLink).count(), {
        message: 'dismissing the chip did not restore the grid',
        timeout: 15_000,
      })
      .toBe(all);
  });

  test('the slug is never shown as the heading while loading', async ({ page }) => {
    test.setTimeout(60_000);

    const shelf = await db.category.findFirst({
      where: { isActive: true, parentId: null },
      select: { name: true, slug: true },
    });
    test.skip(!shelf, 'no category to open');
    // Only meaningful where the two differ in the way a customer would notice.
    test.skip(shelf!.slug === shelf!.name, 'this slug and name are identical');

    await page.route('**/catalog/categories/nav', async (route) => {
      await new Promise((r) => setTimeout(r, 3_000));
      await route.continue();
    });

    await page.goto(`/category/${shelf!.slug}`);

    /*
     * The heading used to fall back to the slug, so a bare lowercase "ghee" sat
     * in the display serif above three grey boxes until the request landed. A
     * URL is a machine-readable string, not a page title.
     *
     * Asserted as "the slug is never the heading" rather than "there is no
     * heading yet": the shelf is resolved on the server now, so the real name
     * is in the first response and the delay above — which only throttles the
     * browser's own request — no longer holds anything back. Demanding an
     * empty heading would be demanding the old, worse behaviour.
     */
    await expect(
      page.getByRole('heading', { level: 1, name: shelf!.slug, exact: true }),
      'the raw slug was shown as the page heading',
    ).toHaveCount(0);

    await expect(
      page.getByRole('heading', { level: 1, name: shelf!.name, exact: true }),
      'the shelf name should be in the first response',
    ).toBeVisible();

    await expect(page.getByRole('heading', { name: shelf!.name, level: 1 })).toBeVisible({
      timeout: 20_000,
    });
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
    // The hook, not the wording. This asserted Next's default copy ("could not
    // be found"), so the first custom 404 page the site ever had broke it while
    // improving the thing it was testing.
    await expect(page.getByTestId('not-found')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('link', { name: /browse everything/i })).toBeVisible();
  });
});
