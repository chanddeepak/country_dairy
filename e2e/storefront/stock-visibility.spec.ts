import { test, expect } from '@playwright/test';
import { db } from '../fixtures/db';

/**
 * What a customer is shown when something cannot be bought.
 *
 * The homepage is the shop window, so it carries nothing that is sold out —
 * tapping through to be told "out of stock" is an errand for nothing. The shop
 * still lists it, below the shelf, because a regular whose size is missing
 * would otherwise wonder whether we had stopped making it.
 */
test.describe('Out of stock', () => {
  let restore: { id: string; qty: number } | null = null;

  test.afterEach(async () => {
    if (restore) {
      await db.productVariant.update({
        where: { id: restore.id },
        data: { stockQuantity: restore.qty },
      });
      restore = null;
    }
  });

  test('a sold-out size leaves the homepage and lands in its own shop section', async ({ page }) => {
    test.setTimeout(180_000);

    // A product whose every size is empty is the only thing that counts as
    // sold out, so use a single-variant product if there is one.
    const product = await db.product.findFirstOrThrow({
      where: { status: 'LIVE', variants: { some: { isActive: true } } },
      include: { variants: { where: { isActive: true } } },
    });
    const variant = product.variants[0];
    restore = { id: variant.id, qty: variant.stockQuantity };

    // In stock first: it should be on the shop, not in the sold-out section.
    await page.goto('/products');
    await expect(page.getByRole('heading', { name: /currently out of stock/i })).toHaveCount(0);

    // Empty every size, so the product really is unbuyable.
    await db.productVariant.updateMany({
      where: { productId: product.id },
      data: { stockQuantity: 0 },
    });

    await page.goto('/products');
    await expect(page.getByRole('heading', { name: /currently out of stock/i })).toBeVisible({
      timeout: 30_000,
    });

    await page.goto('/');
    // The shelf may legitimately be empty now; what matters is that a sold-out
    // product is not sitting in the window.
    const shelfLinks = page.locator(`[data-testid="product-card-link"][href*="${product.slug}"]`);
    await expect(shelfLinks).toHaveCount(0);

    // Put it back and confirm the section disappears again.
    await db.productVariant.updateMany({
      where: { productId: product.id },
      data: { stockQuantity: restore.qty || 50 },
    });
    await page.goto('/products');
    await expect(page.getByRole('heading', { name: /currently out of stock/i })).toHaveCount(0);
  });
});
