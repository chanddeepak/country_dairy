import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DeliveryType, OrderStatus, PaymentStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { istDayRange } from '../analytics/reporting-window';

/** Statuses a local order can be in while it still needs delivering. */
const OPEN_FOR_DELIVERY: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
];

export interface DeliveryStop {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string | null;
  addressLine: string;
  area: string;
  pincode: string;
  itemsSummary: string;
  itemCount: number;
  /** Only what the driver must collect — 0 when already paid online. */
  amountToCollect: number;
  totalAmount: number;
  isCashOnDelivery: boolean;
  status: OrderStatus;
  driverId: string | null;
  driverName: string | null;
  customerNote: string | null;
  placedAt: string;
}

export interface RouteSheet {
  /** Pincode, because that is what an Indian address is reliably keyed on. */
  pincode: string;
  area: string;
  stops: DeliveryStop[];
  stopCount: number;
  cashToCollect: number;
  driverIds: string[];
}

type OrderWithRelations = Prisma.OrderGetPayload<{
  include: {
    user: { select: { name: true; phone: true } };
    driver: { select: { id: true; name: true } };
    orderItems: {
      select: { productTitle: true; variantSizeLabel: true; quantity: true };
    };
  };
}>;

const ROUTE_INCLUDE = {
  user: { select: { name: true, phone: true } },
  driver: { select: { id: true, name: true } },
  orderItems: { select: { productTitle: true, variantSizeLabel: true, quantity: true } },
} satisfies Prisma.OrderInclude;

/**
 * The address is a JSON snapshot taken at checkout, so its shape is whatever
 * the storefront sent that day. Every read goes through here rather than
 * indexing into the blob at the call site.
 */
function readAddress(value: Prisma.JsonValue): {
  line: string;
  area: string;
  pincode: string;
  phone: string | null;
} {
  const a = (value && typeof value === 'object' && !Array.isArray(value) ? value : {}) as Record<
    string,
    unknown
  >;
  const str = (key: string): string => (typeof a[key] === 'string' ? (a[key] as string) : '');

  const line = [str('line1'), str('line2')].filter(Boolean).join(', ');

  return {
    line: line || 'Address not recorded',
    area: str('city') || 'Unassigned',
    pincode: str('postalCode') || '',
    phone: str('phone') || null,
  };
}

function summariseItems(items: OrderWithRelations['orderItems']): string {
  return items
    .map((i) => `${i.quantity} × ${i.productTitle}${i.variantSizeLabel ? ` (${i.variantSizeLabel})` : ''}`)
    .join(', ');
}

