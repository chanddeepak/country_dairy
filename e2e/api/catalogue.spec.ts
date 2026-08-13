import { test, expect } from '@playwright/test';
import { cleanup, db, tracked, RUN_ID, type Tracked } from '../fixtures/db';
import {
  addAddress,
  adminToken,
  apiClient,
  createCustomer,
  createStaff,
  placePaidOrder,
  resolve,
} from '../fixtures/api';

/**
 * QA plan §11 — the admin catalogue.
 *
 * Three of these guard bugs this project has actually shipped: a ₹100 price
 * substituted when none was given, a save that deleted and recreated every
 * variant, and a delete that took the order history with it. They are written
 * against the database rather than the console because what matters is the row
 * that survives, not the toast that appeared.
 */

interface MadeProduct {
  id: string;
  slug: string;
  variantIds: string[];
}

/**
 * A category to hang test products from.
 *
 * Products cannot be created without one — the API refuses rather than
 * inventing a default, after an earlier version fell back to a literal
 * 'cat-1' that did not exist and failed the foreign key. Reuses whatever the
 * catalogue already has so these specs do not litter it with categories.
 */
async function someCategoryId(): Promise<string> {
  const existing = await db.category.findFirst({ where: { isActive: true } });
  if (existing) return existing.id;

  const made = await db.category.create({
    data: { name: `E2E Category ${RUN_ID}`, slug: `e2e-fallback-${RUN_ID}`, isActive: true },
  });
  return made.id;
}

async function createProduct(
  t: Tracked,
  overrides: Record<string, unknown> = {},
): Promise<{ status: number; text: string; product: MadeProduct | null }> {
  const api = await apiClient(await adminToken());
  const suffix = `${RUN_ID}-${Math.random().toString(36).slice(2, 7)}`;

  const res = await api.post(resolve('/catalog/products'), {
    data: {
      title: `E2E Ghee ${suffix}`,
      slug: `e2e-ghee-${suffix}`,
      status: 'LIVE',
      categoryId: await someCategoryId(),
      variants: [
        { sizeLabel: '500 ml', sellingPrice: 750, mrpPrice: 800, stockQuantity: 40 },
        { sizeLabel: '1 Litre', sellingPrice: 1400, mrpPrice: 1500, stockQuantity: 25 },
      ],
      ...overrides,
    },
  });

  const status = res.status();
  const text = await res.text();
  await api.dispose();

  if (status >= 300) return { status, text, product: null };

  const body = JSON.parse(text);
  const id = body.id ?? body.product?.id;
  t.productIds.push(id);

  const variants = await db.productVariant.findMany({
    where: { productId: id },
    orderBy: { displayOrder: 'asc' },
  });

  return {
    status,
    text,
    product: { id, slug: body.slug ?? body.product?.slug, variantIds: variants.map((v) => v.id) },
  };
}

