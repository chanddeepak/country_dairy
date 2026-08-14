import { test, expect } from '@playwright/test';
import { cleanup, db, tracked, RUN_ID, type Tracked } from '../fixtures/db';
import { adminToken, apiClient, createCustomer, resolve } from '../fixtures/api';

/**
 * Hero banner text placement.
 *
 * The point of storing an anchor rather than coordinates is that the value is
 * meaningful on any screen. That only holds if nothing outside the editor's
 * scales can reach the database, so these cases are mostly about what the API
 * refuses to store.
 */
test.describe('Hero layout', () => {
  let t: Tracked;
  const madeBannerIds: string[] = [];

  test.beforeEach(() => {
    t = tracked();
  });

  test.afterEach(async () => {
    if (madeBannerIds.length) {
      await db.heroBanner.deleteMany({ where: { id: { in: madeBannerIds.splice(0) } } });
    }
    await cleanup(t);
  });

  async function createBanner(layout?: unknown) {
    const api = await apiClient(await adminToken());
    const res = await api.post(resolve('/cms/hero'), {
      data: {
        title: `E2E Banner ${RUN_ID}`,
        subtitle: 'Placed by an automated test',
        imageUrl: '/hero-banners/e2e.webp',
        deviceType: 'DESKTOP',
        ...(layout ? { layout } : {}),
      },
    });

    const status = res.status();
    const text = await res.text();
    await api.dispose();

    if (status < 300) {
      const body = JSON.parse(text);
      madeBannerIds.push(body.id);
      return { status, banner: body };
    }
    return { status, banner: null, text };
  }

  test('a banner saved without a layout keeps the original stack', async () => {
    const { status, banner } = await createBanner();
    expect(status).toBeLessThan(300);

    // Null, not a default written eagerly: every banner made before this
    // feature existed must keep rendering exactly as it did.
    expect(banner.layout).toBeNull();
  });

  test('a layout is stored as given when every value is in range', async () => {
    const { banner } = await createBanner({
      version: 1,
      anchor: 'bottom-right',
      offset: { x: 5, y: -3 },
      align: 'right',
      size: 'XL',
      font: 'body',
      color: 'gold',
      scrim: 'strong',
      maxWidth: 40,
    });

    expect(banner.layout).toMatchObject({
      anchor: 'bottom-right',
      align: 'right',
      size: 'XL',
      font: 'body',
      color: 'gold',
      scrim: 'strong',
      maxWidth: 40,
    });
    expect(banner.layout.offset).toEqual({ x: 5, y: -3 });
  });

  test('values outside the scales are replaced, not stored @security', async () => {
    const { status, banner } = await createBanner({
      anchor: 'somewhere-nice',
      align: 'justify',
      size: 'ENORMOUS',
      font: 'Comic Sans',
      color: '#ff00ff',
      scrim: 'rainbow',
      maxWidth: 900,
      offset: { x: 9999, y: -9999 },
    });

    // Accepted, but normalised. The storefront has a rule for every value in
    // the scales and none for anything else, so an unknown anchor would render
    // nothing at all.
    expect(status).toBeLessThan(300);
    expect(banner.layout.anchor).toBe('middle-left');
    expect(banner.layout.align).toBe('left');
    expect(banner.layout.size).toBe('L');
    expect(banner.layout.font).toBe('display');
    expect(banner.layout.color).toBe('auto');
    expect(banner.layout.scrim).toBe('gradient');

    // Width and nudge are clamped rather than defaulted, so a near-miss keeps
    // the intent.
    expect(banner.layout.maxWidth).toBeLessThanOrEqual(100);
    expect(Math.abs(banner.layout.offset.x)).toBeLessThanOrEqual(15);
    expect(Math.abs(banner.layout.offset.y)).toBeLessThanOrEqual(15);
  });

  test('editing a banner can change only its layout', async () => {
    const { banner } = await createBanner();

    const api = await apiClient(await adminToken());
    const res = await api.put(resolve(`/cms/hero/${banner.id}`), {
      data: {
        title: banner.title,
        layout: { version: 1, anchor: 'top-center', align: 'center', size: 'S' },
      },
    });
    expect(res.ok()).toBeTruthy();
    await api.dispose();

    const saved = await db.heroBanner.findUniqueOrThrow({ where: { id: banner.id } });
    const layout = saved.layout as Record<string, unknown>;
    expect(layout.anchor).toBe('top-center');
    expect(layout.align).toBe('center');
    expect(layout.size).toBe('S');
    // Untouched fields keep their defaults rather than going missing.
    expect(layout.scrim).toBe('gradient');
    expect(saved.title).toBe(banner.title);
  });

  test('a customer cannot place hero text @security', async () => {
    const customer = await createCustomer(t);
    const api = await apiClient(customer.token);

    const res = await api.post(resolve('/cms/hero'), {
      data: { title: 'Not yours', layout: { anchor: 'top-left' } },
    });
    expect(res.status()).toBe(403);
    await api.dispose();
  });
});
