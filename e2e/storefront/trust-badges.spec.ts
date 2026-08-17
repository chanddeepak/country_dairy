import { test, expect } from '@playwright/test';
import { db } from '../fixtures/db';
import { adminToken, apiClient, resolve } from '../fixtures/api';
import { RUN_ID } from '../fixtures/db';

/**
 * The reasons to trust us, edited in the console.
 *
 * The TrustBadge table, its API and a whole admin page existed and rendered
 * nowhere. Editing them changed nothing a customer could see, which is worse
 * than not having the feature: someone maintains it, believing it works.
 */
test.describe('Trust badges', () => {
  const made: string[] = [];

  test.afterEach(async () => {
    if (made.length) {
      await db.trustBadge.deleteMany({ where: { id: { in: made.splice(0) } } });
    }
  });

  test('a badge written in the console appears on the homepage', async ({ page }) => {
    test.setTimeout(120_000);

    const title = `Made in Uttarakhand ${RUN_ID}`;
    const api = await apiClient(await adminToken());
    const created = await api.post(resolve('/cms/trust-badges'), {
      data: {
        title,
        subtitle: 'Pure hills, pure cows, pure ghee.',
        iconName: 'Leaf',
        displayOrder: 1,
        isActive: true,
      },
    });
    expect(created.ok(), await created.text()).toBeTruthy();
    made.push((await created.json()).id);
    await api.dispose();

    await page.goto('/');
    await expect(page.getByText(title)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Pure hills, pure cows, pure ghee.')).toBeVisible();
  });

  test('the band still reads well when the console has nothing in it', async ({ page }) => {
    // The fallback exists so a fresh install never shows an empty strip where
    // the reasons to trust us are meant to be.
    const existing = await db.trustBadge.count({ where: { isActive: true } });
    test.skip(existing > 0, 'the console has badges, so the fallback is not on screen');

    await page.goto('/');
    await expect(page.getByRole('heading', { name: /why country dairy/i })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText('A2 Beta-Casein')).toBeVisible();
  });
});
