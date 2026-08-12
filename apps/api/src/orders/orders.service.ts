import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DeliveryType,
  OrderStatus,
  PaymentStatus,
  Prisma,
  ProductStatus,
  StockMovementReason,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RazorpayService } from './razorpay.service';
import { calculateOrderTotals, priceLine, round2, toPaise } from './pricing';

/** Transitions the order state machine permits. */
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  CONFIRMED: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  PROCESSING: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  SHIPPED: [OrderStatus.DELIVERED, OrderStatus.RETURNED],
  DELIVERED: [OrderStatus.RETURNED],
  CANCELLED: [],
  RETURNED: [],
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    private razorpayService: RazorpayService,
    private audit: AuditService,
  ) {}

  /**
   * Human-readable order reference. Customers quote this over WhatsApp, so it
   * has to be something a person can read out loud.
   */
  private async generateOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `CD-${year}-`;

    const latest = await tx.order.findFirst({
      where: { orderNumber: { startsWith: prefix } },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    });

    const nextSeq = latest ? Number(latest.orderNumber.slice(prefix.length)) + 1 : 1;
    return `${prefix}${String(nextSeq).padStart(5, '0')}`;
  }

  async checkout(
    userId: string,
    addressId: string,
    deliveryType: DeliveryType,
    couponCode?: string,
  ) {
    const address = await this.prisma.address.findUnique({ where: { id: addressId } });
    if (!address || address.userId !== userId) {
      throw new BadRequestException('Invalid delivery address');
    }

    const cartItems = await this.prisma.cartItem.findMany({
      where: { userId },
      include: {
        variant: true,
        product: { select: { id: true, title: true, status: true, forceOutOfStock: true, gstRate: true, hsnCode: true } },
      },
    });

    if (cartItems.length === 0) {
      throw new BadRequestException('Cannot checkout: shopping cart is empty');
    }

    // Price every line from its own variant. The previous implementation read
    // `product.variants[0]` from a query that never included variants, so the
    // `|| 100` fallback fired for every line and charged a flat ₹100.
    const lines = cartItems.map((item) => {
      if (item.product.status !== 'LIVE' || item.product.forceOutOfStock || !item.variant.isActive) {
        throw new BadRequestException(`${item.product.title} is no longer available`);
      }
      if (item.quantity > item.variant.stockQuantity) {
        throw new BadRequestException(
          `${item.product.title} (${item.variant.sizeLabel}) has only ${item.variant.stockQuantity} left`,
        );
      }

      const priced = priceLine(
        item.quantity,
        Number(item.variant.sellingPrice),
        Number(item.product.gstRate),
      );

      return { item, priced };
    });

    const coupon = couponCode ? await this.resolveCoupon(couponCode, userId) : null;

    const totals = calculateOrderTotals(
      lines.map((l) => l.priced),
      coupon
        ? {
            discountType: coupon.discountType,
            discountValue: Number(coupon.discountValue),
            maxDiscountAmount: coupon.maxDiscountAmount ? Number(coupon.maxDiscountAmount) : null,
            minOrderAmount: Number(coupon.minOrderAmount),
          }
        : null,
    );

    // Stock is decremented with the order in one transaction, so two customers
    // racing for the last jar cannot both succeed.
    const order = await this.prisma.$transaction(async (tx) => {
      for (const { item } of lines) {
        const updated = await tx.productVariant.updateMany({
          where: { id: item.variantId, stockQuantity: { gte: item.quantity } },
          data: { stockQuantity: { decrement: item.quantity } },
        });

        if (updated.count === 0) {
          throw new ConflictException(
            `${item.product.title} (${item.variant.sizeLabel}) sold out while you were checking out`,
          );
        }
      }

      const orderNumber = await this.generateOrderNumber(tx);

      const created = await tx.order.create({
        data: {
          orderNumber,
          userId,
          addressId,
          // Snapshot: editing a saved address must not rewrite past orders.
          shippingAddress: {
            line1: address.line1,
            line2: address.line2,
            city: address.city,
            state: address.state,
            postalCode: address.postalCode,
            country: address.country,
            phone: address.phone,
          },
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          discountAmount: totals.discountAmount,
          deliveryCharges: totals.deliveryCharges,
          totalAmount: totals.totalAmount,
          couponId: coupon?.id,
          couponCode: coupon?.code,
          deliveryType,
          status: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.PENDING,
          orderItems: {
            create: lines.map(({ item, priced }) => ({
              productId: item.productId,
              variantId: item.variantId,
              // Immutable copies so renaming or archiving a product later
              // cannot alter this invoice.
              productTitle: item.product.title,
              variantSizeLabel: item.variant.sizeLabel,
              sku: item.variant.sku,
              imageUrl: item.variant.imageUrl,
              hsnCode: item.product.hsnCode,
              quantity: priced.quantity,
              unitPrice: priced.unitPrice,
              mrpPrice: Number(item.variant.mrpPrice),
              gstRate: priced.gstRate,
              taxAmount: priced.taxAmount,
              lineTotal: priced.lineTotal,
            })),
          },
          statusHistory: {
            create: { status: OrderStatus.PENDING, note: 'Order created' },
          },
        },
        include: { orderItems: true },
      });

      await tx.stockMovement.createMany({
        data: lines.map(({ item }) => ({
          variantId: item.variantId,
          change: -item.quantity,
          balanceAfter: item.variant.stockQuantity - item.quantity,
          reason: StockMovementReason.ORDER_PLACED,
          referenceId: created.id,
        })),
      });

      if (coupon) {
        await tx.coupon.update({
          where: { id: coupon.id },
          data: { usageCount: { increment: 1 } },
        });
      }

      return created;
    });

    const gatewayOrder = await this.razorpayService.createOrder(
      toPaise(totals.totalAmount),
      order.id,
    );

    await this.prisma.payment.create({
      data: {
        orderId: order.id,
        amount: totals.totalAmount,
        currency: 'INR',
        provider: 'RAZORPAY',
        status: PaymentStatus.PENDING,
        gatewayOrderId: gatewayOrder.id,
      },
    });

    this.logger.log(`Created order ${order.orderNumber} for ₹${totals.totalAmount}`);

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentGatewayId: gatewayOrder.id,
      amount: totals.totalAmount,
      currency: 'INR',
      breakdown: totals,
    };
  }

  private async resolveCoupon(code: string, userId: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: code.trim().toUpperCase() },
    });

    const now = new Date();
    if (
      !coupon ||
      !coupon.isActive ||
      (coupon.startsAt && coupon.startsAt > now) ||
      (coupon.expiresAt && coupon.expiresAt < now)
    ) {
      throw new BadRequestException('This coupon code is not valid');
    }

    if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
      throw new BadRequestException('This coupon has reached its usage limit');
    }

    if (coupon.perUserLimit !== null) {
      const usedByUser = await this.prisma.order.count({
        where: { userId, couponId: coupon.id, status: { not: OrderStatus.CANCELLED } },
      });
      if (usedByUser >= coupon.perUserLimit) {
        throw new BadRequestException('You have already used this coupon');
      }
    }

    return coupon;
  }

  async verifyPayment(
    userId: string,
    orderId: string,
    razorpayPaymentId: string,
    signature: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    if (!order || order.userId !== userId) {
      throw new NotFoundException('Order not found');
    }

    // Idempotent: a retried callback returns the already-confirmed order
    // instead of recording a second payment.
    if (order.paymentStatus === PaymentStatus.PAID) {
      return order;
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(`Order is already ${order.status.toLowerCase()}`);
    }

    // Checkout always writes this row alongside the gateway order. Its absence
    // means the order was created some other way, and there is nothing to
    // verify a signature against.
    const pendingPayment = order.payments[0];
    if (!pendingPayment) {
      throw new BadRequestException('This order has no payment to verify');
    }

    const gatewayOrderId = pendingPayment.gatewayOrderId ?? '';
    const isValid = this.razorpayService.verifySignature(
      gatewayOrderId,
      razorpayPaymentId,
      signature,
    );

    if (!isValid) {
      this.logger.warn(`Invalid payment signature for order ${order.orderNumber}`);
      await this.prisma.$transaction([
        this.prisma.order.update({
          where: { id: orderId },
          data: { paymentStatus: PaymentStatus.FAILED },
        }),
        this.prisma.payment.update({
          where: { id: pendingPayment.id },
          data: {
            status: PaymentStatus.FAILED,
            gatewayPaymentId: razorpayPaymentId,
            gatewaySignature: signature,
            failureReason: 'Signature verification failed',
          },
        }),
      ]);
      throw new BadRequestException('Payment verification failed');
    }

    const [confirmed] = await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CONFIRMED,
          paymentStatus: PaymentStatus.PAID,
          confirmedAt: new Date(),
          statusHistory: {
            create: { status: OrderStatus.CONFIRMED, note: 'Payment verified' },
          },
        },
      }),
      // Settle the PENDING row checkout created for this gateway order rather
      // than adding a parallel one — a `create` here left the original PENDING
      // for ever and made payment reconciliation double-count.
      this.prisma.payment.update({
        where: { id: pendingPayment.id },
        data: {
          status: PaymentStatus.PAID,
          gatewayPaymentId: razorpayPaymentId,
          gatewaySignature: signature,
        },
      }),
      this.prisma.cartItem.deleteMany({ where: { userId } }),
    ]);

    this.logger.log(`Order ${order.orderNumber} confirmed`);
    return confirmed;
  }

  /**
   * Puts a past order back in the cart.
   *
   * Nothing is assumed to still be true: a variant may be delisted, sold out,
   * or repriced since. Each line is reported back so the customer is told what
   * changed rather than discovering it at checkout, which is where a silent
   * substitution would surface.
   */
  async reorder(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { orderItems: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.orderItems.length === 0) {
      throw new BadRequestException('That order has nothing to reorder');
    }

    const variantIds = order.orderItems
      .map((i) => i.variantId)
      .filter((id): id is string => !!id);

    const [variants, existingCart] = await Promise.all([
      this.prisma.productVariant.findMany({
        where: { id: { in: variantIds } },
        include: { product: { select: { id: true, title: true, status: true, forceOutOfStock: true } } },
      }),
      this.prisma.cartItem.findMany({ where: { userId } }),
    ]);

    const byId = new Map(variants.map((v) => [v.id, v]));
    const inCart = new Map(existingCart.map((c) => [c.variantId, c]));

    const added: { title: string; quantity: number }[] = [];
    const adjusted: { title: string; wanted: number; added: number; reason: string }[] = [];
    const unavailable: { title: string; reason: string }[] = [];
    const repriced: { title: string; was: number; now: number }[] = [];

    for (const item of order.orderItems) {
      const label = `${item.productTitle}${item.variantSizeLabel ? ` (${item.variantSizeLabel})` : ''}`;
      const variant = item.variantId ? byId.get(item.variantId) : undefined;

      if (!variant || !variant.isActive) {
        unavailable.push({ title: label, reason: 'no longer sold' });
        continue;
      }

      if (variant.product.status !== ProductStatus.LIVE || variant.product.forceOutOfStock) {
        unavailable.push({ title: label, reason: 'not available right now' });
        continue;
      }

      // What is already in the cart counts against the same stock.
      const alreadyThere = inCart.get(variant.id)?.quantity ?? 0;
      const room = Math.max(0, variant.stockQuantity - alreadyThere);

      if (room === 0) {
        unavailable.push({ title: label, reason: 'sold out' });
        continue;
      }

      const quantity = Math.min(item.quantity, room);

      if (quantity < item.quantity) {
        adjusted.push({
          title: label,
          wanted: item.quantity,
          added: quantity,
          reason: `only ${room} left`,
        });
      } else {
        added.push({ title: label, quantity });
      }

      // Told, not hidden: the price on the old order is not the price today.
      const oldPrice = Number(item.unitPrice);
      const newPrice = Number(variant.sellingPrice);
      if (Math.abs(oldPrice - newPrice) > 0.01) {
        repriced.push({ title: label, was: oldPrice, now: newPrice });
      }

      await this.prisma.cartItem.upsert({
        where: { userId_variantId: { userId, variantId: variant.id } },
        create: {
          userId,
          variantId: variant.id,
          productId: variant.productId,
          quantity,
        },
        update: { quantity: alreadyThere + quantity },
      });
    }

    this.logger.log(
      `Reorder of ${order.orderNumber}: ${added.length} added, ` +
        `${adjusted.length} reduced, ${unavailable.length} unavailable`,
    );

    return {
      orderNumber: order.orderNumber,
      added,
      adjusted,
      unavailable,
      repriced,
      addedCount: added.length + adjusted.length,
    };
  }

  async getUserOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: { orderItems: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrderById(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { orderItems: true, statusHistory: { orderBy: { createdAt: 'asc' } } },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async cancelOrder(userId: string, orderId: string, reason?: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { orderItems: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (!ALLOWED_TRANSITIONS[order.status].includes(OrderStatus.CANCELLED)) {
      throw new ForbiddenException(`An order that is ${order.status.toLowerCase()} cannot be cancelled`);
    }

    return this.restockAndCancel(order.id, order.orderItems, reason ?? 'Cancelled by customer');
  }

  /** Returns reserved stock to inventory and marks the order cancelled. */
  private async restockAndCancel(
    orderId: string,
    items: { variantId: string | null; quantity: number }[],
    reason: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        if (!item.variantId) continue;

        const variant = await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stockQuantity: { increment: item.quantity } },
        });

        await tx.stockMovement.create({
          data: {
            variantId: item.variantId,
            change: item.quantity,
            balanceAfter: variant.stockQuantity,
            reason: StockMovementReason.ORDER_CANCELLED,
            referenceId: orderId,
          },
        });
      }

      return tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: reason,
          statusHistory: { create: { status: OrderStatus.CANCELLED, note: reason } },
        },
      });
    });
  }

  // --- ADMIN ORDER MANAGEMENT ---

  async getAllOrdersAdmin(filters: { status?: OrderStatus; search?: string } = {}) {
    return this.prisma.order.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.search
          ? {
              OR: [
                { orderNumber: { contains: filters.search, mode: 'insensitive' as const } },
                { user: { name: { contains: filters.search, mode: 'insensitive' as const } } },
                { user: { phone: { contains: filters.search } } },
                { user: { email: { contains: filters.search, mode: 'insensitive' as const } } },
              ],
            }
          : {}),
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        driver: { select: { id: true, name: true } },
        orderItems: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async updateOrderStatusAdmin(
    orderId: string,
    status: OrderStatus,
    options: {
      driverId?: string;
      trackingNumber?: string;
      shippingCarrier?: string;
      note?: string;
    } = {},
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { orderItems: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== status && !ALLOWED_TRANSITIONS[order.status].includes(status)) {
      throw new BadRequestException(
        `Cannot move an order from ${order.status} to ${status}`,
      );
    }

    // Cancelling from the admin side must also return the stock.
    if (status === OrderStatus.CANCELLED) {
      return this.restockAndCancel(
        order.id,
        order.orderItems,
        options.note ?? 'Cancelled by staff',
      );
    }

    const timestamps: Prisma.OrderUpdateInput = {};
    if (status === OrderStatus.CONFIRMED) timestamps.confirmedAt = new Date();
    if (status === OrderStatus.SHIPPED) timestamps.shippedAt = new Date();
    if (status === OrderStatus.DELIVERED) timestamps.deliveredAt = new Date();

    await this.audit.record({
      action: 'STATUS_CHANGE',
      entity: 'Order',
      entityId: order.orderNumber,
      before: { status: order.status },
      after: {
        status,
        driverId: options.driverId,
        trackingNumber: options.trackingNumber,
        shippingCarrier: options.shippingCarrier,
      },
    });

    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        status,
        ...timestamps,
        // `driver: connect` rather than a raw driverId, because Prisma will not
        // mix unchecked scalar FKs with nested writes like statusHistory.
        ...(options.driverId ? { driver: { connect: { id: options.driverId } } } : {}),
        ...(options.trackingNumber ? { trackingNumber: options.trackingNumber } : {}),
        ...(options.shippingCarrier ? { shippingCarrier: options.shippingCarrier } : {}),
        statusHistory: { create: { status, note: options.note } },
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        driver: { select: { id: true, name: true } },
        orderItems: true,
      },
    });
  }

  async getOrderStatsAdmin() {
    const [statusCounts, revenue, todayCount] = await Promise.all([
      this.prisma.order.groupBy({ by: ['status'], _count: true }),
      this.prisma.order.aggregate({
        where: { paymentStatus: PaymentStatus.PAID },
        _sum: { totalAmount: true },
      }),
      this.prisma.order.count({
        where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }),
    ]);

    return {
      byStatus: Object.fromEntries(statusCounts.map((s) => [s.status, s._count])),
      totalRevenue: round2(Number(revenue._sum.totalAmount ?? 0)),
      ordersToday: todayCount,
    };
  }
}
