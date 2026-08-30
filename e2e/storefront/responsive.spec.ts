import { test, expect } from '@playwright/test';

/**
 * The storefront on a phone.
 *
 * These run under the `storefront-mobile` project — a Pixel 7 viewport, its
 * device pixel ratio, its user agent and touch enabled. That project has
 * existed for some time and greps for `@responsive`, which nothing carried, so
 * it ran zero tests: a suite configured to check the thing nobody checked.
 *
 * Emulation is not a real handset. It will not catch a font that renders
 * differently on iOS, a scroll that fights Safari's address bar, or anything
 * about touch latency. What it does catch is the class of bug that actually
 * ships — a layout wider than the screen, a control too small or too crowded
 * to hit, a drawer that opens half off the edge.
 */
const PAGES = [
  '/',
  '/products',
  '/category/ghee',
  '/products/country-dairy-a2-vedic-ghee',
  '/faq',
  '/privacy',
];

test.describe('On a phone @responsive', () => {
  for (const path of PAGES) {
    test(`${path} does not scroll sideways`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.goto(path);
      await page.waitForLoadState('domcontentloaded');

      /*
       * The single most common mobile defect, and the most quietly damaging:
       * one element a few pixels too wide drags the whole page sideways, and
       * every screen after it reads as broken without anything looking wrong.
       *
       * Measured on the document, not on elements — a hero deliberately drawn
       * wider than the viewport inside an overflow-hidden parent is fine, and
       * flagging it would train everyone to ignore this check.
       */
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));

      expect(
        scrollWidth,
        `${path} is ${scrollWidth - clientWidth}px wider than the screen`,
      ).toBeLessThanOrEqual(clientWidth + 1);
    });
  }

  test('the menu opens and offers somewhere to go', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/');

    // The whole navigation collapses behind this on a phone, so if it fails
    // there is no way through the site at all.
    await page.getByRole('button', { name: /open menu/i }).click();
    await expect(page.getByRole('link', { name: /shop/i }).first()).toBeVisible();
  });

  test('the filter drawer opens inside the screen, not off the edge', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/products');

    await page.getByRole('button', { name: /filter/i }).first().click();
    const drawer = page.getByTestId('filter-drawer');
    await expect(drawer).toBeVisible();

    const width = page.viewportSize()!.width;

    /*
     * Polled, because it slides in over 250ms and `toBeVisible` is satisfied on
     * the first frame — asserting straight away measured the drawer still off
     * the right edge, mid-animation. The claim is that it fits once open, not
     * that it fits at every frame of getting there.
     */
    await expect
      .poll(
        async () => {
          const box = await drawer.boundingBox();
          return box ? Math.round(box.x + box.width) : null;
        },
        {
          message: 'the drawer never settled inside the screen, so its controls cannot be reached',
          timeout: 10_000,
        },
      )
      .toBeLessThanOrEqual(width + 1);

    const settled = (await drawer.boundingBox())!;
    expect(settled.x, 'the drawer hangs off the left edge').toBeGreaterThanOrEqual(-1);
  });

  test('the gallery thumbnails can be scrolled to, not cut off', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/products/country-dairy-a2-vedic-ghee');

    // They sit wider than the screen on purpose. That is only acceptable
    // because the strip scrolls; clipped, the later images are unreachable.
    const strip = page.locator('div.overflow-x-auto').first();
    await expect(strip).toBeVisible();

    const scrollable = await strip.evaluate(
      (el) => el.scrollWidth > el.clientWidth + 1 || el.scrollWidth === el.clientWidth,
    );
    expect(scrollable, 'the thumbnail strip is clipped rather than scrollable').toBe(true);
  });

  test('small controls are far enough apart to hit @security', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/');

    /*
     * WCAG 2.5.8 lets a target be under 24x24 as long as a 24px circle centred
     * on it does not reach another target's circle. The footer and breadcrumb
     * links are all under that size, so this is the rule that decides whether
     * they are a problem — and by it they are not. Locked in so a later
     * tightening of the footer spacing cannot quietly make them one.
     */
    const violations = await page.evaluate(() => {
      const targets = Array.from(document.querySelectorAll('a[href], button, select'))
        .map((el) => ({ el, b: el.getBoundingClientRect() }))
        .filter(({ b }) => b.width > 0 && b.height > 0);

      const bad: string[] = [];
      for (const t of targets) {
        if (t.b.width >= 24 && t.b.height >= 24) continue;
        const cx = t.b.left + t.b.width / 2;
        const cy = t.b.top + t.b.height / 2;
        for (const o of targets) {
          if (o === t) continue;
          const d = Math.hypot(cx - (o.b.left + o.b.width / 2), cy - (o.b.top + o.b.height / 2));
          if (d < 24) {
            const e = t.el as HTMLElement;
            bad.push(`"${(e.innerText || e.getAttribute('aria-label') || '?').slice(0, 24)}" is ${Math.round(t.b.width)}x${Math.round(t.b.height)}`);
            break;
          }
        }
      }
      return Array.from(new Set(bad));
    });

    expect(violations, `crowded tap targets: ${violations.join('; ')}`).toEqual([]);
  });
});
