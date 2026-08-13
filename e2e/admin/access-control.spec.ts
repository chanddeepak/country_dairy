import { test, expect } from '@playwright/test';
import { STORAGE } from '../../playwright.config';
import { signInToAdmin, signInToStorefront } from '../fixtures/actions';
import { cleanup, tracked, type Tracked } from '../fixtures/db';
import { createCustomer, createStaff, TEST_PASSWORD } from '../fixtures/api';

/**
 * QA plan §10 — Admin access control.
 *
 * Each case here corresponds to something that went wrong once: a driver
 * landing on a 403 because the previous user's tab was restored, and a
 * false "Could not reach the API server" banner shown to roles that simply
 * had no catalogue access.
 */
test.describe('Admin access control', () => {
  let t: Tracked;

  test.beforeEach(() => {
    t = tracked();
  });

  test.afterEach(async () => {
    await cleanup(t);
  });

  test('I2 · a customer cannot sign into the console @security', async ({ page }) => {
    const customer = await createCustomer(t);

    await signInToAdmin(page, customer.email, TEST_PASSWORD);

    // Refused, and still on the sign-in screen.
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/overview|dashboard/i)).toHaveCount(0);
  });

  test('I4 · a driver lands somewhere they can open @security', async ({ browser }) => {
    // Deliberately not the stored driver session: this reproduces arriving on
    // a browser whose last user was an admin, which is when the saved tab
    // used to send a driver to a 403 on their own console.
    const context = await browser.newContext({ storageState: STORAGE.admin });
    const page = await context.newPage();

    const driver = await createStaff(t, 'DELIVERY_DRIVER', 'Tab Restore Driver');

    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('country_dairy_admin_token'));
    await page.goto('/');

    await signInToAdmin(page, driver.email, TEST_PASSWORD);

    await expect(page.getByText(/my deliveries/i).first()).toBeVisible({ timeout: 30_000 });

    const body = await page.locator('body').innerText();
    expect(body, 'the driver was shown a 403 on their own console').not.toMatch(
      /403|cannot open this page/i,
    );
    // The API was fine; the driver simply has no catalogue.
    expect(body, 'a false connectivity error was shown').not.toMatch(
      /could not reach the api/i,
    );

    await context.close();
  });

  test('I3 · a driver sees only their own navigation @security', async ({ browser }) => {
    const context = await browser.newContext({ storageState: STORAGE.driver });
    const page = await context.newPage();

    await page.goto('/');
    await expect(page.getByText(/my deliveries/i).first()).toBeVisible({ timeout: 30_000 });

    const nav = await page.locator('aside').innerText();
    for (const forbidden of [
      /product catalog/i,
      /order queue/i,
      /customer directory/i,
      /user management/i,
      /audit log/i,
    ]) {
      expect(nav, `a driver was offered "${forbidden}"`).not.toMatch(forbidden);
    }

    await context.close();
  });

  test('I7 · a flagged-off page has no nav entry @flags', async ({ browser }) => {
    const context = await browser.newContext({ storageState: STORAGE.admin });
    const page = await context.newPage();

    await page.goto('/');
    await expect(page.getByText(/admin console/i).first()).toBeVisible({ timeout: 30_000 });

    const walletOn = await page.evaluate(async () => {
      const res = await fetch('http://localhost:4000/api/cms/feature-flags/map');
      const flags = await res.json();
      return flags.ENABLE_WALLET === true;
    });

    const nav = await page.locator('aside').innerText();
    if (walletOn) {
      expect(nav).toMatch(/wallet/i);
    } else {
      // Hidden entirely, not merely disabled: offering a wallet the store
      // does not have is its own defect.
      expect(nav, 'Wallet Ledger was listed while the flag is off').not.toMatch(/wallet/i);
    }

    await context.close();
  });
});
