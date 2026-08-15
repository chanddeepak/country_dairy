import { test, expect } from '@playwright/test';
import { cleanup, db, tracked, RUN_ID, type Tracked } from '../fixtures/db';
import { adminToken, apiClient, resolve } from '../fixtures/api';

/**
 * A size can be given its own card on the homepage shelf.
 *
 * Per variant rather than per product on purpose: milk has four sizes, and a
 * product-level switch would put all four on the shelf and bury everything
 * else. The shopkeeper picks the one or two worth featuring.
 */
test.describe('Featuring a size on the homepage @money', () => {
  let t: Tracked;

  test.beforeEach(() => {
    t = tracked();
  });

  test.afterEach(async () => {
    await cleanup(t);
  });

  async function makeProduct(variants: Record<string, unknown>[]) {
    const category = await db.category.findFirstOrThrow({ where: { isActive: true } });
    const api = await apiClient(await adminToken());
    const suffix = `${RUN_ID}-${Math.random().toString(36).slice(2, 7)}`;

    const res = await api.post(resolve('/catalog/products'), {
      data: {
        title: `E2E Shelf ${suffix}`,
        slug: `e2e-shelf-${suffix}`,
        status: 'LIVE',
        categoryId: category.id,
        variants,
      },
    });
    expect(res.ok(), await res.text()).toBeTruthy();

    const body = await res.json();
    t.productIds.push(body.id);
    await api.dispose();
    return body.id as string;
  }

  test('defaults to off, so an existing shelf is unchanged', async () => {
    const id = await makeProduct([
      { sizeLabel: '500 ml', sellingPrice: 100, mrpPrice: 120 },
    ]);

    const variants = await db.productVariant.findMany({ where: { productId: id } });
    // Nothing appears on the homepage until somebody asks for it.
    expect(variants.every((v) => v.showOnHome === false)).toBe(true);
  });

  test('the flag is stored per variant, not per product', async () => {
    const id = await makeProduct([
      { sizeLabel: '500 ml', sellingPrice: 780, mrpPrice: 850, showOnHome: true },
      { sizeLabel: '1 Litre', sellingPrice: 1450, mrpPrice: 1600, showOnHome: false },
      { sizeLabel: '2 Litre', sellingPrice: 2800, mrpPrice: 3000, showOnHome: true },
    ]);

    const variants = await db.productVariant.findMany({
      where: { productId: id },
      orderBy: { displayOrder: 'asc' },
    });

    expect(variants.map((v) => [v.sizeLabel, v.showOnHome])).toEqual([
      ['500 ml', true],
      ['1 Litre', false],
      ['2 Litre', true],
    ]);
  });

  test('the storefront is told which sizes are featured', async () => {
    const id = await makeProduct([
      { sizeLabel: '500 ml', sellingPrice: 780, mrpPrice: 850, showOnHome: true },
      { sizeLabel: '1 Litre', sellingPrice: 1450, mrpPrice: 1600 },
    ]);

    const api = await apiClient();
    const products = await (await api.get(resolve('/catalog/products?status=LIVE'))).json();
    await api.dispose();

    const mine = (Array.isArray(products) ? products : products.products).find(
      (p: { id: string }) => p.id === id,
    );
    expect(mine, 'the product is not on the public catalogue').toBeTruthy();

    // The flag has to survive to the public payload or the shelf cannot act
    // on it — the storefront reads this, not the database.
    const featured = mine.variants.filter((v: { showOnHome?: boolean }) => v.showOnHome);
    expect(featured).toHaveLength(1);
    expect(featured[0].sizeLabel).toBe('500 ml');
  });

  test('editing a product preserves the flag on untouched sizes', async () => {
    const id = await makeProduct([
      { sizeLabel: '500 ml', sellingPrice: 780, mrpPrice: 850, showOnHome: true },
    ]);

    const before = await db.productVariant.findFirstOrThrow({ where: { productId: id } });

    const api = await apiClient(await adminToken());
    const res = await api.put(resolve(`/catalog/products/${id}`), {
      data: {
        title: 'E2E Shelf, renamed',
        variants: [
          {
            id: before.id,
            sizeLabel: before.sizeLabel,
            sellingPrice: Number(before.sellingPrice),
            mrpPrice: Number(before.mrpPrice),
            showOnHome: true,
          },
        ],
      },
    });
    expect(res.ok()).toBeTruthy();
    await api.dispose();

    const after = await db.productVariant.findUniqueOrThrow({ where: { id: before.id } });
    expect(after.id, 'the variant was recreated rather than updated').toBe(before.id);
    expect(after.showOnHome).toBe(true);
  });

  test('a product loaded from the API can be saved straight back', async () => {
    const id = await makeProduct([
      { sizeLabel: '500 ml', sellingPrice: 780, mrpPrice: 850, showOnHome: true },
    ]);

    const api = await apiClient(await adminToken());

    // Exactly what the console does: read the product, then write it back.
    // The read carries ids, timestamps, foreign keys and display orders, and
    // the API validates with forbidNonWhitelisted — so this used to fail with
    // a 400 listing thirty properties, and every edit of an existing product
    // was silently rejected.
    const loaded = await (await api.get(resolve(`/catalog/admin/products/${id}`))).json();

    const res = await api.put(resolve(`/catalog/products/${id}`), {
      data: {
        title: loaded.title,
        variants: loaded.variants.map((v: Record<string, unknown>) => ({
          id: v.id,
          sku: v.sku,
          sizeLabel: v.sizeLabel,
          sellingPrice: Number(v.sellingPrice),
          mrpPrice: Number(v.mrpPrice),
          stockQuantity: v.stockQuantity,
          barcode: v.barcode ?? undefined,
          lengthCm: v.lengthCm ?? undefined,
          widthCm: v.widthCm ?? undefined,
          heightCm: v.heightCm ?? undefined,
          isActive: v.isActive,
          showOnHome: v.showOnHome,
        })),
      },
    });

    expect(res.status(), await res.text()).toBeLessThan(300);
    await api.dispose();

    const after = await db.productVariant.findFirstOrThrow({ where: { productId: id } });
    expect(after.showOnHome, 'the round trip lost the flag').toBe(true);
  });
});
