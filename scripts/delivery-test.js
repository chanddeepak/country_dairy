/**
 * Local delivery contract test.
 *
 * The security property under test is that a driver's view and actions are
 * bound to the id inside their token, not to anything the request supplies —
 * so one driver can neither read nor complete another driver's round.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');
const { only } = require('./lib/safe-ids');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const API = process.env.TEST_API_URL || 'http://localhost:4000/api';
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@countrydairy.in';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'ChangeMe#2026';

let pass = 0;
let fail = 0;

function ok(name, condition, detail = '') {
  if (condition) {
    pass++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } else {
    fail++;
    console.log(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function call(pathname, { method = 'GET', body, token } = {}) {
  const res = await fetch(API + pathname, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data };
}

const stamp = Date.now();
const made = { drivers: [], users: [], orders: [] };

async function makeDriver(suffix) {
  const email = `test-driver-${suffix}-${stamp}@countrydairy.test`;
  const driver = await prisma.user.create({
    data: {
      email,
      name: `Test Driver ${suffix}`,
      role: 'DELIVERY_DRIVER',
      isActive: true,
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12),
      identities: {
        create: { provider: 'EMAIL', providerId: email, verifiedAt: new Date() },
      },
    },
  });
  made.drivers.push(driver.id);

  const login = await call('/auth/admin/login', {
    method: 'POST',
    body: { email, password: ADMIN_PASSWORD },
  });

  return { id: driver.id, token: login.data?.accessToken, email };
}

async function makeLocalOrder(customerId, variant, suffix) {
  const order = await prisma.order.create({
    data: {
      orderNumber: `TESTDEL-${stamp}-${suffix}`,
      userId: customerId,
      shippingAddress: {
        line1: `${suffix} Test Lane`,
        line2: 'Near the test landmark',
        city: 'Tanakpur',
        state: 'Uttarakhand',
        postalCode: '262309',
        country: 'India',
        phone: '9999900000',
      },
      subtotal: 500,
      taxAmount: 0,
      totalAmount: 500,
      status: 'CONFIRMED',
      paymentStatus: 'PENDING', // cash on delivery
      deliveryType: 'LOCAL',
      orderItems: {
        create: {
          variantId: variant.id,
          productId: variant.productId,
          productTitle: 'Test Product',
          variantSizeLabel: variant.sizeLabel,
          sku: `${variant.sku}-t${suffix}`,
          quantity: 2,
          unitPrice: 250,
          mrpPrice: 250,
          gstRate: 0,
          taxAmount: 0,
          lineTotal: 500,
        },
      },
    },
  });
  made.orders.push(order.id);
  return order;
}

(async () => {
  console.log('\n\x1b[1mLOCAL DELIVERY\x1b[0m\n');

  const login = await call('/auth/admin/login', {
    method: 'POST',
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const adminToken = login.data?.accessToken;
  ok('admin can sign in', !!adminToken);
  if (!adminToken) throw new Error('no admin token');

  const variant = await prisma.productVariant.findFirst();

  // A throwaway customer, not the first real one in the database: an
  // interrupted run would otherwise leave test orders in someone's history.
  const customerEmail = `del-fixture-${stamp}@countrydairy.test`;
  await call('/auth/email/register', {
    method: 'POST',
    body: { email: customerEmail, password: ADMIN_PASSWORD, name: 'Delivery Fixture' },
  });
  const customer = await prisma.user.findUnique({ where: { email: customerEmail } });
  if (customer) made.users.push(customer.id);

  ok('fixtures available', !!variant && !!customer);
  if (!variant || !customer) throw new Error('need a variant and a customer');

  const [driverA, driverB] = await Promise.all([makeDriver('a'), makeDriver('b')]);
  ok('both test drivers can sign in', !!driverA.token && !!driverB.token);

  const orderA = await makeLocalOrder(customer.id, variant, '1');
  const orderB = await makeLocalOrder(customer.id, variant, '2');

  // --- Route sheets ---
  console.log('\n  Route sheets');
  const sheets = await call('/delivery/routes', { token: adminToken });
  ok('dispatch can read route sheets', sheets.ok, `status ${sheets.status}`);

  const route = sheets.data?.routes?.find((r) => r.pincode === '262309');
  ok('orders grouped by pincode', !!route, JSON.stringify(sheets.data?.routes?.map((r) => r.pincode)));

  const stop = route?.stops?.find((s) => s.orderId === orderA.id);
  ok('the new order appears as a stop', !!stop);
  ok('address rendered from the snapshot, not "undefined"', !!stop && /Test Lane/.test(stop.addressLine), stop?.addressLine);
  ok('items summarised for the driver', !!stop && /2 × Test Product/.test(stop.itemsSummary), stop?.itemsSummary);
  ok('cash-on-delivery amount is the order total', stop?.amountToCollect === 500, String(stop?.amountToCollect));
  ok('stop starts unassigned', stop?.driverId === null);

  const badDate = await call('/delivery/routes?date=10-08-2026', { token: adminToken });
  ok('malformed date rejected', badDate.status === 400, `status ${badDate.status}`);

  // --- Assignment ---
  console.log('\n  Assignment');
  const assigned = await call('/delivery/routes/assign', {
    method: 'POST',
    token: adminToken,
    body: { orderIds: [orderA.id], driverId: driverA.id },
  });
  ok('route assigned', assigned.ok && assigned.data?.assigned === 1, JSON.stringify(assigned.data));

  const notADriver = await call('/delivery/routes/assign', {
    method: 'POST',
    token: adminToken,
    body: { orderIds: [orderB.id], driverId: customer.id },
  });
  ok('cannot assign a route to a non-driver', notADriver.status === 400, `status ${notADriver.status}`);

  const emptyAssign = await call('/delivery/routes/assign', {
    method: 'POST',
    token: adminToken,
    body: { orderIds: [], driverId: driverA.id },
  });
  ok('empty assignment rejected', emptyAssign.status === 400, `status ${emptyAssign.status}`);

  // --- Driver isolation ---
  console.log('\n  A driver sees only their own round');
  const roundA = await call('/delivery/my-deliveries', { token: driverA.token });
  ok('driver A sees their assigned stop', roundA.data?.some((s) => s.orderId === orderA.id));

  const roundB = await call('/delivery/my-deliveries', { token: driverB.token });
  ok(
    "driver B does not see driver A's stop",
    !roundB.data?.some((s) => s.orderId === orderA.id),
    `${roundB.data?.length ?? '?'} stops returned`,
  );

  const stealAttempt = await call(`/delivery/${orderA.id}/delivered`, {
    method: 'PATCH',
    token: driverB.token,
    body: {},
  });
  ok(
    "driver B cannot complete driver A's delivery",
    stealAttempt.status === 403,
    `status ${stealAttempt.status}`,
  );

  const unassignedComplete = await call(`/delivery/${orderB.id}/delivered`, {
    method: 'PATCH',
    token: driverA.token,
    body: {},
  });
  ok('an unassigned order cannot be completed', unassignedComplete.status === 403, `status ${unassignedComplete.status}`);

  // --- Authorisation ---
  console.log('\n  Authorisation');
  const anonRoutes = await call('/delivery/routes');
  ok('route sheets need a token', anonRoutes.status === 401, `status ${anonRoutes.status}`);

  const driverReadingRoutes = await call('/delivery/routes', { token: driverA.token });
  ok('a driver cannot open the dispatch desk', driverReadingRoutes.status === 403, `status ${driverReadingRoutes.status}`);

  const driverAssigning = await call('/delivery/routes/assign', {
    method: 'POST',
    token: driverA.token,
    body: { orderIds: [orderB.id], driverId: driverA.id },
  });
  ok('a driver cannot assign themselves work', driverAssigning.status === 403, `status ${driverAssigning.status}`);

  const anonComplete = await call(`/delivery/${orderA.id}/delivered`, { method: 'PATCH', body: {} });
  ok('anonymous completion rejected', anonComplete.status === 401, `status ${anonComplete.status}`);

  // --- Failed attempt ---
  console.log('\n  Failed attempt');
  const noReason = await call(`/delivery/${orderA.id}/failed`, {
    method: 'PATCH',
    token: driverA.token,
    body: { reason: 'x' },
  });
  ok('a failed attempt needs a reason', noReason.status === 400, `status ${noReason.status}`);

  const failed = await call(`/delivery/${orderA.id}/failed`, {
    method: 'PATCH',
    token: driverA.token,
    body: { reason: 'Nobody home, gate locked' },
  });
  ok('failed attempt recorded', failed.ok, `status ${failed.status}`);

  const stillOnRound = await call('/delivery/my-deliveries', { token: driverA.token });
  ok(
    'a failed stop stays on the round rather than vanishing',
    stillOnRound.data?.some((s) => s.orderId === orderA.id),
  );

  const history = await prisma.orderStatusHistory.findMany({ where: { orderId: orderA.id } });
  ok('the attempt is in the order history', history.some((h) => /attempt failed/i.test(h.note ?? '')));

  // --- Completion ---
  console.log('\n  Completion');
  const delivered = await call(`/delivery/${orderA.id}/delivered`, {
    method: 'PATCH',
    token: driverA.token,
    body: { note: 'Handed to customer' },
  });
  ok('delivery completed', delivered.ok, `status ${delivered.status}`);

  const settled = await prisma.order.findUnique({ where: { id: orderA.id } });
  ok('order marked DELIVERED', settled.status === 'DELIVERED');
  ok('deliveredAt stamped', !!settled.deliveredAt);
  ok('cash collected settles the payment', settled.paymentStatus === 'PAID');

  const roundAfter = await call('/delivery/my-deliveries', { token: driverA.token });
  ok('completed stop leaves the open round', !roundAfter.data?.some((s) => s.orderId === orderA.id));

  const completedList = await call('/delivery/my-deliveries/completed', { token: driverA.token });
  ok("it appears in today's completed list", completedList.data?.some((s) => s.orderId === orderA.id));

  const twice = await call(`/delivery/${orderA.id}/delivered`, {
    method: 'PATCH',
    token: driverA.token,
    body: {},
  });
  ok('cannot deliver the same order twice', twice.status === 400, `status ${twice.status}`);

  const sheetsAfter = await call('/delivery/routes', { token: adminToken });
  const routeAfter = sheetsAfter.data?.routes?.find((r) => r.pincode === '262309');
  ok(
    'a delivered stop drops off the route sheet',
    !routeAfter?.stops?.some((s) => s.orderId === orderA.id),
  );
})()
  .catch((err) => {
    fail++;
    console.error('\n\x1b[31mFATAL\x1b[0m', err.message);
  })
  .finally(async () => {
    // Clean up in FK order so nothing is left behind for the next run.
    const strays = await prisma.order.findMany({
      where: { orderNumber: { startsWith: `TESTDEL-${stamp}` } },
      select: { id: true },
    });
    const orderIds = [...new Set([...made.orders, ...strays.map((o) => o.id)])];

    await prisma.orderStatusHistory.deleteMany({ where: { orderId: { in: only(orderIds, 'orderIds') } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: only(orderIds, 'orderIds') } } });
    await prisma.order.deleteMany({ where: { id: { in: only(orderIds, 'orderIds') } } });
    await prisma.cartItem.deleteMany({ where: { userId: { in: only(made.users, 'made.users') } } });
    await prisma.authIdentity.deleteMany({ where: { userId: { in: only(made.users, 'made.users') } } });
    await prisma.user.deleteMany({ where: { id: { in: only(made.users, 'made.users') } } });
    await prisma.authIdentity.deleteMany({ where: { userId: { in: only(made.drivers, 'made.drivers') } } });
    await prisma.user.deleteMany({ where: { id: { in: only(made.drivers, 'made.drivers') } } });
    await prisma.$disconnect();

    const colour = fail ? '\x1b[31m' : '\x1b[32m';
    console.log(`\n${colour}\x1b[1m${pass} passed, ${fail} failed\x1b[0m\n`);
    process.exit(fail ? 1 : 0);
  });
