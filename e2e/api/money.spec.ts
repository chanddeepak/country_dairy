import { test, expect } from '@playwright/test';
import { cleanup, db, tracked, type Tracked } from '../fixtures/db';
import {
  addAddress,
  apiClient,
  createCustomer,
  findSellableVariant,
  placePaidOrder,
  resolve,
} from '../fixtures/api';

/**
 * QA plan §5 and §6 — checkout, tax, stock and invoicing.
 *
 * The money paths. Everything here asserts against the database rather than
 * the response body wherever it can: a total that renders correctly and a
 * total that was stored correctly are different claims, and only the second
 * one survives to the GST return.
 */
test.describe('Checkout, tax and stock @money', () => {
  let t: Tracked;

  test.beforeEach(() => {
    t = tracked();
  });

  test.afterEach(async () => {
    await cleanup(t);
  });

  test('D6 · GST is contained in the price, not added to it', async () => {
    const customer = await createCustomer(t);
    const variant = await findSellableVariant();

    const { orderId } = await placePaidOrder(customer, [
      { variantId: variant.id, quantity: 2 },
    ]);
    t.orderIds.push(orderId);

    const items = await db.orderItem.findMany({ where: { orderId } });
    expect(items).toHaveLength(1);

    for (const item of items) {
      const lineTotal = Number(item.lineTotal);
      const rate = Number(item.gstRate);
      // Tax-inclusive: the tax is the portion already inside lineTotal, so
      // lineTotal is the amount the customer pays, not a pre-tax subtotal.
      const contained = lineTotal - lineTotal / (1 + rate / 100);

      expect(Number(item.taxAmount)).toBeCloseTo(contained, 1);
      expect(Number(item.unitPrice) * item.quantity).toBeCloseTo(lineTotal, 1);
    }

    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    const sumOfLines = items.reduce((n, i) => n + Number(i.lineTotal), 0);
    expect(Number(order.subtotal)).toBeCloseTo(sumOfLines, 1);
    // If tax were added rather than extracted, the total would exceed the
    // lines by the tax. It must not.
    expect(Number(order.totalAmount)).toBeCloseTo(
      sumOfLines + Number(order.deliveryCharges) - Number(order.discountAmount),
      1,
    );
  });

  test('D7 · the shipping address is a snapshot, not a reference', async () => {
    const customer = await createCustomer(t);
    const variant = await findSellableVariant();
    const addressId = await addAddress(customer.token, { city: 'Tanakpur' });

    const { orderId, orderNumber } = await placePaidOrder(
      customer,
      [{ variantId: variant.id, quantity: 1 }],
      { addressId },
    );
    t.orderIds.push(orderId);

    expect(orderNumber).toMatch(/[A-Z]/);

    const api = await apiClient(customer.token);
    const moved = await api.patch(resolve(`/auth/address/${addressId}`), {
      data: { city: 'Haldwani', line1: 'Somewhere else entirely' },
    });
    expect(moved.ok()).toBeTruthy();
    await api.dispose();

    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    const snapshot = order.shippingAddress as Record<string, unknown>;
    // The order must still say where it was actually sent. Editing a saved
    // address is not a licence to rewrite delivery history.
    expect(snapshot.city).toBe('Tanakpur');
  });

  test('D8 · stock falls by exactly the quantity ordered', async () => {
    const customer = await createCustomer(t);
    const variant = await findSellableVariant();
    const before = variant.stockQuantity;

    const { orderId } = await placePaidOrder(customer, [
      { variantId: variant.id, quantity: 2 },
    ]);
    t.orderIds.push(orderId);

    const after = await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(after.stockQuantity).toBe(before - 2);
  });

  test('D9 · the cart is empty after a successful order', async () => {
    const customer = await createCustomer(t);
    const variant = await findSellableVariant();

    const { orderId } = await placePaidOrder(customer, [
      { variantId: variant.id, quantity: 1 },
    ]);
    t.orderIds.push(orderId);

    const left = await db.cartItem.count({ where: { userId: customer.id } });
    expect(left).toBe(0);
  });

  test('D11/D12 · a replayed payment settles one row and does not double-count', async () => {
    const customer = await createCustomer(t);
    const variant = await findSellableVariant();
    const stockBefore = variant.stockQuantity;

    const { orderId } = await placePaidOrder(customer, [
      { variantId: variant.id, quantity: 1 },
    ]);
    t.orderIds.push(orderId);

    const api = await apiClient(customer.token);
    const replay = await api.post(resolve('/orders/verify-payment'), {
      data: { orderId, razorpayPaymentId: 'pay_e2e_replay', signature: 'mock' },
    });
    // The retry is answered, not rejected: a gateway callback that arrives
    // twice is normal, and the second one must be harmless.
    expect(replay.ok()).toBeTruthy();
    await api.dispose();

    const payments = await db.payment.findMany({ where: { orderId } });
    expect(payments, 'a replay created a second Payment row').toHaveLength(1);
    expect(payments[0].status).toBe('PAID');
    // A PENDING row still sitting beside a paid order means checkout's row was
    // abandoned rather than settled.
    expect(payments[0].gatewayPaymentId).toBeTruthy();

    const after = await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(after.stockQuantity, 'the replay decremented stock again').toBe(stockBefore - 1);
  });

  test('D10 · two buyers racing for the last unit cannot both win', async () => {
    const alice = await createCustomer(t, 'Alice');
    const bob = await createCustomer(t, 'Bob');
    const variant = await findSellableVariant();

    const original = variant.stockQuantity;
    await db.productVariant.update({
      where: { id: variant.id },
      data: { stockQuantity: 1 },
    });

    try {
      const [aliceApi, bobApi] = await Promise.all([
        apiClient(alice.token),
        apiClient(bob.token),
      ]);

      await Promise.all([
        aliceApi.post(resolve('/cart/add'), { data: { variantId: variant.id, quantity: 1 } }),
        bobApi.post(resolve('/cart/add'), { data: { variantId: variant.id, quantity: 1 } }),
      ]);

      const [aliceAddress, bobAddress] = await Promise.all([
        addAddress(alice.token),
        addAddress(bob.token),
      ]);

      const [first, second] = await Promise.all([
        aliceApi.post(resolve('/orders/checkout'), {
          data: { addressId: aliceAddress, deliveryType: 'LOCAL' },
        }),
        bobApi.post(resolve('/orders/checkout'), {
          data: { addressId: bobAddress, deliveryType: 'LOCAL' },
        }),
      ]);

      for (const res of [first, second]) {
        if (res.ok()) t.orderIds.push((await res.json()).orderId);
      }

      const winners = [first, second].filter((r) => r.ok());
      expect(winners, 'both checkouts succeeded on one unit of stock').toHaveLength(1);

      const loser = [first, second].find((r) => !r.ok())!;
      // 409, not 400: the request was fine, someone else simply got there
      // first. That distinction is what tells a client to re-read stock
      // rather than to re-validate the form.
      expect(loser.status()).toBe(409);
      expect((await loser.text()).toLowerCase()).toMatch(/sold out while you were checking out/);

      const after = await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
      expect(after.stockQuantity, 'stock went negative').toBeGreaterThanOrEqual(0);
      expect(after.stockQuantity).toBe(0);

      await Promise.all([aliceApi.dispose(), bobApi.dispose()]);
    } finally {
      // Restored explicitly: cleanup only puts back what an order consumed,
      // and this test moved the baseline itself.
      await db.productVariant.update({
        where: { id: variant.id },
        data: { stockQuantity: original },
      });
    }
  });
});

