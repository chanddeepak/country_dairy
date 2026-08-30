import { test, expect } from '@playwright/test';
import { cleanup, db, tracked, RUN_ID, type Tracked } from '../fixtures/db';
import { createCustomer, findSellableVariant, placePaidOrder } from '../fixtures/api';
import { signInToStorefront } from '../fixtures/actions';

/**
 * The two forms a customer fills in that are not checkout.
 *
 * The contact form's happy path is covered in support.spec.ts. What is here is
 * everything around it — what happens when a field is empty, when the server
 * says no, and when the server cannot be reached at all. A form that swallows
 * a failure is worse than one that refuses loudly: the customer believes they
 * have been heard and waits for a reply nobody can send.
 */
test.describe('Contact form', () => {
  let t: Tracked;
  test.beforeEach(() => { t = tracked(); });
  test.afterEach(async () => { await cleanup(t); });

  test('an empty form is refused by the browser, and nothing is filed', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('contact-form').scrollIntoViewIfNeeded();

    const before = await db.supportTicket.count();
    await page.getByRole('button', { name: 'Send' }).click();

    // Every field is `required`, so the browser blocks the submit. The proof
    // that matters is not a visible message — it is that nothing was created.
    await expect(page.getByTestId('contact-name')).toBeFocused();
    expect(await db.supportTicket.count()).toBe(before);
  });

  test('an unreachable server says so, instead of pretending to have sent it', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('contact-form').scrollIntoViewIfNeeded();

    // The one failure a customer cannot see coming.
    await page.route('**/support/contact', (route) => route.abort('failed'));

    await page.getByTestId('contact-name').fill('Offline Visitor');
    await page.getByTestId('contact-email').fill(`offline-${RUN_ID}@example.com`);
    await page.getByTestId('contact-subject').fill(`Offline ${RUN_ID}`);
    await page.getByTestId('contact-body').fill('Does this reach you when the API is down?');
    await page.getByRole('button', { name: 'Send' }).click();

    await expect(page.getByText(/could not reach us/i)).toBeVisible({ timeout: 15_000 });
    // And it offers the way round, since the number is on the same page.
    await expect(page.getByText(/whatsapp/i).first()).toBeVisible();

    expect(await db.supportTicket.count({ where: { subject: `Offline ${RUN_ID}` } })).toBe(0);
  });

  test('a rejection from the server is shown, not hidden', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('contact-form').scrollIntoViewIfNeeded();

    await page.route('**/support/contact', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        // The API answers with one message per broken rule; the form shows the
        // first, because a list of them reads as a telling-off.
        body: JSON.stringify({ message: ['Enter a valid email address', 'Subject is too short'] }),
      }),
    );

    await page.getByTestId('contact-name').fill('Rejected Visitor');
    await page.getByTestId('contact-email').fill(`reject-${RUN_ID}@example.com`);
    await page.getByTestId('contact-subject').fill('x');
    await page.getByTestId('contact-body').fill('Body text that is long enough to send.');
    await page.getByRole('button', { name: 'Send' }).click();

    await expect(page.getByText('Enter a valid email address')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Subject is too short')).toHaveCount(0);
  });

  test('the fields empty after a send, so the next message is not the last one again', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('contact-form').scrollIntoViewIfNeeded();

    const subject = `Clears after send ${RUN_ID}`;
    await page.getByTestId('contact-name').fill('Tidy Visitor');
    await page.getByTestId('contact-email').fill(`tidy-${RUN_ID}@example.com`);
    await page.getByTestId('contact-subject').fill(subject);
    await page.getByTestId('contact-body').fill('Please confirm you deliver to Pithoragarh.');
    await page.getByRole('button', { name: 'Send' }).click();

    await expect(page.getByText(/CD-\d{8}-\d{3}/)).toBeVisible({ timeout: 20_000 });

    for (const field of ['contact-name', 'contact-email', 'contact-subject', 'contact-body']) {
      await expect(page.getByTestId(field)).toHaveValue('');
    }
  });
});

