import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RazorpayService, type GatewayPayment } from './razorpay.service';
import { CashfreeService } from './cashfree.service';

/** Events we act on. Anything else is stored and acknowledged. */
const HANDLED_EVENTS = [
  'payment.captured',
  'payment.authorized',
  'payment.failed',
  'refund.processed',
] as const;

/**
 * The Cashfree events we act on.
 *
 * Refunds are absent on purpose. Their refund payload is a different shape and
 * reports rupees, while `onRefund` reads Razorpay's paise and divides by a
 * hundred. Pointing one at the other would refund a hundredth of the right
 * amount, silently. Refunds are C12; until then those events are stored and
 * acknowledged rather than mishandled.
 */
const CASHFREE_HANDLED = [
  'PAYMENT_SUCCESS_WEBHOOK',
  'PAYMENT_FAILED_WEBHOOK',
  'PAYMENT_USER_DROPPED_WEBHOOK',
] as const;

export interface WebhookResult {
  received: true;
  handled: boolean;
  duplicate: boolean;
  event: string;
}

/**
 * Razorpay webhooks: the safety net behind the browser callback.
 *
 * The callback runs in the customer's browser, so it is lost whenever they
 * close the tab, lose signal, or the redirect fails — the money is taken and
 * the order sits PENDING. The webhook is server-to-server and retried until it
 * succeeds, so it is what actually guarantees a paid order gets confirmed.
 */
