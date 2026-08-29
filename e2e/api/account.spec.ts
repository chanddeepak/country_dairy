import { test, expect } from '@playwright/test';
import { cleanup, db, tracked, uniqueEmail, type Tracked } from '../fixtures/db';
import {
  TEST_PASSWORD,
  addAddress,
  apiClient,
  createCustomer,
  createStaff,
  findSellableVariant,
  placePaidOrder,
  resolve,
} from '../fixtures/api';

/**
 * QA plan §7 — addresses, profile, preferences and erasure.
 *
 * The erasure cases are the reason this file exists. Closing an account is
 * destructive, irreversible and legally load-bearing in both directions: the
 * DPDP Act requires the personal data to go, and the GST rules require the
 * invoice to stay. Getting either half wrong is a problem no amount of
 * customer support fixes afterwards.
 */
/**
 * Email sign-in is behind ENABLE_EMAIL_LOGIN and off by default: customers
 * arrive by phone OTP now and an OTP account has neither an email nor a
 * password. Cases that exercise those run only when the older door is
 * unlocked, rather than asserting something about a feature nobody switched on.
 */
async function emailLoginOn(): Promise<boolean> {
  const row = await db.featureFlag.findUnique({ where: { key: 'ENABLE_EMAIL_LOGIN' } });
  return Boolean(row?.isEnabled);
}

