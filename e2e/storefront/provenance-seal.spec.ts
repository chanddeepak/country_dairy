import { test, expect } from '@playwright/test';
import { db } from '../fixtures/db';

/**
 * The Made in Uttarakhand seal.
 *
 * Two placements doing two different jobs: a small mark on the card that
 * people come to recognise, and a legible version on the product page where
 * there is room to say what it means. The card one carries no readable words
 * by design, so the page one has to carry them instead.
 */
test.describe('Provenance seal', () => {
  test('the seal is on product cards', async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto('/products');
    const seal = page.locator('img[alt="Made in Uttarakhand"]').first();
    await expect(seal).toBeVisible({ timeout: 30_000 });

    // A broken image still "renders", so check the file actually loaded.
    await expect
      .poll(async () => seal.evaluate((el: HTMLImageElement) => el.naturalWidth), {
        message: 'the seal image did not load',
        timeout: 20_000,
      })
      .toBeGreaterThan(0);
  });

  test('the product page spells out what the seal means', async ({ page }) => {
    test.setTimeout(120_000);

    const product = await db.product.findFirstOrThrow({ where: { status: 'LIVE' } });
    await page.goto(`/products/${product.slug}`);

    // The words the card version is too small to carry.
    await expect(page.getByText('Made in Uttarakhand')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/pure hills, pure cows/i)).toBeVisible();
  });
});
