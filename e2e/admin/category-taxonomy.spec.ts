import { test, expect } from '@playwright/test';
import { STORAGE } from '../../playwright.config';
import { db } from '../fixtures/db';

/**
 * Categories & Taxonomy — the writes actually reaching the database.
 *
 * Every write on this page was silently failing. The console spread a whole
 * CategoryItem into the request body, so `id` travelled with it and the API's
 * `forbidNonWhitelisted` validation rejected the lot with
 * `400 property id should not exist`; the active toggle sent `{ isActive }`
 * alone and was rejected for the missing name. All three were caught into a
 * `console.warn` behind an optimistic table update, so the row changed on
 * screen, the dialog closed, and nothing was saved.
 *
 * That is why these assertions end at the database rather than at the table.
 * A test that checked the screen would have passed throughout.
 */
test.describe('Category taxonomy', () => {
  test.use({ storageState: STORAGE.admin });

  /**
   * Open the console on the categories screen.
   *
   * It is a sub-tab of "Storefront CMS & Flags", not a page of its own, so
   * there are two clicks and neither label contains the word on the heading.
   */
  async function openCategories(page: import('@playwright/test').Page) {
    await page.goto('/');
    await page.getByText(/storefront cms & flags/i).first().click();
    await page.getByRole('button', { name: /categories & taxonomy/i }).click();
    await expect(page.getByRole('heading', { name: /category & taxonomy/i })).toBeVisible({
      timeout: 30_000,
    });
  }

  test('editing a description saves it, and leaves the slug alone', async ({ page }) => {
    test.setTimeout(120_000);

    const before = await db.category.findFirst({
      where: { isActive: true, parentId: null },
      select: { id: true, name: true, slug: true, description: true },
    });
    test.skip(!before, 'no category to edit');

    const wanted = `E2E description ${Date.now()}`;

    await openCategories(page);

    const row = page.locator('tr', { hasText: before!.name }).first();
    await row.getByTitle('Edit Category').click();

    const box = page.locator('textarea').first();
    await expect(box).toBeVisible({ timeout: 15_000 });
    await box.fill(wanted);
    await page.getByRole('button', { name: /save changes/i }).click();

    // No error surfaced — the dialog closing is not evidence of a save, which
    // is exactly the confusion this bug created.
    await expect(page.locator('[data-testid="category-save-error"]')).toHaveCount(0);

    try {
      await expect
        .poll(
          async () =>
            (await db.category.findUnique({
              where: { id: before!.id },
              select: { description: true },
            }))?.description,
          { message: 'the description never reached the database', timeout: 20_000 },
        )
        .toBe(wanted);

      // The slug is the public URL. Re-deriving it from the name on every save
      // meant editing a description silently moved /category/<slug>.
      const after = await db.category.findUnique({
        where: { id: before!.id },
        select: { slug: true },
      });
      expect(after?.slug, 'editing the description changed the category URL').toBe(before!.slug);
    } finally {
      await db.category.update({
        where: { id: before!.id },
        data: { description: before!.description },
      });
    }
  });

  test('the active toggle reaches the database', async ({ page }) => {
    test.setTimeout(120_000);

    const before = await db.category.findFirst({
      where: { parentId: null },
      select: { id: true, name: true, isActive: true },
    });
    test.skip(!before, 'no category to toggle');

    await openCategories(page);

    const row = page.locator('tr', { hasText: before!.name }).first();
    // The control is labelled with the state it is in, so this reads whichever
    // way round the category currently is.
    await row.getByRole('button', { name: before!.isActive ? 'Active' : 'Disabled', exact: true }).click();

    try {
      await expect
        .poll(
          async () =>
            (await db.category.findUnique({
              where: { id: before!.id },
              select: { isActive: true },
            }))?.isActive,
          { message: 'the toggle never reached the database', timeout: 20_000 },
        )
        .toBe(!before!.isActive);
    } finally {
      await db.category.update({
        where: { id: before!.id },
        data: { isActive: before!.isActive },
      });
    }
  });

  test('a failed save says so instead of closing as though it worked', async ({ page }) => {
    test.setTimeout(90_000);

    const target = await db.category.findFirst({
      where: { isActive: true, parentId: null },
      select: { name: true },
    });
    test.skip(!target, 'no category to edit');

    await openCategories(page);

    // Whatever the reason, a rejected write must not look like a success. This
    // is the property that was missing: the console swallowed a 400 and closed.
    await page.route('**/catalog/categories/**', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ message: ['property id should not exist'] }),
      }),
    );

    const row = page.locator('tr', { hasText: target!.name }).first();
    await row.getByTitle('Edit Category').click();
    await page.locator('textarea').first().fill('this save is going to fail');
    await page.getByRole('button', { name: /save changes/i }).click();

    const error = page.locator('[data-testid="category-save-error"]');
    await expect(error, 'a rejected save was not reported').toBeVisible({ timeout: 20_000 });
    await expect(error).toContainText(/id should not exist/i);
  });
});
