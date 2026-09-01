import { test, expect } from '@playwright/test';
import { STORAGE } from '../../playwright.config';

/**
 * The warning before losing work in progress.
 *
 * The console had no guard of any kind, so a stray back gesture or a closed
 * tab discarded a long product description with no warning and no draft. The
 * storefront's forms are short; a single field here can hold twenty minutes of
 * writing.
 *
 * Asserted by watching for the beforeunload listener rather than by trying to
 * catch the dialog: browsers deliberately suppress that dialog in automation,
 * so a test that waited for it would pass whether or not the guard existed.
 */
test.describe('Unsaved changes', () => {
  test.use({ storageState: STORAGE.admin });

  async function openFirstProduct(page: import('@playwright/test').Page) {
    await page.goto('/');
    // The sidebar calls it "Product Catalog & Stock", not "Products".
    await page.getByText(/product catalog & stock/i).first().click();
    await page.waitForTimeout(2000);

    // The row's edit control is an icon, so it is reached by role where it has
    // a name and by position where it does not.
    const edit = page.getByRole('button', { name: /edit/i }).first();
    if (await edit.count()) {
      await edit.click();
    } else {
      await page.locator('table tbody tr').first().click();
    }
    await page.waitForTimeout(2000);
  }

  test('an untouched editor does not warn, and a typed-in one does', async ({ page }) => {
    test.setTimeout(120_000);

    // Count beforeunload registrations rather than the dialog itself.
    await page.addInitScript(() => {
      (window as any).__beforeUnloadCount = 0;
      const add = window.addEventListener.bind(window);
      const remove = window.removeEventListener.bind(window);
      window.addEventListener = function (type: string, ...rest: any[]) {
        if (type === 'beforeunload') (window as any).__beforeUnloadCount += 1;
        return add(type as any, ...(rest as [any]));
      } as any;
      window.removeEventListener = function (type: string, ...rest: any[]) {
        if (type === 'beforeunload') (window as any).__beforeUnloadCount -= 1;
        return remove(type as any, ...(rest as [any]));
      } as any;
    });

    await openFirstProduct(page);

    /*
     * Measured as a delta, not against zero. The dev server's own client
     * registers a beforeunload of its own, so an absolute count says nothing
     * about this form — the first version of this test asserted 0, failed, and
     * was wrong rather than the code being wrong.
     */
    const before = await page.evaluate(() => (window as any).__beforeUnloadCount);

    // Type into whichever text field the editor opens on.
    const field = page.locator('input[type="text"], textarea').first();
    await expect(field).toBeVisible({ timeout: 20_000 });
    await field.click();
    await field.type(' edited');

    await expect
      .poll(async () => page.evaluate(() => (window as any).__beforeUnloadCount), {
        message: 'editing the product never armed the unsaved-changes warning',
        timeout: 10_000,
      })
      .toBeGreaterThan(before);
  });
});
