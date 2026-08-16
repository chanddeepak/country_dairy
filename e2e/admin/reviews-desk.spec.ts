import { test, expect } from '@playwright/test';
import { STORAGE } from '../../playwright.config';
import { cleanup, db, tracked, RUN_ID, type Tracked } from '../fixtures/db';
import { apiClient, createCustomer, findSellableVariant, resolve } from '../fixtures/api';

/**
 * Taking a review down from the console.
 *
 * The API spec proves the endpoints behave. This is about what the person
 * doing it sees: a confirmation that acknowledges the click, and a dialog
 * that goes away afterwards rather than sitting there looking ignored.
 */
test.describe('Review desk', () => {
  let t: Tracked;

  test.beforeEach(() => {
    t = tracked();
  });

  test.afterEach(async () => {
    await cleanup(t);
  });

  test('a review is taken down, then restored, without leaving a dialog open', async ({
    browser,
  }) => {
    test.setTimeout(240_000);

    const customer = await createCustomer(t);
    const productId = (await findSellableVariant()).productId;

    const asCustomer = await apiClient(customer.token);
    const created = await asCustomer.post(resolve(`/products/${productId}/reviews`), {
      data: { rating: 5, title: `Takedown ${RUN_ID}`, comment: 'A review that will be removed.' },
    });
    expect(created.ok(), await created.text()).toBeTruthy();
    const review = await created.json();
    t.reviewIds.push(review.id);
    await asCustomer.dispose();

    const context = await browser.newContext({ storageState: STORAGE.admin });
    const page = await context.newPage();
    await page.goto('/');
    await page.getByRole('button', { name: 'Customer Reviews' }).click();

    await expect(page.getByText(`Takedown ${RUN_ID}`)).toBeVisible({ timeout: 20_000 });

    // Take it down.
    await page.getByRole('button', { name: /hide from customers/i }).first().click();
    await expect(page.getByRole('heading', { name: 'Delete this review?' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete review' }).click();

    // The dialog must close on its own. Leaving it up is what made the click
    // feel like it had not registered.
    await expect(page.getByRole('heading', { name: 'Delete this review?' })).toBeHidden({
      timeout: 20_000,
    });

    await expect
      .poll(
        async () =>
          (await db.productReview.findUniqueOrThrow({ where: { id: review.id } })).deletedAt !== null,
        { message: 'the review was never taken down', timeout: 20_000 },
      )
      .toBe(true);

    // It has left the published list.
    await expect(page.getByText(`Takedown ${RUN_ID}`)).toHaveCount(0);

    // And is waiting on the other one, restorable.
    await page.getByRole('button', { name: /^Deleted/ }).click();
    await expect(page.getByText(`Takedown ${RUN_ID}`)).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: /put this review back/i }).first().click();
    await expect
      .poll(
        async () =>
          (await db.productReview.findUniqueOrThrow({ where: { id: review.id } })).deletedAt === null,
        { message: 'the review was never restored', timeout: 20_000 },
      )
      .toBe(true);

    await context.close();
  });
});
