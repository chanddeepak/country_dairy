import { test, expect } from '@playwright/test';
import { cleanup, db, tracked, type Tracked } from '../fixtures/db';
import { apiClient, findSellableVariant, resolve } from '../fixtures/api';

/**
 * Checkout without an account.
 *
 * The order exists before anyone has said who they are — Cashfree collects and
 * verifies the phone during payment, and only then can it be attached to an
 * account. So these assert two things at once: that a stranger can buy, and
 * that being a stranger grants nothing else.
 */
test.describe('Guest checkout', () => {
  let t: Tracked;

  test.beforeEach(() => {
    t = tracked();
  });

  test.afterEach(async () => {
    await cleanup(t);
  });

  async function cashfreeOn(): Promise<boolean> {
    const row = await db.featureFlag.findUnique({ where: { key: 'ENABLE_CASHFREE_CHECKOUT' } });
    return Boolean(row?.isEnabled);
  }

  /** Buys one of something, with no token at all. */
  async function guestCheckout(quantity = 1) {
    const variant = await findSellableVariant();
    const api = await apiClient();
    const res = await api.post(resolve('/orders/checkout'), {
      data: { items: [{ variantId: variant.id, quantity }] },
    });
    const text = await res.text();
    await api.dispose();
    return { res, text, variant };
  }

  test('a stranger can place an order', async () => {
    test.skip(!(await cashfreeOn()), 'Guest checkout needs Cashfree');

    const { res, text } = await guestCheckout();
    expect(res.ok(), text).toBeTruthy();

    const body = JSON.parse(text);
    t.orderIds.push(body.orderId);

    expect(body.provider).toBe('CASHFREE');
    expect(typeof body.paymentSessionId).toBe('string');

    const order = await db.order.findUniqueOrThrow({
      where: { id: body.orderId },
      select: { userId: true, claimTokenHash: true, claimTokenExpiresAt: true },
    });

    // Nobody owns it yet. Ownership checks read `where: { id, userId }`, so an
    // unclaimed order matches no one — which is the point.
    expect(order.userId).toBeNull();
    expect(order.claimTokenHash).toBeTruthy();
    expect(order.claimTokenExpiresAt!.getTime()).toBeGreaterThan(Date.now());
  });

  test('the claim token comes back to the browser that placed the order', async () => {
    test.skip(!(await cashfreeOn()), 'Guest checkout needs Cashfree');

    const { res, text } = await guestCheckout();
    expect(res.ok(), text).toBeTruthy();
    const body = JSON.parse(text);
    t.orderIds.push(body.orderId);

    /*
     * It also rides in Cashfree's return_url, but the modal never navigates
     * there, so the response is the copy that actually gets used.
     */
    expect(typeof body.claimToken).toBe('string');
    expect((body.claimToken as string).length).toBeGreaterThan(20);

    // Stored hashed. A token that grants a login must not sit in the database
    // in a form that could be replayed straight out of a leak.
    const order = await db.order.findUniqueOrThrow({
      where: { id: body.orderId },
      select: { claimTokenHash: true },
    });
    expect(order.claimTokenHash).not.toBe(body.claimToken);
    expect(order.claimTokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  test('an invalid token is refused rather than treated as a guest @security', async () => {
    const variant = await findSellableVariant();
    const api = await apiClient('definitely-not-a-jwt');
    const res = await api.post(resolve('/orders/checkout'), {
      data: { items: [{ variantId: variant.id, quantity: 1 }] },
    });
    await api.dispose();

    /*
     * The dangerous alternative is silently downgrading a bad token to a guest:
     * a customer whose session had expired would place an order attached to
     * nobody, and to them it would simply never appear.
     */
    expect(res.status()).toBe(401);
  });

  test('a guest cannot name its own price @security @money', async () => {
    const variant = await findSellableVariant();
    const api = await apiClient();
    const res = await api.post(resolve('/orders/checkout'), {
      data: { items: [{ variantId: variant.id, quantity: 1, sellingPrice: 1, unitPrice: 1 }] },
    });
    const text = await res.text();
    await api.dispose();

    // Rejected outright rather than ignored, which is the stronger outcome:
    // there is no path where a price from the client is silently dropped and
    // the order looks fine.
    expect(res.status()).toBe(400);
    expect(text).toContain('should not exist');
  });

  test('a basket of things we do not sell is refused', async () => {
    const api = await apiClient();
    const res = await api.post(resolve('/orders/checkout'), {
      data: { items: [{ variantId: '00000000-0000-0000-0000-000000000000', quantity: 1 }] },
    });
    await api.dispose();
    expect(res.status()).toBe(400);
  });

  test('an order id alone confirms nothing @security', async () => {
    test.skip(!(await cashfreeOn()), 'Guest checkout needs Cashfree');

    const { res, text } = await guestCheckout();
    expect(res.ok(), text).toBeTruthy();
    const body = JSON.parse(text);
    t.orderIds.push(body.orderId);

    const api = await apiClient();

    /*
     * The attack this whole design exists to stop. orderNumber is max + 1, so
     * ids are guessable; if confirm accepted one on its own, guessing would
     * settle a stranger's order and hand back a session as them.
     */
    const noProof = await api.post(resolve('/orders/confirm'), {
      data: { orderId: body.orderId },
    });
    expect(noProof.status()).toBe(404);

    const wrongToken = await api.post(resolve('/orders/confirm'), {
      data: { orderId: body.orderId, claimToken: 'a'.repeat(43) },
    });
    // 404 rather than 403 — a 403 would confirm the id was a good guess.
    expect(wrongToken.status()).toBe(404);

    await api.dispose();
  });

  test('the right token on an unpaid order still grants no session @security', async () => {
    test.skip(!(await cashfreeOn()), 'Guest checkout needs Cashfree');

    const { res, text } = await guestCheckout();
    expect(res.ok(), text).toBeTruthy();
    const body = JSON.parse(text);
    t.orderIds.push(body.orderId);

    const api = await apiClient();
    const confirmed = await api.post(resolve('/orders/confirm'), {
      data: { orderId: body.orderId, claimToken: body.claimToken },
    });
    const payload = await confirmed.json();
    await api.dispose();

    expect(confirmed.ok()).toBeTruthy();
    /*
     * The token proves which browser placed the order; it is the *payment* that
     * earns an account. So a leaked token before payment is worth nothing — it
     * cannot mint a session, and the order stays unowned.
     */
    expect(payload.order.paymentStatus).toBe('PENDING');
    expect(payload.session).toBeNull();

    const order = await db.order.findUniqueOrThrow({
      where: { id: body.orderId },
      select: { userId: true, claimTokenHash: true },
    });
    expect(order.userId).toBeNull();
    // Not consumed either — the customer may still be paying.
    expect(order.claimTokenHash).toBeTruthy();
  });

  test('an empty basket is refused', async () => {
    const api = await apiClient();
    const res = await api.post(resolve('/orders/checkout'), { data: { items: [] } });
    await api.dispose();
    expect(res.status()).toBe(400);
  });
});