test.describe('Addresses @auth', () => {
  let t: Tracked;

  test.beforeEach(() => {
    t = tracked();
  });

  test.afterEach(async () => {
    await cleanup(t);
  });

  test('F4/F6 · the first address is default, and only ever one is', async () => {
    const customer = await createCustomer(t);

    const first = await addAddress(customer.token, { city: 'Tanakpur' });
    const rows = await db.address.findMany({ where: { userId: customer.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].isDefault).toBe(true);

    await addAddress(customer.token, { city: 'Haldwani', line1: 'Second Street' });

    const defaults = await db.address.count({
      where: { userId: customer.id, isDefault: true },
    });
    expect(defaults, 'two addresses both claim to be the default').toBe(1);

    // And the one that claims it is the one most recently asked for.
    const stillDefault = await db.address.findFirst({
      where: { userId: customer.id, isDefault: true },
    });
    expect(stillDefault!.id).not.toBe(first);
  });

  test('F5 · editing an address changes only that address', async () => {
    const customer = await createCustomer(t);
    const a = await addAddress(customer.token, { city: 'Tanakpur' });
    const b = await addAddress(customer.token, { city: 'Haldwani', line1: 'Second Street' });

    const api = await apiClient(customer.token);
    const res = await api.patch(resolve(`/auth/address/${a}`), {
      data: { city: 'Champawat' },
    });
    expect(res.ok()).toBeTruthy();
    await api.dispose();

    expect((await db.address.findUniqueOrThrow({ where: { id: a } })).city).toBe('Champawat');
    expect((await db.address.findUniqueOrThrow({ where: { id: b } })).city).toBe('Haldwani');
  });

  test('F7 · a deleted address does not disturb the orders that used it', async () => {
    const customer = await createCustomer(t);
    const variant = await findSellableVariant();
    const addressId = await addAddress(customer.token, { city: 'Tanakpur' });

    const { orderId } = await placePaidOrder(
      customer,
      [{ variantId: variant.id, quantity: 1 }],
      { addressId },
    );
    t.orderIds.push(orderId);

    const api = await apiClient(customer.token);
    expect((await api.delete(resolve(`/auth/address/${addressId}`))).ok()).toBeTruthy();
    await api.dispose();

    expect(await db.address.count({ where: { id: addressId } })).toBe(0);

    // The order kept its snapshot, which is the whole point of snapshotting.
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect((order.shippingAddress as Record<string, unknown>).city).toBe('Tanakpur');
  });

  test('F8 · one customer cannot touch another\'s address @security', async () => {
    const alice = await createCustomer(t, 'Alice');
    const bob = await createCustomer(t, 'Bob');
    const aliceAddress = await addAddress(alice.token);

    const api = await apiClient(bob.token);
    // 404 rather than 403, so ids cannot be probed for existence.
    expect((await api.patch(resolve(`/auth/address/${aliceAddress}`), {
      data: { city: 'Nowhere' },
    })).status()).toBe(404);
    expect((await api.delete(resolve(`/auth/address/${aliceAddress}`))).status()).toBe(404);
    await api.dispose();

    // And it is untouched.
    expect((await db.address.findUniqueOrThrow({ where: { id: aliceAddress } })).city).toBe(
      'Tanakpur',
    );
  });
});

test.describe('Profile and preferences @auth', () => {
  let t: Tracked;

  test.beforeEach(() => {
    t = tracked();
  });

  test.afterEach(async () => {
    await cleanup(t);
  });

  test('F9/F10 · the name saves; email and mobile are not editable', async () => {
    const customer = await createCustomer(t);
    const api = await apiClient(customer.token);

    const res = await api.patch(resolve('/auth/profile'), {
      data: { name: 'Renamed Customer' },
    });
    expect(res.ok()).toBeTruthy();

    const user = await db.user.findUniqueOrThrow({ where: { id: customer.id } });
    expect(user.name).toBe('Renamed Customer');

    // Email is a sign-in identity. Sending one must not change it — the
    // global validation pipe rejects unknown properties outright.
    const sneaky = await api.patch(resolve('/auth/profile'), {
      data: { email: 'someone-else@countrydairy.test' },
    });
    expect(sneaky.status()).toBe(400);

    // Compared against what is stored, not against the fixture's idea of it:
    // an account created by phone has no email at all, so this is null here
    // and the point is only that the PATCH did not write one.
    expect((await db.user.findUniqueOrThrow({ where: { id: customer.id } })).email).toBe(
      user.email,
    );

    await api.dispose();
  });

  test('F11 · the mobile number cannot be changed or cleared @security', async () => {
    /*
     * The number is the only way into the account now that email sign-in is
     * off, and this route asks for no proof that a new one belongs to the
     * person typing it. So every shape of a change is refused here.
     *
     * `null` is the case that matters and the one that was live: the guard
     * read `if (dto.phone)`, which null slips past, and the update then wrote
     * it — 200, phone erased, customer locked out for good with nothing
     * looking wrong. Regression cover for that, not a hypothetical.
     */
    const customer = await createCustomer(t);
    const before = (await db.user.findUniqueOrThrow({ where: { id: customer.id } })).phone;
    expect(before).toBeTruthy();

    const api = await apiClient(customer.token);

    for (const phone of ['9876500022', '', null]) {
      const res = await api.patch(resolve('/auth/profile'), { data: { phone } });
      expect(res.ok(), `phone ${JSON.stringify(phone)} was accepted`).toBeFalsy();

      expect(
        (await db.user.findUniqueOrThrow({ where: { id: customer.id } })).phone,
        `phone ${JSON.stringify(phone)} changed the stored number`,
      ).toBe(before);
    }

    await api.dispose();
  });

  test('F12/F13 · the password changes, and only with the current one', async () => {
    test.skip(!(await emailLoginOn()), 'Password sign-in is switched off');
    const customer = await createCustomer(t);
    const before = (await db.user.findUniqueOrThrow({ where: { id: customer.id } }))
      .passwordHash;

    const api = await apiClient(customer.token);

    const wrong = await api.post(resolve('/auth/change-password'), {
      data: { currentPassword: 'NotThePassword#1', newPassword: 'Replaced#2026' },
    });
    expect(wrong.status()).toBe(401);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: customer.id } })).passwordHash,
      'a wrong current password still changed the hash',
    ).toBe(before);

    const ok = await api.post(resolve('/auth/change-password'), {
      data: { currentPassword: TEST_PASSWORD, newPassword: 'Replaced#2026' },
    });
    expect(ok.ok()).toBeTruthy();
    await api.dispose();

    const after = (await db.user.findUniqueOrThrow({ where: { id: customer.id } }))
      .passwordHash;
    expect(after).not.toBe(before);
    expect(after, 'the password was stored in the clear').not.toBe('Replaced#2026');

    // And the new one is what signs in now.
    const fresh = await apiClient();
    const login = await fresh.post(resolve('/auth/email/login'), {
      data: { email: customer.email, password: 'Replaced#2026' },
    });
    expect(login.ok()).toBeTruthy();
    await fresh.dispose();
  });

  test('F14 · communication preferences persist per channel', async () => {
    const customer = await createCustomer(t);
    const api = await apiClient(customer.token);

    const res = await api.patch(resolve('/auth/profile'), {
      data: { emailOptIn: false, smsOptIn: true, whatsappOptIn: false },
    });
    expect(res.ok()).toBeTruthy();
    await api.dispose();

    const user = await db.user.findUniqueOrThrow({ where: { id: customer.id } });
    expect(user.emailOptIn).toBe(false);
    expect(user.smsOptIn).toBe(true);
    expect(user.whatsappOptIn).toBe(false);
  });
});

