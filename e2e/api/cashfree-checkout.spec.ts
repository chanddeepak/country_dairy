import { test, expect } from '@playwright/test';
import { cleanup, db, tracked, type Tracked } from '../fixtures/db';
import {
  addAddress,
  apiClient,
  createCustomer,
  findSellableVariant,
  resolve,
} from '../fixtures/api';

/**
 * Which gateway checkout hands the customer to.
 *
 * The flag is the switch and the credentials are the veto, so there are two
 * ways to end up on Razorpay and only one to end up on Cashfree. These assert
 * the branch actually taken rather than the one intended — the site has never
 * had a working payment path in the browser, so "it looked right" is not
 * evidence of anything here.
 */
test.describe('Cashfree checkout', () => {
  let t: Tracked;

  test.beforeEach(() => {
    t = tracked();
  });

  test.afterEach(async () => {
    await cleanup(t);
  });

  async function flagIsOn(): Promise<boolean> {
    const row = await db.featureFlag.findUnique({
      where: { key: 'ENABLE_CASHFREE_CHECKOUT' },
    });
    return Boolean(row?.isEnabled);
  }

  /** Runs a real checkout and returns the response body. */
  async function checkout(): Promise<Record<string, unknown>> {
    const customer = await createCustomer(t);
    const variant = await findSellableVariant();
    const addressId = await addAddress(customer.token);

    const api = await apiClient(customer.token);
    const added = await api.post(resolve('/cart/add'), {
      data: { variantId: variant.id, quantity: 1 },
    });
    expect(added.ok(), await added.text()).toBeTruthy();

    const res = await api.post(resolve('/orders/checkout'), {
      data: { addressId, deliveryType: 'LOCAL' },
    });
    const text = await res.text();
    expect(res.ok(), text).toBeTruthy();
    await api.dispose();

    const body = JSON.parse(text);
    t.orderIds.push(body.orderId);
    return body;
  }

  test('the flag has a row, so the console can switch it', async () => {
    // ENABLE_SHIPROCKET_CHECKOUT spent months declared in code with no row, so
    // the console had no switch and the storefront read it as false for ever.
    // A feature nobody can turn on is not behind a flag.
    const row = await db.featureFlag.findUnique({
      where: { key: 'ENABLE_CASHFREE_CHECKOUT' },
    });
    expect(row, 'ENABLE_CASHFREE_CHECKOUT has no row to switch').toBeTruthy();
  });

  test('with the flag on, checkout returns a Cashfree session', async () => {
    test.skip(!(await flagIsOn()), 'Cashfree checkout is switched off');

    const body = await checkout();

    expect(body.provider).toBe('CASHFREE');
    // Without this the browser SDK has nothing to open, and the order is
    // created but unpayable — stock decremented against something nobody can
    // pay for.
    expect(typeof body.paymentSessionId).toBe('string');
    expect((body.paymentSessionId as string).length).toBeGreaterThan(10);

    const payment = await db.payment.findFirst({
      where: { orderId: body.orderId as string },
      select: { provider: true, gatewayOrderId: true, status: true },
    });
    expect(payment?.provider).toBe('CASHFREE');
    expect(payment?.status).toBe('PENDING');
    /*
     * Their id starts with our order number so it is recognisable, and carries
     * a uuid suffix so it can never repeat. Order numbers can: they are
     * max(orderNumber) + 1 over surviving rows, so deleting one frees it for
     * reuse, and Cashfree answers a reused id with 409 order_already_exists.
     */
    expect(payment?.gatewayOrderId).toMatch(
      new RegExp(`^${body.orderNumber}-[0-9a-f]{6}$`),
    );
  });

  test('with the flag off, checkout still goes to Razorpay', async () => {
    test.skip(await flagIsOn(), 'Cashfree checkout is switched on');

    const body = await checkout();

    // The rollback path. Turning the flag off has to be a return to the
    // previous behaviour, not an outage.
    expect(body.provider).toBe('RAZORPAY');
    expect(body.paymentSessionId).toBeUndefined();

    const payment = await db.payment.findFirst({
      where: { orderId: body.orderId as string },
      select: { provider: true },
    });
    expect(payment?.provider).toBe('RAZORPAY');
  });

  test('the amount charged is the amount the order says @money', async () => {
    const body = await checkout();

    const order = await db.order.findUniqueOrThrow({
      where: { id: body.orderId as string },
      select: { totalAmount: true },
    });
    const payment = await db.payment.findFirstOrThrow({
      where: { orderId: body.orderId as string },
      select: { amount: true },
    });

    // Cashfree reports rupees and Razorpay reports paise. A stray divide or
    // multiply by a hundred between them is the whole reason this assertion
    // exists, and it holds whichever provider ran.
    expect(Number(payment.amount)).toBe(Number(order.totalAmount));
    expect(Number(body.amount)).toBe(Number(order.totalAmount));
  });
});
