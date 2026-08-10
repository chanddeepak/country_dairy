import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { round2 } from '../orders/pricing';
import {
  REPORTING_TZ,
  dayLabel,
  reportingDayKeys,
  rowDateKey,
  startOfReportingDay,
} from './reporting-window';

export interface TrackEventInput {
  eventName: string;
  productId?: string;
  variantId?: string;
  sessionId?: string;
  deviceType?: string;
  referrer?: string;
  path?: string;
  metadata?: Record<string, unknown>;
}

/** Events the storefront is allowed to record, so the table cannot be spammed. */
const ALLOWED_EVENTS = new Set([
  'page_view',
  'product_view',
  'whatsapp_order_click',
  'add_to_cart',
  'begin_checkout',
  'purchase',
]);

/**
 * Dashboard figures are aggregates over a rolling window, so a few seconds of
 * staleness is invisible to staff but removes a burst of round-trips to the
 * remote pooler — React StrictMode alone fires the request twice.
 */
const DASHBOARD_CACHE_TTL_MS = 20_000;

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private dashboardCache = new Map<number, { at: number; data: unknown }>();

  constructor(private prisma: PrismaService) {}

  /** Dropped when an event arrives so a fresh figure is never far behind. */
  private invalidateDashboard() {
    this.dashboardCache.clear();
  }

  async track(input: TrackEventInput, userId?: string) {
    if (!ALLOWED_EVENTS.has(input.eventName)) {
      // Ignored rather than rejected: a client sending an unknown event should
      // not surface an error to a shopper mid-journey.
      return { recorded: false };
    }

    await this.prisma.analyticsEvent.create({
      data: {
        eventName: input.eventName,
        productId: input.productId,
        variantId: input.variantId,
        sessionId: input.sessionId,
        userId,
        deviceType: input.deviceType,
        referrer: input.referrer?.slice(0, 500),
        path: input.path?.slice(0, 500),
        metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });

    this.invalidateDashboard();
    return { recorded: true };
  }

  /** Everything the admin Overview dashboard renders, from real rows. */
  async getDashboard(days = 7) {
    const cached = this.dashboardCache.get(days);
    if (cached && Date.now() - cached.at < DASHBOARD_CACHE_TTL_MS) {
      return cached.data as Awaited<ReturnType<AnalyticsService['buildDashboard']>>;
    }

    const data = await this.buildDashboard(days);
    this.dashboardCache.set(days, { at: Date.now(), data });
    return data;
  }

  private async buildDashboard(days: number) {
    // Buckets follow the India business day; see reporting-window.ts.
    const dayKeys = reportingDayKeys(days);
    const since = startOfReportingDay(dayKeys[0]);

    const [
      eventTotals,
      dailyRows,
      deviceRows,
      topProductRows,
      revenueRows,
      orderCount,
      lowStock,
    ] = await Promise.all([
      this.prisma.analyticsEvent.groupBy({
        by: ['eventName'],
        where: { createdAt: { gte: since } },
        _count: true,
      }),
      this.prisma.$queryRaw<{ day: Date; event_name: string; count: bigint }[]>`
        SELECT date_trunc('day', "createdAt" AT TIME ZONE ${REPORTING_TZ}) AS day,
               "eventName" AS event_name,
               COUNT(*) AS count
        FROM "AnalyticsEvent"
        WHERE "createdAt" >= ${since}
        GROUP BY day, "eventName"
        ORDER BY day ASC
      `,
      this.prisma.analyticsEvent.groupBy({
        by: ['deviceType'],
        where: { createdAt: { gte: since } },
        _count: true,
      }),
      this.prisma.analyticsEvent.groupBy({
        by: ['productId'],
        where: { createdAt: { gte: since }, eventName: 'product_view', productId: { not: null } },
        _count: true,
        orderBy: { _count: { productId: 'desc' } },
        take: 5,
      }),
      this.prisma.$queryRaw<{ day: Date; revenue: string }[]>`
        SELECT date_trunc('day', "createdAt" AT TIME ZONE ${REPORTING_TZ}) AS day,
               SUM("totalAmount") AS revenue
        FROM "Order"
        WHERE "createdAt" >= ${since} AND "paymentStatus" = 'PAID'
        GROUP BY day
        ORDER BY day ASC
      `,
      this.prisma.order.count({ where: { createdAt: { gte: since } } }),
      this.getStockAlerts(),
    ]);

    const countOf = (name: string) =>
      eventTotals.find((e) => e.eventName === name)?._count ?? 0;

    // Zero-filled so a quiet day renders as a dip rather than disappearing.
    const seriesFor = (eventName: string) =>
      dayKeys.map((key) => ({
        label: dayLabel(key),
        value: Number(
          dailyRows.find((r) => rowDateKey(r.day) === key && r.event_name === eventName)?.count ?? 0,
        ),
      }));

    const revenueByDay = dayKeys.map((key) => ({
      label: dayLabel(key),
      value: round2(Number(revenueRows.find((r) => rowDateKey(r.day) === key)?.revenue ?? 0)),
    }));

    const products = await this.prisma.product.findMany({
      where: { id: { in: topProductRows.map((p) => p.productId!).filter(Boolean) } },
      select: { id: true, title: true },
    });

    return {
      periodDays: days,
      totals: {
        pageViews: countOf('page_view'),
        productViews: countOf('product_view'),
        whatsappClicks: countOf('whatsapp_order_click'),
        addToCart: countOf('add_to_cart'),
        orders: orderCount,
      },
      pageViewsByDay: seriesFor('page_view'),
      whatsappClicksByDay: seriesFor('whatsapp_order_click'),
      revenueByDay,
      deviceSplit: deviceRows.map((d) => ({
        label: d.deviceType ?? 'unknown',
        value: d._count,
      })),
      topProducts: topProductRows.map((row) => ({
        productId: row.productId,
        title: products.find((p) => p.id === row.productId)?.title ?? 'Unknown product',
        views: row._count,
      })),
      stockAlerts: lowStock,
    };
  }

  /**
   * Low and out-of-stock variants. Uses the variant's own threshold rather
   * than a global constant, since a 5L dolchi and a milk pouch do not restock
   * at the same rate.
   *
   * The comparison happens in SQL. Prisma cannot compare two columns in a
   * where clause, and the previous workaround pulled every active variant back
   * and filtered in JavaScript — fine at six variants, not at six thousand.
   */
  async getStockAlerts() {
    return this.prisma.$queryRaw<
      {
        id: string;
        productId: string;
        productName: string;
        variantLabel: string;
        sku: string;
        currentStock: number;
        threshold: number;
        type: 'OUT_OF_STOCK' | 'LOW_STOCK';
        updatedAt: Date;
      }[]
    >`
      SELECT v."id",
             p."id"                AS "productId",
             p."title"             AS "productName",
             v."sizeLabel"         AS "variantLabel",
             v."sku",
             v."stockQuantity"     AS "currentStock",
             v."lowStockThreshold" AS "threshold",
             CASE WHEN v."stockQuantity" = 0 THEN 'OUT_OF_STOCK' ELSE 'LOW_STOCK' END AS "type",
             v."updatedAt"
      FROM "ProductVariant" v
      JOIN "Product" p ON p."id" = v."productId"
      WHERE v."isActive" = true
        AND p."status" = 'LIVE'
        AND v."stockQuantity" <= v."lowStockThreshold"
      ORDER BY v."stockQuantity" ASC
      LIMIT 50
    `;
  }
}
