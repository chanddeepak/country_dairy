import { test, expect } from '@playwright/test';
import { cleanup, db, tracked, type Tracked } from '../fixtures/db';
import { apiClient, createStaff, createCustomer, resolve, TEST_PASSWORD } from '../fixtures/api';

/**
 * Resetting a staff password.
 *
 * Customers have no password — they sign in with a one-time code — so this
 * route exists for staff alone, and it is the only way back in for a manager
 * who has forgotten theirs. It was uncovered, which is how a pre-launch audit
 * came to report that no password reset existed anywhere. It does; nothing
 * asserted it.
 */
test.describe('Staff password reset @security', () => {
  let t: Tracked;
  test.beforeEach(() => { t = tracked(); });
  test.afterEach(async () => { await cleanup(t); });

  test('a super admin can reset a manager, who can then sign in with it', async () => {
    const admin = await createStaff(t, 'SUPER_ADMIN');
    const manager = await createStaff(t, 'ORDER_MANAGER');
    const replacement = 'Replaced#2026xyz';

    const asAdmin = await apiClient(admin.token);
    const res = await asAdmin.patch(resolve(`/users/staff/${manager.id}/password`), {
      data: { password: replacement },
    });
    // Read before disposing: disposing the context disposes its responses, and
    // the body is gone by the time the failure message wants it.
    const ok = res.ok();
    const detail = ok ? '' : await res.text();
    await asAdmin.dispose();
    expect(ok, `reset failed: ${detail}`).toBeTruthy();

    // The proof is signing in, not a 200. A hash written to the wrong column
    // would satisfy the status code and lock the manager out for good.
    const anon = await apiClient();
    const login = await anon.post(resolve('/auth/admin/login'), {
      data: { email: manager.email, password: replacement },
    });
    const body = await login.json();
    await anon.dispose();

    expect(login.ok()).toBeTruthy();
    expect(body.accessToken, 'the new password did not produce a session').toBeTruthy();
  });

  test('the old password stops working', async () => {
    const admin = await createStaff(t, 'SUPER_ADMIN');
    const manager = await createStaff(t, 'ORDER_MANAGER');

    const asAdmin = await apiClient(admin.token);
    await asAdmin.patch(resolve(`/users/staff/${manager.id}/password`), {
      data: { password: 'Something#Else2026' },
    });
    await asAdmin.dispose();

    const anon = await apiClient();
    const stale = await anon.post(resolve('/auth/admin/login'), {
      data: { email: manager.email, password: TEST_PASSWORD },
    });
    await anon.dispose();

    expect(stale.status(), 'the replaced password still signs in').toBeGreaterThanOrEqual(400);
  });

  test('only a super admin may do it', async () => {
    const manager = await createStaff(t, 'ORDER_MANAGER');
    const other = await createStaff(t, 'CATALOG_MANAGER');

    const asManager = await apiClient(other.token);
    const res = await asManager.patch(resolve(`/users/staff/${manager.id}/password`), {
      data: { password: 'NotYours#2026' },
    });
    await asManager.dispose();

    expect(res.status(), 'a non-super-admin reset someone else\'s password').toBe(403);
  });

  test('it refuses a customer, who has no password to reset', async () => {
    /*
     * A customer signs in with a one-time code. Writing a password onto one
     * would create a second way into their account that they never asked for
     * and could not see.
     */
    const admin = await createStaff(t, 'SUPER_ADMIN');
    const customer = await createCustomer(t);

    const asAdmin = await apiClient(admin.token);
    const res = await asAdmin.patch(resolve(`/users/staff/${customer.id}/password`), {
      data: { password: 'Sneaky#2026' },
    });
    await asAdmin.dispose();

    expect(res.status()).toBe(404);

    const after = await db.user.findUniqueOrThrow({ where: { id: customer.id } });
    expect(after.passwordHash, 'a password was written onto a customer').toBeNull();
  });
});
