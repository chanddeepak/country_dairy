import { test, expect } from '@playwright/test';
import { cleanup, db, tracked, type Tracked } from '../fixtures/db';
import { apiClient, createCustomer, findSellableVariant, resolve } from '../fixtures/api';
import { SEL, signInToStorefront } from '../fixtures/actions';

/**
 * QA plan §5 — the checkout journey, clicked.
 *
 * The API specs already prove the arithmetic. What only a browser can show is
 * whether a customer can actually get from a full cart to a paid order: that
 * the address form saves, that the summary on screen is the one the server
 * calculated, and that the payment step ends somewhere sensible.
 */
test.describe('Checkout journey', () => {
  let t: Tracked;

  test.beforeEach(() => {
    t = tracked();
  });

  test.afterEach(async () => {
    await cleanup(t);
  });

  test('D1 · checkout is not reachable signed out', async ({ page }) => {
    await page.goto('/checkout');
    // Either bounced away or asked to sign in — what must not happen is a
    // checkout form for nobody.
    await expect(page.locator(SEL.placeOrder)).toHaveCount(0);
  });

  test('D3/D5/D7 · a customer can go from cart to paid order', async ({ page }) => {
    // Roughly a dozen server round trips to another region, each with a React
    // render behind it.
    test.setTimeout(180_000);

    const customer = await createCustomer(t);
    const variant = await findSellableVariant();

    // The cart is seeded through the API: this case is about checkout, and
    // clicking through the catalogue first is already covered in cart.spec.
    const api = await apiClient(customer.token);
    const added = await api.post(resolve('/cart/add'), {
      data: { variantId: variant.id, quantity: 1 },
    });
    expect(added.ok()).toBeTruthy();
    await api.dispose();

    await signInToStorefront(page, customer);
    await page.goto('/checkout');

    await expect(page.getByRole('heading', { name: /checkout/i }).first()).toBeVisible();

    // D3 — add a delivery address without leaving the page.
    await page.locator(SEL.addAddress).click();
    await expect(page.locator(SEL.addressForm)).toBeVisible();

    await page.locator(SEL.addressLine1).fill('Bilona House, Mall Road');
    await page.locator(SEL.addressCity).fill('Tanakpur');
    await page.locator(SEL.addressState).fill('Uttarakhand');
    await page.locator(SEL.addressPincode).fill('262309');
    await page.locator(SEL.addressPhone).fill('9876543210');
    await page.locator(SEL.addressForm).getByRole('button', { name: /save/i }).click();

    await expect(page.locator(SEL.addressForm)).toBeHidden();

    const address = await db.address.findFirst({ where: { userId: customer.id } });
    expect(address, 'the address form saved nothing').not.toBeNull();

    // D5 — the total on the button is the server's, so read it before paying
    // and compare against what the order ends up storing.
    const placeOrder = page.locator(SEL.placeOrder);
    await expect(placeOrder).toBeEnabled();
    const shownTotal = Number((await placeOrder.innerText()).replace(/[^0-9.]/g, ''));
    expect(Number.isFinite(shownTotal)).toBeTruthy();
    expect(shownTotal).toBeGreaterThan(0);

    await placeOrder.click();

    // Razorpay runs in mock mode locally, and the page stands in its own
    // confirmation for the gateway modal.
    const confirm = page.locator(SEL.confirmPayment);
    await expect(confirm).toBeVisible({ timeout: 30_000 });
    await confirm.click();

    // D7 — the journey ends on the order, not on a spinner.
    await page.waitForURL(/\/orders\/[^/]+\?status=success/, { timeout: 60_000 });

    const orderId = page.url().match(/\/orders\/([^/?]+)/)![1];
    t.orderIds.push(orderId);

    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.userId).toBe(customer.id);
    expect(order.paymentStatus).toBe('PAID');
    expect(Number(order.totalAmount)).toBeCloseTo(shownTotal, 1);

    // D9 — and the cart the customer just bought is gone.
    expect(await db.cartItem.count({ where: { userId: customer.id } })).toBe(0);

    // The page they landed on must show the order, not ₹NaN — the defect this
    // project has already shipped once.
    await expect(page.getByText(/nan/i)).toHaveCount(0);
  });

  test('D4 · a bad PIN code is refused before anything is saved', async ({ page }) => {
    test.setTimeout(120_000);

    const customer = await createCustomer(t);
    const variant = await findSellableVariant();

    const api = await apiClient(customer.token);
    await api.post(resolve('/cart/add'), { data: { variantId: variant.id, quantity: 1 } });
    await api.dispose();

    await signInToStorefront(page, customer);
    await page.goto('/checkout');

    await page.locator(SEL.addAddress).click();
    await page.locator(SEL.addressLine1).fill('Bilona House, Mall Road');
    await page.locator(SEL.addressCity).fill('Tanakpur');
    await page.locator(SEL.addressState).fill('Uttarakhand');
    await page.locator(SEL.addressPincode).fill('12'); // too short, and starts illegally
    await page.locator(SEL.addressPhone).fill('9876543210');
    await page.locator(SEL.addressForm).getByRole('button', { name: /save/i }).click();

    // The form stays open with its complaint rather than silently doing nothing.
    await expect(page.locator(SEL.addressForm)).toBeVisible();
    expect(await db.address.count({ where: { userId: customer.id } })).toBe(0);
  });

  test('D2 · an empty cart offers nothing to pay for', async ({ page }) => {
    const customer = await createCustomer(t);

    await signInToStorefront(page, customer);
    await page.goto('/checkout');

    await expect(page.locator(SEL.placeOrder)).toHaveCount(0);
  });
});
