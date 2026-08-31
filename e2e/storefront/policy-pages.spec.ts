import { test, expect } from '@playwright/test';

/**
 * The pages a customer checks before trusting a shop with money, and the ones
 * a payment gateway looks for before activating a merchant account.
 *
 * They are asserted as content rather than as routes: a 200 that renders an
 * empty shell would satisfy a status check and none of the reasons these pages
 * exist. Every other route on this site is a client component that serves
 * "Loading…" first, so being genuinely in the HTML is the property worth
 * pinning down here.
 */
const PAGES = [
  { path: '/privacy', heading: /privacy policy/i, link: /privacy/i },
  { path: '/terms', heading: /terms of service/i, link: /terms/i },
  { path: '/shipping-and-returns', heading: /shipping & returns/i, link: /shipping & returns/i },
  { path: '/faq', heading: /frequently asked questions/i, link: /faq/i },
] as const;

test.describe('Policy and help pages', () => {
  for (const page_ of PAGES) {
    test(`${page_.path} is served, titled and readable`, async ({ page }) => {
      const res = await page.goto(page_.path);
      expect(res?.status()).toBe(200);

      await expect(page.getByRole('heading', { level: 1, name: page_.heading })).toBeVisible();

      // Its own title, not the homepage's — these are prerendered, so a shared
      // title would mean the metadata never reached them.
      await expect(page).toHaveTitle(/Country Dairy/);
      expect(await page.title()).not.toMatch(/Organic A2 Vedic Ghee & Wood-Pressed Oils/);
    });
  }

  test('every one of them is reachable from the footer', async ({ page }) => {
    // An unlinked policy page is one nobody finds and one a gateway reviewer
    // reports as missing, however well it is written.
    await page.goto('/');
    const policies = page.getByRole('navigation', { name: /policies/i });
    await expect(policies).toBeVisible();

    for (const p of PAGES) {
      await expect(policies.getByRole('link', { name: p.link })).toHaveAttribute('href', p.path);
    }
  });

  test('signing in says what you are agreeing to', async ({ page }) => {
    /*
     * Signing in is also how an account comes into existence here — there is
     * no separate sign-up step — so this is the only moment a customer is
     * shown the terms before one is created for them.
     */
    await page.goto('/');
    await page.getByRole('button', { name: /sign in/i }).first().click();

    await expect(page.getByText(/by continuing you agree to our/i)).toBeVisible();

    // Linked, not just named: text naming a policy nobody can open is worse
    // than not mentioning it.
    await expect(page.getByRole('link', { name: /terms of service/i }))
      .toHaveAttribute('href', '/terms');
    await expect(page.getByRole('link', { name: /privacy policy/i }))
      .toHaveAttribute('href', '/privacy');
  });

  test('the content is in the HTML, not fetched after it', async ({ page, request }) => {
    /*
     * Read over HTTP with no browser rendering, which is what a crawler that
     * does not run JavaScript sees. The product pages would fail this — they
     * serve a shell and fill it in on the client — and these must not.
     */
    const res = await request.get('/privacy');
    const html = await res.text();

    expect(html).toContain('Privacy Policy');
    expect(html).toMatch(/never see/i);
    expect(html).toContain('info@countrydairy.in');
  });
});
