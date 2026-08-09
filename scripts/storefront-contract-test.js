#!/usr/bin/env node
/**
 * Storefront contract test.
 *
 *   npm run test:contract
 *
 * Replays exactly what apps/web sends to the API, so a change on either side
 * that breaks the other is caught here rather than in a browser. Each check
 * that asserts a "legacy payload is rejected" documents a real break found
 * during the variant migration.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API = 'http://localhost:4000/api';
let pass = 0, fail = 0;
const ok = (n, c, d = '') => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n} ${d}`)); };

async function call(p, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${API}${p}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const t = await res.text();
  return { status: res.status, ok: res.ok, data: t ? JSON.parse(t) : null };
}

async function main() {
  const email = `webflow_${Date.now()}@example.com`;

  console.log('AppContext.registerWithEmail');
  const reg = await call('/auth/email/register', {
    method: 'POST',
    body: { email, password: 'WebFlow123', name: 'Web Flow' },
  });
  // The client checks res.ok && data.accessToken — it used to check data.success,
  // which the API no longer returns.
  ok('register returns accessToken the client can read', reg.ok && !!reg.data.accessToken);
  const token = reg.data.accessToken;
  const user = await prisma.user.findUnique({ where: { email } });

  console.log('\nAppContext.loginWithEmail');
  const login = await call('/auth/email/login', { method: 'POST', body: { email, password: 'WebFlow123' } });
  ok('login returns accessToken', login.ok && !!login.data.accessToken);

  console.log('\nAppContext.addToCart (variant based)');
  const products = (await call('/catalog/products')).data;
  const p = products.find((x) => (x.variants || []).some((v) => v.stockQuantity > 1));
  const variant = p.variants.find((v) => v.stockQuantity > 1);

  const add = await call('/cart/add', { method: 'POST', token, body: { variantId: variant.id, quantity: 1 } });
  ok('cart/add accepts { variantId, quantity }', add.ok, `status ${add.status}`);

  const legacy = await call('/cart/add', { method: 'POST', token, body: { productId: p.id, quantity: 1 } });
  ok('legacy { productId } payload is rejected', legacy.status === 400);

  const cart = (await call('/cart', { token })).data;
  ok('cart line carries variant + real price', cart[0].variant?.id === variant.id && cart[0].unitPrice === Number(variant.sellingPrice));

  console.log('\nAppContext.addAddress');
  const addr = await call('/auth/address', {
    method: 'POST', token,
    // The client sends postalCode now; it previously sent `pincode`, which
    // fails validation outright since unknown properties are rejected.
    body: { line1: 'Flat 402, Oakwood', city: 'Noida', state: 'Uttar Pradesh', postalCode: '201301', phone: '9876543210' },
  });
  ok('address accepted with postalCode', addr.ok, `status ${addr.status}`);

  const legacyAddr = await call('/auth/address', {
    method: 'POST', token,
    body: { line1: 'x road', city: 'Noida', state: 'UP', pincode: '201301', phone: '9876543210' },
  });
  ok('legacy { pincode } payload is rejected', legacyAddr.status === 400);

  console.log('\nCheckout page');
  const co = await call('/orders/checkout', {
    method: 'POST', token,
    body: { addressId: addr.data.addresses[0].id, deliveryType: 'LOCAL' },
  });
  ok('checkout succeeds', co.ok, `status ${co.status}`);
  ok('server returns the authoritative breakdown', typeof co.data.breakdown?.totalAmount === 'number');

  const clientTotal = Number(variant.sellingPrice) * 1;
  ok(
    `server total matches the price the customer saw (₹${clientTotal} + delivery)`,
    co.data.breakdown.subtotal === clientTotal,
    `server ₹${co.data.breakdown.subtotal}`,
  );

  const pay = await call('/orders/verify-payment', {
    method: 'POST', token,
    body: { orderId: co.data.orderId, razorpayPaymentId: `pay_mock_${Date.now()}`, signature: 'sig' },
  });
  ok('mock payment verification succeeds', pay.ok, `status ${pay.status}`);

  console.log('\nOrder tracking page');
  const order = (await call(`/orders/${co.data.orderId}`, { token })).data;
  ok('order detail readable by its owner', !!order.orderNumber);
  ok('shippingAddress snapshot present (page reads this, not address.street)', !!order.shippingAddress?.line1);
  ok('order items carry display fields', !!order.orderItems[0].productTitle);

  const other = await call('/auth/email/register', {
    method: 'POST', body: { email: `intruder_${Date.now()}@example.com`, password: 'Intruder123', name: 'Intruder' },
  });
  const peek = await call(`/orders/${co.data.orderId}`, { token: other.data.accessToken });
  ok('another customer cannot read this order', peek.status === 404);

  console.log('\nAccount page');
  const orders = (await call('/orders', { token })).data;
  ok('account page lists the order', orders.length === 1 && orders[0].orderNumber === order.orderNumber);

  console.log('\nStorefront config');
  const wa = (await call('/cms/whatsapp')).data;
  ok('WhatsApp config public', !!wa.phoneNumber);
  const flags = (await call('/cms/feature-flags/map')).data;
  ok('feature flags public', typeof flags.ENABLE_CART === 'boolean');

  // Cleanup
  const intruder = await prisma.user.findFirst({ where: { email: { startsWith: 'intruder_' } } });
  const ids = [user.id, intruder?.id].filter(Boolean);
  const orderIds = (await prisma.order.findMany({ where: { userId: { in: ids } }, select: { id: true } })).map((o) => o.id);
  await prisma.stockMovement.deleteMany({ where: { referenceId: { in: orderIds } } });
  await prisma.orderStatusHistory.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.cartItem.deleteMany({ where: { userId: { in: ids } } });
  await prisma.address.deleteMany({ where: { userId: { in: ids } } });
  await prisma.authIdentity.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.productVariant.update({ where: { id: variant.id }, data: { stockQuantity: variant.stockQuantity } });
  console.log('\n  cleaned up');
}

main()
  .catch((e) => { fail++; console.error('FATAL', e.message); })
  .finally(async () => {
    await prisma.$disconnect();
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  });
