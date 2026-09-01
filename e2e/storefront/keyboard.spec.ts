import { test, expect } from '@playwright/test';

/**
 * The site without a mouse.
 *
 * Lighthouse scores accessibility 100 here and could not have caught any of
 * this: it does not press Tab. What it missed was that the sign-in dialog let
 * Tab walk straight out into the page behind it — "Open cart", "SHOP BY
 * CATEGORY", content hidden under the modal — never reached its own close
 * button, and ignored Escape. A keyboard-only customer could open that dialog
 * and had no way to shut it short of reloading.
 */
test.describe('Keyboard @security', () => {
  test('the first stop is a way past the navigation', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');

    const first = page.getByRole('link', { name: /skip to content/i });
    await expect(first, 'the first tab stop should be the skip link').toBeFocused();

    // And it has somewhere to land.
    await page.keyboard.press('Enter');
    await expect(page.locator('#main')).toBeVisible();
  });

  test('the sign-in dialog announces itself', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /sign in/i }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    // Named by its own heading, so it announces as something rather than
    // simply "dialog".
    await expect(dialog).toHaveAttribute('aria-labelledby', /.+/);
  });

  test('Tab stays inside the dialog instead of wandering behind it', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /sign in/i }).first().click();
    await page.waitForTimeout(500);

    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => {
        const d = document.querySelector('[role="dialog"]');
        return d ? d.contains(document.activeElement) : false;
      });
      expect(inside, `focus escaped the dialog after ${i + 1} tabs`).toBe(true);
    }
  });

  test('Escape closes it, because otherwise nothing does', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /sign in/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // And focus goes back where it came from rather than to the top of the
    // document.
    await expect(page.getByRole('button', { name: /sign in/i }).first()).toBeFocused();
  });
});
