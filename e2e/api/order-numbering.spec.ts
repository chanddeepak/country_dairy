import { test, expect } from '@playwright/test';
import { cleanup, db, tracked, type Tracked } from '../fixtures/db';
import { apiClient, findSellableVariant, resolve } from '../fixtures/api';

/**
 * That two customers checking out at the same moment both get an order.
 *
 * The numbers used to come from `max(orderNumber) + 1`, which meant two
 * simultaneous checkouts read the same maximum and tried to write the same
 * number. The unique index kept the data sound, so nothing was corrupted —
 * one customer simply got a 500 and lost their basket, at random, under load.
 * That is invisible in testing and expensive in production.
 */
test.describe('Order numbering @concurrency', () => {
  let t: Tracked;

  test.beforeEach(() => {
    t = tracked();
  });

  test.afterEach(async () => {
    await cleanup(t);
  });

  test('eight simultaneous checkouts all succeed, with eight distinct numbers', async () => {
    const row = await db.featureFlag.findUnique({ where: { key: 'ENABLE_CASHFREE_CHECKOUT' } });
    test.skip(!row?.isEnabled, 'Guest checkout needs Cashfree');

    const variant = await findSellableVariant();

    // Fired together rather than in sequence — one at a time never collides,
    // which is why this bug survived so long.
    const results = await Promise.all(
      Array.from({ length: 8 }, async () => {
        const api = await apiClient();
        const res = await api.post(resolve('/orders/checkout'), {
          data: { items: [{ variantId: variant.id, quantity: 1 }] },
        });
        const text = await res.text();
        await api.dispose();
        return { status: res.status(), text };
      }),
    );

    const failed = results.filter((r) => r.status >= 400);
    expect(failed.map((f) => f.text.slice(0, 120)), 'every checkout should succeed').toEqual([]);

    const bodies = results.map((r) => JSON.parse(r.text));
    bodies.forEach((b) => t.orderIds.push(b.orderId));

    const numbers = bodies.map((b) => b.orderNumber);
    expect(new Set(numbers).size, `duplicate order numbers: ${numbers.join(', ')}`).toBe(8);
  });

  test('a deleted order never lends its number to the next one', async () => {
    const row = await db.featureFlag.findUnique({ where: { key: 'ENABLE_CASHFREE_CHECKOUT' } });
    test.skip(!row?.isEnabled, 'Guest checkout needs Cashfree');

    const variant = await findSellableVariant();

    async function checkout() {
      const api = await apiClient();
      const res = await api.post(resolve('/orders/checkout'), {
        data: { items: [{ variantId: variant.id, quantity: 1 }] },
      });
      const body = JSON.parse(await res.text());
      await api.dispose();
      return body;
    }

    const first = await checkout();

    /*
     * The failure this reproduces: Cashfree's order ids are permanent, so a
     * reissued number came back 409 order_already_exists and the customer
     * could not pay — for a reason nothing on our side would have explained.
     */
    await db.orderStatusHistory.deleteMany({ where: { orderId: first.orderId } });
    await db.payment.deleteMany({ where: { orderId: first.orderId } });
    await db.orderItem.deleteMany({ where: { orderId: first.orderId } });
    await db.stockMovement.deleteMany({ where: { referenceId: first.orderId } });
    await db.order.delete({ where: { id: first.orderId } });

    const second = await checkout();
    t.orderIds.push(second.orderId);

    expect(second.orderNumber).not.toBe(first.orderNumber);
  });

  test('the series row is what hands out numbers @money', async () => {
    const year = Number(
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric' }).format(
        new Date(),
      ),
    );
    const series = await db.numberSeries.findUnique({ where: { key: `order:${year}` } });

    // Seeded from the existing maximum by the migration. If it were ever below
    // that, the next order would collide with one already taken.
    expect(series, `no order:${year} series row`).toBeTruthy();

    const orders = await db.order.findMany({
      where: { orderNumber: { startsWith: `CD-${year}-` } },
      select: { orderNumber: true },
    });
    const highest = Math.max(
      0,
      ...orders.map((o) => Number(o.orderNumber.split('-')[2])).filter((n) => !Number.isNaN(n)),
    );
    expect(series!.lastValue).toBeGreaterThanOrEqual(highest);
  });
});
