import { test, expect } from '@playwright/test';
import { db, RUN_ID } from '../fixtures/db';
import { adminToken, apiClient, resolve } from '../fixtures/api';

/**
 * Types within a category — Desi Ghee under Ghee.
 *
 * Two levels is the whole model, and it is enforced by the service rather than
 * by table structure. That choice is only sound if the rule actually holds, so
 * these are the tests that make it true rather than conventional.
 */
test.describe('Category types @security', () => {
  const made: string[] = [];

  test.afterEach(async () => {
    if (made.length) {
      await db.category.deleteMany({ where: { id: { in: made.splice(0) } } });
    }
  });

  test('a type belongs to its category and never to the nav bar', async () => {
    const api = await apiClient(await adminToken());
    const parent = await db.category.findFirstOrThrow({ where: { parentId: null } });

    const res = await api.post(resolve('/catalog/categories'), {
      data: {
        name: `Desi Ghee ${RUN_ID}`,
        parentId: parent.id,
        // Asked for, and must be refused: a type lives on its category's page.
        showInNav: true,
        displayOrder: 1,
      },
    });
    expect(res.status(), await res.text()).toBeLessThan(300);

    const created = await res.json();
    made.push(created.id);

    expect(created.parentId).toBe(parent.id);
    expect(created.showInNav, 'a type was promoted to the nav bar').toBe(false);

    await api.dispose();
  });

  test('a type cannot contain another type', async () => {
    const api = await apiClient(await adminToken());
    const parent = await db.category.findFirstOrThrow({ where: { parentId: null } });

    const type = await (
      await api.post(resolve('/catalog/categories'), {
        data: { name: `Cultured ${RUN_ID}`, parentId: parent.id },
      })
    ).json();
    made.push(type.id);

    // The whole two-level model rests on this refusal.
    const deeper = await api.post(resolve('/catalog/categories'), {
      data: { name: `Deeper ${RUN_ID}`, parentId: type.id },
    });
    expect(deeper.status()).toBe(400);
    expect((await deeper.text()).toLowerCase()).toContain('cannot contain');

    expect(await db.category.count({ where: { name: `Deeper ${RUN_ID}` } })).toBe(0);
    await api.dispose();
  });

  test('a category of its own can be promoted', async () => {
    const api = await apiClient(await adminToken());

    const res = await api.post(resolve('/catalog/categories'), {
      data: { name: `Standalone ${RUN_ID}`, showInNav: true },
    });
    expect(res.ok(), await res.text()).toBeTruthy();

    const created = await res.json();
    made.push(created.id);
    expect(created.parentId).toBeNull();
    expect(created.showInNav).toBe(true);

    await api.dispose();
  });

  test('a product saved with a type points at the type, not its category', async () => {
    test.setTimeout(120_000);

    const api = await apiClient(await adminToken());
    const parent = await db.category.findFirstOrThrow({ where: { parentId: null } });

    const type = await (
      await api.post(resolve('/catalog/categories'), {
        data: { name: `Buffalo Ghee ${RUN_ID}`, parentId: parent.id },
      })
    ).json();
    made.push(type.id);

    // The console sends the name, so this is the path a real save takes.
    const res = await api.post(resolve('/catalog/products'), {
      data: {
        title: `Test jar ${RUN_ID}`,
        categoryName: type.name,
        status: 'DRAFT',
      },
    });
    expect(res.status(), await res.text()).toBeLessThan(300);
    const product = await res.json();

    try {
      // The leaf, not the parent. A product filed under Ghee when Desi Ghee
      // exists would be missing from every type filter on the storefront.
      expect(product.categoryId).toBe(type.id);
      expect(product.categoryId).not.toBe(parent.id);
    } finally {
      await db.product.delete({ where: { id: product.id } }).catch(() => undefined);
      await api.dispose();
    }
  });
});
