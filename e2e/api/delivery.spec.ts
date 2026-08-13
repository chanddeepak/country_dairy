import { test, expect } from '@playwright/test';
import { cleanup, db, tracked, type Tracked } from '../fixtures/db';
import {
  TEST_PASSWORD,
  addAddress,
  adminToken,
  apiClient,
  createCustomer,
  createStaff,
  findSellableVariant,
  placePaidOrder,
  resolve,
} from '../fixtures/api';

/**
 * QA plan §13 — route sheets, assignment and the driver's round.
 *
 * Two of these guard against taking money that has already been taken. A stop
 * that shows the order total regardless of whether it was paid online is how a
 * prepaid customer gets charged again at the door, and there is no clean way to
 * undo that afterwards.
 */

/** An order sitting on today's sheet: local, open, and either paid or not. */
async function localOrder(
  t: Tracked,
  opts: { paid: boolean; name?: string },
): Promise<{ orderId: string; customerId: string; total: number }> {
  const customer = await createCustomer(t, opts.name ?? 'Delivery Customer');
  const variant = await findSellableVariant();
  const addressId = await addAddress(customer.token);

  const { orderId } = await placePaidOrder(
    customer,
    [{ variantId: variant.id, quantity: 1 }],
    { addressId, pay: opts.paid },
  );
  t.orderIds.push(orderId);

  // Confirmed, so it is open for delivery rather than still awaiting payment.
  const order = await db.order.update({
    where: { id: orderId },
    data: { status: 'CONFIRMED', deliveryType: 'LOCAL' },
  });

  return { orderId, customerId: customer.id, total: Number(order.totalAmount) };
}

async function stopsFor(orderId: string) {
  const api = await apiClient(await adminToken());
  const res = await api.get(resolve('/delivery/routes'));
  expect(res.ok()).toBeTruthy();
  const sheet = await res.json();
  await api.dispose();

  const all = sheet.routes.flatMap((r: { stops: unknown[] }) => r.stops);
  return { sheet, stop: all.find((s: { orderId: string }) => s.orderId === orderId) };
}

test.describe('Route sheets @money', () => {
  let t: Tracked;

  test.beforeEach(() => {
    t = tracked();
  });

  test.afterEach(async () => {
    await cleanup(t);
  });

  test('L2 · a prepaid stop asks the driver to collect nothing', async () => {
    test.setTimeout(180_000);

    const paid = await localOrder(t, { paid: true, name: 'Prepaid' });
    const unpaid = await localOrder(t, { paid: false, name: 'Cash' });

    const { stop: paidStop } = await stopsFor(paid.orderId);
    const { stop: cashStop } = await stopsFor(unpaid.orderId);

    expect(paidStop, 'the paid order is missing from the sheet').toBeTruthy();
    expect(cashStop, 'the unpaid order is missing from the sheet').toBeTruthy();

    // Charging a customer who has already paid is the failure this prevents.
    expect(paidStop.amountToCollect).toBe(0);
    expect(paidStop.isCashOnDelivery).toBe(false);

    expect(cashStop.amountToCollect).toBeCloseTo(unpaid.total, 1);
    expect(cashStop.isCashOnDelivery).toBe(true);
  });

  test('L1 · courier orders stay off the local sheet', async () => {
    const local = await localOrder(t, { paid: false });

    await db.order.update({
      where: { id: local.orderId },
      data: { deliveryType: 'COURIER' },
    });

    const { stop } = await stopsFor(local.orderId);
    expect(stop, 'a courier order appeared on the local round').toBeFalsy();
  });

  test('L1 · an address with no pincode still gets a stop', async () => {
    const order = await localOrder(t, { paid: false });

    const current = (await db.order.findUniqueOrThrow({ where: { id: order.orderId } }))
      .shippingAddress as Record<string, unknown>;
    await db.order.update({
      where: { id: order.orderId },
      data: { shippingAddress: { ...current, postalCode: '' } },
    });

    // Silently dropping it would mean a delivery nobody is told about.
    const { stop } = await stopsFor(order.orderId);
    expect(stop, 'an order without a pincode vanished from the sheet').toBeTruthy();
  });
});

