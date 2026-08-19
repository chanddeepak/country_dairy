import { test, expect } from '@playwright/test';
import { apiClient, resolve } from '../fixtures/api';

/**
 * PIN code lookup.
 *
 * The point of proxying this rather than calling the postal API from the
 * browser is that it can fail without taking checkout down with it. These
 * cover the shapes the page has to cope with — found, not found, and
 * nonsense — because the address form treats all three as "carry on typing".
 */
test.describe('PIN codes', () => {
  test('a real PIN code resolves to a district and state', async () => {
    const api = await apiClient();
    // Dehradun. Chosen because it is where the dairy actually is.
    const res = await api.get(resolve('/geo/pincode/248001'));

    expect(res.ok(), await res.text()).toBeTruthy();
    const body = await res.json();

    expect(body.state).toBe('Uttarakhand');
    expect(body.district).toBeTruthy();
    expect(Array.isArray(body.localities)).toBe(true);
    expect(body.localities.length).toBeGreaterThan(0);

    await api.dispose();
  });

  test('the second lookup is served from memory', async () => {
    const api = await apiClient();

    // The cache only holds successes — a failed lookup is deliberately not
    // stored, because a timeout describes the network this minute rather than
    // the PIN code. So this test needs the first call to have actually worked;
    // without that check it measures India Post's uptime instead of our cache,
    // which is how it failed once with nothing wrong on our side.
    const warm = await api.get(resolve('/geo/pincode/110001'));
    test.skip(!warm.ok(), 'the postal API is unreachable, so nothing was cached to test');

    const started = Date.now();
    const again = await api.get(resolve('/geo/pincode/110001'));
    const elapsed = Date.now() - started;

    expect(again.ok()).toBeTruthy();
    // Generous — this asserts "did not go to the postal API", not a latency
    // budget. A round trip to Delhi and back cannot beat this.
    expect(elapsed, 'the lookup was not cached').toBeLessThan(300);

    await api.dispose();
  });

  test('an unknown or malformed code is a plain 404', async () => {
    const api = await apiClient();

    for (const bad of ['999999', 'abcdef', '000000', '12']) {
      const res = await api.get(resolve(`/geo/pincode/${bad}`));
      expect(res.status(), `${bad} should not resolve`).toBe(404);
    }

    await api.dispose();
  });

  test('no account is needed to look one up', async () => {
    // Someone filling in a delivery address has not necessarily signed in,
    // and a PIN code is a public postal directory rather than personal data.
    const anon = await apiClient();
    expect((await anon.get(resolve('/geo/pincode/248001'))).status()).toBe(200);
    await anon.dispose();
  });
});
