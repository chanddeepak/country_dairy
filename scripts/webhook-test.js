/**
 * Razorpay webhook contract test.
 *
 * The webhook is unauthenticated by design — the HMAC over the raw body is the
 * only thing standing between a stranger and the ability to mark any order
 * paid. Most of what follows tests that boundary.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { only } = require('./lib/safe-ids');

const prisma = new PrismaClient();

const API = process.env.TEST_API_URL || 'http://localhost:4000/api';
const WEBHOOK_URL = `${API}/orders/webhook/razorpay`;
const SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

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

function sign(body, secret = SECRET) {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

/** Posts a webhook exactly as Razorpay would: raw JSON plus the signature. */
async function postWebhook(payload, { signature, secret } = {}) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': signature ?? sign(body, secret ?? SECRET),
    },
    body,
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
const made = { orders: [], events: [], users: [] };

/**
 * Fixtures get their own throwaway customer.
 *
 * These used to attach to `findFirst({ role: 'CUSTOMER' })` — the first real
 * customer in the database — so an interrupted run left test orders sitting in
 * a real person's order history.
 */
async function makeTestCustomer() {
  const email = `wh-fixture-${stamp}@countrydairy.test`;
  await fetch(`${API}/auth/email/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'TestPass#2026', name: 'Webhook Fixture' }),
  });
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) made.users.push(user.id);
  return user;
}

function capturedEvent(gatewayOrderId, paymentId, amountRupees) {
  return {
    entity: 'event',
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: paymentId,
          order_id: gatewayOrderId,
          amount: Math.round(amountRupees * 100),
          currency: 'INR',
          status: 'captured',
          method: 'upi',
        },
      },
    },
  };
}

async function makePendingOrder(customerId, variant, suffix, amount = 500) {
  const gatewayOrderId = `order_test_${stamp}_${suffix}`;

  const order = await prisma.order.create({
    data: {
      orderNumber: `TESTWH-${stamp}-${suffix}`,
      userId: customerId,
      shippingAddress: { line1: 'Test', city: 'Tanakpur', state: 'UK', postalCode: '262309' },
      subtotal: amount,
      taxAmount: 0,
      totalAmount: amount,
      status: 'PENDING',
      paymentStatus: 'PENDING',
      deliveryType: 'LOCAL',
      orderItems: {
        create: {
          variantId: variant.id,
          productId: variant.productId,
          productTitle: 'Test Product',
          variantSizeLabel: variant.sizeLabel,
          sku: `${variant.sku}-w${suffix}`,
          quantity: 1,
          unitPrice: amount,
          mrpPrice: amount,
          gstRate: 0,
          taxAmount: 0,
          lineTotal: amount,
        },
      },
      payments: {
        create: {
          amount,
          provider: 'RAZORPAY',
          status: 'PENDING',
          gatewayOrderId,
        },
      },
    },
  });

  made.orders.push(order.id);
  return { order, gatewayOrderId };
}

(async () => {
  console.log('\n\x1b[1mRAZORPAY WEBHOOKS\x1b[0m\n');

  if (!SECRET) {
    console.log(
      '  \x1b[33m!\x1b[0m RAZORPAY_WEBHOOK_SECRET is not set — testing rejection only.\n',
    );
    const rejected = await postWebhook(capturedEvent('order_x', 'pay_x', 100), {
      signature: 'anything',
    });
    ok('without a configured secret every webhook is rejected', rejected.status === 400, `status ${rejected.status}`);
    return;
  }

  const variant = await prisma.productVariant.findFirst();
  const customer = await makeTestCustomer();
  ok('fixtures available', !!variant && !!customer);
  if (!variant || !customer) throw new Error('need a variant and a customer');

  // --- Signature is the authentication ---
  console.log('\n  Signature is the only authentication');
  const { order: probeOrder, gatewayOrderId: probeGw } = await makePendingOrder(
    customer.id,
    variant,
    'probe',
  );

  const forged = await postWebhook(capturedEvent(probeGw, `pay_forged_${stamp}`, 500), {
    signature: 'deadbeef',
  });
  ok('a forged signature is rejected', forged.status === 400, `status ${forged.status}`);

  const wrongSecret = await postWebhook(capturedEvent(probeGw, `pay_ws_${stamp}`, 500), {
    secret: 'not-the-real-secret',
  });
  ok('a signature from the wrong secret is rejected', wrongSecret.status === 400, `status ${wrongSecret.status}`);

  const noSignature = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(capturedEvent(probeGw, `pay_ns_${stamp}`, 500)),
  });
  ok('a missing signature is rejected', noSignature.status === 400, `status ${noSignature.status}`);

  const stillPending = await prisma.order.findUnique({ where: { id: probeOrder.id } });
  ok('none of those touched the order', stillPending.paymentStatus === 'PENDING');

  // Tamper: sign one body, send a different one.
  const honest = JSON.stringify(capturedEvent(probeGw, `pay_t_${stamp}`, 1));
  const tampered = JSON.stringify(capturedEvent(probeGw, `pay_t_${stamp}`, 500));
  const tamperRes = await postWebhook(tampered, { signature: sign(honest) });
  ok('a body altered after signing is rejected', tamperRes.status === 400, `status ${tamperRes.status}`);

  // --- Capture confirms the order ---
  console.log('\n  Capture confirms the order');
  const { order, gatewayOrderId } = await makePendingOrder(customer.id, variant, '1');
  const stockBefore = (await prisma.productVariant.findUnique({ where: { id: variant.id } }))
    .stockQuantity;

  const paymentId = `pay_test_${stamp}_1`;
  const captured = await postWebhook(capturedEvent(gatewayOrderId, paymentId, 500));
  ok('valid webhook accepted', captured.ok, `status ${captured.status} ${JSON.stringify(captured.data)}`);
  ok('reported as handled', captured.data?.handled === true);

  const confirmed = await prisma.order.findUnique({ where: { id: order.id } });
  ok('order marked PAID', confirmed.paymentStatus === 'PAID', confirmed.paymentStatus);
  ok('order marked CONFIRMED', confirmed.status === 'CONFIRMED', confirmed.status);
  ok('confirmedAt stamped', !!confirmed.confirmedAt);

  const stockAfter = (await prisma.productVariant.findUnique({ where: { id: variant.id } }))
    .stockQuantity;
  ok(
    'stock NOT decremented again — checkout already took it',
    stockAfter === stockBefore,
    `${stockBefore} → ${stockAfter}`,
  );

  const payment = await prisma.payment.findUnique({ where: { gatewayPaymentId: paymentId } });
  ok('payment row recorded', !!payment && payment.status === 'PAID');

  // --- Idempotency ---
  console.log('\n  Idempotency');
  const replay = await postWebhook(capturedEvent(gatewayOrderId, paymentId, 500));
  ok('a replayed webhook is accepted, not errored', replay.ok, `status ${replay.status}`);
  ok('and reported as a duplicate', replay.data?.duplicate === true, JSON.stringify(replay.data));

  const afterReplay = (await prisma.productVariant.findUnique({ where: { id: variant.id } }))
    .stockQuantity;
  ok('the replay changed no stock', afterReplay === stockBefore, `${stockBefore} → ${afterReplay}`);

  const paymentCount = await prisma.payment.count({ where: { orderId: order.id } });
  ok('no second payment row created', paymentCount === 1, `${paymentCount} rows`);

  // --- Amount mismatch ---
  console.log('\n  Amount mismatch');
  const { order: cheapOrder, gatewayOrderId: cheapGw } = await makePendingOrder(
    customer.id,
    variant,
    'underpaid',
    500,
  );

  const underpaid = await postWebhook(
    capturedEvent(cheapGw, `pay_under_${stamp}`, 1), // paid ₹1 for a ₹500 order
  );
  ok('an underpayment is refused', !underpaid.ok, `status ${underpaid.status}`);

  const notSettled = await prisma.order.findUnique({ where: { id: cheapOrder.id } });
  ok('the underpaid order stays unpaid', notSettled.paymentStatus === 'PENDING', notSettled.paymentStatus);

  const failedEvent = await prisma.webhookEvent.findFirst({
    where: { eventId: { contains: `pay_under_${stamp}` } },
  });
  ok('the failure is stored for retry, not swallowed', !!failedEvent && failedEvent.processedAt === null);
  ok('with the reason recorded', !!failedEvent?.error && /mismatch/i.test(failedEvent.error), failedEvent?.error);

  // --- Failed payment ---
  console.log('\n  Failed payment');
  const { order: failOrder, gatewayOrderId: failGw } = await makePendingOrder(
    customer.id,
    variant,
    'fail',
  );

  const failPaymentId = `pay_fail_${stamp}`;
  const failedRes = await postWebhook({
    event: 'payment.failed',
    payload: {
      payment: {
        entity: {
          id: failPaymentId,
          order_id: failGw,
          amount: 50000,
          status: 'failed',
          error_description: 'Insufficient funds',
        },
      },
    },
  });
  ok('failure webhook accepted', failedRes.ok, `status ${failedRes.status}`);

  const failedOrder = await prisma.order.findUnique({ where: { id: failOrder.id } });
  ok('order marked payment FAILED', failedOrder.paymentStatus === 'FAILED', failedOrder.paymentStatus);
  ok('order not confirmed', failedOrder.status === 'PENDING', failedOrder.status);

  const failedPayment = await prisma.payment.findUnique({
    where: { gatewayPaymentId: failPaymentId },
  });
  ok('failure reason stored', failedPayment?.failureReason === 'Insufficient funds');

  // A late failure notice must not undo a captured payment.
  const lateFailure = await postWebhook({
    event: 'payment.failed',
    payload: {
      payment: {
        entity: { id: `${paymentId}-late`, order_id: gatewayOrderId, amount: 50000, status: 'failed' },
      },
    },
  });
  ok('a late failure notice is accepted', lateFailure.ok);

  const stillPaid = await prisma.order.findUnique({ where: { id: order.id } });
  ok('but does not un-pay a captured order', stillPaid.paymentStatus === 'PAID', stillPaid.paymentStatus);

  // --- Refund ---
  console.log('\n  Refund');
  const refunded = await postWebhook({
    event: 'refund.processed',
    payload: {
      refund: {
        entity: { id: `rfnd_${stamp}`, payment_id: paymentId, amount: 50000, status: 'processed' },
      },
    },
  });
  ok('refund webhook accepted', refunded.ok, `status ${refunded.status}`);

  const refundedOrder = await prisma.order.findUnique({ where: { id: order.id } });
  ok('order marked REFUNDED', refundedOrder.paymentStatus === 'REFUNDED', refundedOrder.paymentStatus);

  const refundedPayment = await prisma.payment.findUnique({
    where: { gatewayPaymentId: paymentId },
  });
  ok('refunded amount recorded', Number(refundedPayment.refundedAmount) === 500, String(refundedPayment.refundedAmount));

  // --- Unknown events ---
  console.log('\n  Unknown and unmatched events');
  const unknown = await postWebhook({
    event: 'subscription.charged',
    payload: { payment: { entity: { id: `pay_unk_${stamp}`, order_id: 'order_none', amount: 100 } } },
  });
  ok('an unhandled event type is acknowledged, not errored', unknown.ok, `status ${unknown.status}`);
  ok('and reported as unhandled', unknown.data?.handled === false, JSON.stringify(unknown.data));

  const orphan = await postWebhook(
    capturedEvent(`order_nonexistent_${stamp}`, `pay_orphan_${stamp}`, 500),
  );
  ok('a payment matching no order is acknowledged', orphan.ok, `status ${orphan.status}`);

  const malformed = await postWebhook('{not json');
  ok('a malformed body is rejected', malformed.status === 400, `status ${malformed.status}`);
})()
  .catch((err) => {
    fail++;
    console.error('\n\x1b[31mFATAL\x1b[0m', err.message);
  })
  .finally(async () => {
    // Sweep by prefix as well as by id: a run that dies before pushing an id
    // must not leave anything behind either.
    const strays = await prisma.order.findMany({
      where: { orderNumber: { startsWith: `TESTWH-${stamp}` } },
      select: { id: true },
    });
    const orderIds = [...new Set([...made.orders, ...strays.map((o) => o.id)])];

    await prisma.webhookEvent.deleteMany({ where: { eventId: { contains: String(stamp) } } });
    await prisma.orderStatusHistory.deleteMany({ where: { orderId: { in: only(orderIds, 'orderIds') } } });
    await prisma.payment.deleteMany({ where: { orderId: { in: only(orderIds, 'orderIds') } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: only(orderIds, 'orderIds') } } });
    await prisma.order.deleteMany({ where: { id: { in: only(orderIds, 'orderIds') } } });
    await prisma.cartItem.deleteMany({ where: { userId: { in: only(made.users, 'made.users') } } });
    await prisma.authIdentity.deleteMany({ where: { userId: { in: only(made.users, 'made.users') } } });
    await prisma.user.deleteMany({ where: { id: { in: only(made.users, 'made.users') } } });
    await prisma.$disconnect();

    const colour = fail ? '\x1b[31m' : '\x1b[32m';
    console.log(`\n${colour}\x1b[1m${pass} passed, ${fail} failed\x1b[0m\n`);
    process.exit(fail ? 1 : 0);
  });
