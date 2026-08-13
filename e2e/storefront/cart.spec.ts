import { test, expect } from '@playwright/test';
import { STORAGE } from '../../playwright.config';
import { SEL, signInToStorefront } from '../fixtures/actions';
import { cleanup, db, tracked, type Tracked } from '../fixtures/db';
import { createCustomer, findSellableVariant } from '../fixtures/api';

/**
 * QA plan §4 — Cart.
 *
 * Most of these guard ground that was lost before: ₹NaN in the drawer, a
 * cart keyed so two sizes of one product could not coexist, and an Add to
 * Cart button that gave no sign it had done anything.
 */
test.describe('Cart', () => {
  let t: Tracked;

  test.beforeEach(() => {
    t = tracked();
  });

  test.afterEach(async () => {
    await cleanup(t);
  });

  test('C6 · no price anywhere renders as NaN or undefined @money', async ({ page }) => {
    const variant = await findSellableVariant();
    const customer = await createCustomer(t);

    await signInToStorefront(page, customer);

    await page.goto(`/products/${variant.product.slug}?variant=${variant.id}`);

    const addButton = page.locator(SEL.addToCart);
    await expect(addButton).toBeVisible();
    await addButton.click();

    // Optimistic, so the confirmation is immediate rather than after the
    // round trip. This is the assertion that caught the tick expiring before
    // a slow request finished.
    await expect(addButton).toHaveText(/added to cart/i, { timeout: 10_000 });

    await page.locator(SEL.openCart).click();

    const drawer = page.locator('text=/subtotal/i').first();
    await expect(drawer).toBeVisible({ timeout: 15_000 });

    const body = await page.locator('body').innerText();
    expect(body, 'the drawer rendered a broken figure').not.toMatch(/₹\s*NaN/);
    expect(body).not.toMatch(/₹\s*undefined/);
    expect(body).not.toMatch(/₹\s*null/);

    // And the database catches up. Polled rather than read once: the tick is
    // optimistic by design, so it appears before the server has confirmed
    // anything — asserting immediately tests the round trip's speed, not its
    // correctness.
    await expect
      .poll(async () => db.cartItem.count({ where: { userId: customer.id } }), {
        timeout: 20_000,
        message: 'the optimistic line never reached the database',
      })
      .toBe(1);

    const rows = await db.cartItem.findMany({ where: { userId: customer.id } });
    expect(rows[0].variantId).toBe(variant.id);
    expect(rows[0].quantity).toBe(1);
  });

  test('C4 · two sizes of one product are separate lines', async ({ page }) => {
    const product = await db.product.findFirst({
      where: { status: 'LIVE', variants: { some: {} } },
      include: {
        variants: {
          where: { isActive: true, stockQuantity: { gt: 5 } },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    test.skip(
      !product || product.variants.length < 2,
      'needs a product with two stocked variants',
    );

    const customer = await createCustomer(t);
    const [first, second] = product!.variants;

    await signInToStorefront(page, customer);

    for (const variant of [first, second]) {
      await page.goto(`/products/${product!.slug}?variant=${variant.id}`);
      await page.locator(SEL.addToCart).click();
      await expect(page.locator(SEL.addToCart)).toHaveText(/added to cart/i, {
        timeout: 15_000,
      });
    }

    // Two rows, not one merged line: the cart key used to be
    // [userId, productId], which made 500ml and 1L impossible together.
    await expect
      .poll(async () => db.cartItem.count({ where: { userId: customer.id } }), {
        timeout: 20_000,
      })
      .toBe(2);

    const rows = await db.cartItem.findMany({ where: { userId: customer.id } });
    expect(new Set(rows.map((r) => r.variantId)).size).toBe(2);
    expect(new Set(rows.map((r) => r.productId)).size).toBe(1);
  });

  test('B7 · a sold-out variant cannot be bought', async ({ page }) => {
    const variant = await findSellableVariant();
    const original = variant.stockQuantity;

    await db.productVariant.update({
      where: { id: variant.id },
      data: { stockQuantity: 0 },
    });

    try {
      await page.goto(`/products/${variant.product.slug}?variant=${variant.id}`);

      // The behaviour that matters is that it cannot be bought. Asserting on
      // the wording would break every time the copy is edited.
      const addButton = page.locator(SEL.addToCart);
      await expect(addButton).toBeVisible();
      await expect(addButton, 'a sold-out variant was still buyable').toBeDisabled();
      await expect(addButton).toHaveText(/out of stock/i);
    } finally {
      await db.productVariant.update({
        where: { id: variant.id },
        data: { stockQuantity: original },
      });
    }
  });
});
