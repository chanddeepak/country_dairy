import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DeliveryStatus,
  SubscriptionFrequency,
  SubscriptionStatus,
  TransactionType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FLAG, FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { round2 } from '../orders/pricing';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private prisma: PrismaService,
    private featureFlags: FeatureFlagsService,
  ) {}

  async createSubscription(
    userId: string,
    variantId: string,
    quantity: number,
    frequency: SubscriptionFrequency,
    daysOfWeek: number[],
    startDateStr: string,
  ) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: true },
    });

    if (!variant || !variant.isActive) {
      throw new NotFoundException('Product option not found');
    }

    if (!variant.product.isSubscriptionAllowed) {
      throw new BadRequestException('Subscriptions are not available for this product');
    }

    const startDate = new Date(startDateStr);
    if (Number.isNaN(startDate.getTime())) {
      throw new BadRequestException('Invalid start date');
    }

    if (frequency === SubscriptionFrequency.CUSTOM_DAYS && !daysOfWeek?.length) {
      throw new BadRequestException('Select at least one delivery day');
    }

    const nextDelivery = this.calculateNextDelivery(frequency, daysOfWeek, startDate);

    return this.prisma.subscription.create({
      data: {
        userId,
        productId: variant.productId,
        variantId,
        quantity,
        frequency,
        daysOfWeek: daysOfWeek ?? [],
        startDate,
        nextDelivery,
        status: SubscriptionStatus.ACTIVE,
      },
      include: {
        variant: true,
        product: { select: { title: true, slug: true, galleryImages: true } },
      },
    });
  }

  async pauseSubscription(userId: string, subscriptionId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { id: subscriptionId, userId },
    });

    if (!sub) {
      throw new NotFoundException('Subscription not found');
    }

    return this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: SubscriptionStatus.PAUSED },
    });
  }

  async resumeSubscription(userId: string, subscriptionId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { id: subscriptionId, userId },
    });

    if (!sub) {
      throw new NotFoundException('Subscription not found');
    }

    const nextDelivery = this.calculateNextDelivery(sub.frequency, sub.daysOfWeek, new Date());

    return this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: SubscriptionStatus.ACTIVE, nextDelivery },
    });
  }

  async getUserSubscriptions(userId: string) {
    return this.prisma.subscription.findMany({
      where: { userId },
      include: {
        variant: true,
        product: { select: { title: true, slug: true, galleryImages: true } },
        deliveries: { orderBy: { deliveryDate: 'desc' }, take: 5 },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async processDailySubscriptions(date?: string) {
    const searchDate = date ? new Date(date) : new Date();
    searchDate.setHours(0, 0, 0, 0);

    const activeSubs = await this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        nextDelivery: {
          gte: searchDate,
          lt: new Date(searchDate.getTime() + 24 * 60 * 60 * 1000),
        },
      },
      include: { variant: true, product: true, user: true },
    });

    this.logger.log(`[Scheduler] ${activeSubs.length} subscriptions due on ${searchDate.toDateString()}`);

    // Wallet billing is behind a flag until the wallet feature is built out.
    // With it off, deliveries are still scheduled but nothing is charged.
    const walletEnabled = await this.featureFlags.isEnabled(FLAG.WALLET);

    let successCount = 0;
    let failCount = 0;

    for (const sub of activeSubs) {
      // Price comes from the subscribed variant. This previously read
      // `product.variants[0]` with a `|| 100` fallback, so it billed an
      // arbitrary size at a flat ₹100.
      const cost = round2(Number(sub.variant.sellingPrice) * sub.quantity);

      try {
        if (walletEnabled) {
          await this.chargeAndSchedule(sub, cost, searchDate);
        } else {
          await this.scheduleWithoutCharge(sub, cost, searchDate);
        }
        successCount++;
      } catch (error) {
        this.logger.warn(
          `[Scheduler] Could not process subscription ${sub.id}: ${(error as Error).message}`,
        );
        await this.recordFailedDelivery(sub.id, searchDate, sub.quantity);
        failCount++;
      }
    }

    this.logger.log(`[Scheduler] success=${successCount} failed=${failCount}`);
    return { successCount, failCount };
  }

  /**
   * Schedules the delivery without touching the wallet, for while the wallet
   * feature is disabled. Collection happens out of band (cash on delivery).
   */
  private async scheduleWithoutCharge(
    sub: { id: string; frequency: SubscriptionFrequency; daysOfWeek: number[]; quantity: number },
    cost: number,
    searchDate: Date,
  ) {
    const tomorrow = new Date(searchDate);
    tomorrow.setDate(tomorrow.getDate() + 1);

    await this.prisma.$transaction([
      this.prisma.subscriptionDelivery.create({
        data: {
          subscriptionId: sub.id,
          deliveryDate: searchDate,
          status: DeliveryStatus.SCHEDULED,
          quantity: sub.quantity,
          priceCharged: cost,
        },
      }),
      this.prisma.subscription.update({
        where: { id: sub.id },
        data: {
          nextDelivery: this.calculateNextDelivery(sub.frequency, sub.daysOfWeek, tomorrow),
        },
      }),
    ]);
  }

  private async chargeAndSchedule(
    sub: { id: string; userId: string; quantity: number; frequency: SubscriptionFrequency; daysOfWeek: number[]; product: { title: string } },
    cost: number,
    searchDate: Date,
  ) {
    await this.prisma.$transaction(async (tx) => {
      // Conditional update rather than read-then-write: two concurrent
      // scheduler runs cannot both pass a balance check and overdraw.
      const debited = await tx.user.updateMany({
        where: { id: sub.userId, walletBalance: { gte: cost } },
        data: { walletBalance: { decrement: cost } },
      });

      if (debited.count === 0) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      const user = await tx.user.findUniqueOrThrow({
        where: { id: sub.userId },
        select: { walletBalance: true },
      });

      await tx.walletTransaction.create({
        data: {
          userId: sub.userId,
          amount: cost,
          type: TransactionType.DEBIT,
          balanceAfter: user.walletBalance,
          description: `Subscription delivery: ${sub.quantity}x ${sub.product.title}`,
          referenceId: sub.id,
        },
      });

      await tx.subscriptionDelivery.create({
        data: {
          subscriptionId: sub.id,
          deliveryDate: searchDate,
          status: DeliveryStatus.SCHEDULED,
          quantity: sub.quantity,
          priceCharged: cost,
        },
      });

      const tomorrow = new Date(searchDate);
      tomorrow.setDate(tomorrow.getDate() + 1);

      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          nextDelivery: this.calculateNextDelivery(sub.frequency, sub.daysOfWeek, tomorrow),
        },
      });
    });
  }

  private async recordFailedDelivery(subscriptionId: string, deliveryDate: Date, quantity: number) {
    await this.prisma.$transaction([
      this.prisma.subscriptionDelivery.create({
        data: {
          subscriptionId,
          deliveryDate,
          status: DeliveryStatus.FAILED,
          quantity,
          priceCharged: 0,
          skipReason: 'Insufficient wallet balance',
        },
      }),
      // Auto-pause so the same failure does not repeat every day.
      this.prisma.subscription.update({
        where: { id: subscriptionId },
        data: { status: SubscriptionStatus.PAUSED },
      }),
    ]);
  }

  /** Next delivery date implied by the subscription's frequency rule. */
  private calculateNextDelivery(
    frequency: SubscriptionFrequency,
    daysOfWeek: number[],
    fromDate: Date,
  ): Date {
    const next = new Date(fromDate);
    next.setHours(0, 0, 0, 0);

    switch (frequency) {
      case SubscriptionFrequency.DAILY:
        return next;

      case SubscriptionFrequency.ALTERNATE_DAYS:
        next.setDate(next.getDate() + 1);
        return next;

      case SubscriptionFrequency.WEEKLY:
        next.setDate(next.getDate() + 7);
        return next;

      case SubscriptionFrequency.CUSTOM_DAYS: {
        if (!daysOfWeek?.length) return next;
        for (let i = 0; i < 7; i++) {
          if (daysOfWeek.includes(next.getDay())) return next;
          next.setDate(next.getDate() + 1);
        }
        return next;
      }

      default:
        return next;
    }
  }
}
