import { test, expect } from '@playwright/test';
import { cleanup, tracked, type Tracked } from '../fixtures/db';
import { createCustomer, TEST_PASSWORD } from '../fixtures/api';
import { registerOnStorefront, signInToStorefront } from '../fixtures/actions';
import { uniqueEmail, db } from '../fixtures/db';

/**
 * QA plan §2 — Authentication and session.
 *
 * The expiry cases matter most: a dead token used to leave the storefront
 * rendering a customer's name, orders and addresses from localStorage while
 * every write silently failed.
 */
test.describe('Session', () => {
  let t: Tracked;

  test.beforeEach(() => {
    t = tracked();
  });

  test.afterEach(async () => {
    await cleanup(t);
  });

  test('A1 · register, and the row looks right @auth', async ({ page }) => {
    const email = uniqueEmail('signup');

    await registerOnStorefront(page, {
      name: 'E2E Signup',
      email,
      password: TEST_PASSWORD,
    });

    await expect
      .poll(async () => db.user.findUnique({ where: { email } }), { timeout: 30_000 })
      .not.toBeNull();

    const user = await db.user.findUnique({ where: { email } });
    t.userIds.push(user!.id);

    expect(user!.role).toBe('CUSTOMER');
    expect(user!.isActive).toBe(true);
    // Opted in by default; a customer who orders has asked to hear about it.
    expect(user!.emailOptIn).toBe(true);

    // Never the password itself.
    expect(user!.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(user!.passwordHash).not.toContain(TEST_PASSWORD);
  });

  test('A3 · the same email cannot register twice @auth', async ({ request }) => {
    const customer = await createCustomer(t);

    for (const variant of [
      customer.email,
      customer.email.toUpperCase(),
      `  ${customer.email}  `,
    ]) {
      const res = await request.post(
        `${process.env.E2E_API_URL || 'http://localhost:4000/api'}/auth/email/register`,
        { data: { email: variant, password: TEST_PASSWORD, name: 'Duplicate' } },
      );
      expect(res.status(), `"${variant}" was allowed through`).toBe(400);
    }

    const count = await db.user.count({
      where: { email: { equals: customer.email, mode: 'insensitive' } },
    });
    expect(count).toBe(1);
  });

  test('A8 · a rejected token empties the account page @auth', async ({ page }) => {
    const customer = await createCustomer(t);

    await page.goto('/');
    await page.evaluate(
      ([token, user]) => {
        // A structurally valid token that the server will not accept.
        localStorage.setItem('cd_token', token as string);
        localStorage.setItem('cd_user', user as string);
      },
      [
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJnaG9zdCJ9.not-a-real-signature',
        JSON.stringify({ id: customer.id, email: customer.email, name: 'Ghost', addresses: [] }),
      ],
    );

    await page.goto('/account?tab=orders');

    // Says why, rather than blaming the customer's input.
    await expect(page.getByText(/session has ended|sign in to see/i)).toBeVisible({
      timeout: 30_000,
    });

    // And renders nothing personal from the stale copy.
    const body = await page.locator('body').innerText();
    expect(body, 'stale personal data was still on screen').not.toContain('Ghost');

    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('cd_token')), { timeout: 15_000 })
      .toBeNull();
  });

  test('A7 · a live session survives a reload without a modal flash @auth', async ({ page }) => {
    const customer = await createCustomer(t, 'Returning Shopper');

    await page.goto('/');
    await page.evaluate(
      ([token, user]) => {
        localStorage.setItem('cd_token', token as string);
        localStorage.setItem('cd_user', user as string);
      },
      [
        customer.token,
        JSON.stringify({
          id: customer.id,
          email: customer.email,
          name: 'Returning Shopper',
          addresses: [],
        }),
      ],
    );

    await page.goto('/account');
    await expect(page.getByRole('heading', { name: /my account/i })).toBeVisible({
      timeout: 30_000,
    });

    // The sign-in modal must never appear for somebody already signed in —
    // it used to, because the guard ran before localStorage was read.
    await expect(page.getByRole('button', { name: /^sign in$/i })).toHaveCount(0);
  });
});
