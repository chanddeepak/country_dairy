import { test, expect } from '@playwright/test';
import { STORAGE } from '../../playwright.config';
import { cleanup, db, tracked, RUN_ID, type Tracked } from '../fixtures/db';
import {
  addAddress,
  apiClient,
  createCustomer,
  findSellableVariant,
  placePaidOrder,
  resolve,
} from '../fixtures/api';

/**
 * The support desk, driven through the console.
 *
 * There is an API test asserting that a single opened thread comes back with
 * the order's line items, and it passed while the modal showed "No line items
 * came back for this order" for every ticket. The console never called that
 * endpoint — it opened threads straight from the list, which deliberately
 * omits them.
 *
 * The endpoint being right is not the same as the page asking it. This test
 * clicks.
 */
test.describe('Support desk', () => {
  let t: Tracked;

  test.beforeEach(() => {
    t = tracked();
  });

  test.afterEach(async () => {
    await db.supportTicket.deleteMany({
      where: t.orderIds.length ? { orderId: { in: t.orderIds } } : { subject: { contains: RUN_ID } },
    });
    await cleanup(t);
  });

  test('opening a thread shows what was in the box', async ({ browser }) => {
    test.setTimeout(240_000);

    const context = await browser.newContext({ storageState: STORAGE.admin });
    const page = await context.newPage();

    const customer = await createCustomer(t);
    const variant = await findSellableVariant();
    const addressId = await addAddress(customer.token);
    const { orderId, orderNumber } = await placePaidOrder(
      customer,
      [{ variantId: variant.id, quantity: 2 }],
      { addressId },
    );
    t.orderIds.push(orderId);

    const asCustomer = await apiClient(customer.token);
    await asCustomer.post(resolve('/support'), {
      data: { subject: `Wrong size ${RUN_ID}`, body: 'I think I was sent the wrong size.', orderId },
    });
    await asCustomer.dispose();

    await page.goto('/');
    await page.getByRole('button', { name: 'Customer Queries' }).click();

    // Open the thread for this order.
    await page.getByText(orderNumber).first().click();

    await page.getByRole('button', { name: /what was ordered/i }).click();

    // The actual failure: the panel opened, but empty.
    await expect(
      page.getByText(/no line items came back/i),
      'the console opened the thread without asking for the order',
    ).toHaveCount(0);

    // The product as it was at checkout, which is what the desk needs to see.
    await expect(page.getByText(variant.product.title, { exact: false }).first()).toBeVisible({
      timeout: 15_000,
    });

    await context.close();
  });

  test('the inbox can be refreshed without reloading the browser', async ({ browser }) => {
    test.setTimeout(180_000);

    const context = await browser.newContext({ storageState: STORAGE.admin });
    const page = await context.newPage();

    await page.goto('/');
    await page.getByRole('button', { name: 'Customer Queries' }).click();
    await expect(page.getByTestId('refresh-queries')).toBeVisible({ timeout: 20_000 });

    const customer = await createCustomer(t);
    const asCustomer = await apiClient(customer.token);
    const subject = `Arrived while watching ${RUN_ID}`;
    await asCustomer.post(resolve('/support'), {
      data: { subject, body: 'Sent after the desk had already opened the page.' },
    });
    await asCustomer.dispose();

    // Nothing pushes a new query to an open console, so until it is asked the
    // desk has no idea this exists.
    await page.getByTestId('refresh-queries').click();
    await expect(page.getByText(subject)).toBeVisible({ timeout: 20_000 });

    await context.close();
  });
});
