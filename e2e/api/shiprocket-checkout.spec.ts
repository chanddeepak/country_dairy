import { test, expect } from '@playwright/test';
import { db } from '../fixtures/db';
import { apiClient, resolve } from '../fixtures/api';

/**
 * Opening Shiprocket's checkout from our storefront.
 *
 * Nothing here reaches Shiprocket — we have no staging credentials yet, and a
 * test that needed them would be a test nobody could run. What *is* testable is
 * everything on our side of the call: whether the flag holds the door shut,
 * whether a basket is checked before it is passed on, and whether an
 * unconfigured integration fails loudly rather than silently.
 *
 * That is the half most likely to be wrong, because it is the half we wrote.
 */
test.describe('Shiprocket checkout token @security', () => {
  const ROUTE = '/shiprocket/checkout/token';

  async function flagIsOn() {
    const row = await db.featureFlag.findUnique({
      where: { key: 'ENABLE_SHIPROCKET_CHECKOUT' },
    });
    return Boolean(row?.isEnabled);
  }

  test('the flag has a row, so the console can switch it', async () => {
    // It was declared in code from the start and never given a row, which meant
    // the switch did not exist in the console and the storefront read it as
    // false for ever. A feature you cannot turn on is not behind a flag.
    const row = await db.featureFlag.findUnique({
      where: { key: 'ENABLE_SHIPROCKET_CHECKOUT' },
    });
    expect(row, 'ENABLE_SHIPROCKET_CHECKOUT has no row to switch').toBeTruthy();
  });

  test('while the flag is off the route is not there at all', async () => {
    test.skip(await flagIsOn(), 'Shiprocket checkout is switched on');

    const api = await apiClient();
    const variant = await db.productVariant.findFirst({ select: { id: true } });
    test.skip(!variant, 'no variants to ask for');

    const res = await api.post(resolve(ROUTE), {
      data: { items: [{ variantId: variant!.id, quantity: 1 }] },
    });

    // 404 rather than 403: an unreleased checkout should not confirm its own
    // existence to somebody probing the API.
    expect(res.status(), 'a disabled checkout announced itself').toBe(404);

    await api.dispose();
  });

  test('a malformed basket is refused before anything is signed', async () => {
    const api = await apiClient();

    // Each of these must fail on our validation, never by being forwarded.
    // The route 404s while the flag is off, so both codes are acceptable —
    // what must never happen is a 2xx.
    const rubbish = [
      {},
      { items: [] },
      { items: [{ variantId: '00000000-0000-4000-8000-000000000000' }] },
      { items: [{ variantId: '00000000-0000-4000-8000-000000000000', quantity: 0 }] },
      { items: [{ variantId: '00000000-0000-4000-8000-000000000000', quantity: -4 }] },
      // Not a uuid at all: our id shape is the first thing checked.
      { items: [{ variantId: 'nope', quantity: 1 }] },
      { items: [{ variantId: '00000000-0000-4000-8000-000000000000', quantity: 1, redirectUrl: 'https://evil.test' }] },
    ];

    for (const data of rubbish) {
      const res = await api.post(resolve(ROUTE), { data });
      expect(
        res.status(),
        `${JSON.stringify(data)} was not refused`,
      ).toBeGreaterThanOrEqual(400);
    }

    await api.dispose();
  });

  test('the caller cannot choose where customers are sent afterwards', async () => {
    const api = await apiClient();
    const variant = await db.productVariant.findFirst({ select: { id: true } });
    test.skip(!variant, 'no variants to ask for');

    // The redirect is signed with our API secret, so accepting one from the
    // browser would be an open redirect carrying our own signature. The DTO
    // does not allow the property, and the global pipe rejects unknown ones.
    const res = await api.post(resolve(ROUTE), {
      data: {
        items: [{ variantId: variant!.id, quantity: 1 }],
        redirectUrl: 'https://evil.test/collect',
      },
    });

    expect(res.status(), 'a caller-supplied redirect was accepted').toBeGreaterThanOrEqual(400);

    await api.dispose();
  });

  test('an item we do not sell never reaches Shiprocket', async () => {
    test.skip(!(await flagIsOn()), 'the route is closed while the flag is off');

    const api = await apiClient();

    // A well-formed id nothing owns. Their checkout prices from the catalogue
    // they synced, so a line we forward unchecked is one they will charge for.
    const res = await api.post(resolve(ROUTE), {
      data: { items: [{ variantId: '00000000-0000-4000-8000-000000000000', quantity: 1 }] },
    });

    expect(res.status(), 'an unknown variant was forwarded').toBe(400);

    await api.dispose();
  });
});
