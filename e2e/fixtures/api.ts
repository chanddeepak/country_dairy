import { request, type APIRequestContext } from '@playwright/test';
import { API } from '../../playwright.config';
import { db, uniqueEmail, uniquePhone, type Tracked } from './db';

export const TEST_PASSWORD = 'E2ePass#2026';

/**
 * The fixed sign-in code the API issues when OTP_DEV_CODE is set.
 *
 * Customers are created by phone now, and a real code is bcrypt-hashed and
 * unreadable from here — so the suite needs the API running with a known one.
 */
export const DEV_OTP = process.env.E2E_DEV_OTP || '123456';

export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@countrydairy.in';
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'ChangeMe#2026';

/**
 * A bare API client, for setup and for assertions the UI cannot make.
 *
 * The trailing slash matters. Playwright resolves a request path against
 * baseURL with URL semantics, so a path beginning "/" replaces the base's
 * path entirely — `http://host/api` + `/auth/x` becomes `http://host/auth/x`
 * and every call 404s. With the slash, and relative paths, the prefix
 * survives. `resolve()` below keeps callers from having to remember.
 */
export async function apiClient(token?: string): Promise<APIRequestContext> {
  return request.newContext({
    baseURL: API.endsWith('/') ? API : `${API}/`,
    extraHTTPHeaders: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

/** Strips the leading slash so the /api prefix on baseURL is not discarded. */
export function resolve(path: string): string {
  return path.replace(/^\/+/, '');
}

export interface TestUser {
  id: string;
  /** Empty for a customer: an OTP account has no email until one is given. */
  email: string;
  /** Empty for a customer: an OTP account has no password. */
  password: string;
  phone?: string;
  token: string;
}

/**
 * Registers a throwaway customer.
 *
 * Never reuses an existing account: a spec that writes to whichever customer
 * happens to be first in the database puts test orders in a real person's
 * order history, which is exactly how four of them ended up on the storefront.
 */
export async function createCustomer(t: Tracked, name = 'E2E Customer'): Promise<TestUser> {
  const phone = uniquePhone();
  const bcrypt = await import('bcryptjs');

  /*
   * By phone, because that is how a customer account comes into existence now.
   * Email sign-up is switched off, so registering that way would test a door
   * that is locked — the fixture should build accounts the way the product
   * does, or every spec is exercising a path nobody takes.
   *
   * The code is written straight into the table rather than requested through
   * /auth/send-otp, for the same reason createStaff writes its user directly:
   * that endpoint spends real money on every call and is rate limited to ten
   * per IP per hour. A suite that creates a customer per test would exhaust it
   * within one run — it did, which is how this was found — and raising the
   * limit to suit the tests would be weakening a control to avoid an
   * inconvenience.
   *
   * verify-otp is still the real route, so what is under test stays under test.
   */
  const code = '123456';
  await db.otpVerification.create({
    data: {
      phone,
      codeHash: await bcrypt.hash(code, 10),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });

  const api = await apiClient();
  const res = await api.post(resolve('/auth/verify-otp'), { data: { phone, otp: code } });

  if (!res.ok()) {
    throw new Error(
      `Could not sign in ${phone}: ${res.status()} ${await res.text()}\n` +
        'Customers are created by phone OTP now, so ENABLE_OTP_LOGIN must be on.',
    );
  }

  const body = await res.json();
  const user = await db.user.findUnique({ where: { phone } });
  if (!user) throw new Error(`Signed in ${phone} but no row appeared`);

  // OTP sign-up carries no name; specs that show one need it set.
  await db.user.update({ where: { id: user.id }, data: { name } });

  t.userIds.push(user.id);
  await api.dispose();

  return {
    id: user.id,
    phone,
    // Empty on purpose: an OTP account has neither until the customer gives one.
    email: user.email ?? '',
    password: '',
    token: body.accessToken,
  };
}

/** A staff account of any role, created directly so no console click is needed. */
export async function createStaff(
  t: Tracked,
  role: 'SUPER_ADMIN' | 'CATALOG_MANAGER' | 'ORDER_MANAGER' | 'DELIVERY_DRIVER',
  name = 'E2E Staff',
): Promise<TestUser> {
  const email = uniqueEmail(role.toLowerCase());
  const bcrypt = await import('bcryptjs');

  const user = await db.user.create({
    data: {
      email,
      name,
      role,
      isActive: true,
      passwordHash: await bcrypt.hash(TEST_PASSWORD, 12),
      identities: { create: { provider: 'EMAIL', providerId: email, verifiedAt: new Date() } },
    },
  });

  t.userIds.push(user.id);

  const api = await apiClient();
  const res = await api.post(resolve('/auth/admin/login'), {
    data: { email, password: TEST_PASSWORD },
  });
  const body = await res.json();
  await api.dispose();

  return { id: user.id, email, password: TEST_PASSWORD, token: body.accessToken };
}

export async function adminToken(): Promise<string> {
  const api = await apiClient();
  const res = await api.post(resolve('/auth/admin/login'), {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });

  if (!res.ok()) {
    throw new Error(
      `Admin sign-in failed (${res.status()}). Seed one with:\n` +
        `  SEED_ADMIN_PASSWORD='${ADMIN_PASSWORD}' npm run db:seed`,
    );
  }

  const body = await res.json();
  await api.dispose();
  return body.accessToken;
}

/** A delivery address, needed before checkout will accept anything. */
export async function addAddress(
  token: string,
  overrides: Partial<{ line1: string; city: string; state: string; postalCode: string }> = {},
): Promise<string> {
  const api = await apiClient(token);

  // Tagged so the new row can be picked out of the response by identity
  // rather than by position. The list comes back ordered by isDefault then
  // createdAt, so the address just added is only last while it is the only
  // one — taking `[length - 1]` silently returns an older address as soon as
  // there are two, which makes two fixtures the same row.
  const label = `E2E-${Math.random().toString(36).slice(2, 9)}`;

  const res = await api.post(resolve('/auth/address'), {
    data: {
      label,
      line1: 'Bilona House, Mall Road',
      city: 'Tanakpur',
      state: 'Uttarakhand',
      postalCode: '262309',
      phone: '9876543210',
      isDefault: true,
      ...overrides,
    },
  });

  if (!res.ok()) throw new Error(`Could not add an address: ${res.status()} ${await res.text()}`);
  const body = await res.json();
  await api.dispose();

  const added = body.addresses.find((a: { label?: string }) => a.label === label);
  if (!added) throw new Error(`Added address ${label} but it is not in the returned list`);
  return added.id;
}

/**
 * Buys something, end to end, through the real endpoints.
 *
 * Razorpay runs in mock mode without credentials, and mock mode both issues
 * `order_mock_*` gateway ids and bypasses signature checking — so the payment
 * really does travel through `verify-payment` rather than being faked by a
 * direct write to `paymentStatus`. That matters: settling the pending Payment
 * row, decrementing stock and clearing the cart all live in that path, and a
 * DB shortcut would test none of them.
 */
export async function placePaidOrder(
  customer: TestUser,
  lines: { variantId: string; quantity: number }[],
  opts: { addressId?: string; pay?: boolean } = {},
): Promise<{ orderId: string; orderNumber: string; amount: number }> {
  const api = await apiClient(customer.token);

  for (const line of lines) {
    const res = await api.post(resolve('/cart/add'), { data: line });
    if (!res.ok()) throw new Error(`Could not add to cart: ${res.status()} ${await res.text()}`);
  }

  const addressId = opts.addressId ?? (await addAddress(customer.token));
  const checkout = await api.post(resolve('/orders/checkout'), {
    data: { addressId, deliveryType: 'LOCAL' },
  });

  if (!checkout.ok()) {
    throw new Error(`Checkout failed: ${checkout.status()} ${await checkout.text()}`);
  }

  const { orderId, orderNumber, amount } = await checkout.json();

  if (opts.pay !== false) {
    const paid = await api.post(resolve('/orders/verify-payment'), {
      data: { orderId, razorpayPaymentId: `pay_e2e_${Date.now()}`, signature: 'mock' },
    });
    if (!paid.ok()) {
      throw new Error(`Payment failed: ${paid.status()} ${await paid.text()}`);
    }
  }

  await api.dispose();
  return { orderId, orderNumber, amount };
}

/** The first live, in-stock variant — what most storefront specs shop for. */
export async function findSellableVariant() {
  const variant = await db.productVariant.findFirst({
    where: {
      isActive: true,
      stockQuantity: { gt: 10 },
      product: { status: 'LIVE', forceOutOfStock: false },
    },
    include: { product: true },
    orderBy: { sellingPrice: 'asc' },
  });

  if (!variant) {
    throw new Error(
      'No live, stocked variant to test against. Run `npm run db:seed` first.',
    );
  }

  return variant;
}
