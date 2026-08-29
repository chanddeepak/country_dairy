import { OrdersService } from './orders.service';

/**
 * Freeing stock from checkouts nobody paid for.
 *
 * The dangerous half is not releasing stock — it is releasing the *wrong*
 * stock. A PENDING order is not proof of abandonment: the customer may have
 * paid while their browser closed, or the webhook may have gone astray. Cancel
 * that one and a completed payment is destroyed along with its allocation, and
 * the customer finds out when the parcel never comes.
 *
 * So the sweep asks the gateway before it touches anything, and these tests
 * exist mostly to prove it keeps asking.
 */
function buildService(orders: unknown[], remoteStatus: Record<string, string>) {
  const restocked: string[] = [];
  const confirmed: string[] = [];

  const prisma = {
    order: { findMany: jest.fn().mockResolvedValue(orders) },
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) =>
      typeof fn === 'function' ? fn({}) : fn,
    ),
  };

  const cashfreeService = {
    getOrder: jest.fn(async (id: string) => ({ order_status: remoteStatus[id] ?? 'ACTIVE' })),
  };

  const service = new OrdersService(
    prisma as never, {} as never, cashfreeService as never,
    {} as never, {} as never, {} as never, {} as never, {} as never,
  );

  // The two things the sweep can do, stubbed so the test sees which happened.
  (service as unknown as Record<string, unknown>).restockAndCancel = jest.fn(
    async (orderId: string) => { restocked.push(orderId); },
  );
  service.confirmCashfreeOrder = jest.fn(async (_u, orderId: string) => {
    confirmed.push(orderId);
    return { order: {}, session: null } as never;
  });

  return { service, restocked, confirmed, cashfreeService, prisma };
}

const order = (
  id: string,
  gatewayOrderId: string | null,
  paymentStatus: 'PENDING' | 'FAILED' = 'PENDING',
  provider = 'CASHFREE',
) => ({
  id,
  orderNumber: `CD-2026-${id}`,
  paymentStatus,
  orderItems: [{ variantId: 'v1', quantity: 2 }],
  payments: gatewayOrderId ? [{ provider, gatewayOrderId }] : [],
});

describe('expireAbandonedOrders', () => {
  it('releases stock from a checkout the gateway says was never paid', async () => {
    const { service, restocked, confirmed } = buildService(
      [order('1', 'CF-1')], { 'CF-1': 'ACTIVE' },
    );

    const r = await service.expireAbandonedOrders();

    expect(restocked).toEqual(['1']);
    expect(confirmed).toEqual([]);
    expect(r).toMatchObject({ examined: 1, released: 1, settled: 0, failed: 0 });
  });

  it('settles rather than cancels one that turns out to be paid @money', async () => {
    const { service, restocked, confirmed } = buildService(
      [order('2', 'CF-2')], { 'CF-2': 'PAID' },
    );

    const r = await service.expireAbandonedOrders();

    /*
     * The whole reason the sweep asks first. This is a customer whose money
     * was taken and whose confirmation never arrived; cancelling would throw
     * the payment away and put the jars back on the shelf.
     */
    expect(confirmed).toEqual(['2']);
    expect(restocked).toEqual([]);
    expect(r).toMatchObject({ released: 0, settled: 1 });
  });

  it('always asks before releasing', async () => {
    const { service, cashfreeService } = buildService(
      [order('3', 'CF-3')], { 'CF-3': 'ACTIVE' },
    );

    await service.expireAbandonedOrders();

    expect(cashfreeService.getOrder).toHaveBeenCalledWith('CF-3');
  });

  it('releases an order that has no gateway id, since it was never payable', async () => {
    const { service, restocked, cashfreeService } = buildService([order('4', null)], {});

    await service.expireAbandonedOrders();

    expect(restocked).toEqual(['4']);
    // Nothing to ask about.
    expect(cashfreeService.getOrder).not.toHaveBeenCalled();
  });

  it('keeps going when one order fails', async () => {
    const { service, restocked } = buildService(
      [order('5', 'CF-5'), order('6', 'CF-6')], { 'CF-5': 'ACTIVE', 'CF-6': 'ACTIVE' },
    );
    const restock = (service as unknown as Record<string, jest.Mock>).restockAndCancel;
    restock.mockImplementationOnce(async () => { throw new Error('database blinked'); });

    const r = await service.expireAbandonedOrders();

    // One failure must not strand every other order behind it.
    expect(r).toMatchObject({ examined: 2, released: 1, failed: 1 });
    expect(restocked).toEqual(['6']);
  });

  it('sweeps a failed payment too, not only a silent one', async () => {
    const { service, restocked } = buildService(
      [order('7', 'CF-7', 'FAILED')], { 'CF-7': 'ACTIVE' },
    );

    /*
     * The case that is easiest to miss. A declined payment sets paymentStatus
     * FAILED and deliberately leaves the order PENDING so the customer can try
     * again — but if the sweep only looked at PENDING *payments*, those jars
     * would stay reserved for ever against an order that already failed.
     */
    const r = await service.expireAbandonedOrders();

    expect(restocked).toEqual(['7']);
    expect(r).toMatchObject({ released: 1 });
  });

  it('looks for both pending and failed payments', async () => {
    const { service, prisma } = buildService([], {});

    await service.expireAbandonedOrders();

    const where = prisma.order.findMany.mock.calls[0][0].where;
    expect(where.paymentStatus.in).toEqual(expect.arrayContaining(['PENDING', 'FAILED']));
    // An order already CONFIRMED has been paid for; one already CANCELLED has
    // had its stock returned. Neither should be touched again.
    expect(where.status).toBe('PENDING');
  });

  it('only looks at orders older than the window', async () => {
    const { service, prisma } = buildService([], {});

    await service.expireAbandonedOrders(90);

    const where = prisma.order.findMany.mock.calls[0][0].where;
    const cutoff = where.createdAt.lt as Date;
    const minutesAgo = (Date.now() - cutoff.getTime()) / 60000;
    expect(minutesAgo).toBeGreaterThan(89);
    expect(minutesAgo).toBeLessThan(91);
  });
});
