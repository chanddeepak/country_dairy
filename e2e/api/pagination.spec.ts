import { test, expect } from '@playwright/test';
import { cleanup, db, tracked, type Tracked } from '../fixtures/db';
import { adminToken, apiClient, createCustomer, resolve } from '../fixtures/api';

/**
 * The admin lists page rather than truncate.
 *
 * Each of these used to take a fixed slice — 200 orders, 200 customers, 100
 * audit entries — and return a bare array. Nothing in the response said a
 * slice had been taken, so a console showing 200 orders looked identical
 * whether there were 200 or 2,000. The difference was invisible exactly when
 * it mattered.
 */
const LISTS = [
  { name: 'orders', path: '/orders/admin/all', noun: 'orders' },
  { name: 'customers', path: '/users/customers', noun: 'customers' },
  { name: 'audit', path: '/audit', noun: 'audit entries' },
] as const;

test.describe('Admin list pagination', () => {
  let t: Tracked;

  test.beforeEach(() => {
    t = tracked();
  });

  test.afterEach(async () => {
    await cleanup(t);
  });

  test('every list returns a page, not a bare array', async () => {
    const api = await apiClient(await adminToken());

    for (const list of LISTS) {
      const res = await api.get(resolve(list.path));
      expect(res.ok(), `${list.name} did not answer`).toBeTruthy();

      const body = await res.json();
      expect(Array.isArray(body), `${list.name} still returns a bare array`).toBe(false);
      expect(Array.isArray(body.items), `${list.name} has no items`).toBe(true);

      // total is the count matching the filter, not the length of this page.
      // Without it a client cannot tell a last page from a truncated one.
      expect(typeof body.total).toBe('number');
      expect(typeof body.totalPages).toBe('number');
      expect(typeof body.hasMore).toBe('boolean');
      expect(body.page).toBe(1);
      expect(body.items.length).toBeLessThanOrEqual(body.pageSize);
    }

    await api.dispose();
  });

  test('pageSize is honoured and page 2 is different rows', async () => {
    const api = await apiClient(await adminToken());

    for (const list of LISTS) {
      const first = await (await api.get(resolve(`${list.path}?page=1&pageSize=2`))).json();

      if (first.total < 3) {
        // Nothing to page through; the shape was already checked above.
        continue;
      }

      expect(first.items.length, `${list.name} ignored pageSize`).toBe(2);
      expect(first.hasMore).toBe(true);

      const second = await (await api.get(resolve(`${list.path}?page=2&pageSize=2`))).json();
      expect(second.page).toBe(2);
      expect(second.total).toBe(first.total);

      const firstIds = first.items.map((i: { id: string }) => i.id);
      const secondIds = second.items.map((i: { id: string }) => i.id);

      // Overlapping pages mean skip is wrong, and a client walking the pages
      // would show the same row twice while never showing another.
      expect(
        secondIds.some((id: string) => firstIds.includes(id)),
        `${list.name} repeated a row across pages`,
      ).toBe(false);
    }

    await api.dispose();
  });

  test('the last page reports no more, and past the end is empty rather than an error', async () => {
    const api = await apiClient(await adminToken());

    for (const list of LISTS) {
      const head = await (await api.get(resolve(`${list.path}?page=1&pageSize=5`))).json();
      if (head.total === 0) continue;

      const last = await (
        await api.get(resolve(`${list.path}?page=${head.totalPages}&pageSize=5`))
      ).json();
      expect(last.hasMore, `${list.name} claims more after the last page`).toBe(false);
      expect(last.items.length).toBeGreaterThan(0);

      // A client that asks for a page beyond the end — because rows were
      // deleted underneath it — should get an empty page, not a 500.
      const beyond = await api.get(resolve(`${list.path}?page=9999&pageSize=5`));
      expect(beyond.ok(), `${list.name} errored past the last page`).toBeTruthy();
      const beyondBody = await beyond.json();
      expect(beyondBody.items).toHaveLength(0);
      expect(beyondBody.total).toBe(head.total);
    }

    await api.dispose();
  });

  test('nonsense paging is clamped, not obeyed and not fatal', async () => {
    const api = await apiClient(await adminToken());

    for (const list of LISTS) {
      for (const query of [
        'page=0&pageSize=10',
        'page=-3&pageSize=10',
        'page=abc&pageSize=xyz',
        'page=1&pageSize=0',
        'page=1&pageSize=-5',
        'page=1&pageSize=99999',
      ]) {
        const res = await api.get(resolve(`${list.path}?${query}`));
        expect(res.ok(), `${list.name} broke on ?${query}`).toBeTruthy();

        const body = await res.json();
        expect(body.page, `${list.name} allowed page below 1 on ?${query}`).toBeGreaterThanOrEqual(1);
        expect(body.pageSize).toBeGreaterThanOrEqual(1);
        // Capped so one request cannot ask the database for everything.
        expect(body.pageSize, `${list.name} allowed an unbounded page on ?${query}`)
          .toBeLessThanOrEqual(200);
      }
    }

    await api.dispose();
  });

  test('paging respects the filter it is paging through', async () => {
    const api = await apiClient(await adminToken());

    const all = await (await api.get(resolve('/orders/admin/all?pageSize=5'))).json();
    const delivered = await (
      await api.get(resolve('/orders/admin/all?status=DELIVERED&pageSize=5'))
    ).json();

    // A total that ignores the filter is how "showing 5 of 2,000" appears
    // above five filtered rows.
    expect(delivered.total).toBeLessThanOrEqual(all.total);
    for (const order of delivered.items) {
      expect(order.status).toBe('DELIVERED');
    }

    const search = await (
      await api.get(resolve('/users/customers?search=zzz-no-such-customer-zzz'))
    ).json();
    expect(search.total).toBe(0);
    expect(search.items).toHaveLength(0);
    expect(search.hasMore).toBe(false);
    expect(search.totalPages).toBe(1);

    await api.dispose();
  });

  test('the lists stay closed to customers @security', async () => {
    const customer = await createCustomer(t);
    const api = await apiClient(customer.token);

    for (const list of LISTS) {
      expect((await api.get(resolve(list.path))).status(), `${list.name} was open`).toBe(403);
    }

    await api.dispose();
  });
});
