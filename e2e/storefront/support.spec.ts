import { test, expect } from '@playwright/test';
import { cleanup, db, tracked, RUN_ID, type Tracked } from '../fixtures/db';
import {
  addAddress,
  adminToken,
  apiClient,
  createCustomer,
  findSellableVariant,
  placePaidOrder,
  resolve,
} from '../fixtures/api';
import { signInToStorefront } from '../fixtures/actions';

/**
 * Asking for help, through the browser.
 *
 * There is an API spec covering these same routes and it passed green while
 * the feature was completely broken for every real customer: the app sent its
 * body with no Content-Type, so the API parsed nothing and rejected every
 * field — including ones the customer never saw. Playwright's request context
 * sets that header on your behalf, so a test written at the API can never see
 * it. Only a real browser sends what the app actually sends.
 *
 * That is the whole reason this file exists alongside the API one. It clicks.
 */
test.describe('Asking for help @auth', () => {
  let t: Tracked;

  test.beforeEach(() => {
    t = tracked();
  });

  test.afterEach(async () => {
    // Both relations are SetNull, so tickets are not swept by deleting their
    // owner — they would be left behind, orphaned and invisible. They have to
    // go first, while the order still identifies them.
    await db.supportTicket.deleteMany({
      where: {
        OR: [
          { subject: { contains: RUN_ID } },
          { contactEmail: { contains: RUN_ID } },
          ...(t.orderIds.length ? [{ orderId: { in: t.orderIds } }] : []),
        ],
      },
    });
    await cleanup(t);
  });

  test('a customer asks about an order and reads the answer', async ({ page }) => {
    // Places a real paid order first, then drives two screens.
    test.setTimeout(300_000);

    const customer = await createCustomer(t);
    const variant = await findSellableVariant();
    const addressId = await addAddress(customer.token);
    const { orderId, orderNumber } = await placePaidOrder(
      customer,
      [{ variantId: variant.id, quantity: 1 }],
      { addressId },
    );
    t.orderIds.push(orderId);

    // 1 · Open the order and ask, by typing into the box.
    await signInToStorefront(page, customer);
    await page.goto(`/orders/${orderId}`);

    await page.getByTestId('ask-a-question').click();
    const question = `The seal was broken when it arrived ${RUN_ID}`;
    await page.getByTestId('query-body').fill(question);
    await page.getByRole('button', { name: 'Send question' }).click();

    // The confirmation carries the reference, which is the customer's proof
    // they can quote later. A green box with no reference is not enough.
    await expect(page.getByText(/CD-\d{8}-\d{3}/)).toBeVisible({ timeout: 15_000 });

    // 2 · It really landed, with the order attached.
    // Found by the order, not by the subject: the app writes the subject
    // itself from the order number, so it carries no marker of this run.
    const ticket = await db.supportTicket.findFirstOrThrow({
      where: { orderId },
      include: { messages: true },
    });
    expect(ticket.subject).toContain(orderNumber);
    expect(ticket.messages[0].body).toContain('seal was broken');

    // 3 · The desk answers.
    const asStaff = await apiClient(await adminToken());
    const replied = await asStaff.post(resolve(`/support/${ticket.id}/reply`), {
      data: { body: 'So sorry — a replacement is on its way to you today.' },
    });
    expect(replied.ok(), await replied.text()).toBeTruthy();
    await asStaff.dispose();

    // 4 · The customer finds it without being told where to look.
    await page.goto('/account?tab=queries');
    await page.getByTestId('query-row').first().click();
    await expect(page.getByText('replacement is on its way')).toBeVisible({ timeout: 15_000 });

    // 5 · And writes back — the other call that was broken the same way.
    // Scoped to the page body: the footer carries a contact form with a Send
    // button of its own, and an unscoped match finds both.
    await page.getByTestId('query-reply').fill('Thank you, that is very good of you.');
    await page.getByRole('main').getByRole('button', { name: 'Send' }).click();

    await expect
      .poll(
        async () => db.supportMessage.count({ where: { ticketId: ticket.id } }),
        { message: 'the reply never reached the database', timeout: 20_000 },
      )
      .toBe(3);

    const thread = await db.supportMessage.findMany({
      where: { ticketId: ticket.id },
      orderBy: { createdAt: 'asc' },
    });
    // A customer's own message must never be recorded as coming from the shop.
    expect(thread[2].fromStaff).toBe(false);
    expect(thread[2].body).toContain('very good of you');

    // Replying hands it back to the desk rather than leaving it answered.
    expect((await db.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } })).status).toBe(
      'OPEN',
    );
  });

  test('a stranger can ask through the contact form', async ({ page }) => {
    test.setTimeout(120_000);

    // The form lives in the footer, so it is reachable from anywhere.
    await page.goto('/');

    const subject = `Delivery to Haldwani ${RUN_ID}`;
    await page.getByTestId('contact-form').scrollIntoViewIfNeeded();
    await page.getByTestId('contact-name').fill('Prospective Buyer');
    await page.getByTestId('contact-email').fill(`guest-${RUN_ID}@example.com`);
    await page.getByTestId('contact-subject').fill(subject);
    await page
      .getByTestId('contact-body')
      .fill('Do you deliver to Haldwani? I would like to order some ghee.');

    await page.getByRole('button', { name: 'Send' }).click();

    await expect(page.getByText(/CD-\d{8}-\d{3}/)).toBeVisible({ timeout: 15_000 });

    // No account, but still answerable — the email is the only way back.
    const ticket = await db.supportTicket.findFirstOrThrow({ where: { subject } });
    expect(ticket.userId).toBeNull();
    expect(ticket.contactEmail).toContain(RUN_ID);
  });
});
