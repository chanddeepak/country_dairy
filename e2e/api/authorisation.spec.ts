import { test, expect } from '@playwright/test';
import { cleanup, tracked, type Tracked } from '../fixtures/db';
import { adminToken, apiClient, createCustomer, resolve } from '../fixtures/api';

/**
 * QA plan §19 R7 — the authorisation matrix.
 *
 * For every protected route: anonymous is 401, the wrong role is 403, the
 * right role works. Two of these were open to the public until recently —
 * media delete took a URL and removed it with no guard at all, and media
 * URLs are public on the storefront.
 */
const MATRIX = [
  { method: 'GET', path: '/orders/admin/all', needs: 'staff' },
  { method: 'GET', path: '/catalog/admin/products', needs: 'staff' },
  { method: 'GET', path: '/lab-reports/admin', needs: 'staff' },
  { method: 'GET', path: '/delivery/routes', needs: 'staff' },
  { method: 'GET', path: '/users/staff', needs: 'staff' },
  { method: 'GET', path: '/audit', needs: 'staff' },
  { method: 'GET', path: '/analytics/dashboard', needs: 'staff' },
  { method: 'GET', path: '/media/orphans', needs: 'staff' },
  { method: 'POST', path: '/media/orphans/sweep', needs: 'staff', body: {} },
  { method: 'POST', path: '/media/delete', needs: 'staff', body: { url: '/products/x.webp' } },
] as const;

test.describe('Authorisation matrix', () => {
  let t: Tracked;

  test.beforeEach(() => {
    t = tracked();
  });

  test.afterEach(async () => {
    await cleanup(t);
  });

  test('anonymous callers get 401 on every staff route @security', async () => {
    const api = await apiClient();

    for (const route of MATRIX) {
      const res =
        route.method === 'GET'
          ? await api.get(resolve(route.path))
          : await api.post(resolve(route.path), { data: (route as any).body ?? {} });

      expect(
        res.status(),
        `${route.method} ${route.path} let an anonymous caller through`,
      ).toBe(401);
    }

    await api.dispose();
  });

  test('a customer token gets 403 on staff routes @security', async () => {
    const customer = await createCustomer(t);
    const api = await apiClient(customer.token);

    for (const route of MATRIX) {
      const res =
        route.method === 'GET'
          ? await api.get(resolve(route.path))
          : await api.post(resolve(route.path), { data: (route as any).body ?? {} });

      expect(
        res.status(),
        `${route.method} ${route.path} let a customer through`,
      ).toBe(403);
    }

    await api.dispose();
  });

  test('an admin token is accepted @security', async () => {
    const api = await apiClient(await adminToken());

    for (const route of MATRIX.filter((r) => r.method === 'GET')) {
      const res = await api.get(resolve(route.path));
      expect(res.status(), `${route.path} refused an admin`).toBeLessThan(400);
    }

    await api.dispose();
  });

  test('a forged signature is rejected @security', async () => {
    const customer = await createCustomer(t);
    const tampered = `${customer.token.slice(0, -6)}abcdef`;

    const api = await apiClient(tampered);
    const res = await api.get(resolve('/auth/me'));
    expect(res.status()).toBe(401);
    await api.dispose();
  });

  test("one customer cannot read another's order @security", async () => {
    const alice = await createCustomer(t, 'Alice');
    const bob = await createCustomer(t, 'Bob');

    const { db } = await import('../fixtures/db');
    const order = await db.order.create({
      data: {
        orderNumber: `E2E-PRIV-${Date.now()}`,
        userId: alice.id,
        shippingAddress: { line1: 'x', city: 'Tanakpur', state: 'Uttarakhand', postalCode: '262309' },
        subtotal: 100,
        taxAmount: 0,
        totalAmount: 100,
        status: 'PENDING',
        paymentStatus: 'PENDING',
        deliveryType: 'LOCAL',
      },
    });
    t.orderIds.push(order.id);

    const api = await apiClient(bob.token);
    // 404 rather than 403, so ids cannot be probed for existence.
    expect((await api.get(resolve(`/orders/${order.id}`))).status()).toBe(404);
    expect((await api.get(resolve(`/orders/${order.id}/invoice`))).status()).toBe(404);
    expect((await api.post(resolve(`/orders/${order.id}/reorder`))).status()).toBe(404);
    await api.dispose();
  });
});