test.describe('Closing an account @security', () => {
  let t: Tracked;

  test.beforeEach(() => {
    t = tracked();
  });

  test.afterEach(async () => {
    await cleanup(t);
  });

  test('F15 · closure is guarded by the password', async () => {
    test.skip(!(await emailLoginOn()), 'Password sign-in is switched off');
    const customer = await createCustomer(t);
    const api = await apiClient(customer.token);

    const res = await api.post(resolve('/auth/close-account'), {
      data: { password: 'NotThePassword#1' },
    });
    expect(res.status()).toBe(401);

    const user = await db.user.findUniqueOrThrow({ where: { id: customer.id } });
    expect(user.deletedAt, 'a wrong password still closed the account').toBeNull();

    await api.dispose();
  });

  test('F15 · staff cannot close themselves out through the storefront route', async () => {
    const staff = await createStaff(t, 'CATALOG_MANAGER');
    const api = await apiClient(staff.token);

    const res = await api.post(resolve('/auth/close-account'), {
      data: { password: TEST_PASSWORD },
    });
    // Otherwise this route is a way to delete the last administrator.
    expect(res.status()).toBe(403);
    await api.dispose();

    expect((await db.user.findUniqueOrThrow({ where: { id: staff.id } })).deletedAt).toBeNull();
  });

  test('F16/F17/F18 · erasure removes the person and keeps the invoice', async () => {
    // F18 asserts a closed email can be registered again, which needs the
    // email door open to mean anything.
    test.skip(!(await emailLoginOn()), 'Email sign-up is switched off');
    test.setTimeout(180_000);

    const customer = await createCustomer(t);
    const variant = await findSellableVariant();
    const addressId = await addAddress(customer.token, { city: 'Tanakpur' });

    const { orderId } = await placePaidOrder(
      customer,
      [{ variantId: variant.id, quantity: 1 }],
      { addressId },
    );
    t.orderIds.push(orderId);

    const api = await apiClient(customer.token);

    // An invoice, so the retention side has something real to protect.
    const invoice = await api.get(resolve(`/orders/${orderId}/invoice`));
    expect(invoice.ok()).toBeTruthy();
    const { invoiceNumber } = await invoice.json();

    // Something in the cart, to prove it goes.
    await api.post(resolve('/cart/add'), { data: { variantId: variant.id, quantity: 1 } });

    const closed = await api.post(resolve('/auth/close-account'), {
      data: { password: TEST_PASSWORD, reason: 'e2e' },
    });
    expect(closed.ok()).toBeTruthy();

    // ---- erased ----
    const user = await db.user.findUniqueOrThrow({ where: { id: customer.id } });
    expect(user.name).toBe('Closed account');
    expect(user.email).toBeNull();
    expect(user.phone).toBeNull();
    expect(user.passwordHash).toBeNull();
    expect(user.isActive).toBe(false);
    expect(user.deletedAt).not.toBeNull();
    expect(user.emailOptIn).toBe(false);
    expect(user.smsOptIn).toBe(false);
    expect(user.whatsappOptIn).toBe(false);

    expect(await db.address.count({ where: { userId: customer.id } })).toBe(0);
    expect(await db.cartItem.count({ where: { userId: customer.id } })).toBe(0);
    expect(await db.productReview.count({ where: { userId: customer.id } })).toBe(0);
    expect(await db.authIdentity.count({ where: { userId: customer.id } })).toBe(0);

    // ---- kept, deliberately ----
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.invoiceNumber, 'the invoice number was erased with the person').toBe(
      invoiceNumber,
    );
    expect(Number(order.totalAmount)).toBeGreaterThan(0);

    const snapshot = order.shippingAddress as Record<string, unknown>;
    expect(snapshot.line1).toBe('[erased at customer request]');
    expect(snapshot.phone).toBe('');
    // Place of supply decides whether that invoice charged CGST+SGST or IGST,
    // so the state cannot be erased without making the tax unexplainable.
    expect(snapshot.city).toBe('Tanakpur');
    expect(snapshot.state).toBe('Uttarakhand');
    expect(snapshot.postalCode).toBe('262309');

    // F17 — the token dies with the account.
    expect((await api.get(resolve('/auth/me'))).status()).toBe(401);
    await api.dispose();

    // F18 — the address is free again, because it was nulled rather than
    // tombstoned. Someone who comes back can sign up with their own email.
    const fresh = await apiClient();
    const again = await fresh.post(resolve('/auth/email/register'), {
      data: { email: customer.email, password: TEST_PASSWORD, name: 'Returned' },
    });
    expect(again.ok(), 'the closed email could not be reused').toBeTruthy();
    await fresh.dispose();

    const reborn = await db.user.findUnique({ where: { email: customer.email } });
    expect(reborn).not.toBeNull();
    expect(reborn!.id).not.toBe(customer.id);
    t.userIds.push(reborn!.id);
  });

  test('F15 · an account cannot be closed twice', async () => {
    test.skip(!(await emailLoginOn()), 'Password sign-in is switched off');
    const customer = await createCustomer(t);
    const api = await apiClient(customer.token);

    expect((await api.post(resolve('/auth/close-account'), {
      data: { password: TEST_PASSWORD },
    })).ok()).toBeTruthy();

    // The token is dead, so the second attempt is refused as unauthenticated
    // rather than reaching the already-closed check.
    expect((await api.post(resolve('/auth/close-account'), {
      data: { password: TEST_PASSWORD },
    })).status()).toBe(401);

    await api.dispose();
  });
});
