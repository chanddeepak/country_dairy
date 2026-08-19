import { test, expect } from '@playwright/test';
import { db } from '../fixtures/db';

const BAR_LINK = '[data-testid="category-bar-link"]';
const BAR_MORE = '[data-testid="category-bar-more"]';

/**
 * The category bar.
 *
 * Everything here is read from the taxonomy rather than naming a category. The
 * bar's whole point is that a merchandising change — promoting a shelf, adding
 * a new one — needs no code, so a test that hardcodes "Ghee" would have to be
 * edited by the same person who edits the console, which is exactly the
 * coupling the `showInNav` flag exists to avoid.
 */
test.describe('Category bar', () => {
  async function shelves() {
    return db.category.findMany({
      where: { isActive: true, parentId: null },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      select: { name: true, slug: true, showInNav: true },
    });
  }

  test('every active shelf is reachable from the bar', async ({ page }) => {
    test.setTimeout(90_000);

    const all = await shelves();
    test.skip(all.length === 0, 'no active categories');

    await page.goto('/');
    await expect(page.locator(BAR_LINK).first()).toBeVisible({ timeout: 30_000 });

    // Promoted shelves sit in the bar; the rest are behind the menu. Open it so
    // both are in the DOM, then assert on the union — the split between them is
    // a merchandising choice and not what this test is pinning down.
    const more = page.locator(BAR_MORE);
    if (await more.isVisible()) await more.click();

    for (const shelf of all) {
      await expect(
        page.locator(`${BAR_LINK}[href="/category/${shelf.slug}"]`),
        `"${shelf.name}" is not reachable from the category bar`,
      ).toHaveCount(1);
    }
  });

  test('a promoted shelf is in the bar itself, not hidden in the menu', async ({ page }) => {
    const promoted = await db.category.findFirst({
      where: { isActive: true, parentId: null, showInNav: true },
      select: { name: true, slug: true },
    });
    test.skip(!promoted, 'no shelf is promoted to the bar');

    await page.goto('/');

    // Visible without opening anything. That is the entire difference between
    // showInNav true and false.
    await expect(
      page.locator(`${BAR_LINK}[href="/category/${promoted!.slug}"]`),
    ).toBeVisible({ timeout: 30_000 });
  });

  test('clicking a shelf lands on its page', async ({ page }) => {
    test.setTimeout(60_000);

    const promoted = await db.category.findFirst({
      where: { isActive: true, parentId: null, showInNav: true },
      select: { name: true, slug: true },
    });
    test.skip(!promoted, 'no shelf is promoted to the bar');

    await page.goto('/');
    const link = page.locator(`${BAR_LINK}[href="/category/${promoted!.slug}"]`);
    await expect(link).toBeVisible({ timeout: 30_000 });
    await link.click();

    await expect(page).toHaveURL(new RegExp(`/category/${promoted!.slug}$`));
    await expect(page.getByRole('heading', { name: promoted!.name, level: 1 })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('the bar is on every storefront page, not just the homepage', async ({ page }) => {
    test.setTimeout(60_000);

    // It lives in Navbar, which each page mounts for itself — so "it renders"
    // and "it renders everywhere" are genuinely different claims.
    for (const path of ['/', '/products']) {
      await page.goto(path);
      await expect(page.locator(BAR_LINK).first(), `no category bar on ${path}`).toBeVisible({
        timeout: 30_000,
      });
    }
  });
});
