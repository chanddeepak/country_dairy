import { test, expect } from '@playwright/test';
import { db } from '../fixtures/db';

/**
 * QA plan §3 B9 — which tab a product opens on.
 *
 * Ghee is the product the bilona story is about, and that story is the reason
 * someone pays four times the supermarket price. Opening on a specification
 * table buries it. Everything else has no such story and opens on its details.
 */
async function findProduct(matching: boolean) {
  const products = await db.product.findMany({
    where: { status: 'LIVE' },
    include: { category: true },
  });

  return products.find((p) => {
    const haystack = `${p.slug} ${p.title} ${p.category?.name ?? ''}`.toLowerCase();
    return haystack.includes('ghee') === matching;
  });
}

test.describe('Product detail tabs', () => {
  test('B9 · ghee opens on the Traditional Vedic Process', async ({ page }) => {
    const ghee = await findProduct(true);
    test.skip(!ghee, 'no ghee product in the catalogue');

    await page.goto(`/products/${ghee!.slug}`);

    const vedicTab = page.getByRole('button', { name: /traditional vedic process/i });
    await expect(vedicTab).toBeVisible({ timeout: 30_000 });

    // The panel, not just the tab: a highlighted tab over the wrong panel is
    // the failure worth catching.
    await expect(
      page.getByText(/5-step traditional vedic bilona process/i),
    ).toBeVisible({ timeout: 20_000 });

    await expect(page.getByRole('button', { name: /product details/i })).toBeVisible();
  });

  test('B9 · choosing Product Details on ghee is respected', async ({ page }) => {
    const ghee = await findProduct(true);
    test.skip(!ghee, 'no ghee product in the catalogue');

    await page.goto(`/products/${ghee!.slug}`);
    await expect(
      page.getByText(/5-step traditional vedic bilona process/i),
    ).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: /product details/i }).click();

    // The default must not snap back and drag the reader out of the tab they
    // just chose.
    await expect(page.getByText(/5-step traditional vedic bilona process/i)).toBeHidden();
  });

  test('B9 · a non-ghee product has no process tab at all', async ({ page }) => {
    const other = await findProduct(false);
    test.skip(!other, 'no non-ghee product in the catalogue');

    await page.goto(`/products/${other!.slug}`);
    await expect(page.getByRole('button', { name: /product details/i })).toBeVisible({
      timeout: 30_000,
    });

    // Bilona is a ghee process. Offering it against milk would be a claim the
    // product cannot support.
    await expect(
      page.getByRole('button', { name: /traditional vedic process/i }),
    ).toHaveCount(0);
  });
});

test.describe('Related products', () => {
  /**
   * QA plan §3 B9 — "You May Also Like".
   *
   * This row read a hardcoded list holding a single product, so it showed one
   * card everywhere except that product's own page, where the filter removed
   * the only entry it had. It now comes from the live catalogue, which means
   * every product with a companion on sale gets a row.
   */
  test('B9 · every product offers something else on sale', async ({ page }) => {
    const live = await db.product.findMany({ where: { status: 'LIVE' }, take: 6 });
    test.skip(live.length < 2, 'needs two live products to relate');

    for (const product of live) {
      await page.goto(`/products/${product.slug}`);

      const heading = page.getByRole('heading', { name: /you may also like/i });
      await expect(heading, `${product.slug} offered nothing`).toBeVisible({ timeout: 30_000 });

      const cards = page.locator('[data-testid="product-card-link"]');
      await expect(cards.first()).toBeVisible();

      // Never itself. A row recommending the page you are on is filler.
      const hrefs = await cards.evaluateAll((els) =>
        els.map((el) => el.getAttribute('href') ?? ''),
      );
      expect(
        hrefs.some((href) => href.includes(`/products/${product.slug}`)),
        `${product.slug} recommended itself`,
      ).toBe(false);
    }
  });
});