@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private toStop(order: OrderWithRelations): DeliveryStop {
    const address = readAddress(order.shippingAddress);
    const total = Number(order.totalAmount);

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.user?.name || 'Customer',
      // For a guest order the address phone is the only phone, and it is the
      // one Cashfree verified — so it was already the better of the two.
      customerPhone: address.phone || order.user?.phone || '',
      addressLine: address.line,
      area: address.area,
      pincode: address.pincode,
      itemsSummary: summariseItems(order.orderItems),
      itemCount: order.orderItems.reduce((sum, i) => sum + i.quantity, 0),
      // Paid online means the driver collects nothing. Showing the order total
      // regardless is how a customer gets charged twice at the door.
      amountToCollect: order.paymentStatus === PaymentStatus.PAID ? 0 : total,
      totalAmount: total,
      isCashOnDelivery: order.paymentStatus !== PaymentStatus.PAID,
      status: order.status,
      driverId: order.driverId,
      driverName: order.driver?.name ?? null,
      customerNote: order.customerNote,
      placedAt: order.createdAt.toISOString(),
    };
  }

  /**
   * Route sheets for a delivery day, grouped by pincode.
   *
   * Local orders only — a courier consignment is not something a milk runner
   * carries, and mixing them would put a Delhivery parcel on a morning round.
   */
  async getRouteSheets(dateKey?: string): Promise<{
    date: string;
    routes: RouteSheet[];
    unassignedCount: number;
    totalStops: number;
    totalCashToCollect: number;
  }> {
    const { start, end, key } = istDayRange(dateKey);

    const orders = await this.prisma.order.findMany({
      where: {
        deliveryType: DeliveryType.LOCAL,
        status: { in: OPEN_FOR_DELIVERY },
        createdAt: { gte: start, lt: end },
      },
      include: ROUTE_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });

    const byPincode = new Map<string, RouteSheet>();

    for (const order of orders) {
      const stop = this.toStop(order);
      // An address saved without a pincode still has to appear somewhere; it
      // must not silently vanish from the day's sheet.
      const routeKey = stop.pincode || 'NO-PINCODE';

      let route = byPincode.get(routeKey);
      if (!route) {
        route = {
          pincode: stop.pincode,
          area: stop.area,
          stops: [],
          stopCount: 0,
          cashToCollect: 0,
          driverIds: [],
        };
        byPincode.set(routeKey, route);
      }

      route.stops.push(stop);
      route.stopCount += 1;
      route.cashToCollect = Number((route.cashToCollect + stop.amountToCollect).toFixed(2));
      if (stop.driverId && !route.driverIds.includes(stop.driverId)) {
        route.driverIds.push(stop.driverId);
      }
    }

    const routes = [...byPincode.values()].sort((a, b) => b.stopCount - a.stopCount);

    return {
      date: key,
      routes,
      unassignedCount: orders.filter((o) => !o.driverId).length,
      totalStops: orders.length,
      totalCashToCollect: Number(
        routes.reduce((sum, r) => sum + r.cashToCollect, 0).toFixed(2),
      ),
    };
  }

  /** Assigns a whole route to one driver in a single write. */
  async assignRoute(
    orderIds: string[],
    driverId: string | null,
  ): Promise<{ assigned: number; driverId: string | null }> {
    if (orderIds.length === 0) {
      throw new BadRequestException('Select at least one stop to assign');
    }

    if (driverId) {
      const driver = await this.prisma.user.findFirst({
        where: { id: driverId, role: Role.DELIVERY_DRIVER, isActive: true },
        select: { id: true },
      });

      if (!driver) {
        throw new BadRequestException('That driver is not an active delivery driver');
      }
    }

    // Scoped to open local orders so a stale console tab cannot reassign an
    // order that has since been delivered or cancelled.
    const result = await this.prisma.order.updateMany({
      where: {
        id: { in: orderIds },
        deliveryType: DeliveryType.LOCAL,
        status: { in: OPEN_FOR_DELIVERY },
      },
      data: { driverId },
    });

    await this.audit.record({
      action: 'UPDATE',
      entity: 'Order',
      entityId: orderIds.join(','),
      after: { driverId, assigned: result.count },
    });

    this.logger.log(
      `Route assignment: ${result.count} stops → ${driverId ?? 'unassigned'}`,
    );

    return { assigned: result.count, driverId };
  }

  /** What one driver sees. Always scoped to the caller's own id. */
  async getMyDeliveries(driverId: string): Promise<DeliveryStop[]> {
    const orders = await this.prisma.order.findMany({
      where: {
        driverId,
        status: { in: OPEN_FOR_DELIVERY },
      },
      include: ROUTE_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });

    return orders.map((o) => this.toStop(o));
  }

  /** Today's completed drops, so a driver can see what they have finished. */
  async getMyCompletedToday(driverId: string): Promise<DeliveryStop[]> {
    const { start, end } = istDayRange();

    const orders = await this.prisma.order.findMany({
      where: {
        driverId,
        status: OrderStatus.DELIVERED,
        deliveredAt: { gte: start, lt: end },
      },
      include: ROUTE_INCLUDE,
      orderBy: { deliveredAt: 'desc' },
    });

    return orders.map((o) => this.toStop(o));
  }

  private async loadOwnOrder(orderId: string, driverId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, orderNumber: true, status: true, driverId: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // A driver acting on someone else's stop is the failure this guards.
    if (order.driverId !== driverId) {
      throw new ForbiddenException('That delivery is not assigned to you');
    }

    return order;
  }

  async markDelivered(
    orderId: string,
    driverId: string,
    note?: string,
  ): Promise<DeliveryStop> {
    const order = await this.loadOwnOrder(orderId, driverId);

    if (order.status === OrderStatus.DELIVERED) {
      throw new BadRequestException('That order is already marked delivered');
    }
    if (!OPEN_FOR_DELIVERY.includes(order.status)) {
      throw new BadRequestException(
        `An order in ${order.status} cannot be delivered`,
      );
    }

    const now = new Date();

    const [updated] = await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.DELIVERED,
          deliveredAt: now,
          // Cash handed over at the door settles the order.
          paymentStatus: PaymentStatus.PAID,
          ...(note ? { internalNote: note } : {}),
        },
        include: ROUTE_INCLUDE,
      }),
      this.prisma.orderStatusHistory.create({
        data: {
          orderId,
          status: OrderStatus.DELIVERED,
          note: note || 'Marked delivered by driver',
          actorId: driverId,
        },
      }),
    ]);

    await this.audit.record({
      action: 'UPDATE',
      entity: 'Order',
      entityId: orderId,
      before: { status: order.status },
      after: { status: OrderStatus.DELIVERED, deliveredBy: driverId },
    });

    this.logger.log(`Order ${order.orderNumber} delivered by driver ${driverId}`);
    return this.toStop(updated);
  }

  /**
   * A failed attempt. The order stays open and assigned so it appears on the
   * next round rather than disappearing into a status nobody watches.
   */
  async markAttemptFailed(
    orderId: string,
    driverId: string,
    reason: string,
  ): Promise<DeliveryStop> {
    const order = await this.loadOwnOrder(orderId, driverId);

    if (!OPEN_FOR_DELIVERY.includes(order.status)) {
      throw new BadRequestException(`An order in ${order.status} cannot be attempted`);
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: { internalNote: reason },
        include: ROUTE_INCLUDE,
      }),
      this.prisma.orderStatusHistory.create({
        data: {
          orderId,
          status: order.status,
          note: `Delivery attempt failed: ${reason}`,
          actorId: driverId,
        },
      }),
    ]);

    await this.audit.record({
      action: 'UPDATE',
      entity: 'Order',
      entityId: orderId,
      after: { attemptFailed: reason, driverId },
    });

    return this.toStop(updated);
  }
}
