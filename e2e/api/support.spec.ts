import { test, expect } from '@playwright/test';
import { cleanup, db, tracked, RUN_ID, type Tracked } from '../fixtures/db';
import {
  addAddress,
  adminToken,
  apiClient,
  createCustomer,
  createStaff,
  findSellableVariant,
  placePaidOrder,
  resolve,
} from '../fixtures/api';

/**
 * Customer queries, both directions.
 *
 * The half that matters is the return trip: a question that can be sent but
 * whose answer never reaches the person who asked is worse than no feature,
 * because they wait for it.
 */
test.describe('Support @auth', () => {
  let t: Tracked;
  const madeTicketIds: string[] = [];

  test.beforeEach(() => {
    t = tracked();
  });

  test.afterEach(async () => {
    if (madeTicketIds.length) {
      await db.supportTicket.deleteMany({ where: { id: { in: madeTicketIds.splice(0) } } });
    }
    await db.supportTicket.deleteMany({ where: { subject: { contains: RUN_ID } } });
    await cleanup(t);
  });

  test('a customer can ask about one of their own orders', async () => {
    test.setTimeout(180_000);

    const customer = await createCustomer(t);
    const variant = await findSellableVariant();
    const addressId = await addAddress(customer.token);
    const { orderId } = await placePaidOrder(
      customer,
      [{ variantId: variant.id, quantity: 1 }],
      { addressId },
    );
    t.orderIds.push(orderId);

    const api = await apiClient(customer.token);
    const res = await api.post(resolve('/support'), {
      data: {
        subject: `Cracked jar ${RUN_ID}`,
        body: 'The jar arrived cracked. Could you replace it please?',
        orderId,
      },
    });

    expect(res.status(), await res.text()).toBeLessThan(300);
    const ticket = await res.json();
    madeTicketIds.push(ticket.id);

    expect(ticket.ticketRef).toMatch(/^CD-\d{8}-\d{3}$/);
    expect(ticket.status).toBe('OPEN');
    expect(ticket.messages).toHaveLength(1);
    // The order has to come back attached, or the desk cannot see what the
    // question is about without going hunting.
    expect(ticket.order?.id).toBe(orderId);

    await api.dispose();
  });

  test('the desk can see what was in the box', async () => {
    test.setTimeout(180_000);

    const customer = await createCustomer(t);
    const variant = await findSellableVariant();
    const addressId = await addAddress(customer.token);
    const { orderId } = await placePaidOrder(
      customer,
      [{ variantId: variant.id, quantity: 2 }],
      { addressId },
    );
    t.orderIds.push(orderId);

    const asCustomer = await apiClient(customer.token);
    const ticket = await (
      await asCustomer.post(resolve('/support'), {
        data: { subject: `Wrong size ${RUN_ID}`, body: 'I think I was sent the wrong size.', orderId },
      })
    ).json();
    madeTicketIds.push(ticket.id);
    await asCustomer.dispose();

    const asStaff = await apiClient(await adminToken());

    // The inbox list stays lean — line items there would mean loading every
    // order on every page of the inbox.
    const inbox = await (await asStaff.get(resolve('/support/admin'))).json();
    const row = inbox.items.find((x: { id: string }) => x.id === ticket.id);
    expect(
      row.order?.orderItems,
      'the list is carrying line items it does not need',
    ).toBeUndefined();

    // Opening one thread is where they arrive.
    const opened = await (await asStaff.get(resolve(`/support/admin/${ticket.id}`))).json();
    expect(opened.order.orderItems, 'the desk cannot see what was ordered').toBeTruthy();
    expect(opened.order.orderItems.length).toBeGreaterThan(0);

    const line = opened.order.orderItems[0];
    expect(line.productTitle).toBeTruthy();
    expect(line.variantSizeLabel).toBeTruthy();
    expect(line.quantity).toBe(2);
    // The slug is what the modal links to; without it the row has nowhere
    // to go.
    expect(line.product?.slug).toBeTruthy();

    await asStaff.dispose();
  });

  test("a customer cannot attach somebody else's order @security", async () => {
    test.setTimeout(180_000);

    const owner = await createCustomer(t, 'Owner');
    const stranger = await createCustomer(t, 'Stranger');
    const variant = await findSellableVariant();
    const addressId = await addAddress(owner.token);
    const { orderId } = await placePaidOrder(
      owner,
      [{ variantId: variant.id, quantity: 1 }],
      { addressId },
    );
    t.orderIds.push(orderId);

    const api = await apiClient(stranger.token);
    const res = await api.post(resolve('/support'), {
      data: {
        subject: `Prying ${RUN_ID}`,
        body: 'Tell me about this order that is not mine, please.',
        orderId,
      },
    });

    // Otherwise a ticket against someone else's order would let a stranger
    // read the reply about it.
    expect(res.status()).toBe(404);
    await api.dispose();
  });

  test('the whole loop: ask, answer, and the customer reads it', async () => {
    const customer = await createCustomer(t);

    const asCustomer = await apiClient(customer.token);
    const created = await asCustomer.post(resolve('/support'), {
      data: {
        subject: `Grass fed ${RUN_ID}`,
        body: 'Are the cows grazed on open pasture all year round?',
      },
    });
    expect(created.ok(), await created.text()).toBeTruthy();
    const ticket = await created.json();
    madeTicketIds.push(ticket.id);

    const asStaff = await apiClient(await adminToken());
    const inbox = await (await asStaff.get(resolve('/support/admin'))).json();
    expect(
      inbox.items.some((x: { id: string }) => x.id === ticket.id),
      'the query never reached the inbox',
    ).toBe(true);

    const replied = await asStaff.post(resolve(`/support/${ticket.id}/reply`), {
      data: { body: 'Yes — open pasture, with fodder only in deep winter.' },
    });
    expect(replied.ok()).toBeTruthy();

    // Replying puts the ball back in the customer's court, which is what lets
    // the inbox show who is actually waiting.
    const afterReply = await (await asStaff.get(resolve(`/support/admin/${ticket.id}`))).json();
    expect(afterReply.status).toBe('AWAITING_CUSTOMER');
    expect(afterReply.lastReplyAt).toBeTruthy();

    // The half that matters.
    const mine = await (await asCustomer.get(resolve('/support'))).json();
    const seen = mine.find((x: { id: string }) => x.id === ticket.id);
    expect(seen, 'the customer cannot see their own query').toBeTruthy();
    expect(seen.messages).toHaveLength(2);
    expect(seen.messages[1].fromStaff).toBe(true);
    expect(seen.messages[1].body).toContain('open pasture');

    // And answering back returns it to the desk.
    const back = await asCustomer.post(resolve(`/support/${ticket.id}/reply`), {
      data: { body: 'Thank you, that is what I hoped.' },
    });
    expect(back.ok()).toBeTruthy();
    expect((await db.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } })).status).toBe(
      'OPEN',
    );

    await asCustomer.dispose();
    await asStaff.dispose();
  });

  test('a customer message can never claim to be from staff @security', async () => {
    const customer = await createCustomer(t);
    const api = await apiClient(customer.token);

    const ticket = await (
      await api.post(resolve('/support'), {
        data: { subject: `Impersonation ${RUN_ID}`, body: 'A perfectly ordinary question.' },
      })
    ).json();
    madeTicketIds.push(ticket.id);

    // fromStaff is decided from the caller's role, not from anything sent.
    await api.post(resolve(`/support/${ticket.id}/reply`), {
      data: { body: 'Posing as the shop', fromStaff: true },
    });

    const messages = await db.supportMessage.findMany({ where: { ticketId: ticket.id } });
    expect(messages.every((m) => m.fromStaff === false)).toBe(true);
    await api.dispose();
  });

  test("one customer cannot read another's thread @security", async () => {
    const alice = await createCustomer(t, 'Alice');
    const bob = await createCustomer(t, 'Bob');

    const asAlice = await apiClient(alice.token);
    const ticket = await (
      await asAlice.post(resolve('/support'), {
        data: { subject: `Private ${RUN_ID}`, body: 'Something I would rather Bob did not read.' },
      })
    ).json();
    madeTicketIds.push(ticket.id);
    await asAlice.dispose();

    const asBob = await apiClient(bob.token);
    expect((await asBob.get(resolve(`/support/${ticket.id}`))).status()).toBe(404);
    // Replying to it must fail too, or the thread leaks by another door.
    expect(
      (await asBob.post(resolve(`/support/${ticket.id}/reply`), { data: { body: 'hello' } })).status(),
    ).toBe(404);
    await asBob.dispose();
  });

  test('the contact form needs no account', async () => {
    const api = await apiClient();
    const res = await api.post(resolve('/support/contact'), {
      data: {
        name: 'Prospective Buyer',
        email: `guest-${RUN_ID}@example.com`,
        subject: `Delivery area ${RUN_ID}`,
        body: 'Do you deliver to Haldwani? I would like to order some ghee.',
      },
    });

    expect(res.status(), await res.text()).toBeLessThan(300);
    const ticket = await res.json();
    madeTicketIds.push(ticket.id);

    // A guest query has no user but must still be answerable.
    expect(ticket.userId).toBeNull();
    expect(ticket.contactEmail).toContain('@');
    await api.dispose();
  });

  test('a closed thread is refused rather than silently reopened', async () => {
    const customer = await createCustomer(t);
    const asCustomer = await apiClient(customer.token);

    const ticket = await (
      await asCustomer.post(resolve('/support'), {
        data: { subject: `Closing ${RUN_ID}`, body: 'A question that will shortly be closed.' },
      })
    ).json();
    madeTicketIds.push(ticket.id);

    const asStaff = await apiClient(await adminToken());
    await asStaff.patch(resolve(`/support/admin/${ticket.id}/status`), {
      data: { status: 'CLOSED' },
    });

    const res = await asCustomer.post(resolve(`/support/${ticket.id}/reply`), {
      data: { body: 'One more thing…' },
    });
    expect(res.status()).toBe(400);
    expect((await res.text()).toLowerCase()).toContain('closed');

    await asCustomer.dispose();
    await asStaff.dispose();
  });

  test('the inbox is staff only @security', async () => {
    const customer = await createCustomer(t);
    const driver = await createStaff(t, 'DELIVERY_DRIVER');

    for (const [who, token, expected] of [
      ['an anonymous caller', undefined, 401],
      ['a customer', customer.token, 403],
      ['a delivery driver', driver.token, 403],
    ] as const) {
      const api = await apiClient(token);
      expect((await api.get(resolve('/support/admin'))).status(), `${who} read the inbox`).toBe(
        expected,
      );
      await api.dispose();
    }
  });
});
