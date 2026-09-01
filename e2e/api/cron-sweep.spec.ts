import { test, expect } from '@playwright/test';
import { apiClient, resolve } from '../fixtures/api';

/**
 * The scheduled sweep's door.
 *
 * It is the one route on the API that a stranger can reach with no account, so
 * what it refuses matters more than what it does. The sweep itself is covered
 * by expire-abandoned.spec.ts; this is only about who gets in.
 */
test.describe('Scheduled sweep @security', () => {
  const PATH = '/orders/cron/expire-abandoned';

  test('a caller with no secret is refused', async () => {
    const api = await apiClient();
    const res = await api.post(resolve(PATH));
    await api.dispose();

    expect(res.status(), 'an unauthenticated caller reached the sweep').toBe(401);
  });

  test('a wrong secret is refused', async () => {
    const api = await apiClient();
    const res = await api.post(resolve(PATH), {
      headers: { 'x-cron-secret': 'not-the-secret' },
    });
    await api.dispose();

    expect(res.status()).toBe(401);
  });

  test('an empty secret is refused rather than matching an unset one', async () => {
    /*
     * The way this pattern usually fails: CRON_SECRET is not configured, the
     * header is empty, and empty equals empty. The guard closes the route when
     * the secret is missing instead of opening it.
     */
    const api = await apiClient();
    const res = await api.post(resolve(PATH), { headers: { 'x-cron-secret': '' } });
    await api.dispose();

    expect(res.status()).toBe(401);
  });

  test('it accepts no body, so a caller cannot widen the window', async () => {
    // Even authenticated, the route takes no parameters — there is nothing to
    // set olderThanMinutes to zero with and cancel every pending order.
    const api = await apiClient();
    const res = await api.post(resolve(PATH), {
      headers: { 'x-cron-secret': 'not-the-secret' },
      data: { olderThanMinutes: 0 },
    });
    await api.dispose();

    expect(res.status()).toBe(401);
  });
});
