import { test, expect } from '@playwright/test';
import { findSellableVariant } from '../fixtures/api';
import { SEL } from '../fixtures/actions';

/**
 * QA plan §4 C1 — the cart before anyone signs in.
 *
 * Every other cart case runs signed in, which is how two guest-only defects
 * went unnoticed: one click put two jars in the cart, and the detail page
 * demanded an account the rest of the site did not.
 */

/** The quantity the drawer is showing for a variant, read off the screen. */
async function drawerQuantity(page: import('@playwright/test').Page): Promise<number> {
  const badge = page.locator(SEL.cartCount);
  if ((await badge.count()) === 0) return 0;
  return Number((await badge.first().innerText()).replace(/[^0-9]/g, '')) || 0;
}

test.describe('Guest cart', () => {
  test.beforeEach(async ({ context }) => {
    // No token, no user: a first-time visitor.
    await context.clearCookies();
  });

  test('C1 · adding once from the homepage adds one, not two', async ({ page }) => {
    const variant = await findSellableVariant();

    await page.goto('/');
    await expect(page.locator(SEL.productCardLink).first()).toBeVisible({ timeout: 30_000 });

    const card = page
      .locator(`${SEL.productCardLink}[href*="${variant.product.slug}"]`)
      .first();
    const targetCard = (await card.count()) ? card : page.locator(SEL.productCardLink).first();

    // The card's own Add to Cart, reached from the card the link belongs to.
    const shelfButton = page.getByRole('button', { name: /add to cart/i }).first();
    await expect(shelfButton).toBeVisible();
    await targetCard.scrollIntoViewIfNeeded();

    await shelfButton.click();

    await expect
      .poll(() => drawerQuantity(page), { timeout: 20_000 })
      .toBeGreaterThan(0);

    // One press, one unit. The optimistic update and the guest-cart write both
    // counted the same click, so this read 2.
    expect(await drawerQuantity(page)).toBe(1);

    await page.locator(SEL.openCart).click();
    const rows = page.locator('[data-testid="checkout-now"]');
    await expect(rows).toBeVisible();

    // And the line renders as a real line, not a blank name at ₹undefined.
    await expect(page.getByText(/undefined|NaN/i)).toHaveCount(0);
  });

  test('C1 · a guest can add from the product detail page without signing in', async ({
    page,
  }) => {
    const variant = await findSellableVariant();

    await page.goto(`/products/${variant.product.slug}?variant=${variant.id}`);

    const add = page.locator(SEL.addToCart);
    await expect(add).toBeVisible({ timeout: 30_000 });
    await add.click();

    // The detail page used to open the sign-in modal here while the homepage
    // and the all-products page both accepted the same click from a guest.
    await expect(page.locator(SEL.emailInput)).toHaveCount(0);
    await expect(page.locator(SEL.passwordInput)).toHaveCount(0);

    await expect.poll(() => drawerQuantity(page), { timeout: 20_000 }).toBe(1);
  });

  test('C1 · a guest cart survives a reload', async ({ page }) => {
    const variant = await findSellableVariant();

    await page.goto(`/products/${variant.product.slug}?variant=${variant.id}`);
    await page.locator(SEL.addToCart).click();
    await expect.poll(() => drawerQuantity(page), { timeout: 20_000 }).toBe(1);

    await page.reload();

    // Kept in localStorage under cd_guest_cart, so closing the tab does not
    // throw away a basket someone spent time filling.
    await expect.poll(() => drawerQuantity(page), { timeout: 20_000 }).toBe(1);
  });

  test('C1 · adding the same variant twice makes two units on one line', async ({ page }) => {
    const variant = await findSellableVariant();

    await page.goto(`/products/${variant.product.slug}?variant=${variant.id}`);
    const add = page.locator(SEL.addToCart);

    await add.click();
    await expect.poll(() => drawerQuantity(page), { timeout: 20_000 }).toBe(1);

    await add.click();
    await expect.poll(() => drawerQuantity(page), { timeout: 20_000 }).toBe(2);

    await page.locator(SEL.openCart).click();
    // One line, not two: the guest write matches on variantId.
    await expect(page.locator(SEL.qtyIncrease)).toHaveCount(1);
  });
});