test.describe('Reorder @money', () => {
  let t: Tracked;

  test.beforeEach(() => {
    t = tracked();
  });

  test.afterEach(async () => {
    await cleanup(t);
  });

  test('E4/E5 · reordering twice adds up rather than duplicating rows', async () => {
    const customer = await createCustomer(t);
    const variant = await findSellableVariant();

    const { orderId } = await placePaidOrder(customer, [
      { variantId: variant.id, quantity: 2 },
    ]);
    t.orderIds.push(orderId);

    const api = await apiClient(customer.token);

    const first = await api.post(resolve(`/orders/${orderId}/reorder`));
    expect(first.ok()).toBeTruthy();
    expect((await first.json()).added).toHaveLength(1);

    let rows = await db.cartItem.findMany({ where: { userId: customer.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].quantity).toBe(2);

    const second = await api.post(resolve(`/orders/${orderId}/reorder`));
    expect(second.ok()).toBeTruthy();

    rows = await db.cartItem.findMany({ where: { userId: customer.id } });
    expect(rows, 'reorder created a duplicate line instead of adding').toHaveLength(1);
    expect(rows[0].quantity).toBe(4);

    await api.dispose();
  });

  test('E6 · a sold-out line is reported, and the rest still go in', async () => {
    const customer = await createCustomer(t);
    const variant = await findSellableVariant();

    const other = await db.productVariant.findFirst({
      where: {
        isActive: true,
        stockQuantity: { gt: 5 },
        id: { not: variant.id },
        product: { status: 'LIVE', forceOutOfStock: false },
      },
    });
    test.skip(!other, 'needs two sellable variants in the catalogue');

    const { orderId } = await placePaidOrder(customer, [
      { variantId: variant.id, quantity: 1 },
      { variantId: other!.id, quantity: 1 },
    ]);
    t.orderIds.push(orderId);

    const stockBefore = (
      await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } })
    ).stockQuantity;

    await db.productVariant.update({ where: { id: variant.id }, data: { stockQuantity: 0 } });

    try {
      const api = await apiClient(customer.token);
      const res = await api.post(resolve(`/orders/${orderId}/reorder`));
      expect(res.ok()).toBeTruthy();

      const body = await res.json();
      expect(body.unavailable).toHaveLength(1);
      expect(body.unavailable[0].reason).toMatch(/sold out/i);
      expect(body.added).toHaveLength(1);

      // Nothing is silently swapped in for what is gone.
      const rows = await db.cartItem.findMany({ where: { userId: customer.id } });
      expect(rows).toHaveLength(1);
      expect(rows[0].variantId).toBe(other!.id);

      await api.dispose();
    } finally {
      await db.productVariant.update({
        where: { id: variant.id },
        data: { stockQuantity: stockBefore },
      });
    }
  });

  test('E7 · partial stock says how many were wanted versus added', async () => {
    const customer = await createCustomer(t);
    const variant = await findSellableVariant();

    const { orderId } = await placePaidOrder(customer, [
      { variantId: variant.id, quantity: 2 },
    ]);
    t.orderIds.push(orderId);

    const stockBefore = (
      await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } })
    ).stockQuantity;

    await db.productVariant.update({ where: { id: variant.id }, data: { stockQuantity: 1 } });

    try {
      const api = await apiClient(customer.token);
      const res = await api.post(resolve(`/orders/${orderId}/reorder`));
      expect(res.ok()).toBeTruthy();

      const body = await res.json();
      expect(body.adjusted).toHaveLength(1);
      expect(body.adjusted[0]).toMatchObject({ wanted: 2, added: 1 });

      const rows = await db.cartItem.findMany({ where: { userId: customer.id } });
      expect(rows[0].quantity).toBe(1);

      await api.dispose();
    } finally {
      await db.productVariant.update({
        where: { id: variant.id },
        data: { stockQuantity: stockBefore },
      });
    }
  });

  test('E8 · a price change is stated before checkout, not after', async () => {
    const customer = await createCustomer(t);
    const variant = await findSellableVariant();

    const { orderId } = await placePaidOrder(customer, [
      { variantId: variant.id, quantity: 1 },
    ]);
    t.orderIds.push(orderId);

    const was = Number(variant.sellingPrice);
    await db.productVariant.update({
      where: { id: variant.id },
      data: { sellingPrice: was + 25 },
    });

    try {
      const api = await apiClient(customer.token);
      const res = await api.post(resolve(`/orders/${orderId}/reorder`));
      expect(res.ok()).toBeTruthy();

      const body = await res.json();
      expect(body.repriced, 'a silent price rise is the one thing reorder must not do')
        .toHaveLength(1);
      expect(Number(body.repriced[0].was)).toBeCloseTo(was, 2);
      expect(Number(body.repriced[0].now)).toBeCloseTo(was + 25, 2);

      await api.dispose();
    } finally {
      await db.productVariant.update({
        where: { id: variant.id },
        data: { sellingPrice: was },
      });
    }
  });

  test('E9 · a delisted product is reported as no longer sold', async () => {
    const customer = await createCustomer(t);
    const variant = await findSellableVariant();

    const { orderId } = await placePaidOrder(customer, [
      { variantId: variant.id, quantity: 1 },
    ]);
    t.orderIds.push(orderId);

    const previousStatus = variant.product.status;
    await db.product.update({
      where: { id: variant.productId },
      data: { status: 'ARCHIVED' },
    });

    try {
      const api = await apiClient(customer.token);
      const res = await api.post(resolve(`/orders/${orderId}/reorder`));
      expect(res.ok()).toBeTruthy();

      const body = await res.json();
      expect(body.unavailable).toHaveLength(1);
      expect(body.unavailable[0].reason).toMatch(/no longer sold/i);
      expect(await db.cartItem.count({ where: { userId: customer.id } })).toBe(0);

      await api.dispose();
    } finally {
      await db.product.update({
        where: { id: variant.productId },
        data: { status: previousStatus },
      });
    }
  });
});

