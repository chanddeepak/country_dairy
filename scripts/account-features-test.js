/**
 * Reorder, erasure, consent and invoicing.
 *
 * The two that carry real risk: erasure must remove the person while keeping
 * the invoice (tax law requires one, the DPDP Act the other), and the invoice
 * series must be gap-free per financial year with the right CGST/SGST vs IGST
 * split for the place of supply.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');
const { only } = require('./lib/safe-ids');
const prisma = new PrismaClient();

const API = process.env.TEST_API_URL || 'http://localhost:4000/api';
const PASSWORD = 'TestPass#2026';

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
const made = { users: [], orders: [] };

async function makeCustomer(suffix) {
  const email = `acct-${suffix}-${stamp}@countrydairy.test`;
  const reg = await call('/auth/email/register', {
    method: 'POST',
    body: { email, password: PASSWORD, name: `Acct Tester ${suffix}` },
  });
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) made.users.push(user.id);
  return { token: reg.data?.accessToken, id: user?.id, email };
}

/** A paid order, so invoices and reorders have something real to work on. */
async function makePaidOrder(userId, variant, suffix, state = 'Uttarakhand') {
  const unit = Number(variant.sellingPrice);
  const gstRate = 12;
  const lineTotal = unit * 2;
  const taxAmount = Number((lineTotal - lineTotal / (1 + gstRate / 100)).toFixed(2));

  const order = await prisma.order.create({
    data: {
      orderNumber: `ACCT-${stamp}-${suffix}`,
      userId,
      shippingAddress: {
        line1: '12 Test Lane',
        line2: 'Near the temple',
        city: 'Tanakpur',
        state,
        postalCode: '262309',
        country: 'India',
        phone: '9876543210',
      },
      subtotal: lineTotal,
      taxAmount,
      deliveryCharges: 0,
      totalAmount: lineTotal,
      status: 'DELIVERED',
      paymentStatus: 'PAID',
      deliveryType: 'LOCAL',
      orderItems: {
        create: {
          variantId: variant.id,
          productId: variant.productId,
          productTitle: variant.product?.title ?? 'Test Product',
          variantSizeLabel: variant.sizeLabel,
          sku: `${variant.sku}-a${suffix}`,
          hsnCode: '0405',
          quantity: 2,
          unitPrice: unit,
          mrpPrice: unit,
          gstRate,
          taxAmount,
          lineTotal,
        },
      },
    },
  });
  made.orders.push(order.id);
  return order;
}