test.describe('Assignment @security', () => {
  let t: Tracked;

  test.beforeEach(() => {
    t = tracked();
  });

  test.afterEach(async () => {
    await cleanup(t);
  });

  test('L4/L5 · a route is assigned and handed back', async () => {
    test.setTimeout(120_000);

    const order = await localOrder(t, { paid: false });
    const driver = await createStaff(t, 'DELIVERY_DRIVER', 'Round Driver');

    const api = await apiClient(await adminToken());

    const assigned = await api.post(resolve('/delivery/routes/assign'), {
      data: { orderIds: [order.orderId], driverId: driver.id },
    });
    expect(assigned.ok()).toBeTruthy();
    expect((await db.order.findUniqueOrThrow({ where: { id: order.orderId } })).driverId).toBe(
      driver.id,
    );

    // Null hands the route back to the pool, which is what happens when a
    // driver calls in sick.
    const cleared = await api.post(resolve('/delivery/routes/assign'), {
      data: { orderIds: [order.orderId], driverId: null },
    });
    expect(cleared.ok()).toBeTruthy();
    expect((await db.order.findUniqueOrThrow({ where: { id: order.orderId } })).driverId).toBeNull();

    await api.dispose();
  });

  test('L6 · only an active delivery driver can be assigned', async () => {
    const order = await localOrder(t, { paid: false });
    const notADriver = await createStaff(t, 'CATALOG_MANAGER', 'Not A Driver');
    const customer = await createCustomer(t, 'Definitely Not A Driver');

    const api = await apiClient(await adminToken());

    for (const [who, id] of [
      ['a catalogue manager', notADriver.id],
      ['a customer', customer.id],
      ['nobody at all', '00000000-0000-0000-0000-000000000000'],
    ] as const) {
      const res = await api.post(resolve('/delivery/routes/assign'), {
        data: { orderIds: [order.orderId], driverId: id },
      });
      expect(res.status(), `${who} was accepted as a driver`).toBe(400);
    }

    // A deactivated driver is no more assignable than a non-driver.
    const retired = await createStaff(t, 'DELIVERY_DRIVER', 'Retired Driver');
    await db.user.update({ where: { id: retired.id }, data: { isActive: false } });

    const res = await api.post(resolve('/delivery/routes/assign'), {
      data: { orderIds: [order.orderId], driverId: retired.id },
    });
    expect(res.status(), 'a deactivated driver was accepted').toBe(400);

    await api.dispose();

    expect((await db.order.findUniqueOrThrow({ where: { id: order.orderId } })).driverId).toBeNull();
  });
});

