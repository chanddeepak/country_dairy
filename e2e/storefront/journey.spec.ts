import { test, expect } from '@playwright/test';
import { cleanup, db, tracked, uniqueEmail, type Tracked } from '../fixtures/db';
import { TEST_PASSWORD, findSellableVariant } from '../fixtures/api';
import { SEL } from '../fixtures/actions';

/**
 * The whole thing, clicked.
 *
 * Every other spec takes a shortcut somewhere — a session planted into
 * localStorage, a cart seeded over the API, a product reached by deep link.
 * Those are reasonable when a case is about one screen, but they mean nothing
 * exercises the seams between screens, which is where integration actually
 * breaks. This one takes no shortcut: it registers by typing, finds the
 * product by browsing, picks the size by clicking it, and pays.
 *
 * It is the slowest test in the suite and the one worth keeping green.
 */
test.describe('Full customer journey', () => {
  let t: Tracked;

  test.beforeEach(() => {
    t = tracked();
  });

  test.afterEach(async () => {
    await cleanup(t);
  });

  test('a stranger arrives, registers, shops and pays', async ({ page }) => {
    // Around thirty round trips to a database a region away, each behind a
    // React render. This one is allowed to take its time.
    test.setTimeout(300_000);

    const email = uniqueEmail('journey');
    const name = 'Journey Customer';

    // 1 · Arrive on the homepage, as anyone would.
    await page.goto('/');
    await expect(page).toHaveTitle(/./);

    // 2 · Register through the modal, by typing.
    await page.locator(SEL.openAuth).click();
    await page.locator(SEL.toggleRegister).click();
    await page.locator(SEL.signupName).fill(name);
    await page.locator(SEL.emailInput).fill(email);
    await page.locator(SEL.passwordInput).fill(TEST_PASSWORD);
    await page.locator(SEL.submit).click();

    // The row is the proof the form worked, not the modal closing.
    await expect
      .poll(async () => db.user.count({ where: { email } }), { timeout: 30_000 })
      .toBe(1);

    const customer = await db.user.findUniqueOrThrow({ where: { email } });
    t.userIds.push(customer.id);

    await expect(page.locator(SEL.openAuth)).toHaveCount(0, { timeout: 20_000 });

    // 3 · Browse to the catalogue the way the homepage actually works: "Shop"
    //     is an anchor to the shelf further down the page, and only becomes a
    //     link to /products from elsewhere. So scroll to the shelf, then take
    //     the button that leaves for the full catalogue.
    await page.getByRole('link', { name: /^shop$/i }).first().click();
    await expect(page.locator('#shop')).toBeInViewport({ timeout: 20_000 });
    await expect(page.locator(SEL.productCardLink).first()).toBeVisible({ timeout: 30_000 });

    await page.getByRole('link', { name: /explore complete catalog/i }).click();
    await page.waitForURL(/\/products/);

    const cards = page.locator(SEL.productCardLink);
    await expect(cards.first()).toBeVisible({ timeout: 30_000 });

    // 4 · Open a product by clicking its card.
    const variant = await findSellableVariant();
    const card = page.locator(`${SEL.productCardLink}[href*="${variant.product.slug}"]`).first();
    await (await card.count() ? card : cards.first()).click();
    await page.waitForURL(/\/products\/[^/]+/);

    // 5 · Choose a size by clicking the selector, if the product has more
    //     than one. The URL is not touched.
    const options = page.locator(SEL.variantOption);
    if (await options.count() > 1) {
      await options.nth(1).click();
      await options.nth(0).click();
    }

    const chosenVariantId = await options
      .first()
      .getAttribute('data-variant-id')
      .catch(() => null);

    // 6 · Add to cart and wait for the server, not the optimistic tick.
    await page.locator(SEL.addToCart).click();
    await expect
      .poll(async () => db.cartItem.count({ where: { userId: customer.id } }), {
        timeout: 30_000,
      })
      .toBeGreaterThan(0);

    // 7 · Open the drawer and put the quantity up to two, by clicking.
    await page.locator(SEL.openCart).click();
    await expect(page.locator(SEL.checkoutNow)).toBeVisible();

    await page.locator(SEL.qtyIncrease).first().click();
    await expect
      .poll(
        async () => {
          const rows = await db.cartItem.findMany({ where: { userId: customer.id } });
          return rows.reduce((n, r) => n + r.quantity, 0);
        },
        { timeout: 30_000 },
      )
      .toBe(2);

    // 8 · Through to checkout from the drawer.
    await page.locator(SEL.checkoutNow).click();
    await page.waitForURL(/\/checkout/);

    // 9 · Type an address in.
    await page.locator(SEL.addAddress).click();
    await page.locator(SEL.addressLine1).fill('Bilona House, Mall Road');
    await page.locator(SEL.addressCity).fill('Tanakpur');
    await page.locator(SEL.addressState).selectOption('Uttarakhand');
    await page.locator(SEL.addressPincode).fill('262309');
    await page.locator(SEL.addressPhone).fill('9876543210');
    await page.locator(SEL.addressForm).getByRole('button', { name: /save/i }).click();
    await expect(page.locator(SEL.addressForm)).toBeHidden({ timeout: 30_000 });

    // 10 · Read the total off the button before paying, so the stored order
    //      can be checked against what the customer was actually shown.
    const placeOrder = page.locator(SEL.placeOrder);
    await expect(placeOrder).toBeEnabled();
    const shownTotal = Number((await placeOrder.innerText()).replace(/[^0-9.]/g, ''));
    expect(shownTotal).toBeGreaterThan(0);

    await placeOrder.click();

    const confirm = page.locator(SEL.confirmPayment);
    await expect(confirm).toBeVisible({ timeout: 40_000 });
    await confirm.click();

    // 11 · Land on the order.
    await page.waitForURL(/\/orders\/[^/]+\?status=success/, { timeout: 60_000 });
    const orderId = page.url().match(/\/orders\/([^/?]+)/)![1];
    t.orderIds.push(orderId);

    const order = await db.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { orderItems: true },
    });

    expect(order.userId).toBe(customer.id);
    expect(order.paymentStatus).toBe('PAID');
    expect(Number(order.totalAmount)).toBeCloseTo(shownTotal, 1);
    expect(order.orderItems.reduce((n, i) => n + i.quantity, 0)).toBe(2);

    if (chosenVariantId) {
      // The size the customer clicked is the size they were sold. A default
      // quietly winning here is the kind of bug nobody notices until delivery.
      expect(order.orderItems.map((i) => i.variantId)).toContain(chosenVariantId);
    }

    // 12 · The cart is empty and the page shows real numbers.
    expect(await db.cartItem.count({ where: { userId: customer.id } })).toBe(0);
    await expect(page.getByText(/nan|undefined/i)).toHaveCount(0);

    // 13 · The order is in their history. That lives under a tab on /account —
    //      there is no /orders index route — so get there by clicking, which
    //      is also what checks the tab is reachable at all.
    await page.goto('/account');
    await page.getByRole('button', { name: /^orders$/i }).first().click();
    await expect(page.getByText(order.orderNumber)).toBeVisible({ timeout: 30_000 });
  });
});