(async () => {
  console.log('\n\x1b[1mACCOUNT FEATURES\x1b[0m\n');

  const variant = await prisma.productVariant.findFirst({
    where: { stockQuantity: { gt: 5 }, isActive: true },
    include: { product: true },
  });
  ok('a stocked variant exists to work with', !!variant);
  if (!variant) throw new Error('need a stocked variant');

  const alice = await makeCustomer('a');
  ok('customer registered', !!alice.token);

  // ── REORDER ────────────────────────────────────────────────────
  console.log('\n  Reorder');
  const order = await makePaidOrder(alice.id, variant, '1');

  const reordered = await call(`/orders/${order.id}/reorder`, {
    method: 'POST',
    token: alice.token,
  });
  ok('reorder accepted', reordered.ok, `status ${reordered.status}`);
  ok('it reports what it added', reordered.data?.addedCount === 1, JSON.stringify(reordered.data?.addedCount));

  const cart = await prisma.cartItem.findMany({ where: { userId: alice.id } });
  ok('the cart holds the line', cart.length === 1);
  ok('with the original quantity', cart[0]?.quantity === 2, String(cart[0]?.quantity));

  // Reordering twice must add to the line, not replace or duplicate it.
  await call(`/orders/${order.id}/reorder`, { method: 'POST', token: alice.token });
  const cartAgain = await prisma.cartItem.findMany({ where: { userId: alice.id } });
  ok('reordering again does not duplicate the row', cartAgain.length === 1);
  ok('it adds to the quantity', cartAgain[0]?.quantity === 4, String(cartAgain[0]?.quantity));

  const otherPerson = await makeCustomer('b');
  const theft = await call(`/orders/${order.id}/reorder`, {
    method: 'POST',
    token: otherPerson.token,
  });
  ok("cannot reorder someone else's order", theft.status === 404, `status ${theft.status}`);

  // A sold-out variant must be reported, not silently dropped.
  await prisma.cartItem.deleteMany({ where: { userId: alice.id } });
  const originalStock = variant.stockQuantity;
  await prisma.productVariant.update({ where: { id: variant.id }, data: { stockQuantity: 0 } });

  const soldOut = await call(`/orders/${order.id}/reorder`, {
    method: 'POST',
    token: alice.token,
  });
  ok('a sold-out line is reported as unavailable', soldOut.data?.unavailable?.length === 1);
  ok('and nothing was added', soldOut.data?.addedCount === 0);
  ok(
    'the reason is given',
    /sold out/i.test(soldOut.data?.unavailable?.[0]?.reason ?? ''),
    soldOut.data?.unavailable?.[0]?.reason,
  );

  // Partial stock: take what there is and say so.
  await prisma.productVariant.update({ where: { id: variant.id }, data: { stockQuantity: 1 } });
  const partial = await call(`/orders/${order.id}/reorder`, {
    method: 'POST',
    token: alice.token,
  });
  ok('a short line is added at the available quantity', partial.data?.adjusted?.length === 1);
  ok('it says how many were wanted and added', partial.data?.adjusted?.[0]?.added === 1);

  // Price change is surfaced rather than hidden.
  await prisma.cartItem.deleteMany({ where: { userId: alice.id } });
  await prisma.productVariant.update({
    where: { id: variant.id },
    data: { stockQuantity: originalStock, sellingPrice: Number(variant.sellingPrice) + 50 },
  });
  const repriced = await call(`/orders/${order.id}/reorder`, {
    method: 'POST',
    token: alice.token,
  });
  ok('a price change since the order is reported', repriced.data?.repriced?.length === 1);
  await prisma.productVariant.update({
    where: { id: variant.id },
    data: { sellingPrice: variant.sellingPrice },
  });

  // ── CONSENT ────────────────────────────────────────────────────
  console.log('\n  Communication preferences');
  const me = await call('/auth/me', { token: alice.token });
  ok('a new account is opted in by default', me.data?.emailOptIn === true);

  const optOut = await call('/auth/profile', {
    method: 'PATCH',
    token: alice.token,
    body: { whatsappOptIn: false, smsOptIn: false },
  });
  ok('preferences saved', optOut.ok, `status ${optOut.status}`);
  ok('whatsapp off', optOut.data?.user?.whatsappOptIn === false);
  ok('sms off', optOut.data?.user?.smsOptIn === false);
  ok('email untouched by a partial update', optOut.data?.user?.emailOptIn === true);

  const persisted = await prisma.user.findUnique({ where: { id: alice.id } });
  ok('and it is in the database, not just the response', persisted.whatsappOptIn === false);

  // ── INVOICE ────────────────────────────────────────────────────
  console.log('\n  Tax invoice');
  const invoice = await call(`/orders/${order.id}/invoice`, { token: alice.token });
  ok('invoice returned', invoice.ok, `status ${invoice.status}`);
  ok('it has a number', !!invoice.data?.invoiceNumber, invoice.data?.invoiceNumber);
  ok(
    'the number carries the financial year',
    /\/\d{4}-\d{2}\//.test(invoice.data?.invoiceNumber ?? ''),
    invoice.data?.invoiceNumber,
  );

  const stored = await prisma.order.findUnique({ where: { id: order.id } });
  ok('the number is persisted on the order', stored.invoiceNumber === invoice.data.invoiceNumber);
  ok('with an invoice date', !!stored.invoicedAt);

  const again = await call(`/orders/${order.id}/invoice`, { token: alice.token });
  ok(
    'asking twice does not burn a second number',
    again.data?.invoiceNumber === invoice.data.invoiceNumber,
    `${invoice.data.invoiceNumber} vs ${again.data?.invoiceNumber}`,
  );

  ok('line items carry an HSN code', invoice.data?.lines?.[0]?.hsnCode === '0405');
  ok('taxable value excludes the tax', invoice.data?.lines?.[0]?.taxableValue < invoice.data?.lines?.[0]?.total);

  // Same state as the seller splits the tax; a different one does not.
  ok('an Uttarakhand delivery is taxed CGST + SGST', invoice.data?.taxKind === 'CGST_SGST');
  ok('CGST and SGST are equal halves', invoice.data?.lines?.[0]?.cgst === invoice.data?.lines?.[0]?.sgst);
  ok('and no IGST is charged', invoice.data?.lines?.[0]?.igst === 0);

  const outOfState = await makePaidOrder(alice.id, variant, '2', 'Karnataka');
  const igstInvoice = await call(`/orders/${outOfState.id}/invoice`, { token: alice.token });
  ok('a Karnataka delivery is taxed IGST', igstInvoice.data?.taxKind === 'IGST');
  ok('IGST carries the whole tax', igstInvoice.data?.lines?.[0]?.igst > 0);
  ok('and CGST is zero', igstInvoice.data?.lines?.[0]?.cgst === 0);

  ok(
    'the series is consecutive',
    Number(igstInvoice.data.invoiceNumber.split('/').pop()) ===
      Number(invoice.data.invoiceNumber.split('/').pop()) + 1,
    `${invoice.data.invoiceNumber} then ${igstInvoice.data.invoiceNumber}`,
  );

  const theirInvoice = await call(`/orders/${order.id}/invoice`, { token: otherPerson.token });
  ok("cannot read someone else's invoice", theirInvoice.status === 404, `status ${theirInvoice.status}`);

  const unpaid = await prisma.order.create({
    data: {
      orderNumber: `ACCT-${stamp}-unpaid`,
      userId: alice.id,
      shippingAddress: { line1: 'x', city: 'Tanakpur', state: 'Uttarakhand', postalCode: '262309' },
      subtotal: 100,
      taxAmount: 0,
      totalAmount: 100,
      status: 'PENDING',
      paymentStatus: 'PENDING',
      deliveryType: 'LOCAL',
    },
  });
  made.orders.push(unpaid.id);

  const noInvoice = await call(`/orders/${unpaid.id}/invoice`, { token: alice.token });
  ok('an unpaid order has no invoice yet', noInvoice.status === 400, `status ${noInvoice.status}`);
  const unpaidRow = await prisma.order.findUnique({ where: { id: unpaid.id } });
  ok('and it did not consume a number from the series', unpaidRow.invoiceNumber === null);

  // ── ERASURE ────────────────────────────────────────────────────
  console.log('\n  Closing an account');
  const wrongPassword = await call('/auth/close-account', {
    method: 'POST',
    token: alice.token,
    body: { password: 'NotMyPassword#9' },
  });
  ok('the wrong password will not close it', wrongPassword.status === 401, `status ${wrongPassword.status}`);

  const reviewMedia = ['/review-media/erasure-probe.webp'];
  await prisma.productReview.create({
    data: {
      userId: alice.id,
      productId: variant.productId,
      rating: 5,
      comment: 'Should not survive erasure.',
      mediaUrls: reviewMedia,
      mediaTypes: ['IMAGE'],
      status: 'APPROVED',
    },
  });

  const closed = await call('/auth/close-account', {
    method: 'POST',
    token: alice.token,
    body: { password: PASSWORD, reason: 'testing' },
  });
  ok('account closed', closed.ok, `status ${closed.status}`);
  ok('it says how many orders were kept', closed.data?.ordersRetained >= 2);

  const erased = await prisma.user.findUnique({ where: { id: alice.id } });
  ok('the row survives so orders still resolve', !!erased);
  ok('the name is gone', erased.name === 'Closed account');
  ok('the email is gone', erased.email === null);
  ok('the phone is gone', erased.phone === null);
  ok('the password is gone', erased.passwordHash === null);
  ok('it is marked closed', !!erased.deletedAt);
  ok('and deactivated', erased.isActive === false);
  ok('consent is withdrawn on every channel', !erased.emailOptIn && !erased.smsOptIn && !erased.whatsappOptIn);

  const leftovers = await Promise.all([
    prisma.address.count({ where: { userId: alice.id } }),
    prisma.cartItem.count({ where: { userId: alice.id } }),
    prisma.productReview.count({ where: { userId: alice.id } }),
    prisma.authIdentity.count({ where: { userId: alice.id } }),
  ]);
  ok('addresses removed', leftovers[0] === 0);
  ok('cart removed', leftovers[1] === 0);
  ok('reviews removed', leftovers[2] === 0);
  ok('sign-in identities removed', leftovers[3] === 0);

  const keptOrders = await prisma.order.findMany({ where: { userId: alice.id } });
  ok('orders are kept for the tax record', keptOrders.length >= 2);
  ok('with their money intact', keptOrders.every((o) => Number(o.totalAmount) > 0));
  ok(
    'the street address is redacted',
    keptOrders.every((o) => o.shippingAddress.line1 === '[erased at customer request]'),
  );
  ok(
    'but the state survives, because it decides the tax treatment',
    keptOrders.some((o) => !!o.shippingAddress.state),
  );
  ok('and the phone number is gone', keptOrders.every((o) => !o.shippingAddress.phone));

  const deadToken = await call('/auth/me', { token: alice.token });
  ok('the old token stops working', deadToken.status === 401, `status ${deadToken.status}`);

  const reused = await call('/auth/email/register', {
    method: 'POST',
    body: { email: alice.email, password: PASSWORD, name: 'Returning Customer' },
  });
  ok('the address can be used to sign up again', reused.ok, `status ${reused.status}`);
  const returning = await prisma.user.findUnique({ where: { email: alice.email } });
  if (returning) made.users.push(returning.id);
  ok('which creates a genuinely new account', returning?.id !== alice.id);
})()
  .catch((err) => {
    fail++;
    console.error('\n\x1b[31mFATAL\x1b[0m', err.message);
  })
  .finally(async () => {
    await prisma.orderStatusHistory.deleteMany({ where: { orderId: { in: only(made.orders, 'made.orders') } } });
    await prisma.payment.deleteMany({ where: { orderId: { in: only(made.orders, 'made.orders') } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: only(made.orders, 'made.orders') } } });
    await prisma.order.deleteMany({ where: { id: { in: only(made.orders, 'made.orders') } } });
    await prisma.productReview.deleteMany({ where: { userId: { in: only(made.users, 'made.users') } } });
    await prisma.address.deleteMany({ where: { userId: { in: only(made.users, 'made.users') } } });
    await prisma.cartItem.deleteMany({ where: { userId: { in: only(made.users, 'made.users') } } });
    await prisma.authIdentity.deleteMany({ where: { userId: { in: only(made.users, 'made.users') } } });
    await prisma.user.deleteMany({ where: { id: { in: only(made.users, 'made.users') } } });
    await prisma.$disconnect();

    const colour = fail ? '\x1b[31m' : '\x1b[32m';
    console.log(`\n${colour}\x1b[1m${pass} passed, ${fail} failed\x1b[0m\n`);
    process.exit(fail ? 1 : 0);
  });
