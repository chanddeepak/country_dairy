import { Injectable, Logger } from '@nestjs/common';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

/**
 * Turning a Shiprocket order into one of ours.
 *
 * Their documentation is explicit that "Webhooks may be sent more than once",
 * so every path through here has to be safe to run twice. That is not a
 * nicety: a second delivery must not take stock twice, must not burn a second
 * invoice number, and must not charge anybody anything.
 *
 * The natural idempotency key is theirs, not ours — `fastrr_order_id` is
 * stable across retries where anything we generate would not be.
 */

/** What their webhook sends. Only the fields we act on are named. */
export interface ShiprocketOrderPayload {
  order_id: string;
  fastrr_order_id?: string;
  platform_order_id?: string;
  status: string;
  phone: string;
  email?: string | null;
  cart_data: { items: { variant_id: string; quantity: number }[] };
  shipping_address: ShiprocketAddress;
  billing_address?: ShiprocketAddress;
  payment_type: 'PREPAID' | 'CASH_ON_DELIVERY';
  payment_status: string;
  payments?: {
    txn_id?: string;
    payment_status?: string;
    gateway?: string;
    payment_method?: string;
    amount?: number;
    pg_transaction_id?: string;
    amount_received?: number;
  }[];
  subtotal_price?: number;
  shipping_charges?: number;
  cod_charges?: number;
  total_discount?: number;
  coupon_discount?: number;
  prepaid_discount?: number;
  coupon_codes?: string[];
  total_amount_payable: number;
  edd?: string | null;
  rto_prediction?: string | null;
  shipping_plan?: string | null;
  source?: string | null;
}

interface ShiprocketAddress {
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  country?: string | null;
  landmark?: string | null;
}

