import { test, expect } from '@playwright/test';
import * as crypto from 'crypto';
import { db, RUN_ID } from '../fixtures/db';
import { apiClient, findSellableVariant, resolve } from '../fixtures/api';

/**
 * Shiprocket's order webhook.
 *
 * Their documentation says webhooks "may be sent more than once", so the
 * assertions here are mostly about the second delivery: it must not create a
 * second order, must not take stock twice, and must not charge or invoice
 * anybody again. That is the whole reason this endpoint is dangerous.
 */
const KEY = process.env.SHIPROCKET_API_KEY || 'dev-local-key';
const SECRET = process.env.SHIPROCKET_API_SECRET || 'dev-local-secret';

function sign(body: string) {
  return {
    'X-Api-Key': KEY,
    'X-Api-HMAC-SHA256': crypto.createHmac('sha256', SECRET).update(body).digest('base64'),
    'Content-Type': 'application/json',
  };
}

function orderPayload(variantExternalId: string, ref: string, quantity = 1) {
  return {
    order_id: ref,
    fastrr_order_id: ref,
    status: 'SUCCESS',
    phone: '9812345678',
    email: `sr-${RUN_ID}@example.com`,
    cart_data: { items: [{ variant_id: variantExternalId, quantity }] },
    shipping_address: {
      first_name: 'Shiprocket',
      last_name: 'Customer',
      phone: '9812345678',
      line1: 'Bilona House, Mall Road',
      city: 'Dehradun',
      state: 'Uttarakhand',
      pincode: '248001',
      country: 'India',
    },
    payment_type: 'PREPAID',
    payment_status: 'Success',
    payments: [
      {
        txn_id: `txn-${ref}`,
        payment_status: 'Success',
        gateway: 'Razorpay',
        payment_method: 'UPI',
        amount: 780,
        pg_transaction_id: `pg-${ref}`,
        amount_received: 780,
      },
    ],
    subtotal_price: 780,
    shipping_charges: 60,
    total_discount: 0,
    total_amount_payable: 840,
  };
}

test.describe('Shiprocket order webhook @security @money', () => {
  const madeOrders: string[] = [];
  const madeUsers: string[] = [];

  test.afterEach(async () => {
    if (madeOrders.length) {
      await db.orderItem.deleteMany({ where: { orderId: { in: madeOrders } } });
      await db.payment.deleteMany({ where: { orderId: { in: madeOrders } } });
      await db.order.deleteMany({ where: { id: { in: madeOrders.splice(0) } } });
    }
    if (madeUsers.length) {
      await db.user.deleteMany({ where: { id: { in: madeUsers.splice(0) } } });
    }
  });

  test('an unsigned webhook is refused', async () => {
    const api = await apiClient();
    const body = JSON.stringify(orderPayload('1', `unsigned-${RUN_ID}`));

    const res = await api.post(resolve('/shiprocket/webhook/order'), {
      data: body,
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(511);

    // And nothing was created from an unverified body.
    expect(await db.order.count({ where: { shiprocketOrderId: `unsigned-${RUN_ID}` } })).toBe(0);
    await api.dispose();
  });

  test('a signed order is created, stock falls once, and a replay changes nothing', async () => {
    test.setTimeout(180_000);

    const variant = await findSellableVariant();
    const before = variant.stockQuantity;
    const ref = `sr-${RUN_ID}`;
    const body = JSON.stringify(orderPayload(String(variant.externalId), ref, 2));

    const api = await apiClient();
    const first = await api.post(resolve('/shiprocket/webhook/order'), {
      data: body,
      headers: sign(body),
    });
    expect(first.status(), await first.text()).toBe(200);

    const order = await db.order.findFirstOrThrow({
      where: { shiprocketOrderId: ref },
      include: { orderItems: true, payments: true, user: true },
    });
    madeOrders.push(order.id);
    madeUsers.push(order.userId);

    // Every figure is theirs; we must not have recomputed any of it.
    expect(Number(order.totalAmount)).toBe(840);
    expect(Number(order.deliveryCharges)).toBe(60);
    expect(order.orderItems).toHaveLength(1);
    expect(order.orderItems[0].quantity).toBe(2);
    expect(order.payments).toHaveLength(1);
    expect(order.user.phone).toBe('9812345678');

    const afterFirst = await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(afterFirst.stockQuantity, 'stock did not fall').toBe(before - 2);

    // The replay. Same body, same signature, exactly as a retry would arrive.
    const second = await api.post(resolve('/shiprocket/webhook/order'), {
      data: body,
      headers: sign(body),
    });
    // 200, or they keep retrying something we have deliberately declined.
    expect(second.status()).toBe(200);

    expect(
      await db.order.count({ where: { shiprocketOrderId: ref } }),
      'a replay created a second order',
    ).toBe(1);

    const afterReplay = await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(afterReplay.stockQuantity, 'a replay took stock twice').toBe(before - 2);

    // Put the stock back for whatever runs next.
    await db.productVariant.update({
      where: { id: variant.id },
      data: { stockQuantity: before },
    });

    await api.dispose();
  });

  test('an abandoned checkout does not become an order', async () => {
    const variant = await findSellableVariant();
    const ref = `abandoned-${RUN_ID}`;
    const payload = { ...orderPayload(String(variant.externalId), ref), status: 'INITIATED' };
    const body = JSON.stringify(payload);

    const api = await apiClient();
    const res = await api.post(resolve('/shiprocket/webhook/order'), {
      data: body,
      headers: sign(body),
    });

    // Acknowledged so they stop, but nothing recorded — otherwise the console
    // fills with orders nobody placed.
    expect(res.status()).toBe(200);
    expect(await db.order.count({ where: { shiprocketOrderId: ref } })).toBe(0);
    await api.dispose();
  });

  test('a cash-on-delivery order is recorded as unpaid', async () => {
    const variant = await findSellableVariant();
    const ref = `cod-${RUN_ID}`;
    const payload = {
      ...orderPayload(String(variant.externalId), ref),
      payment_type: 'CASH_ON_DELIVERY',
      payment_status: 'Pending',
    };
    const body = JSON.stringify(payload);

    const api = await apiClient();
    expect((await api.post(resolve('/shiprocket/webhook/order'), { data: body, headers: sign(body) })).status()).toBe(200);

    const order = await db.order.findFirstOrThrow({ where: { shiprocketOrderId: ref } });
    madeOrders.push(order.id);
    madeUsers.push(order.userId);

    // Money that has not arrived must not be recorded as though it has.
    expect(order.paymentStatus).toBe('PENDING');
    await api.dispose();
  });
});
