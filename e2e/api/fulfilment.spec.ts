import { test, expect } from '@playwright/test';
import { cleanup, db, tracked, type Tracked } from '../fixtures/db';
import {
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
 * QA plan §12/§13 — which queue an order is in.
 *
 * Nothing at checkout can know whether an address is inside the van's area, so
 * every storefront order arrives LOCAL and the desk decides. The two queues
 * read the same field from opposite sides — route sheets take LOCAL, the
 * consignment desk takes everything else — so this one switch is what puts an
 * order in front of the right person.
 */
async function anOrder(t: Tracked, opts: { name?: string } = {}) {
  const customer = await createCustomer(t, opts.name ?? 'Fulfilment Customer');
  const variant = await findSellableVariant();
  const addressId = await addAddress(customer.token);

  const { orderId } = await placePaidOrder(
    customer,
    [{ variantId: variant.id, quantity: 1 }],
    { addressId },
  );
  t.orderIds.push(orderId);

  await db.order.update({ where: { id: orderId }, data: { status: 'CONFIRMED' } });
  return orderId;
}

test.describe('Choosing how an order ships @security', () => {
  let t: Tracked;

  test.beforeEach(() => {
    t = tracked();
  });

  test.afterEach(async () => {
    await cleanup(t);
  });

  test('an order starts local and can be moved to courier', async () => {
    test.setTimeout(180_000);

    const orderId = await anOrder(t);

    // Every storefront order arrives on the local round, because that is the
    // schema default and checkout sends nothing else.
    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).deliveryType).toBe(
      'LOCAL',
    );

    const api = await apiClient(await adminToken());
    const res = await api.patch(resolve(`/orders/admin/${orderId}/delivery-type`), {
      data: { deliveryType: 'COURIER' },
    });
    expect(res.ok()).toBeTruthy();

    const moved = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(moved.deliveryType).toBe('COURIER');

    // And back again, while no waybill exists.
    const back = await api.patch(resolve(`/orders/admin/${orderId}/delivery-type`), {
      data: { deliveryType: 'LOCAL' },
    });
    expect(back.ok()).toBeTruthy();
    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).deliveryType).toBe(
      'LOCAL',
    );

    await api.dispose();
  });

  test('moving to courier takes the order off its driver', async () => {
    test.setTimeout(180_000);

    const orderId = await anOrder(t);
    const driver = await createStaff(t, 'DELIVERY_DRIVER', 'Round Driver');

    const api = await apiClient(await adminToken());
    await api.post(resolve('/delivery/routes/assign'), {
      data: { orderIds: [orderId], driverId: driver.id },
    });
    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).driverId).toBe(driver.id);

    await api.patch(resolve(`/orders/admin/${orderId}/delivery-type`), {
      data: { deliveryType: 'COURIER' },
    });

    // Left set, the order would stay on that driver's list after it had gone
    // out with a courier.
    const after = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(after.driverId, 'a courier order is still assigned to a driver').toBeNull();

    const round = await (await apiClient(driver.token)).get(resolve('/delivery/my-deliveries'));
    const stops = await round.json();
    expect(stops.map((s: { orderId: string }) => s.orderId)).not.toContain(orderId);

    await api.dispose();
  });

  test('an order already on a waybill cannot be pulled back to the van @money', async () => {
    test.setTimeout(180_000);

    const orderId = await anOrder(t);
    const api = await apiClient(await adminToken());

    await api.patch(resolve(`/orders/admin/${orderId}/delivery-type`), {
      data: { deliveryType: 'COURIER' },
    });

    // Statuses advance one step at a time — CONFIRMED goes to PROCESSING
    // before SHIPPED — so the waybill only lands if the walk is done properly.
    // Skipping a step made this case pass for the wrong reason: no tracking
    // number was ever set, so the guard below was never reached.
    const toProcessing = await api.patch(resolve(`/orders/admin/${orderId}/status`), {
      data: { status: 'PROCESSING' },
    });
    expect(toProcessing.ok(), await toProcessing.text()).toBeTruthy();

    // The consignment desk records the waybill the carrier issued.
    const shipped = await api.patch(resolve(`/orders/admin/${orderId}/status`), {
      data: {
        status: 'SHIPPED',
        trackingNumber: 'E2E1234567890',
        shippingCarrier: 'Delhivery',
      },
    });
    expect(shipped.ok(), await shipped.text()).toBeTruthy();
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: orderId } })).trackingNumber,
    ).toBe('E2E1234567890');

    const res = await api.patch(resolve(`/orders/admin/${orderId}/delivery-type`), {
      data: { deliveryType: 'LOCAL' },
    });

    // The parcel is physically with the carrier. Dropping the waybill would
    // strand a real consignment nobody is tracking any more.
    expect(res.status()).toBe(400);
    const text = (await res.text()).toLowerCase();
    expect(text).toContain('e2e1234567890');
    expect(text).toMatch(/cancel the consignment/);

    const still = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(still.deliveryType).toBe('COURIER');
    expect(still.trackingNumber).toBe('E2E1234567890');

    await api.dispose();
  });

  test('a delivered order cannot change how it shipped', async () => {
    test.setTimeout(180_000);

    const orderId = await anOrder(t);
    await db.order.update({
      where: { id: orderId },
      data: { status: 'DELIVERED', deliveredAt: new Date() },
    });

    const api = await apiClient(await adminToken());
    const res = await api.patch(resolve(`/orders/admin/${orderId}/delivery-type`), {
      data: { deliveryType: 'COURIER' },
    });

    // The question is settled; changing it would only make the record
    // disagree with what happened.
    expect(res.status()).toBe(400);
    expect((await res.text()).toLowerCase()).toMatch(/delivered/);
    await api.dispose();
  });

  test('setting the type it already has is refused rather than silently ignored', async () => {
    test.setTimeout(180_000);

    const orderId = await anOrder(t);
    const api = await apiClient(await adminToken());

    const res = await api.patch(resolve(`/orders/admin/${orderId}/delivery-type`), {
      data: { deliveryType: 'LOCAL' },
    });
    expect(res.status()).toBe(400);
    expect((await res.text()).toLowerCase()).toMatch(/already/);
    await api.dispose();
  });

  test('nonsense and unauthorised callers are turned away', async () => {
    test.setTimeout(180_000);

    const orderId = await anOrder(t);
    const customer = await createCustomer(t, 'Nosy');

    const admin = await apiClient(await adminToken());
    const bad = await admin.patch(resolve(`/orders/admin/${orderId}/delivery-type`), {
      data: { deliveryType: 'DRONE' },
    });
    expect(bad.status()).toBe(400);
    expect((await bad.text()).toLowerCase()).toMatch(/local delivery or courier/);
    await admin.dispose();

    const anon = await apiClient();
    expect(
      (await anon.patch(resolve(`/orders/admin/${orderId}/delivery-type`), {
        data: { deliveryType: 'COURIER' },
      })).status(),
    ).toBe(401);
    await anon.dispose();

    const asCustomer = await apiClient(customer.token);
    expect(
      (await asCustomer.patch(resolve(`/orders/admin/${orderId}/delivery-type`), {
        data: { deliveryType: 'COURIER' },
      })).status(),
    ).toBe(403);
    await asCustomer.dispose();

    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).deliveryType).toBe(
      'LOCAL',
    );
  });

  test('the two queues never hold the same order', async () => {
    test.setTimeout(180_000);

    const orderId = await anOrder(t);
    const api = await apiClient(await adminToken());

    const onRoundSheet = async () => {
      const sheet = await (await api.get(resolve('/delivery/routes'))).json();
      return sheet.routes
        .flatMap((r: { stops: { orderId: string }[] }) => r.stops)
        .some((s: { orderId: string }) => s.orderId === orderId);
    };

    expect(await onRoundSheet(), 'a local order is missing from the round').toBe(true);

    await api.patch(resolve(`/orders/admin/${orderId}/delivery-type`), {
      data: { deliveryType: 'COURIER' },
    });

    // The consignment desk reads deliveryType !== LOCAL, so leaving it on the
    // sheet would have the same parcel queued for a van and a courier at once.
    expect(await onRoundSheet(), 'a courier order is still on the local round').toBe(false);

    await api.dispose();
  });
});