test.describe("The driver's round @security", () => {
  let t: Tracked;

  test.beforeEach(() => {
    t = tracked();
  });

  test.afterEach(async () => {
    await cleanup(t);
  });

  test('L7/L8 · a driver sees and touches only their own stops', async () => {
    test.setTimeout(180_000);

    const mine = await localOrder(t, { paid: false, name: 'Mine' });
    const theirs = await localOrder(t, { paid: false, name: 'Theirs' });

    const driver = await createStaff(t, 'DELIVERY_DRIVER', 'Driver One');
    const other = await createStaff(t, 'DELIVERY_DRIVER', 'Driver Two');

    const admin = await apiClient(await adminToken());
    await admin.post(resolve('/delivery/routes/assign'), {
      data: { orderIds: [mine.orderId], driverId: driver.id },
    });
    await admin.post(resolve('/delivery/routes/assign'), {
      data: { orderIds: [theirs.orderId], driverId: other.id },
    });
    await admin.dispose();

    const api = await apiClient(driver.token);
    const round = await (await api.get(resolve('/delivery/my-deliveries'))).json();

    const ids = round.map((s: { orderId: string }) => s.orderId);
    expect(ids).toContain(mine.orderId);
    expect(ids, "another driver's stop is on this round").not.toContain(theirs.orderId);

    // And knowing the id is not enough to complete it.
    const poached = await api.patch(resolve(`/delivery/${theirs.orderId}/delivered`), {
      data: {},
    });
    expect(poached.status()).toBe(403);
    await api.dispose();

    expect((await db.order.findUniqueOrThrow({ where: { id: theirs.orderId } })).status).toBe(
      'CONFIRMED',
    );
  });

  test('L9/L10 · delivering settles a cash order, and only once', async () => {
    test.setTimeout(120_000);

    const order = await localOrder(t, { paid: false });
    const driver = await createStaff(t, 'DELIVERY_DRIVER', 'Settling Driver');

    const admin = await apiClient(await adminToken());
    await admin.post(resolve('/delivery/routes/assign'), {
      data: { orderIds: [order.orderId], driverId: driver.id },
    });
    await admin.dispose();

    const api = await apiClient(driver.token);
    const done = await api.patch(resolve(`/delivery/${order.orderId}/delivered`), {
      data: { note: 'Handed to the customer' },
    });
    expect(done.ok()).toBeTruthy();

    const delivered = await db.order.findUniqueOrThrow({ where: { id: order.orderId } });
    expect(delivered.status).toBe('DELIVERED');
    expect(delivered.deliveredAt).not.toBeNull();
    // Cash handed over at the door settles the order.
    expect(delivered.paymentStatus).toBe('PAID');

    // L10 — a second tap must not re-settle anything.
    const again = await api.patch(resolve(`/delivery/${order.orderId}/delivered`), { data: {} });
    expect(again.status()).toBe(400);
    expect((await again.text()).toLowerCase()).toMatch(/already/);
    await api.dispose();

    const history = await db.orderStatusHistory.findMany({
      where: { orderId: order.orderId, status: 'DELIVERED' },
    });
    expect(history, 'delivering twice wrote two history rows').toHaveLength(1);
  });

  test('L11 · a failed attempt stays on the round and is recorded', async () => {
    test.setTimeout(120_000);

    const order = await localOrder(t, { paid: false });
    const driver = await createStaff(t, 'DELIVERY_DRIVER', 'Unlucky Driver');

    const admin = await apiClient(await adminToken());
    await admin.post(resolve('/delivery/routes/assign'), {
      data: { orderIds: [order.orderId], driverId: driver.id },
    });
    await admin.dispose();

    const api = await apiClient(driver.token);
    const failed = await api.patch(resolve(`/delivery/${order.orderId}/failed`), {
      data: { reason: 'Nobody home, gate locked' },
    });
    expect(failed.ok()).toBeTruthy();

    // It must not vanish into a status nobody watches — tomorrow someone has
    // to try again.
    const after = await db.order.findUniqueOrThrow({ where: { id: order.orderId } });
    expect(after.status).toBe('CONFIRMED');
    expect(after.deliveredAt).toBeNull();

    const round = await (await api.get(resolve('/delivery/my-deliveries'))).json();
    expect(
      round.map((s: { orderId: string }) => s.orderId),
      'a failed stop dropped off the round',
    ).toContain(order.orderId);
    await api.dispose();

    const history = await db.orderStatusHistory.findMany({
      where: { orderId: order.orderId },
      orderBy: { createdAt: 'desc' },
    });
    expect(history[0].note).toMatch(/nobody home, gate locked/i);
    expect(history[0].actorId).toBe(driver.id);
  });

  test('L7 · a customer cannot open a driver round at all', async () => {
    const customer = await createCustomer(t);
    const api = await apiClient(customer.token);

    expect((await api.get(resolve('/delivery/my-deliveries'))).status()).toBe(403);
    expect((await api.get(resolve('/delivery/routes'))).status()).toBe(403);
    await api.dispose();
  });
});
