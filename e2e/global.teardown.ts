import { test as teardown } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { db, only } from './fixtures/db';

const SHARED = path.resolve(__dirname, '.auth/shared.json');

/**
 * Removes the roles global.setup created for the whole run.
 *
 * Per-spec fixtures clean themselves up; these outlive every spec, so they
 * are removed once at the end.
 */
teardown('remove the run-scoped accounts', async () => {
  if (!fs.existsSync(SHARED)) return;

  const shared = JSON.parse(fs.readFileSync(SHARED, 'utf8'));
  const userIds = only(shared.userIds, 'shared.userIds');

  if (userIds.length > 0) {
    await db.orderStatusHistory.deleteMany({ where: { order: { userId: { in: userIds } } } });
    await db.payment.deleteMany({ where: { order: { userId: { in: userIds } } } });
    await db.orderItem.deleteMany({ where: { order: { userId: { in: userIds } } } });
    await db.order.deleteMany({ where: { userId: { in: userIds } } });
    await db.productReview.deleteMany({ where: { userId: { in: userIds } } });
    await db.address.deleteMany({ where: { userId: { in: userIds } } });
    await db.cartItem.deleteMany({ where: { userId: { in: userIds } } });
    await db.authIdentity.deleteMany({ where: { userId: { in: userIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
  }

  fs.rmSync(SHARED, { force: true });
  await db.$disconnect();
});