test.describe('Catalogue authoring @security', () => {
  let t: Tracked;

  test.beforeEach(() => {
    t = tracked();
  });

  test.afterEach(async () => {
    await cleanup(t);
  });

  test('J2 · a product and its variants are created together', async () => {
    const { status, product } = await createProduct(t);
    expect(status).toBeLessThan(300);

    const saved = await db.product.findUniqueOrThrow({
      where: { id: product!.id },
      include: { variants: true },
    });

    expect(saved.status).toBe('LIVE');
    expect(saved.variants).toHaveLength(2);
    // A SKU is generated when the author does not supply one, because an
    // empty SKU makes stock impossible to reconcile later.
    for (const variant of saved.variants) {
      expect(variant.sku).toBeTruthy();
      expect(Number(variant.sellingPrice)).toBeGreaterThan(0);
    }
  });

  test('J3 · a price is never invented @money', async () => {
    for (const [what, variants] of [
      ['zero', [{ sizeLabel: '500 ml', sellingPrice: 0, mrpPrice: 800 }]],
      ['negative', [{ sizeLabel: '500 ml', sellingPrice: -5, mrpPrice: 800 }]],
      ['missing', [{ sizeLabel: '500 ml', mrpPrice: 800 }]],
    ] as const) {
      const { status, text } = await createProduct(t, { variants });

      // The ₹100 fallback this project shipped once came from treating a
      // missing price as a reason to pick one. It must be a reason to refuse.
      expect(status, `a ${what} price was accepted`).toBe(400);
      expect(text.toLowerCase()).toMatch(/price|number/);
    }

    const nameless = await createProduct(t, {
      variants: [{ sellingPrice: 500, mrpPrice: 600 }],
    });
    expect(nameless.status).toBe(400);
    expect(nameless.text.toLowerCase()).toMatch(/size label/);
  });

  test('J5 · editing a product does not recreate its variants', async () => {
    const { product } = await createProduct(t);
    const before = await db.productVariant.findMany({
      where: { productId: product!.id },
      orderBy: { displayOrder: 'asc' },
    });

    const api = await apiClient(await adminToken());
    const res = await api.put(resolve(`/catalog/products/${product!.id}`), {
      data: {
        title: 'E2E Ghee, renamed',
        variants: before.map((v) => ({
          id: v.id,
          sizeLabel: v.sizeLabel,
          sellingPrice: Number(v.sellingPrice),
          mrpPrice: Number(v.mrpPrice),
          stockQuantity: v.stockQuantity,
        })),
      },
    });
    expect(res.ok()).toBeTruthy();
    await api.dispose();

    const after = await db.productVariant.findMany({
      where: { productId: product!.id },
      orderBy: { displayOrder: 'asc' },
    });

    // The previous implementation deleted and recreated every variant on save,
    // which detached order history and emptied customers' carts. The ids must
    // be the same objects afterwards.
    expect(after.map((v) => v.id)).toEqual(before.map((v) => v.id));
    expect(after.map((v) => v.sku)).toEqual(before.map((v) => v.sku));
  });

  test('J6 · a variant matched by SKU keeps its identity and its packaging', async () => {
    const { product } = await createProduct(t);
    const original = await db.productVariant.findFirstOrThrow({
      where: { productId: product!.id },
      orderBy: { displayOrder: 'asc' },
    });

    const api = await apiClient(await adminToken());
    // No id sent — only the SKU, which is how the editor round-trips a variant
    // it did not load an id for.
    const res = await api.put(resolve(`/catalog/products/${product!.id}`), {
      data: {
        variants: [
          {
            sku: original.sku,
            sizeLabel: original.sizeLabel,
            sellingPrice: Number(original.sellingPrice),
            mrpPrice: Number(original.mrpPrice),
            packagingCode: 'GLASS_JAR',
          },
        ],
      },
    });
    expect(res.ok()).toBeTruthy();
    await api.dispose();

    const kept = await db.productVariant.findUnique({ where: { id: original.id } });
    expect(kept, 'the variant was recreated rather than matched by SKU').not.toBeNull();
    expect(kept!.packagingCode).toBe('GLASS_JAR');
  });

  test('J9 · a product that never sold is deleted outright', async () => {
    const { product } = await createProduct(t);

    const api = await apiClient(await adminToken());
    expect((await api.delete(resolve(`/catalog/products/${product!.id}`))).ok()).toBeTruthy();
    await api.dispose();

    expect(await db.product.count({ where: { id: product!.id } })).toBe(0);
  });

  test('J10 · a product that has sold is archived, not destroyed @money', async () => {
    test.setTimeout(180_000);

    const { product } = await createProduct(t);
    const customer = await createCustomer(t);
    const addressId = await addAddress(customer.token);

    const variantId = product!.variantIds[0];
    const { orderId } = await placePaidOrder(
      customer,
      [{ variantId, quantity: 1 }],
      { addressId },
    );
    t.orderIds.push(orderId);

    const api = await apiClient(await adminToken());
    const res = await api.delete(resolve(`/catalog/products/${product!.id}`));
    expect(res.ok()).toBeTruthy();
    await api.dispose();

    const still = await db.product.findUnique({ where: { id: product!.id } });
    expect(still, 'a sold product was destroyed along with its revenue record')
      .not.toBeNull();
    expect(still!.status).toBe('ARCHIVED');
    expect(still!.isFeatured).toBe(false);

    // Its variants stop being sellable, but they still exist for the order
    // line to point at.
    const variants = await db.productVariant.findMany({ where: { productId: product!.id } });
    expect(variants.every((v) => !v.isActive)).toBe(true);

    // And the money is untouched.
    const items = await db.orderItem.findMany({ where: { orderId } });
    expect(items).toHaveLength(1);
    expect(Number(items[0].lineTotal)).toBeGreaterThan(0);
    expect(items[0].productTitle).toBeTruthy();
  });

  test('J1 · an archived product leaves the storefront but stays in the console', async () => {
    const { product } = await createProduct(t);

    const api = await apiClient(await adminToken());
    await api.put(resolve(`/catalog/products/${product!.id}`), {
      data: { status: 'ARCHIVED' },
    });

    const admin = await (await api.get(resolve('/catalog/admin/products'))).json();
    const adminList = Array.isArray(admin) ? admin : (admin.products ?? []);
    expect(
      adminList.some((p: { id: string }) => p.id === product!.id),
      'the console lost sight of an archived product',
    ).toBe(true);
    await api.dispose();

    const shop = await apiClient();
    const publicList = await (await shop.get(resolve('/catalog/products'))).json();
    const items = Array.isArray(publicList) ? publicList : (publicList.products ?? []);
    await shop.dispose();

    expect(
      items.some((p: { id: string }) => p.id === product!.id),
      'an archived product is still on sale',
    ).toBe(false);
  });

  test('J2 · authoring is closed to customers and to the wrong staff @security', async () => {
    const customer = await createCustomer(t);
    const orderManager = await createStaff(t, 'ORDER_MANAGER');
    // Sent so a rejection is provably about the caller, not a missing field.
    const categoryId = await someCategoryId();

    for (const [who, token, expected] of [
      ['an anonymous caller', undefined, 401],
      ['a customer', customer.token, 403],
      ['an order manager', orderManager.token, 403],
    ] as const) {
      const api = await apiClient(token);
      const res = await api.post(resolve('/catalog/products'), {
        data: {
          title: `Should not exist ${RUN_ID}`,
          categoryId,
          variants: [{ sizeLabel: '1 L', sellingPrice: 100, mrpPrice: 120 }],
        },
      });
      expect(res.status(), `${who} could create a product`).toBe(expected);
      await api.dispose();
    }

    expect(
      await db.product.count({ where: { title: { contains: `Should not exist ${RUN_ID}` } } }),
    ).toBe(0);
  });
});

