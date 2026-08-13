import { request, type APIRequestContext } from '@playwright/test';
import { API } from '../../playwright.config';
import { db, uniqueEmail, type Tracked } from './db';

export const TEST_PASSWORD = 'E2ePass#2026';

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
  email: string;
  password: string;
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
  const email = uniqueEmail('customer');
  const api = await apiClient();

  const res = await api.post(resolve('/auth/email/register'), {
    data: { email, password: TEST_PASSWORD, name },
  });

  if (!res.ok()) {
    throw new Error(`Could not register ${email}: ${res.status()} ${await res.text()}`);
  }

  const body = await res.json();
  const user = await db.user.findUnique({ where: { email } });
  if (!user) throw new Error(`Registered ${email} but no row appeared`);

  t.userIds.push(user.id);
  await api.dispose();

  return { id: user.id, email, password: TEST_PASSWORD, token: body.accessToken };
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
