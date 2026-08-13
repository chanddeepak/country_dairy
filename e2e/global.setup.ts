import { test as setup, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { ADMIN, STOREFRONT, STORAGE } from '../playwright.config';
import {
  adminToken,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  apiClient,
  createCustomer,
  createStaff,
  resolve,
  TEST_PASSWORD,
} from './fixtures/api';
import { db, tracked } from './fixtures/db';
import { signInToAdmin, signInToStorefront } from './fixtures/actions';

/**
 * Roles that persist for the whole run, unlike the throwaway fixtures each
 * spec makes. Recorded here so the final teardown can remove them.
 */
const SHARED = path.resolve(__dirname, '.auth/shared.json');

setup('the three apps are reachable', async ({ request }) => {
  const checks = [
    { name: 'API', url: `${process.env.E2E_API_URL || 'http://localhost:4000/api'}/catalog/products` },
    { name: 'storefront', url: STOREFRONT },
    { name: 'admin console', url: ADMIN },
  ];

  for (const { name, url } of checks) {
    // Retried rather than asserted once. A Next dev server recompiles on the
    // first request after a change and can take tens of seconds, which is not
    // the same as being down — failing there aborts a whole run over a cold
    // start.
    await expect
      .poll(
        async () => {
          const res = await request.get(url).catch(() => null);
          return res?.ok() ?? false;
        },
        {
          timeout: 120_000,
          intervals: [1_000, 2_000, 5_000],
          message:
            `${name} is not answering at ${url}. Start it before running these ` +
            'tests — see docs/RUNNING.md.',
        },
      )
      .toBe(true);
  }
});

setup('there is data to test against', async () => {
  const products = await db.product.count({ where: { status: 'LIVE' } });
  expect(
    products,
    'No live products. Run `npm run db:seed` before these tests.',
  ).toBeGreaterThan(0);
});

setup('sign in as admin', async ({ page }) => {
  // Proves the console's own sign-in works, and banks the session so the
  // twenty-odd admin specs do not each pay for it.
  await signInToAdmin(page, ADMIN_EMAIL, ADMIN_PASSWORD);

  await expect(
    page.getByText(/admin console/i).first(),
    'Admin sign-in did not reach the console. If the password has been ' +
      'rotated, set E2E_ADMIN_PASSWORD.',
  ).toBeVisible({ timeout: 30_000 });

  await page.context().storageState({ path: STORAGE.admin });
});

setup('sign in as a customer', async ({ page }) => {
  const t = tracked();
  const customer = await createCustomer(t, 'E2E Shopper');

  // The storefront keeps its session in localStorage rather than a cookie, so
  // the token is planted directly; the sign-in form itself is covered by its
  // own spec rather than being a dependency of every other one.
  await signInToStorefront(page, { ...customer, name: 'E2E Shopper' });

  await page.context().storageState({ path: STORAGE.customer });

  fs.mkdirSync(path.dirname(SHARED), { recursive: true });
  fs.writeFileSync(SHARED, JSON.stringify({ customer, userIds: t.userIds }, null, 2));
});

setup('sign in as a delivery driver', async ({ page }) => {
  const t = tracked();
  const driver = await createStaff(t, 'DELIVERY_DRIVER', 'E2E Driver');

  await signInToAdmin(page, driver.email, TEST_PASSWORD);

  // A driver must land somewhere they can actually open. Landing on a 403 was
  // a real defect, so this doubles as a regression check.
  await expect(page.getByText(/my deliveries/i).first()).toBeVisible({ timeout: 30_000 });

  await page.context().storageState({ path: STORAGE.driver });

  const shared = JSON.parse(fs.readFileSync(SHARED, 'utf8'));
  shared.driver = driver;
  shared.userIds = [...shared.userIds, ...t.userIds];
  fs.writeFileSync(SHARED, JSON.stringify(shared, null, 2));
});

setup('the admin API answers', async () => {
  const token = await adminToken();
  const api = await apiClient(token);
  const res = await api.get(resolve('/catalog/admin/products'));
  expect(res.ok(), 'Admin catalogue read failed').toBeTruthy();
  await api.dispose();
});
