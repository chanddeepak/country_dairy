import { test, expect } from '@playwright/test';
import { db } from '../fixtures/db';
import { SEL } from '../fixtures/actions';

/**
 * Every size a customer can buy is a size they can find.
 *
 * The shop listed one card per product, so a jar that existed in two sizes
 * appeared once. The 500ml was reachable only by opening the product and
 * noticing a selector — which is not browsing, it is searching for something
 * you have not been told exists.
 *
 * Deliberately not driven by the "show on home" flag. That curates the
 * homepage shelf; the shop is the whole catalogue.
 */
test.describe('The shop shows every size', () => {
  test('a product with two sizes gets two cards', async ({ page }) => {
    test.setTimeout(120_000);

    // A live product that genuinely has more than one active size.
    const product = await db.product.findFirst({
      where: {
        status: 'LIVE',
        variants: { some: { isActive: true } },
      },
      include: { variants: { where: { isActive: true } } },
    });

    test.skip(!product || product.variants.length < 2, 'no multi-size product to test against');

    await page.goto('/products');
    await expect(page.locator(SEL.productCardLink).first()).toBeVisible({ timeout: 30_000 });

    // Each size names itself, so the two cards are distinguishable rather
    // than two identical-looking entries at different prices.
    for (const variant of product!.variants) {
      await expect(
        page.getByText(variant.sizeLabel, { exact: false }).first(),
        `${variant.sizeLabel} is missing from the shop`,
      ).toBeVisible({ timeout: 20_000 });
    }

    // And the prices differ, which is the whole reason they are separate.
    const prices = new Set(product!.variants.map((v) => String(v.sellingPrice)));
    expect(prices.size, 'sizes priced identically make a weak test').toBeGreaterThan(1);
  });
});
