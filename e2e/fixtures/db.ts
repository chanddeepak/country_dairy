import { PrismaClient } from '@prisma/client';

/**
 * One client for the whole run. Each connection to the pooler costs a round
 * trip to another region, so opening one per spec is measurably slower.
 */
export const db = new PrismaClient();

/**
 * Guard for `deleteMany({ where: { id: { in: ... } } })`.
 *
 * Prisma reads `{ in: undefined }` as "no filter" and deletes every row. A
 * cleanup referencing a key its bookkeeping object does not have is therefore
 * not a no-op — it is a truncate. That emptied this project's User table once
 * already, so nothing here passes an id list without going through this.
 */
export function only(list: string[] | undefined | null, label = 'id list'): string[] {
  if (list === undefined || list === null) {
    throw new Error(
      `Refusing to delete: ${label} is ${list}. Prisma would read that as ` +
        '"no filter" and remove every row.',
    );
  }
  if (!Array.isArray(list)) {
    throw new Error(`Refusing to delete: ${label} is ${typeof list}, expected an array.`);
  }
  return list;
}

/** Everything a spec created, so it can be undone in FK order. */
export interface Tracked {
  userIds: string[];
  orderIds: string[];
  productIds: string[];
  reviewIds: string[];
  labReportIds: string[];
}

export function tracked(): Tracked {
  return { userIds: [], orderIds: [], productIds: [], reviewIds: [], labReportIds: [] };
}

/**
 * Removes a spec's fixtures.
 *
 * Order matters: children before parents, or the foreign keys refuse.
 */
export async function cleanup(t: Tracked): Promise<void> {
  const users = only(t.userIds, 'userIds');
  const products = only(t.productIds, 'productIds');
  const reviews = only(t.reviewIds, 'reviewIds');
  const labReports = only(t.labReportIds, 'labReportIds');

  // Orders a spec forgot to track still hold FKs onto its users, and the user
  // delete below would fail on them. Sweeping by owner covers both.
  const owned = users.length
    ? await db.order.findMany({ where: { userId: { in: users } }, select: { id: true } })
    : [];
  const orders = only([...new Set([...only(t.orderIds, 'orderIds'), ...owned.map((o) => o.id)])]);

  // Checkout decremented stock. Deleting the order does not put it back, so
  // without this every run leaves the catalogue slightly emptier than it found
  // it, until findSellableVariant has nothing left to return.
  if (orders.length) {
    const items = await db.orderItem.findMany({
      where: { orderId: { in: orders } },
      select: { variantId: true, quantity: true },
    });

    const perVariant = new Map<string, number>();
    for (const item of items) {
      if (!item.variantId) continue;
      perVariant.set(item.variantId, (perVariant.get(item.variantId) ?? 0) + item.quantity);
    }

    for (const [variantId, quantity] of perVariant) {
      await db.productVariant.update({
        where: { id: variantId },
        data: { stockQuantity: { increment: quantity } },
      });
    }
  }

  await db.orderStatusHistory.deleteMany({ where: { orderId: { in: orders } } });
  await db.payment.deleteMany({ where: { orderId: { in: orders } } });
  await db.orderItem.deleteMany({ where: { orderId: { in: orders } } });
  await db.order.deleteMany({ where: { id: { in: orders } } });

  await db.productReview.deleteMany({ where: { id: { in: reviews } } });
  await db.labReport.deleteMany({ where: { id: { in: labReports } } });

  await db.productImage.deleteMany({ where: { productId: { in: products } } });
  await db.productVariant.deleteMany({ where: { productId: { in: products } } });
  await db.product.deleteMany({ where: { id: { in: products } } });

  await db.address.deleteMany({ where: { userId: { in: users } } });
  await db.cartItem.deleteMany({ where: { userId: { in: users } } });
  await db.productReview.deleteMany({ where: { userId: { in: users } } });
  await db.authIdentity.deleteMany({ where: { userId: { in: users } } });

  // Swept again, immediately before the users go. When a test times out its
  // last request is abandoned by the client but still finishes on the server,
  // so an order can land after the sweep above and turn a timeout into an
  // unrelated foreign-key crash that hides the real failure.
  const stragglers = users.length
    ? await db.order.findMany({ where: { userId: { in: users } }, select: { id: true } })
    : [];

  if (stragglers.length) {
    const ids = only(stragglers.map((o) => o.id));
    await db.orderStatusHistory.deleteMany({ where: { orderId: { in: ids } } });
    await db.payment.deleteMany({ where: { orderId: { in: ids } } });
    await db.orderItem.deleteMany({ where: { orderId: { in: ids } } });
    await db.order.deleteMany({ where: { id: { in: ids } } });
  }

  await db.user.deleteMany({ where: { id: { in: users } } });
}

/**
 * A run-unique suffix.
 *
 * Every fixture carries it so two runs — or a run beside a human clicking
 * around — cannot collide, and so anything left behind is identifiable.
 */
export const RUN_ID = `e2e${Date.now().toString(36)}`;

/**
 * A mobile number no other run will pick.
 *
 * Customers are created by phone now — email sign-up is switched off — so this
 * is what makes a test account, and two runs colliding on a number would have
 * them fighting over one order history.
 */
export function uniquePhone(): string {
  const tail = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
  // 9 keeps it a valid Indian mobile; the rest is the run and a random tail.
  return `+919${RUN_ID.replace(/\D/g, '').slice(-3).padStart(3, '0')}${tail}`;
}

export function uniqueEmail(role = 'customer'): string {
  return `${RUN_ID}-${role}-${Math.random().toString(36).slice(2, 7)}@countrydairy.test`;
}