/**
 * Writing a review.
 *
 * Untested until now, and it is the only place on the storefront where a
 * customer publishes something other people read.
 */
test.describe('Review form @auth', () => {
  let t: Tracked;
  test.beforeEach(() => { t = tracked(); });
  test.afterEach(async () => { await cleanup(t); });

  async function openTheForm(page: any) {
    const variant = await findSellableVariant();
    const customer = await createCustomer(t, 'Reviewer');
    await signInToStorefront(page, customer);
    await page.goto(`/products/${variant.product.slug}`);
    await page.getByRole('button', { name: /write a(nother)? review/i }).click();
    return { customer, product: variant.product };
  }

  test('a review needs a rating, and says so rather than failing quietly', async ({ page }) => {
    test.setTimeout(120_000);
    const { customer } = await openTheForm(page);

    // Words but no stars — the one combination the server would accept as a
    // zero and the customer never meant.
    await page.getByLabel('Comment:').fill('Lovely ghee, arrived quickly.');
    await page.getByRole('button', { name: 'Submit Review' }).click();

    await expect(page.getByText(/select a star rating/i)).toBeVisible();
    expect(await db.productReview.count({ where: { userId: customer.id } })).toBe(0);
  });

  test('a signed-in customer can post one, stars and all', async ({ page }) => {
    test.setTimeout(120_000);
    const { customer, product } = await openTheForm(page);

    // By accessible name, which is also the point: each star used to be an
    // unlabelled button, so a screen reader offered five identical controls.
    await page.getByRole('button', { name: '4 stars' }).click();
    await page.getByLabel('Title:').fill(`Very good ${RUN_ID}`);
    await page.getByLabel('Comment:').fill('Rich and clean tasting. Will buy again.');
    await page.getByRole('button', { name: 'Submit Review' }).click();

    await expect
      .poll(async () =>
        db.productReview.findFirst({
          where: { userId: customer.id, productId: product.id },
          select: { rating: true, title: true, isVerifiedPurchase: true },
        }),
      { message: 'the review never reached the database', timeout: 20_000 })
      .toMatchObject({
        rating: 4,
        title: `Very good ${RUN_ID}`,
        // Nobody bought anything here, so the badge must not be claimed. It is
        // derived from a paid order rather than taken from the client, and a
        // badge that can be had for free means nothing.
        isVerifiedPurchase: false,
      });
  });

  test('the verified badge follows the purchase, not the reviewer', async ({ page }) => {
    test.setTimeout(180_000);

    /*
     * The pair to the case above, and the reason that one is worth anything.
     *
     * On its own, asserting false proves nothing — a column that is always
     * false would satisfy it. This buys the product first and expects true, so
     * between them the two cases can only pass if the badge is actually
     * derived from a paid order.
     */
    const variant = await findSellableVariant();
    const customer = await createCustomer(t, 'Verified Reviewer');
    const { orderId } = await placePaidOrder(customer, [{ variantId: variant.id, quantity: 1 }]);
    t.orderIds.push(orderId);

    await signInToStorefront(page, customer);
    await page.goto(`/products/${variant.product.slug}`);
    await page.getByRole('button', { name: /write a(nother)? review/i }).click();

    await page.getByRole('button', { name: '5 stars' }).click();
    await page.getByLabel('Comment:').fill('Bought it, ate it, buying it again.');
    await page.getByRole('button', { name: 'Submit Review' }).click();

    await expect
      .poll(async () =>
        db.productReview.findFirst({
          where: { userId: customer.id, productId: variant.product.id },
          select: { rating: true, isVerifiedPurchase: true },
        }),
      { message: 'the review never reached the database', timeout: 20_000 })
      .toMatchObject({ rating: 5, isVerifiedPurchase: true });
  });
});