test.describe('Categories @security', () => {
  let t: Tracked;
  const madeCategoryIds: string[] = [];

  test.beforeEach(() => {
    t = tracked();
  });

  test.afterEach(async () => {
    if (madeCategoryIds.length) {
      await db.category.deleteMany({ where: { id: { in: madeCategoryIds.splice(0) } } });
    }
    await cleanup(t);
  });

  test('J11 · a category is created, renamed and deactivated', async () => {
    const api = await apiClient(await adminToken());
    const name = `E2E Category ${RUN_ID}`;

    const created = await api.post(resolve('/catalog/categories'), {
      data: { name, slug: `e2e-cat-${RUN_ID}`, displayOrder: 99 },
    });
    expect(created.ok()).toBeTruthy();

    const body = await created.json();
    const id = body.id ?? body.category?.id;
    madeCategoryIds.push(id);

    const renamed = await api.put(resolve(`/catalog/categories/${id}`), {
      data: { name: `${name} renamed`, slug: `e2e-cat-${RUN_ID}`, isActive: false },
    });
    expect(renamed.ok()).toBeTruthy();
    await api.dispose();

    const saved = await db.category.findUniqueOrThrow({ where: { id } });
    expect(saved.name).toBe(`${name} renamed`);
    expect(saved.isActive).toBe(false);

    // A deactivated category must not offer itself as a storefront filter.
    const shop = await apiClient();
    const publicCats = await (await shop.get(resolve('/catalog/categories'))).json();
    await shop.dispose();

    const list = Array.isArray(publicCats) ? publicCats : (publicCats.categories ?? []);
    expect(
      list.some((c: { id: string }) => c.id === id),
      'a deactivated category is still a storefront chip',
    ).toBe(false);
  });
});
