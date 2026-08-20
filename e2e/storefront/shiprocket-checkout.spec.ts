import { test, expect } from '@playwright/test';
import { SEL, signInToStorefront } from '../fixtures/actions';
import { cleanup, db, tracked, type Tracked } from '../fixtures/db';
import { adminToken, apiClient, createCustomer, findSellableVariant, resolve } from '../fixtures/api';

const FLAG = 'ENABLE_SHIPROCKET_CHECKOUT';
const EXPRESS = '[data-testid="shiprocket-checkout"]';

/**
 * The Shiprocket checkout button on our checkout page.
 *
 * It is a second way to pay and never a replacement: their own script wants a
 * fallbackUrl pointing back at our checkout for when their server is down, so
 * ours has to keep working whatever happens. Both assertions below are really
 * one property — the flag decides whether the extra button exists, and nothing
 * about the existing one changes either way.
 *
 * The flag is flipped here and restored afterwards, because the point is the
 * behaviour on both sides of it and the seeded default is off.
 */
test.describe('Shiprocket express checkout', () => {
  let t: Tracked;

  test.beforeEach(() => {
    t = tracked();
  });

  test.afterEach(async () => {
    // Whatever happened, the switch goes back. A test that leaves a feature on
    // hands its mess to whatever runs next.
    await setFlag(false);
    await cleanup(t);
  });

  /**
   * Flip the flag the way the console does.
   *
   * Writing the row directly is not enough: the API holds flags for 30 seconds,
   * so the storefront went on seeing the old value and the first version of
   * this test failed for a reason that had nothing to do with the button. The
   * console's own route clears that cache, which is exactly why it exists.
   */
  async function setFlag(on: boolean) {
    const current = await db.featureFlag.findUnique({ where: { key: FLAG } });
    if (!current || current.isEnabled === on) return;

    const admin = await apiClient(await adminToken());
    const res = await admin.patch(resolve(`/cms/feature-flags/${FLAG}/toggle`));
    expect(res.ok(), `could not toggle ${FLAG}: ${await res.text()}`).toBeTruthy();
    await admin.dispose();
  }

  /** A signed-in customer with something in the basket and an address saved. */
  async function readyToPay(page: import('@playwright/test').Page) {
    const customer = await createCustomer(t);
    const variant = await findSellableVariant();

    const api = await apiClient(customer.token);
    await api.post(resolve('/cart/add'), { data: { variantId: variant.id, quantity: 1 } });
    await api.dispose();

    await signInToStorefront(page, customer);
    await page.goto('/checkout');

    await page.locator(SEL.addAddress).click();
    await expect(page.locator(SEL.addressForm)).toBeVisible();
    await page.locator(SEL.addressLine1).fill('Bilona House, Mall Road');
    await page.locator(SEL.addressCity).fill('Tanakpur');
    await page.locator(SEL.addressState).selectOption('Uttarakhand');
    await page.locator(SEL.addressPincode).fill('262309');
    await page.locator(SEL.addressPhone).fill('9876543210');
    await page.locator(SEL.addressForm).getByRole('button', { name: /save/i }).click();
    await expect(page.locator(SEL.addressForm)).toBeHidden();

    await expect(page.locator(SEL.placeOrder)).toBeEnabled({ timeout: 20_000 });
  }

  test('off, the page is exactly as it was', async ({ page }) => {
    test.setTimeout(120_000);
    await setFlag(false);

    await readyToPay(page);

    await expect(page.locator(EXPRESS), 'a disabled checkout showed its button').toHaveCount(0);
    // The point of a flag: the path that already worked is untouched.
    await expect(page.locator(SEL.placeOrder)).toBeEnabled();
  });

  test('on, it appears beside the existing way to pay, not instead of it', async ({ page }) => {
    test.setTimeout(120_000);
    await setFlag(true);

    await readyToPay(page);

    await expect(page.locator(EXPRESS), 'the flag was on and no button appeared').toBeVisible({
      timeout: 20_000,
    });

    // Both, at once. Our own checkout is the fallback their script is
    // configured to use, so it can never be the one that disappears.
    await expect(page.locator(SEL.placeOrder)).toBeEnabled();
  });

  test('with no credentials it says so rather than hanging', async ({ page }) => {
    test.setTimeout(120_000);
    // Opt-in, because this one leaves the machine: with the flag on, the API
    // really does call Shiprocket. Locally SHIPROCKET_API_KEY holds the
    // placeholder the inbound guard uses in tests, so the call goes out and is
    // refused — which is the behaviour under test, but it is still a third
    // party in a suite that otherwise only talks to localhost.
    test.skip(
      process.env.E2E_ALLOW_EXTERNAL !== '1',
      'set E2E_ALLOW_EXTERNAL=1 to let this one call Shiprocket for real',
    );

    await setFlag(true);
    await readyToPay(page);

    await page.locator(EXPRESS).click();

    // Unconfigured is the state we are actually in until Shiprocket send keys,
    // so it is the state most worth pinning: a customer gets a sentence and the
    // original button, never a spinner that never resolves.
    await expect(page.locator('[data-testid="shiprocket-error"]')).toBeVisible({
      timeout: 25_000,
    });
    await expect(page.locator(SEL.placeOrder)).toBeEnabled();
  });
});
