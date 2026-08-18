import { test, expect } from '@playwright/test';
import * as crypto from 'crypto';
import { db } from '../fixtures/db';
import { apiClient, resolve } from '../fixtures/api';

/**
 * The catalogue feed Shiprocket pulls from us.
 *
 * This is a contract with someone else's system, so the assertions are about
 * their field names rather than ours. If a rename here looks harmless, it is
 * not — their sync breaks silently and the first symptom is a product missing
 * from a checkout nobody on our side is looking at.
 */
const KEY = process.env.SHIPROCKET_API_KEY || 'dev-local-key';
const SECRET = process.env.SHIPROCKET_API_SECRET || 'dev-local-secret';

function signed(body = '') {
  return {
    'X-Api-Key': KEY,
    'X-Api-HMAC-SHA256': crypto.createHmac('sha256', SECRET).update(body).digest('base64'),
  };
}

test.describe('Shiprocket catalogue feed @security', () => {
  test('refuses anyone without a valid key and digest', async () => {
    const api = await apiClient();

    // 511 rather than 401: it is the code their documentation tells clients
    // to expect, and a 500 would say the fault was ours.
    expect((await api.get(resolve('/shiprocket/products'))).status()).toBe(511);

    expect(
      (
        await api.get(resolve('/shiprocket/products'), {
          headers: { 'X-Api-Key': KEY, 'X-Api-HMAC-SHA256': 'not-the-right-digest' },
        })
      ).status(),
      'a valid key with a wrong digest was accepted',
    ).toBe(511);

    await api.dispose();
  });

  test('products come back in their shape, with everything their sync needs', async () => {
    const api = await apiClient();
    const res = await api.get(resolve('/shiprocket/products'), { headers: signed() });
    expect(res.status(), await res.text()).toBe(200);

    const body = await res.json();
    expect(body.data.total).toBeGreaterThan(0);

    const product = body.data.products[0];
    for (const field of ['id', 'title', 'handle', 'vendor', 'status', 'variants', 'options']) {
      expect(product[field], `product.${field} is missing`).toBeDefined();
    }

    // Long, not a UUID — the requirement that forced the externalId column.
    expect(typeof product.id).toBe('number');
    expect(product.status).toBe('active');

    const variant = product.variants[0];
    for (const field of ['id', 'title', 'price', 'sku', 'quantity', 'grams', 'weight_unit']) {
      expect(variant[field], `variant.${field} is missing`).toBeDefined();
    }
    expect(typeof variant.id).toBe('number');

    // Stock reaches them here and nowhere else.
    const live = await db.productVariant.findFirstOrThrow({
      where: { externalId: BigInt(variant.id) },
    });
    expect(variant.quantity).toBe(live.stockQuantity);
    expect(variant.price).toBe(String(live.sellingPrice));

    // A relative path resolves against *their* domain and 404s, so a picture
    // that is set at all must be absolute.
    if (product.image.src) {
      expect(product.image.src, 'image url is not absolute').toMatch(/^https?:\/\//);
    }

    await api.dispose();
  });

  test('only live products are published', async () => {
    const api = await apiClient();
    const body = await (
      await api.get(resolve('/shiprocket/products'), { headers: signed() })
    ).json();
    await api.dispose();

    const published = body.data.products.map((p: { id: number }) => BigInt(p.id));
    if (published.length === 0) return;

    const rows = await db.product.findMany({ where: { externalId: { in: published } } });
    // A draft or archived product in their checkout would let someone buy
    // something we do not sell.
    expect(rows.every((r) => r.status === 'LIVE')).toBe(true);
  });

  test('collections carry numeric ids and only ones with something to sell', async () => {
    const api = await apiClient();
    const body = await (
      await api.get(resolve('/shiprocket/collections'), { headers: signed() })
    ).json();

    for (const c of body.data.collections) {
      expect(typeof c.id).toBe('number');
      expect(c.handle).toBeTruthy();

      const count = await db.product.count({
        where: { status: 'LIVE', category: { externalId: BigInt(c.id) } },
      });
      expect(count, `collection ${c.title} is empty`).toBeGreaterThan(0);
    }

    await api.dispose();
  });
});
