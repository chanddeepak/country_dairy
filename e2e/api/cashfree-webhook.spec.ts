import { test, expect } from '@playwright/test';
import * as crypto from 'crypto';
import { db, RUN_ID } from '../fixtures/db';
import { apiClient, resolve } from '../fixtures/api';

/**
 * Cashfree's payment webhook.
 *
 * This endpoint takes no JWT — the signature is the authentication — so most of
 * what matters here is what it refuses. It is also the safety net behind the
 * browser callback: the callback is lost whenever a customer closes the tab,
 * and Cashfree retries this until it gets a 2xx, so a redelivery must settle
 * nothing twice.
 *
 * Cashfree signs `timestamp + rawBody`, not the body alone, and base64s the
 * digest rather than hex. Both differ from Razorpay, and both are checked.
 */
const SECRET = process.env.CASHFREE_CLIENT_SECRET || '';

function sign(timestamp: string, body: string): string {
  return crypto.createHmac('sha256', SECRET).update(timestamp + body).digest('base64');
}

function paymentEvent(orderId: string, type = 'PAYMENT_SUCCESS_WEBHOOK') {
  return JSON.stringify({
    type,
    data: {
      order: { order_id: orderId, order_amount: 1450 },
      payment: {
        cf_payment_id: Math.floor(Math.random() * 1e9),
        payment_status: type === 'PAYMENT_SUCCESS_WEBHOOK' ? 'SUCCESS' : 'FAILED',
        payment_amount: 1450,
        payment_group: 'upi',
        payment_message: 'probe',
      },
    },
  });
}

async function send(body: string, headers: Record<string, string>) {
  const api = await apiClient();
  const res = await api.post(resolve('/orders/webhook/cashfree'), {
    headers: { 'Content-Type': 'application/json', ...headers },
    data: body,
  });
  const status = res.status();
  const text = await res.text();
  await api.dispose();
  return { status, text };
}

test.describe('Cashfree webhook', () => {
  test.skip(!SECRET, 'CASHFREE_CLIENT_SECRET is not set');

  const madeEventIds: string[] = [];

  test.afterEach(async () => {
    if (madeEventIds.length) {
      await db.webhookEvent.deleteMany({
        where: { provider: 'CASHFREE', eventId: { in: madeEventIds.splice(0) } },
      });
    }
  });

  test('a correctly signed event is accepted and recorded', async () => {
    const orderId = `e2e-cf-${RUN_ID}-${Date.now()}`;
    const body = paymentEvent(orderId);
    const ts = String(Math.floor(Date.now() / 1000));

    const { status, text } = await send(body, {
      'x-webhook-signature': sign(ts, body),
      'x-webhook-timestamp': ts,
    });

    expect(status, text).toBe(200);
    expect(JSON.parse(text).received).toBe(true);

    const stored = await db.webhookEvent.findFirst({
      where: { provider: 'CASHFREE', eventId: { contains: orderId } },
      select: { eventId: true, eventType: true, processedAt: true },
    });
    expect(stored, 'the event was not recorded').not.toBeNull();
    expect(stored!.eventType).toBe('PAYMENT_SUCCESS_WEBHOOK');
    // processedAt set means it will not be worked a second time.
    expect(stored!.processedAt).not.toBeNull();
    madeEventIds.push(stored!.eventId);
  });

  test('a redelivery of the same event is a no-op @security', async () => {
    const orderId = `e2e-cf-dup-${RUN_ID}-${Date.now()}`;
    const body = paymentEvent(orderId);
    const ts = String(Math.floor(Date.now() / 1000));
    const headers = { 'x-webhook-signature': sign(ts, body), 'x-webhook-timestamp': ts };

    const first = await send(body, headers);
    const second = await send(body, headers);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(JSON.parse(first.text).duplicate).toBe(false);
    // The second delivery must be recognised rather than reprocessed, or a
    // retried payment settles an order twice and takes stock twice.
    expect(JSON.parse(second.text).duplicate).toBe(true);

    const rows = await db.webhookEvent.findMany({
      where: { provider: 'CASHFREE', eventId: { contains: orderId } },
      select: { eventId: true },
    });
    expect(rows, 'a redelivery created a second row').toHaveLength(1);
    madeEventIds.push(rows[0].eventId);
  });

  test('one byte changed in the body is refused @security', async () => {
    const body = paymentEvent(`e2e-cf-tamper-${RUN_ID}`);
    const ts = String(Math.floor(Date.now() / 1000));
    const signature = sign(ts, body);

    const { status } = await send(`${body} `, {
      'x-webhook-signature': signature,
      'x-webhook-timestamp': ts,
    });

    expect(status).toBe(400);
  });

  test('the timestamp is part of what is signed @security', async () => {
    const body = paymentEvent(`e2e-cf-ts-${RUN_ID}`);
    const ts = String(Math.floor(Date.now() / 1000));
    const signature = sign(ts, body);

    // A signature that is valid for one timestamp must not be reusable under
    // another, or a captured request can be replayed indefinitely.
    const { status } = await send(body, {
      'x-webhook-signature': signature,
      'x-webhook-timestamp': String(Number(ts) + 1),
    });

    expect(status).toBe(400);
  });

  test('a missing signature or timestamp is refused, not defaulted @security', async () => {
    const body = paymentEvent(`e2e-cf-missing-${RUN_ID}`);
    const ts = String(Math.floor(Date.now() / 1000));

    const noSignature = await send(body, { 'x-webhook-timestamp': ts });
    const noTimestamp = await send(body, { 'x-webhook-signature': sign(ts, body) });

    expect(noSignature.status).toBe(400);
    expect(noTimestamp.status).toBe(400);
  });

  test('an event type we do not act on is acknowledged, not acted on', async () => {
    const orderId = `e2e-cf-refund-${RUN_ID}-${Date.now()}`;
    // Refunds are C12. Until then they must be stored and acknowledged rather
    // than run through Razorpay's paise-based refund path.
    const body = JSON.stringify({
      type: 'REFUND_STATUS_WEBHOOK',
      data: { order: { order_id: orderId }, refund: { refund_amount: 1450 } },
    });
    const ts = String(Math.floor(Date.now() / 1000));

    const { status, text } = await send(body, {
      'x-webhook-signature': sign(ts, body),
      'x-webhook-timestamp': ts,
    });

    expect(status).toBe(200);
    const parsed = JSON.parse(text);
    expect(parsed.received).toBe(true);
    expect(parsed.handled).toBe(false);

    const stored = await db.webhookEvent.findFirst({
      where: { provider: 'CASHFREE', eventId: { contains: orderId } },
      select: { eventId: true },
    });
    expect(stored).not.toBeNull();
    madeEventIds.push(stored!.eventId);
  });
});
