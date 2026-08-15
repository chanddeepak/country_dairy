import { test, expect } from '@playwright/test';
import { cleanup, db, tracked, type Tracked } from '../fixtures/db';
import { createCustomer } from '../fixtures/api';
import { signInToStorefront } from '../fixtures/actions';

/**
 * Adding and editing an address from the account page.
 *
 * The same lookup as checkout, on the form customers actually use more often
 * — they set an address up once here and reuse it at every checkout after.
 */
test.describe('Addresses on the account page @auth', () => {
  let t: Tracked;

  test.beforeEach(() => {
    t = tracked();
  });

  test.afterEach(async () => {
    await cleanup(t);
  });

  test('the PIN code fills in the town and state', async ({ page }) => {
    test.setTimeout(180_000);

    const customer = await createCustomer(t);
    await signInToStorefront(page, customer);
    await page.goto('/account?tab=addresses');

    await page.getByRole('button', { name: /add.*address/i }).first().click();

    await page.getByTestId('account-postal-code').fill('248001');

    await expect(page.getByTestId('account-state')).toHaveValue('Uttarakhand', {
      timeout: 15_000,
    });
    await expect(page.getByTestId('account-city')).not.toHaveValue('');

    // And it saves, which is the bit the lookup exists to serve.
    await page.getByPlaceholder(/house no/i).fill('Bilona House, Mall Road');
    await page.getByPlaceholder(/mobile/i).fill('9876543210');
    await page.getByRole('button', { name: /save address/i }).click();

    await expect
      .poll(async () => db.address.count({ where: { userId: customer.id } }), {
        message: 'the address never reached the database',
        timeout: 20_000,
      })
      .toBe(1);

    const saved = await db.address.findFirstOrThrow({ where: { userId: customer.id } });
    expect(saved.state).toBe('Uttarakhand');
    expect(saved.postalCode).toBe('248001');
  });

  test('changing the PIN code again moves the town and state with it', async ({ page }) => {
    test.setTimeout(180_000);

    const customer = await createCustomer(t);
    await signInToStorefront(page, customer);
    await page.goto('/account?tab=addresses');

    await page.getByRole('button', { name: /add.*address/i }).first().click();

    // Dehradun.
    await page.getByTestId('account-postal-code').fill('248001');
    await expect(page.getByTestId('account-state')).toHaveValue('Uttarakhand', {
      timeout: 15_000,
    });

    // Now somewhere else entirely. The first version of this only filled
    // fields that were empty, so the second code changed nothing and the
    // address kept Dehradun — a wrong town under a right PIN code, which is
    // worse than no help at all.
    await page.getByTestId('account-postal-code').fill('400001');
    await expect(page.getByTestId('account-state')).toHaveValue('Maharashtra', {
      timeout: 15_000,
    });
    await expect(page.getByTestId('account-city')).not.toHaveValue('Dehradun');

    // But a town the customer typed themselves is theirs, and survives.
    await page.getByTestId('account-city').fill('My Own Village');
    await page.getByTestId('account-postal-code').fill('248001');
    await expect(page.getByTestId('account-state')).toHaveValue('Uttarakhand', {
      timeout: 15_000,
    });
    await expect(page.getByTestId('account-city')).toHaveValue('My Own Village');
  });

  test('an address saved before the dropdown still opens on its own state', async ({ page }) => {
    test.setTimeout(180_000);

    const customer = await createCustomer(t);

    // What the free-text field used to allow. An unmatched value selects
    // nothing, so without normalising it the customer would open the form,
    // see an empty State, and be told to fill in what they already had.
    await db.address.create({
      data: {
        userId: customer.id,
        line1: 'Old House, Mall Road',
        city: 'Dehradun',
        state: 'uttarakhand',
        postalCode: '248001',
        phone: '9876543210',
        isDefault: true,
      },
    });

    await signInToStorefront(page, customer);
    await page.goto('/account?tab=addresses');

    await page.getByRole('button', { name: /^edit$/i }).first().click();
    await expect(page.getByTestId('account-state')).toHaveValue('Uttarakhand', {
      timeout: 15_000,
    });
  });
});
