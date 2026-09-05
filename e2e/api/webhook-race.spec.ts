import { test, expect } from '@playwright/test';
import * as crypto from 'crypto';
import { db, RUN_ID } from '../fixtures/db';
import { apiClient, resolve } from '../fixtures/api';

/**
 * Two deliveries of the same webhook arriving at once.
 *
 * The audit listed this as never tested. Cashfree retries until it gets a 2xx,
 * and a retry can overlap the delivery it is retrying — so the idempotency
 * guard is a read of `processedAt` followed by a write, and two callers can
 * both read "not processed" before either writes.
 *
 * What must not happen is the payment being settled twice: a second confirm
 * would write a second "Payment confirmed" line into the order's history,
 * which is the record a dispute is read from.
 */
const SECRET = process.env.CASHFREE_CLIENT_SECRET || '';

function sign(timestamp: string, body: string): string {
  return crypto.createHmac('sha256', SECRET).update(timestamp + body).digest('base64');
}

test.describe('Webhook race @money @security', () => {
  test.skip(!SECRET, 'CASHFREE_CLIENT_SECRET is not set');

  const eventIds: string[] = [];

  test.afterEach(async () => {
    if (eventIds.length) {
      await db.webhookEvent.deleteMany({
        where: { provider: 'CASHFREE', eventId: { in: eventIds.splice(0) } },
      });
    }
  });

  test('the same delivery twice, at once, is recorded once', async () => {
    const orderId = `e2e-race-${RUN_ID}-${Date.now()}`;
    const paymentId = Math.floor(Math.random() * 1e9);

    const body = JSON.stringify({
      type: 'PAYMENT_SUCCESS_WEBHOOK',
      data: {
        order: { order_id: orderId, order_amount: 1450 },
        payment: {
          // The same payment id in both, which is what makes them the same
          // event rather than two events.
          cf_payment_id: paymentId,
          payment_status: 'SUCCESS',
          payment_amount: 1450,
          payment_group: 'upi',
          payment_message: 'race probe',
        },
      },
    });

    const ts = String(Math.floor(Date.now() / 1000));
    const headers = {
      'Content-Type': 'application/json',
      'x-webhook-signature': sign(ts, body),
      'x-webhook-timestamp': ts,
    };

    // Fired together rather than one after the other. Sequential replay is
    // already covered; this is the case the guard cannot see coming.
    const [a, b] = await Promise.all([
      (async () => {
        const api = await apiClient();
        const res = await api.post(resolve('/orders/webhook/cashfree'), { headers, data: body });
        const out = { status: res.status(), text: await res.text() };
        await api.dispose();
        return out;
      })(),
      (async () => {
        const api = await apiClient();
        const res = await api.post(resolve('/orders/webhook/cashfree'), { headers, data: body });
        const out = { status: res.status(), text: await res.text() };
        await api.dispose();
        return out;
      })(),
    ]);

    // Whatever each caller was told, exactly one row may exist for the event —
    // the unique constraint on (provider, eventId) is what ultimately holds
    // this together, and this asserts it actually does under collision.
    const rows = await db.webhookEvent.findMany({
      where: { provider: 'CASHFREE', payload: { path: ['data', 'payment', 'cf_payment_id'], equals: paymentId } },
      select: { id: true, eventId: true },
    });
    rows.forEach((r) => eventIds.push(r.eventId));

    expect(
      rows.length,
      `two concurrent deliveries produced ${rows.length} event rows; statuses were ${a.status} and ${b.status}`,
    ).toBe(1);

    // And neither caller was told something untrue. A 5xx is acceptable here —
    // Cashfree retries, and the retry finds the work done — but a silent 2xx
    // on a delivery that did nothing would be a lie.
    const ok = [a, b].filter((r) => r.status >= 200 && r.status < 300).length;
    expect(ok, 'neither concurrent delivery was accepted').toBeGreaterThanOrEqual(1);
  });
});