test.describe('Invoicing @money', () => {
  let t: Tracked;

  test.beforeEach(() => {
    t = tracked();
  });

  test.afterEach(async () => {
    await cleanup(t);
  });

  test('E10/E11 · the number is issued once and never moves', async () => {
    const customer = await createCustomer(t);
    const variant = await findSellableVariant();

    const { orderId } = await placePaidOrder(customer, [
      { variantId: variant.id, quantity: 1 },
    ]);
    t.orderIds.push(orderId);

    const api = await apiClient(customer.token);

    const first = await api.get(resolve(`/orders/${orderId}/invoice`));
    expect(first.ok()).toBeTruthy();
    const invoice = await first.json();

    // Shaped CD/2026-27/00001: series, financial year, zero-padded sequence.
    expect(invoice.invoiceNumber).toMatch(/^[A-Z]+\/\d{4}-\d{2}\/\d+$/);

    for (let i = 0; i < 3; i += 1) {
      const again = await api.get(resolve(`/orders/${orderId}/invoice`));
      expect((await again.json()).invoiceNumber).toBe(invoice.invoiceNumber);
    }

    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.invoiceNumber).toBe(invoice.invoiceNumber);
    expect(order.invoicedAt).toBeTruthy();

    await api.dispose();
  });

  test('E12 · the series is consecutive across orders', async () => {
    // Three orders paid for and invoiced in turn, against a database a region
    // away. Roughly twenty round trips at ~700ms each does not fit the default
    // minute, and a timeout here would abandon an in-flight checkout.
    test.setTimeout(240_000);

    const customer = await createCustomer(t);
    const variant = await findSellableVariant();
    const api = await apiClient(customer.token);
    const addressId = await addAddress(customer.token);

    const sequences: number[] = [];

    for (let i = 0; i < 3; i += 1) {
      const { orderId } = await placePaidOrder(
        customer,
        [{ variantId: variant.id, quantity: 1 }],
        { addressId },
      );
      t.orderIds.push(orderId);

      const res = await api.get(resolve(`/orders/${orderId}/invoice`));
      expect(res.ok()).toBeTruthy();
      const { invoiceNumber } = await res.json();
      sequences.push(Number(invoiceNumber.split('/').pop()));
    }

    // Gap-free is the point: a missing number in a GST series is a question
    // from the department, not a cosmetic flaw.
    expect(sequences[1]).toBe(sequences[0] + 1);
    expect(sequences[2]).toBe(sequences[1] + 1);

    await api.dispose();
  });

  test('E13 · an unpaid order is refused and consumes no number', async () => {
    const customer = await createCustomer(t);
    const variant = await findSellableVariant();

    const { orderId } = await placePaidOrder(
      customer,
      [{ variantId: variant.id, quantity: 1 }],
      { pay: false },
    );
    t.orderIds.push(orderId);

    const api = await apiClient(customer.token);
    const res = await api.get(resolve(`/orders/${orderId}/invoice`));

    expect(res.status()).toBe(400);
    expect((await res.text()).toLowerCase()).toMatch(/paid/);

    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.invoiceNumber, 'an unpaid order took a number out of the series').toBeNull();

    await api.dispose();
  });

  test('E14 · an Uttarakhand address splits into CGST and SGST', async () => {
    const customer = await createCustomer(t);
    const variant = await findSellableVariant();
    const addressId = await addAddress(customer.token, { state: 'Uttarakhand' });

    const { orderId } = await placePaidOrder(
      customer,
      [{ variantId: variant.id, quantity: 1 }],
      { addressId },
    );
    t.orderIds.push(orderId);

    const api = await apiClient(customer.token);
    const invoice = await (await api.get(resolve(`/orders/${orderId}/invoice`))).json();
    await api.dispose();

    // Intra-state: the tax splits in half between centre and state, and no
    // IGST is charged.
    expect(invoice.taxKind).toBe('CGST_SGST');
    expect(Number(invoice.totals.igst)).toBe(0);
    expect(Number(invoice.totals.cgst)).toBeCloseTo(Number(invoice.totals.sgst), 2);
    expect(Number(invoice.totals.cgst) + Number(invoice.totals.sgst)).toBeCloseTo(
      Number(invoice.totals.totalTax),
      1,
    );
  });
});