@Injectable()
export class ShiprocketOrderService {
  private readonly logger = new Logger(ShiprocketOrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async ingest(payload: ShiprocketOrderPayload) {
    const externalRef = payload.fastrr_order_id || payload.order_id;

    // Only a paid, completed order becomes an order here. Their INITIATED and
    // FAILED states describe a checkout somebody abandoned, and recording
    // those would fill the console with orders that never happened.
    if (payload.status !== 'SUCCESS') {
      this.logger.log(`Shiprocket order ${externalRef} ignored: status ${payload.status}`);
      return { created: false, reason: 'not-successful' as const };
    }

    const existing = await this.prisma.order.findFirst({
      where: { shiprocketOrderId: externalRef },
      select: { id: true, orderNumber: true },
    });

    if (existing) {
      // The retry case, and the whole reason this method reads the way it
      // does. Answer 200 so they stop retrying, and touch nothing.
      this.logger.log(`Shiprocket order ${externalRef} already ingested as ${existing.orderNumber}`);
      return { created: false, reason: 'duplicate' as const, orderId: existing.id };
    }

    const customer = await this.findOrCreateCustomer(payload);
    const lines = await this.resolveLines(payload.cart_data.items);

    if (lines.length === 0) {
      // Better to refuse loudly than to record an order with nothing in it.
      this.logger.error(
        `Shiprocket order ${externalRef} matched no variants: ` +
          payload.cart_data.items.map((i) => i.variant_id).join(', '),
      );
      throw new Error('No known variants in Shiprocket order');
    }

    const order = await this.prisma.$transaction(async (tx) => {
      const orderNumber = await this.nextOrderNumber(tx);

      const created = await tx.order.create({
        data: {
          orderNumber,
          userId: customer.id,
          shiprocketOrderId: externalRef,
          status: OrderStatus.CONFIRMED,
          confirmedAt: new Date(),
          deliveryType: 'COURIER',
          // Every figure is theirs. Their checkout decided what the customer
          // paid, so recomputing any of it here could only ever disagree with
          // the money that actually moved.
          subtotal: dec(payload.subtotal_price),
          discountAmount: dec(payload.total_discount),
          deliveryCharges: dec((payload.shipping_charges ?? 0) + (payload.cod_charges ?? 0)),
          taxAmount: dec(0),
          totalAmount: dec(payload.total_amount_payable),
          couponCode: payload.coupon_codes?.[0] ?? null,
          shippingAddress: toAddressJson(payload.shipping_address),
          paymentStatus:
            payload.payment_type === 'CASH_ON_DELIVERY'
              ? PaymentStatus.PENDING
              : PaymentStatus.PAID,
          customerNote: payload.rto_prediction
            ? `RTO risk: ${payload.rto_prediction}`
            : null,
          orderItems: {
            create: lines.map((line) => ({
              productId: line.productId,
              variantId: line.variantId,
              productTitle: line.productTitle,
              variantSizeLabel: line.sizeLabel,
              sku: line.sku,
              imageUrl: line.imageUrl,
              hsnCode: line.hsnCode,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              mrpPrice: line.mrpPrice,
              gstRate: line.gstRate,
              taxAmount: dec(0),
              lineTotal: line.unitPrice.mul(line.quantity),
            })),
          },
        },
        select: { id: true, orderNumber: true },
      });

      // Conditional decrement, the same guard our own checkout uses. Their
      // checkout never asked whether we had the stock, so this is the first
      // moment anyone checks — and it must not push a count below zero.
      for (const line of lines) {
        await tx.productVariant.updateMany({
          where: { id: line.variantId, stockQuantity: { gte: line.quantity } },
          data: { stockQuantity: { decrement: line.quantity } },
        });
      }

      const payment = payload.payments?.[0];
      if (payment) {
        await tx.payment.create({
          data: {
            orderId: created.id,
            amount: dec(payment.amount_received ?? payment.amount),
            status:
              payment.payment_status === 'Success'
                ? PaymentStatus.PAID
                : PaymentStatus.PENDING,
            // Their transaction id, kept unique, so a replay collides here as
            // well as on the order — two locks on the same door.
            gatewayPaymentId: payment.pg_transaction_id ?? payment.txn_id ?? null,
            gatewayOrderId: externalRef,
            rawPayload: payload as unknown as Prisma.InputJsonValue,
          },
        });
      }

      return created;
    });

    await this.audit.record({
      action: 'CREATE',
      entity: 'Order',
      entityId: order.id,
      before: null,
      after: {
        source: 'shiprocket',
        shiprocketOrderId: externalRef,
        orderNumber: order.orderNumber,
        paymentType: payload.payment_type,
      },
    });

    this.logger.log(`Shiprocket order ${externalRef} ingested as ${order.orderNumber}`);
    return { created: true, orderId: order.id, orderNumber: order.orderNumber };
  }

  /**
   * The customer, by phone.
   *
   * Phone is the identity because it is the only thing anyone verified — the
   * OTP proved it. An email is contact detail and is never used to find an
   * existing account: matching on an unverified address would let anyone
   * inherit somebody else's order history by typing their address.
   */
  private async findOrCreateCustomer(payload: ShiprocketOrderPayload) {
    const phone = normalisePhone(payload.phone || payload.shipping_address?.phone);
    const email = (payload.email || payload.shipping_address?.email || '').trim().toLowerCase();
    const name =
      [payload.shipping_address?.first_name, payload.shipping_address?.last_name]
        .filter(Boolean)
        .join(' ')
        .trim() || 'Customer';

    const existing = await this.prisma.user.findFirst({ where: { phone } });
    if (existing) return existing;

    // One email to one account. Where the address is already taken the order
    // still lands — it is attached to the phone, which is what identifies the
    // customer — and the email is simply left off rather than failing a
    // purchase over a contact detail.
    const emailTaken = email
      ? await this.prisma.user.findFirst({ where: { email }, select: { id: true } })
      : null;

    return this.prisma.user.create({
      data: {
        phone,
        email: email && !emailTaken ? email : null,
        name,
        role: 'CUSTOMER',
        isActive: true,
      },
    });
  }

  /** Their variant ids are our externalId, which is why that column exists. */
  private async resolveLines(items: { variant_id: string; quantity: number }[]) {
    const ids = items
      .map((i) => {
        try {
          return BigInt(i.variant_id);
        } catch {
          return null;
        }
      })
      .filter((v): v is bigint => v !== null);

    const variants = await this.prisma.productVariant.findMany({
      where: { externalId: { in: ids } },
      include: { product: { select: { id: true, title: true, hsnCode: true, gstRate: true } } },
    });

    return items.flatMap((item) => {
      const variant = variants.find((v) => String(v.externalId) === String(item.variant_id));
      if (!variant) return [];

      return [
        {
          variantId: variant.id,
          productId: variant.product.id,
          productTitle: variant.product.title,
          sizeLabel: variant.sizeLabel,
          sku: variant.sku,
          imageUrl: variant.imageUrl ?? null,
          hsnCode: variant.product.hsnCode ?? null,
          gstRate: variant.product.gstRate ?? new Prisma.Decimal(0),
          quantity: item.quantity,
          unitPrice: variant.sellingPrice,
          mrpPrice: variant.mrpPrice,
        },
      ];
    });
  }

  /** Same series as our own orders — one sequence, whoever took the order. */
  private async nextOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
    const prefix = `CD-${new Date().getFullYear()}-`;
    const latest = await tx.order.findFirst({
      where: { orderNumber: { startsWith: prefix } },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    });

    const next = latest ? Number(latest.orderNumber.slice(prefix.length)) + 1 : 1;
    return `${prefix}${String(next).padStart(5, '0')}`;
  }
}

function dec(value: number | null | undefined): Prisma.Decimal {
  return new Prisma.Decimal(value ?? 0);
}

/** Ten digits, no country code, matching what the rest of the system stores. */
function normalisePhone(raw?: string | null): string {
  const digits = (raw ?? '').replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function toAddressJson(a: ShiprocketAddress): Prisma.InputJsonValue {
  return {
    line1: a.line1 ?? '',
    line2: a.line2 ?? '',
    city: a.city ?? '',
    state: a.state ?? '',
    postalCode: a.pincode ?? '',
    country: a.country ?? 'India',
    phone: a.phone ?? '',
    landmark: a.landmark ?? '',
  };
}
