import { test, expect } from '@playwright/test';
import { db } from '../fixtures/db';
import { apiClient, resolve } from '../fixtures/api';

/**
 * The navigation tree.
 *
 * Every storefront page renders this, so it is cached — and the count has to
 * include products sitting on a shelf's types, or Ghee reads as empty while
 * holding every jar we sell.
 */
test.describe('Category nav tree', () => {
  test('shelves carry their types, and count what is beneath them', async () => {
    const api = await apiClient();
    const res = await api.get(resolve('/catalog/categories/nav'));
    expect(res.ok(), await res.text()).toBeTruthy();

    const tree = await res.json();
    expect(Array.isArray(tree)).toBe(true);

    // Only shelves at the top. A type must never appear as one.
    for (const shelf of tree) {
      const row = await db.category.findUniqueOrThrow({ where: { id: shelf.id } });
      expect(row.parentId, `${shelf.name} is a type, not a shelf`).toBeNull();
    }

    const withTypes = tree.find((s: { types: unknown[] }) => s.types.length > 0);
    test.skip(!withTypes, 'no shelf has types yet');

    // The sum, not just what sits directly on the shelf.
    const beneath = await db.product.count({
      where: {
        status: 'LIVE',
        OR: [{ categoryId: withTypes.id }, { category: { parentId: withTypes.id } }],
      },
    });
    expect(withTypes.productCount, 'the shelf count ignores its types').toBe(beneath);

    await api.dispose();
  });

  test('an empty category is still listed', async () => {
    // Shown deliberately: a category with nothing in it tells a customer the
    // thing is coming. Hiding it tells them nothing.
    // Empty the way the tree counts it: nothing on the shelf *and* nothing on
    // its types. Asking only for no direct products picked Ghee, whose jars are
    // all filed under "A2 Desi Ghee" — the tree rightly said 1 and this test
    // said 0. It passed for weeks only because findFirst happened to return a
    // different row.
    const empty = await db.category.findFirst({
      where: {
        isActive: true,
        parentId: null,
        products: { none: { status: 'LIVE' } },
        subCategories: { none: { products: { some: { status: 'LIVE' } } } },
      },
    });
    test.skip(!empty, 'every category has products');

    const api = await apiClient();
    const tree = await (await api.get(resolve('/catalog/categories/nav'))).json();
    const found = tree.find((s: { id: string }) => s.id === empty!.id);

    expect(found, `${empty!.name} was dropped from the tree`).toBeTruthy();
    expect(found.productCount).toBe(0);

    await api.dispose();
  });

  test('the second call is served from memory', async () => {
    const api = await apiClient();
    await api.get(resolve('/catalog/categories/nav'));

    const started = Date.now();
    const again = await api.get(resolve('/catalog/categories/nav'));
    const elapsed = Date.now() - started;

    expect(again.ok()).toBeTruthy();
    // Asserting "did not query Postgres", not a latency budget — the database
    // is in another region and cannot beat this.
    expect(elapsed, 'the nav tree was not cached').toBeLessThan(150);

    await api.dispose();
  });
});