@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpay: RazorpayService,
    private readonly cashfree: CashfreeService,
  ) {}

  async handleRazorpay(rawBody: Buffer | string, signature: string): Promise<WebhookResult> {
    if (!this.razorpay.verifyWebhookSignature(rawBody, signature)) {
      // Deliberately vague: a caller probing for a valid signature learns
      // nothing about whether the secret is configured.
      this.logger.warn('Rejected a webhook with an invalid signature');
      throw new BadRequestException('Invalid signature');
    }

    let event: {
      event?: string;
      payload?: { payment?: { entity?: Record<string, unknown> }; refund?: { entity?: Record<string, unknown> } };
      id?: string;
    };

    try {
      event = JSON.parse(rawBody.toString('utf8' as BufferEncoding));
    } catch {
      throw new BadRequestException('Malformed webhook body');
    }

    const eventType = event.event ?? 'unknown';
    // Razorpay puts its delivery id in a header, but the payment id is stable
    // across retries of the same event and is present in the body.
    const paymentEntity = event.payload?.payment?.entity;
    const eventId =
      event.id ??
      `${eventType}:${(paymentEntity?.id as string) ?? ''}:${(event.payload?.refund?.entity?.id as string) ?? ''}`;

    // Idempotency. Razorpay retries until it gets a 2xx and the retry carries
    // the same event, so without this a redelivered payment.captured would
    // confirm and decrement stock a second time.
    const existing = await this.prisma.webhookEvent.findUnique({
      where: { provider_eventId: { provider: 'RAZORPAY', eventId } },
      select: { id: true, processedAt: true },
    });

    if (existing?.processedAt) {
      this.logger.log(`Ignoring duplicate webhook ${eventType} (${eventId})`);
      return { received: true, handled: true, duplicate: true, event: eventType };
    }

    const record = existing
      ? await this.prisma.webhookEvent.update({
          where: { id: existing.id },
          data: { payload: event as unknown as Prisma.InputJsonValue, error: null },
        })
      : await this.prisma.webhookEvent.create({
          data: {
            provider: 'RAZORPAY',
            eventId,
            eventType,
            payload: event as unknown as Prisma.InputJsonValue,
          },
        });

    if (!HANDLED_EVENTS.includes(eventType as (typeof HANDLED_EVENTS)[number])) {
      await this.prisma.webhookEvent.update({
        where: { id: record.id },
        data: { processedAt: new Date() },
      });
      return { received: true, handled: false, duplicate: false, event: eventType };
    }

    try {
      const orderId = await this.dispatch(eventType, event);

      await this.prisma.webhookEvent.update({
        where: { id: record.id },
        data: { processedAt: new Date(), orderId },
      });

      return { received: true, handled: true, duplicate: false, event: eventType };
    } catch (err) {
      // processedAt stays null so a retry is allowed to try again. The error is
      // rethrown so Razorpay sees a non-2xx and does retry.
      await this.prisma.webhookEvent.update({
        where: { id: record.id },
        data: { error: (err as Error).message },
      });
      this.logger.error(`Webhook ${eventType} failed: ${(err as Error).message}`);
      throw err;
    }
  }

  /**
   * Cashfree webhooks. Same job as the Razorpay one, different envelope.
   *
   * Their signature covers `timestamp + rawBody` rather than the body alone,
   * so the timestamp header is as load-bearing as the signature and a missing
   * one is a rejection, not a default.
   */
  async handleCashfree(
    rawBody: Buffer | string,
    signature: string,
    timestamp: string,
  ): Promise<WebhookResult> {
    if (!this.cashfree.verifyWebhookSignature(rawBody, signature, timestamp)) {
      // Vague on purpose: a caller probing for a valid signature learns nothing
      // about whether the secret is configured.
      this.logger.warn('Rejected a Cashfree webhook with an invalid signature');
      throw new BadRequestException('Invalid signature');
    }

    let event: {
      type?: string;
      data?: {
        order?: { order_id?: string };
        payment?: Record<string, unknown>;
      };
    };

    try {
      event = JSON.parse(rawBody.toString('utf8' as BufferEncoding));
    } catch {
      throw new BadRequestException('Malformed webhook body');
    }

    const eventType = event.type ?? 'unknown';
    const paymentEntity = event.data?.payment;
    const cashfreeOrderId = event.data?.order?.order_id ?? '';

    // Their payload carries no delivery id, so the key is the pair that is
    // stable across retries of the same event.
    const eventId = `${eventType}:${cashfreeOrderId}:${String(paymentEntity?.cf_payment_id ?? '')}`;

    const existing = await this.prisma.webhookEvent.findUnique({
      where: { provider_eventId: { provider: 'CASHFREE', eventId } },
      select: { id: true, processedAt: true },
    });

    if (existing?.processedAt) {
      this.logger.log(`Ignoring duplicate Cashfree webhook ${eventType} (${eventId})`);
      return { received: true, handled: true, duplicate: true, event: eventType };
    }

    const record = existing
      ? await this.prisma.webhookEvent.update({
          where: { id: existing.id },
          data: { payload: event as unknown as Prisma.InputJsonValue, error: null },
        })
      : await this.prisma.webhookEvent.create({
          data: {
            provider: 'CASHFREE',
            eventId,
            eventType,
            payload: event as unknown as Prisma.InputJsonValue,
          },
        });

    if (!CASHFREE_HANDLED.includes(eventType as (typeof CASHFREE_HANDLED)[number]) || !paymentEntity) {
      await this.prisma.webhookEvent.update({
        where: { id: record.id },
        data: { processedAt: new Date() },
      });
      return { received: true, handled: false, duplicate: false, event: eventType };
    }

    try {
      // order_id lives on the order, not the payment, and readPaymentEntity
      // expects to find it beside the rest.
      const payment = this.cashfree.readPaymentEntity({
        ...paymentEntity,
        order_id: cashfreeOrderId,
      });

      let orderId: string | null;
      if (eventType === 'PAYMENT_SUCCESS_WEBHOOK') {
        orderId = await this.onCaptured(payment);
      } else if (eventType === 'PAYMENT_FAILED_WEBHOOK') {
        orderId = await this.onFailed(payment);
      } else {
        // Dropped at the payment page. The attempt is worth recording; the
        // order stays PENDING and is not a failure they cannot retry.
        orderId = await this.recordAttempt(payment, PaymentStatus.PENDING);
      }

      await this.prisma.webhookEvent.update({
        where: { id: record.id },
        data: { processedAt: new Date(), orderId },
      });

      return { received: true, handled: true, duplicate: false, event: eventType };
    } catch (err) {
      // processedAt stays null so their retry is allowed to try again, and the
      // error is rethrown so they see a non-2xx and do retry.
      await this.prisma.webhookEvent.update({
        where: { id: record.id },
        data: { error: (err as Error).message },
      });
      this.logger.error(`Cashfree webhook ${eventType} failed: ${(err as Error).message}`);
      throw err;
    }
  }

  private async dispatch(
    eventType: string,
    event: { payload?: { payment?: { entity?: Record<string, unknown> }; refund?: { entity?: Record<string, unknown> } } },
  ): Promise<string | null> {
    if (eventType === 'refund.processed') {
      return this.onRefund(event.payload?.refund?.entity ?? {});
    }

    const entity = event.payload?.payment?.entity;
    if (!entity) return null;

    const payment = this.razorpay.readPaymentEntity(entity);

    if (eventType === 'payment.failed') return this.onFailed(payment);
    // authorized but not captured is still money held, so treat both as paid
    // only when captured; authorized just records the attempt.
    if (eventType === 'payment.captured') return this.onCaptured(payment);
    return this.recordAttempt(payment, PaymentStatus.PENDING);
  }


  /**
   * Settles the payment row checkout already created for this gateway order,
   * rather than adding a parallel one.
   *
   * Checkout writes a PENDING Payment when it creates the gateway order. An
   * upsert keyed on gatewayPaymentId does not match it — that column is still
   * null at that point — so settling created a second row and left the first
   * PENDING for ever, which makes any payment reconciliation wrong.
   */
  private async settleOperation(
    orderId: string,
    payment: GatewayPayment,
    status: PaymentStatus,
    extra: { failureReason?: string | null } = {},
  ) {
    const pending = await this.prisma.payment.findFirst({
      where: {
        orderId,
        gatewayOrderId: payment.gatewayOrderId,
        gatewayPaymentId: null,
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    if (pending) {
      return this.prisma.payment.update({
        where: { id: pending.id },
        data: {
          status,
          amount: payment.amount,
          gatewayPaymentId: payment.paymentId,
          failureReason: extra.failureReason ?? null,
        },
      });
    }

    return this.prisma.payment.upsert({
      where: { gatewayPaymentId: payment.paymentId },
      create: {
        orderId,
        amount: payment.amount,
        provider: 'RAZORPAY',
        status,
        gatewayOrderId: payment.gatewayOrderId,
        gatewayPaymentId: payment.paymentId,
        failureReason: extra.failureReason ?? null,
      },
      update: { status, amount: payment.amount, failureReason: extra.failureReason ?? null },
    });
  }

  /** Finds the order a gateway payment belongs to. */
  private async findOrder(payment: GatewayPayment) {
    if (!payment.gatewayOrderId) return null;

    const existingPayment = await this.prisma.payment.findFirst({
      where: { gatewayOrderId: payment.gatewayOrderId },
      select: { orderId: true },
    });

    if (!existingPayment) return null;

    return this.prisma.order.findUnique({ where: { id: existingPayment.orderId } });
  }

  private async onCaptured(payment: GatewayPayment): Promise<string | null> {
    const order = await this.findOrder(payment);

    if (!order) {
      this.logger.warn(`Captured payment ${payment.paymentId} matched no known order`);
      return null;
    }

    // The browser callback usually wins the race. Nothing to do, and doing it
    // anyway would decrement stock twice.
    if (order.paymentStatus === PaymentStatus.PAID) {
      this.logger.log(`Order ${order.orderNumber} was already settled by the callback`);
      return order.id;
    }

    if (order.status === OrderStatus.CANCELLED) {
      // Money taken against a cancelled order needs a human, not an automatic
      // confirmation that puts it back into fulfilment.
      this.logger.error(
        `Payment ${payment.paymentId} captured for CANCELLED order ${order.orderNumber} — refund required`,
      );
      await this.recordAttempt(payment, PaymentStatus.PAID, order.id);
      return order.id;
    }

    const amountMismatch = Math.abs(payment.amount - Number(order.totalAmount)) > 0.01;
    if (amountMismatch) {
      // Never settle an order for less than it costs.
      throw new Error(
        `Amount mismatch on ${order.orderNumber}: gateway says ₹${payment.amount}, order is ₹${order.totalAmount}`,
      );
    }

    await this.settleOperation(order.id, payment, PaymentStatus.PAID);

    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: PaymentStatus.PAID,
          status: OrderStatus.CONFIRMED,
          confirmedAt: new Date(),
        },
      }),
      this.prisma.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: OrderStatus.CONFIRMED,
          note: `Payment captured via webhook (${payment.method ?? 'unknown method'})`,
        },
      }),
      // Stock is NOT touched here. Checkout already decremented it inside the
      // transaction that created the order, so that two customers racing for
      // the last jar cannot both succeed. Decrementing again on capture would
      // take the same stock off twice.
      //
      // The cart is cleared here because the browser callback — which normally
      // does it — is exactly what failed if this webhook is the one confirming
      // the order.
      // A guest's cart lives in their browser, not in CartItem, so there is
      // nothing here to clear for one — and deleteMany with a null userId would
      // be a query looking for rows that cannot exist.
      ...(order.userId
        ? [this.prisma.cartItem.deleteMany({ where: { userId: order.userId } })]
        : []),
    ]);

    this.logger.log(`Order ${order.orderNumber} confirmed by webhook`);
    return order.id;
  }

  private async onFailed(payment: GatewayPayment): Promise<string | null> {
    const order = await this.findOrder(payment);
    if (!order) return null;

    // A failure notice after a successful capture is out of order delivery;
    // the captured state is the truthful one.
    if (order.paymentStatus === PaymentStatus.PAID) {
      this.logger.warn(
        `Ignoring payment.failed for ${order.orderNumber}, which is already paid`,
      );
      return order.id;
    }

    await this.settleOperation(order.id, payment, PaymentStatus.FAILED, {
      failureReason: payment.failureReason,
    });

    await this.prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: PaymentStatus.FAILED },
    });

    this.logger.log(`Order ${order.orderNumber} marked payment failed by webhook`);
    return order.id;
  }

  private async onRefund(entity: Record<string, unknown>): Promise<string | null> {
    const paymentId = typeof entity.payment_id === 'string' ? entity.payment_id : null;
    const amount = typeof entity.amount === 'number' ? entity.amount / 100 : 0;

    if (!paymentId) return null;

    const payment = await this.prisma.payment.findUnique({
      where: { gatewayPaymentId: paymentId },
      include: { order: true },
    });

    if (!payment) {
      this.logger.warn(`Refund for unknown payment ${paymentId}`);
      return null;
    }

    const refundedTotal = Number(payment.refundedAmount) + amount;
    const isFullRefund = refundedTotal >= Number(payment.amount) - 0.01;

    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          refundedAmount: refundedTotal,
          ...(isFullRefund ? { status: PaymentStatus.REFUNDED } : {}),
        },
      }),
      ...(isFullRefund
        ? [
            this.prisma.order.update({
              where: { id: payment.orderId },
              data: { paymentStatus: PaymentStatus.REFUNDED },
            }),
            this.prisma.orderStatusHistory.create({
              data: {
                orderId: payment.orderId,
                status: payment.order.status,
                note: `Refunded ₹${refundedTotal.toFixed(2)} via webhook`,
              },
            }),
          ]
        : []),
    ]);

    this.logger.log(
      `Refund of ₹${amount} recorded for ${payment.order.orderNumber}` +
        (isFullRefund ? ' (fully refunded)' : ' (partial)'),
    );
    return payment.orderId;
  }

  /** Stores a gateway attempt without changing the order's own state. */
  private async recordAttempt(
    payment: GatewayPayment,
    status: PaymentStatus,
    knownOrderId?: string,
  ): Promise<string | null> {
    const orderId = knownOrderId ?? (await this.findOrder(payment))?.id;
    if (!orderId) return null;

    await this.settleOperation(orderId, payment, status);
    return orderId;
  }
}
