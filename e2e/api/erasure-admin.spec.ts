import { test, expect } from '@playwright/test';
import { cleanup, db, tracked, RUN_ID, type Tracked } from '../fixtures/db';
import {
  addAddress,
  adminToken,
  apiClient,
  createCustomer,
  createStaff,
  findSellableVariant,
  placePaidOrder,
  resolve,
  TEST_PASSWORD,
} from '../fixtures/api';

/**
 * Erasing a customer from the console.
 *
 * The customer can already close their own account. This is the same erasure
 * driven by a super admin, for the request that arrives by phone or email
 * rather than through the form — which, in practice, is most of them.
 *
 * The two paths share one implementation on purpose. Two erasures written
 * separately drift, and the way you discover the drift is a regulator asking
 * why a name is still in the database.
 */
test.describe('Admin erasure @security', () => {
  let t: Tracked;

  test.beforeEach(() => {
    t = tracked();
  });

  test.afterEach(async () => {
    await db.supportTicket.deleteMany({ where: { subject: { contains: RUN_ID } } });
    await cleanup(t);
  });

  test('a super admin erases the person and keeps the invoice', async () => {
    test.setTimeout(240_000);

    const customer = await createCustomer(t);
    const variant = await findSellableVariant();
    const addressId = await addAddress(customer.token);
    const { orderId } = await placePaidOrder(
      customer,
      [{ variantId: variant.id, quantity: 1 }],
      { addressId },
    );
    t.orderIds.push(orderId);

    // A support thread, which is the part the original erasure missed: it was
    // written before support existed, so a closed account left the customer's
    // own words behind under their name.
    const asCustomer = await apiClient(customer.token);
    await asCustomer.post(resolve('/support'), {
      data: { subject: `Erase me ${RUN_ID}`, body: 'A question I would rather not leave behind.' },
    });
    await asCustomer.dispose();

    const before = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    const totalBefore = before.totalAmount;

    const asStaff = await apiClient(await adminToken());
    const res = await asStaff.delete(resolve(`/users/customers/${customer.id}`), {
      data: { reason: 'Asked us to delete their data over the phone' },
    });
    expect(res.status(), await res.text()).toBeLessThan(300);

    // The person is gone.
    const erased = await db.user.findUniqueOrThrow({ where: { id: customer.id } });
    expect(erased.email).toBeNull();
    expect(erased.phone).toBeNull();
    expect(erased.passwordHash).toBeNull();
    expect(erased.name).toBe('Closed account');
    expect(erased.deletedAt).toBeTruthy();
    expect(erased.isActive).toBe(false);

    expect(await db.address.count({ where: { userId: customer.id } })).toBe(0);
    expect(await db.cartItem.count({ where: { userId: customer.id } })).toBe(0);
    expect(await db.productReview.count({ where: { userId: customer.id } })).toBe(0);
    expect(
      await db.supportTicket.count({ where: { userId: customer.id } }),
      'their support thread outlived the erasure',
    ).toBe(0);

    // The invoice is not. Tax law needs the figure, so the order survives with
    // the street and the phone stripped out of its address snapshot.
    const after = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(after.totalAmount).toEqual(totalBefore);
    const address = after.shippingAddress as Record<string, unknown>;
    expect(String(address.line1)).toContain('erased');
    expect(address.phone).toBe('');
    // The tax treatment depends on where it went, so that much stays.
    expect(address.state).toBeTruthy();

    await asStaff.dispose();
  });

  test('the erased customer can no longer sign in', async () => {
    test.setTimeout(180_000);

    const customer = await createCustomer(t);
    const email = customer.email;

    const asStaff = await apiClient(await adminToken());
    expect((await asStaff.delete(resolve(`/users/customers/${customer.id}`))).ok()).toBeTruthy();
    await asStaff.dispose();

    // Erasure that leaves a working login is not erasure.
    const anon = await apiClient();
    const signIn = await anon.post(resolve('/auth/email/login'), {
      data: { email, password: TEST_PASSWORD },
    });
    expect(signIn.status()).toBeGreaterThanOrEqual(400);

    // And the token they were already holding stops working.
    const stale = await apiClient(customer.token);
    expect((await stale.get(resolve('/auth/me'))).status()).toBeGreaterThanOrEqual(400);

    await anon.dispose();
    await stale.dispose();
  });

  test('only a super admin may do it', async () => {
    test.setTimeout(180_000);

    const victim = await createCustomer(t, 'Victim');
    const otherCustomer = await createCustomer(t, 'Nosy');
    const manager = await createStaff(t, 'ORDER_MANAGER');
    const driver = await createStaff(t, 'DELIVERY_DRIVER');

    for (const [who, token, expected] of [
      ['an anonymous caller', undefined, 401],
      ['another customer', otherCustomer.token, 403],
      // An order manager handles orders and support. Erasing people is not
      // part of that job.
      ['an order manager', manager.token, 403],
      ['a delivery driver', driver.token, 403],
    ] as const) {
      const api = await apiClient(token);
      expect(
        (await api.delete(resolve(`/users/customers/${victim.id}`))).status(),
        `${who} erased a customer`,
      ).toBe(expected);
      await api.dispose();
    }

    // Still there after all that.
    const survivor = await db.user.findUniqueOrThrow({ where: { id: victim.id } });
    expect(survivor.deletedAt).toBeNull();
  });

  test('staff accounts are not erased through the customer route', async () => {
    test.setTimeout(180_000);

    const manager = await createStaff(t, 'ORDER_MANAGER');

    const asStaff = await apiClient(await adminToken());
    // Otherwise this becomes a way to remove a colleague — including the last
    // administrator — from a route meant for customers.
    const res = await asStaff.delete(resolve(`/users/customers/${manager.id}`));
    expect(res.status()).toBeGreaterThanOrEqual(400);

    expect((await db.user.findUniqueOrThrow({ where: { id: manager.id } })).deletedAt).toBeNull();
    await asStaff.dispose();
  });

  test('erasing twice is refused rather than repeated', async () => {
    test.setTimeout(180_000);

    const customer = await createCustomer(t);
    const asStaff = await apiClient(await adminToken());

    expect((await asStaff.delete(resolve(`/users/customers/${customer.id}`))).ok()).toBeTruthy();

    const again = await asStaff.delete(resolve(`/users/customers/${customer.id}`));
    expect(again.status()).toBeGreaterThanOrEqual(400);

    await asStaff.dispose();
  });

  test('the erasure is written to the audit log', async () => {
    test.setTimeout(180_000);

    const customer = await createCustomer(t);
    const asStaff = await apiClient(await adminToken());
    await asStaff.delete(resolve(`/users/customers/${customer.id}`), {
      data: { reason: `Phoned in ${RUN_ID}` },
    });
    await asStaff.dispose();

    // Erasure is irreversible and done by one person on another's behalf, so
    // who did it and why has to survive the record it destroyed.
    const entry = await db.auditLog.findFirst({
      where: { entity: 'User', entityId: customer.id, action: 'DELETE' },
      orderBy: { createdAt: 'desc' },
    });
    expect(entry, 'no audit entry for the erasure').toBeTruthy();
    expect(entry!.userId, 'the audit entry does not name who did it').toBeTruthy();
  });
});
