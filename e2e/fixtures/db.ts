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
  const orders = only(t.orderIds, 'orderIds');
  const users = only(t.userIds, 'userIds');
  const products = only(t.productIds, 'productIds');
  const reviews = only(t.reviewIds, 'reviewIds');
  const labReports = only(t.labReportIds, 'labReportIds');

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
  await db.user.deleteMany({ where: { id: { in: users } } });
}

/**
 * A run-unique suffix.
 *
 * Every fixture carries it so two runs — or a run beside a human clicking
 * around — cannot collide, and so anything left behind is identifiable.
 */
export const RUN_ID = `e2e${Date.now().toString(36)}`;

export function uniqueEmail(role = 'customer'): string {
  return `${RUN_ID}-${role}-${Math.random().toString(36).slice(2, 7)}@countrydairy.test`;
}
