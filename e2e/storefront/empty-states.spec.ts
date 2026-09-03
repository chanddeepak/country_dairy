import { test, expect } from '@playwright/test';
import { cleanup, tracked, type Tracked } from '../fixtures/db';
import { createCustomer } from '../fixtures/api';
import { signInToStorefront } from '../fixtures/actions';

/**
 * Empty states, and whether they say what to do next.
 *
 * Reporting that something is absent is the easy half. The half that decides
 * whether a customer stays is the way onward — a shop that says "no products
 * found" and leaves you to work out which of a search box, a category chip and
 * a filter drawer is hiding everything has stopped helping.
 */
test.describe('Empty states', () => {
  let t: Tracked;
  test.beforeEach(() => { t = tracked(); });
  test.afterEach(async () => { await cleanup(t); });

  test('an empty cart offers the way back to the shop', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /open cart/i }).first().click();

    await expect(page.getByText(/your cart is empty/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /start shopping/i })).toBeVisible();
  });

  test('a search that matches nothing offers to clear itself', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/products');
    await page.waitForLoadState('domcontentloaded');

    const search = page.locator('input').first();
    await search.fill('zzzzqqq-no-such-thing');

    await expect(page.getByText(/no products found/i)).toBeVisible({ timeout: 15_000 });

    const clear = page.getByRole('button', { name: /clear search and filters/i });
    await expect(clear, 'the empty state gave no way out of the filter causing it').toBeVisible();

    // And it works: the products come back.
    await clear.click();
    await expect(page.getByText(/no products found/i)).toHaveCount(0);
  });

  test('an account with no orders points at the shop', async ({ page }) => {
    test.setTimeout(120_000);
    const customer = await createCustomer(t, 'No Orders');
    await signInToStorefront(page, customer);
    await page.goto('/account?tab=orders');

    await expect(page.getByText(/no orders yet/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('link', { name: /browse the shop/i })).toBeVisible();
  });
});
