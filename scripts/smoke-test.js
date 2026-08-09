#!/usr/bin/env node
/**
 * End-to-end smoke test against a running API and the real database.
 *
 *   npm run smoke
 *
 * Covers the paths where a regression costs money or leaks data: checkout
 * pricing, stock, access control, moderation, and CMS persistence. Every row
 * it creates is removed at the end.
 *
 * Requires: API on $API_URL (default http://localhost:4000/api) and an admin
 * account matching $SMOKE_ADMIN_EMAIL / $SMOKE_ADMIN_PASSWORD.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API = process.env.API_URL || 'http://localhost:4000/api';
const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL || 'admin@countrydairy.in';
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD || 'ChangeMe#2026';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } else {
    failed++;
    failures.push(name);
    console.log(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function section(title) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

async function call(endpoint, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${API}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

const created = { userIds: [], orderIds: [] };

async function run() {
  // ---------------------------------------------------------------- setup
  section('Setup');
  const adminRes = await call('/auth/admin/login', {
    method: 'POST',
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  check('admin can sign in', adminRes.status === 200, `status ${adminRes.status}`);
  if (adminRes.status !== 200) throw new Error('Cannot continue without an admin token');
  const adminToken = adminRes.data.accessToken;

  const products = (await call('/catalog/products')).data;
  check('storefront returns live products', Array.isArray(products) && products.length > 0);

  const withStock = products
    .flatMap((p) => (p.variants || []).map((v) => ({ product: p, variant: v })))
    .filter((x) => x.variant.stockQuantity > 2);
  check('at least one variant has stock to buy', withStock.length > 0);
  if (withStock.length === 0) throw new Error('Seed the catalog first: npm run db:seed');

  const pick = withStock[0];
  const expectedUnitPrice = Number(pick.variant.sellingPrice);

  // ------------------------------------------------------- access control
  section('Access control');
  check(
    'unauthenticated product write rejected',
    (await call('/catalog/products', { method: 'POST', body: { title: 'x' } })).status === 401,
  );
  check(
    'unauthenticated admin orders rejected',
    (await call('/orders/admin/all')).status === 401,
  );
  check(
    'draft enumeration ignored on public listing',
    (await call('/catalog/products?status=DRAFT')).data.every((p) => p.status === 'LIVE'),
  );

  const forged = await (async () => {
    const crypto = require('crypto');
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const h = b64({ alg: 'HS256', typ: 'JWT' });
    const pl = b64({ sub: 'usr-001', role: 'SUPER_ADMIN', iat: Math.floor(Date.now() / 1000) });
    const sig = crypto
      .createHmac('sha256', 'country-dairy-dev-secret-key-12345')
      .update(`${h}.${pl}`)
      .digest('base64url');
    return `${h}.${pl}.${sig}`;
  })();
  check(
    'JWT forged with the old leaked secret rejected',
    (await call('/catalog/admin/products', { token: forged })).status === 401,
  );
  check(
    'login with a wrong password rejected',
    (await call('/auth/admin/login', {
      method: 'POST',
      body: { email: ADMIN_EMAIL, password: 'definitely-wrong' },
    })).status === 401,
  );

  // ------------------------------------------------------------ purchase
  section('Purchase flow');
  const email = `smoke_${Date.now()}@example.com`;
  const reg = await call('/auth/email/register', {
    method: 'POST',
    body: { email, password: 'SmokeTest123', name: 'Smoke Tester' },
  });
  check('customer can register', reg.status === 201, `status ${reg.status}`);
  const custToken = reg.data.accessToken;
  const customer = await prisma.user.findUnique({ where: { email } });
  created.userIds.push(customer.id);

  check(
    'registration creates an AuthIdentity row',
    (await prisma.authIdentity.count({ where: { userId: customer.id, provider: 'EMAIL' } })) === 1,
  );
  check(
    'password is hashed, not stored in the clear',
    !!customer.passwordHash && !customer.passwordHash.includes('SmokeTest123'),
  );

  const add = await call('/cart/add', {
    method: 'POST',
    token: custToken,
    body: { variantId: pick.variant.id, quantity: 2 },
  });
  check('add to cart succeeds', add.status === 201, `status ${add.status}`);

  const cart = (await call('/cart', { token: custToken })).data;
  check('cart prices from the variant, not a default', cart[0]?.unitPrice === expectedUnitPrice,
    `got ${cart[0]?.unitPrice}, expected ${expectedUnitPrice}`);
  check('cart line total = unit x qty', cart[0]?.lineTotal === expectedUnitPrice * 2);

  const overStock = await call('/cart/add', {
    method: 'POST',
    token: custToken,
    body: { variantId: pick.variant.id, quantity: 99999 },
  });
  check('cannot add more than available stock', overStock.status === 400);

  const addrRes = await call('/auth/address', {
    method: 'POST',
    token: custToken,
    body: {
      line1: '1 Smoke Test Road',
      city: 'Noida',
      state: 'Uttar Pradesh',
      postalCode: '201301',
      phone: '9876543210',
    },
  });
  check('address saved', addrRes.status === 201, `status ${addrRes.status}`);
  check('first address becomes the default', addrRes.data.addresses[0].isDefault === true);

  const badAddr = await call('/auth/address', {
    method: 'POST',
    token: custToken,
    body: { line1: 'x', city: 'N', state: 'U', postalCode: '99', phone: '123' },
  });
  check('invalid PIN code rejected', badAddr.status === 400);

  const stockBefore = (await prisma.productVariant.findUnique({ where: { id: pick.variant.id } })).stockQuantity;

  const checkout = await call('/orders/checkout', {
    method: 'POST',
    token: custToken,
    body: { addressId: addrRes.data.addresses[0].id, deliveryType: 'LOCAL' },
  });
  check('checkout succeeds', checkout.status === 201, `status ${checkout.status}`);
  created.orderIds.push(checkout.data.orderId);

  const expectedSubtotal = expectedUnitPrice * 2;
  check(
    `subtotal is real (₹${expectedSubtotal}, not a flat rate)`,
    checkout.data.breakdown.subtotal === expectedSubtotal,
    `got ₹${checkout.data.breakdown.subtotal}`,
  );
  check('order number is human readable', /^CD-\d{4}-\d{5}$/.test(checkout.data.orderNumber),
    checkout.data.orderNumber);

  const stockAfter = (await prisma.productVariant.findUnique({ where: { id: pick.variant.id } })).stockQuantity;
  check('stock decremented by the quantity ordered', stockBefore - stockAfter === 2,
    `${stockBefore} -> ${stockAfter}`);

  check(
    'stock movement recorded in the ledger',
    (await prisma.stockMovement.count({ where: { referenceId: checkout.data.orderId } })) > 0,
  );

  const orderRow = await prisma.order.findUnique({
    where: { id: checkout.data.orderId },
    include: { orderItems: true, statusHistory: true },
  });
  check('order line snapshots the product title', !!orderRow.orderItems[0].productTitle);
  check('order line snapshots the SKU', orderRow.orderItems[0].sku === pick.variant.sku);
  check('shipping address is snapshotted on the order', !!orderRow.shippingAddress?.line1);
  check('status history has an opening entry', orderRow.statusHistory.length > 0);

  const pay = await call('/orders/verify-payment', {
    method: 'POST',
    token: custToken,
    body: { orderId: checkout.data.orderId, razorpayPaymentId: 'pay_smoke', signature: 'sig_mock' },
  });
  check('payment verification succeeds', pay.status === 201, `status ${pay.status}`);
  check('order confirmed and marked paid', pay.data.status === 'CONFIRMED' && pay.data.paymentStatus === 'PAID');

  const replay = await call('/orders/verify-payment', {
    method: 'POST',
    token: custToken,
    body: { orderId: checkout.data.orderId, razorpayPaymentId: 'pay_smoke', signature: 'sig_mock' },
  });
  check('replayed payment is idempotent', replay.status === 201);
  check(
    'no duplicate PAID payment row from the replay',
    (await prisma.payment.count({ where: { orderId: checkout.data.orderId, status: 'PAID' } })) === 1,
  );

  check('cart cleared after payment', (await call('/cart', { token: custToken })).data.length === 0);

  // ------------------------------------------------------- order lifecycle
  section('Order lifecycle (admin)');
  const illegal = await call(`/orders/admin/${checkout.data.orderId}/status`, {
    method: 'PATCH', token: adminToken, body: { status: 'DELIVERED' },
  });
  check('illegal status jump rejected (CONFIRMED -> DELIVERED)', illegal.status === 400);

  const legal = await call(`/orders/admin/${checkout.data.orderId}/status`, {
    method: 'PATCH', token: adminToken, body: { status: 'PROCESSING' },
  });
  check('legal transition accepted (CONFIRMED -> PROCESSING)', legal.status === 200);

  const custSeesAdmin = await call('/orders/admin/all', { token: custToken });
  check('customer cannot read the admin order list', custSeesAdmin.status === 403);

  // -------------------------------------------------------------- reviews
  section('Reviews & moderation');
  const flagsMap = (await call('/cms/feature-flags/map')).data;
  if (flagsMap.ENABLE_PRODUCT_RATINGS) {
    const review = await call(`/products/${pick.product.id}/reviews`, {
      method: 'POST', token: custToken,
      body: { rating: 5, title: 'Smoke test', comment: 'Automated smoke test review.' },
    });
    check('review submitted', review.status === 201, `status ${review.status}`);
    check('new review starts as PENDING', review.data.status === 'PENDING');
    check('verified purchase derived from the paid order', review.data.isVerifiedPurchase === true);

    const beforeMod = (await call(`/products/${pick.product.id}/reviews`)).data;
    const pendingVisible = beforeMod.reviews.some((r) => r.id === review.data.id);
    check('pending review hidden from the storefront', !pendingVisible);

    await call(`/reviews/admin/${review.data.id}/moderate`, {
      method: 'PATCH', token: adminToken, body: { status: 'APPROVED' },
    });
    const afterMod = (await call(`/products/${pick.product.id}/reviews`)).data;
    check('approved review appears on the storefront',
      afterMod.reviews.some((r) => r.id === review.data.id));
    check('average rating recalculated', afterMod.averageRating > 0);

    await prisma.productReview.deleteMany({ where: { userId: customer.id } });
  } else {
    console.log('  \x1b[33m—\x1b[0m ratings flag off, skipping review checks');
  }

  // ------------------------------------------------------------ analytics
  section('Analytics');
  const eventsBefore = await prisma.analyticsEvent.count();
  await call('/analytics/track', {
    method: 'POST',
    body: { eventName: 'whatsapp_order_click', productId: pick.product.id, deviceType: 'mobile' },
  });
  const eventsAfter = await prisma.analyticsEvent.count();
  check('event ingested to the database', eventsAfter === eventsBefore + 1);

  const junk = await call('/analytics/track', { method: 'POST', body: { eventName: 'made_up_event' } });
  check('unknown event dropped without an error', junk.status === 202 && junk.data.recorded === false);
  check('unknown event not written', (await prisma.analyticsEvent.count()) === eventsAfter);

  check('dashboard requires staff auth', (await call('/analytics/dashboard')).status === 401);
  const dash = (await call('/analytics/dashboard?days=7', { token: adminToken })).data;
  check('dashboard returns a 7-point series', dash.revenueByDay.length === 7);
  check('dashboard counts today\'s revenue', dash.revenueByDay.some((d) => d.value > 0));

  await prisma.analyticsEvent.deleteMany({ where: { eventName: 'whatsapp_order_click', productId: pick.product.id } });

  // ------------------------------------------------------------------ CMS
  section('CMS & configuration');
  const wa = (await call('/cms/whatsapp')).data;
  check('WhatsApp config readable without auth', !!wa.phoneNumber);
  check('WhatsApp number is digits only', /^[0-9]+$/.test(wa.phoneNumber), wa.phoneNumber);
  check(
    'WhatsApp write rejects a malformed number',
    (await call('/cms/whatsapp', {
      method: 'PUT', token: adminToken,
      body: { isEnabled: true, phoneNumber: '+91 999-888', messageTemplate: 'a valid length template' },
    })).status === 400,
  );
  check(
    'unauthenticated WhatsApp write rejected',
    (await call('/cms/whatsapp', {
      method: 'PUT',
      body: { isEnabled: true, phoneNumber: '919997801112', messageTemplate: 'a valid length template' },
    })).status === 401,
  );
  check(
    'feature flag toggle requires super admin',
    (await call('/cms/feature-flags/ENABLE_CART/toggle', { method: 'PATCH' })).status === 401,
  );

  // --------------------------------------------------------------- staff
  section('Staff management');
  check('staff list requires super admin', (await call('/users/staff', { token: custToken })).status === 403);
  const staff = (await call('/users/staff', { token: adminToken })).data;
  check('staff directory returns accounts', Array.isArray(staff) && staff.length > 0);

  const self = staff.find((u) => u.email === ADMIN_EMAIL);
  const selfDeactivate = await call(`/users/staff/${self.id}`, {
    method: 'PATCH', token: adminToken, body: { isActive: false },
  });
  check('cannot deactivate your own account', selfDeactivate.status === 403);

  const customers = (await call('/users/customers', { token: adminToken })).data;
  const smokeCustomer = customers.find((c) => c.email === email);
  check('new customer appears in the directory', !!smokeCustomer);
  check('lifetime spend reflects the paid order', smokeCustomer.totalSpent > 0,
    `got ${smokeCustomer?.totalSpent}`);
}

async function cleanup() {
  section('Cleanup');
  try {
    if (created.orderIds.length) {
      await prisma.stockMovement.deleteMany({ where: { referenceId: { in: created.orderIds } } });
      await prisma.orderStatusHistory.deleteMany({ where: { orderId: { in: created.orderIds } } });
      await prisma.payment.deleteMany({ where: { orderId: { in: created.orderIds } } });
      await prisma.orderItem.deleteMany({ where: { orderId: { in: created.orderIds } } });
      await prisma.order.deleteMany({ where: { id: { in: created.orderIds } } });
    }
    if (created.userIds.length) {
      await prisma.productReview.deleteMany({ where: { userId: { in: created.userIds } } });
      await prisma.cartItem.deleteMany({ where: { userId: { in: created.userIds } } });
      await prisma.address.deleteMany({ where: { userId: { in: created.userIds } } });
      await prisma.authIdentity.deleteMany({ where: { userId: { in: created.userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
    }
    console.log('  test data removed');
  } catch (e) {
    console.log(`  \x1b[33mcleanup warning:\x1b[0m ${e.message}`);
  }
}

run()
  .catch((e) => {
    failed++;
    failures.push(`fatal: ${e.message}`);
    console.error(`\n\x1b[31mAborted:\x1b[0m ${e.message}`);
  })
  .then(cleanup)
  .finally(async () => {
    await prisma.$disconnect();
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`\x1b[1m${passed} passed, ${failed} failed\x1b[0m`);
    if (failures.length) {
      console.log('\nFailures:');
      failures.forEach((f) => console.log(`  - ${f}`));
    }
    process.exit(failed > 0 ? 1 : 0);
  });
