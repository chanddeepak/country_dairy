import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(private prisma: PrismaService) {}

  async createSubscription(
    userId: string,
    productId: string,
    quantity: number,
    frequency: string, // "DAILY", "ALTERNATE", "CUSTOM"
    daysOfWeek: number[], // 0 = Sunday, 6 = Saturday
    startDateStr: string,
  ) {
    this.logger.log(`Creating subscription: user=${userId}, product=${productId}, freq=${frequency}`);

    // Validate product subscription availability
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (!product.isSubscriptionAllowed) {
      throw new BadRequestException('Subscriptions are not allowed for this product');
    }

    if (quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than 0');
    }

    const startDate = new Date(startDateStr);
    if (isNaN(startDate.getTime())) {
      throw new BadRequestException('Invalid start date');
    }

    const nextDelivery = this.calculateNextDelivery(frequency, daysOfWeek, startDate);

    try {
      return await this.prisma.subscription.create({
        data: {
          userId,
          productId,
          quantity,
          frequency,
          daysOfWeek: daysOfWeek || [],
          startDate,
          nextDelivery,
          status: 'ACTIVE',
        },
        include: {
          product: {
            select: {
              title: true,
              galleryImages: true,
              variants: true,
            },
          },
        },
      });
    } catch (error) {
      this.logger.error(`Failed to create subscription for user ${userId}`, error.stack);
      throw error;
    }
  }

  async pauseSubscription(userId: string, subscriptionId: string) {
    this.logger.log(`Pausing subscription: ${subscriptionId} for user ${userId}`);
    const sub = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!sub || sub.userId !== userId) {
      throw new NotFoundException('Subscription not found');
    }

    return this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'PAUSED',
      },
    });
  }

  async resumeSubscription(userId: string, subscriptionId: string) {
    this.logger.log(`Resuming subscription: ${subscriptionId} for user ${userId}`);
    const sub = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!sub || sub.userId !== userId) {
      throw new NotFoundException('Subscription not found');
    }

    // Recalculate next delivery from today's date
    const today = new Date();
    const nextDelivery = this.calculateNextDelivery(sub.frequency, sub.daysOfWeek, today);

    return this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'ACTIVE',
        nextDelivery,
      },
    });
  }

  async getUserSubscriptions(userId: string) {
    return this.prisma.subscription.findMany({
      where: { userId },
      include: {
        product: {
          select: {
            title: true,
            galleryImages: true,
            variants: true,
          },
        },
        deliveries: {
          orderBy: {
            deliveryDate: 'desc',
          },
          take: 5, // Return last 5 delivery history records
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async processDailySubscriptions(date?: string) {
    const searchDate = date ? new Date(date) : new Date();
    searchDate.setHours(0, 0, 0, 0);

    this.logger.log(`[Scheduler] Running daily subscription processing for date: ${searchDate.toISOString()}`);

    try {
      const activeSubs = await this.prisma.subscription.findMany({
        where: {
          status: 'ACTIVE',
          nextDelivery: {
            gte: searchDate,
            lt: new Date(searchDate.getTime() + 24 * 60 * 60 * 1000),
          },
        },
        include: {
          product: {
            include: { variants: true },
          },
          user: true,
        },
      });

      this.logger.log(`Found ${activeSubs.length} active deliveries scheduled for matching date`);

      let successCount = 0;
      let failCount = 0;

      for (const sub of activeSubs) {
        const cost = Number((sub.product as any).variants?.[0]?.sellingPrice || 100) * sub.quantity;
        const balance = Number(sub.user.walletBalance);

        if (balance >= cost) {
          // 1. Transactional wallet deduction
          await this.prisma.$transaction(async (tx) => {
            await tx.user.update({
              where: { id: sub.userId },
              data: {
                walletBalance: {
                  decrement: cost,
                },
              },
            });

            // 2. Log ledger debit transaction
            await tx.walletTransaction.create({
              data: {
                userId: sub.userId,
                amount: cost,
                type: 'DEBIT',
                description: `Daily subscription delivery: ${sub.quantity}x ${sub.product.title}`,
                referenceId: sub.id,
              },
            });

            // 3. Create delivery entry
            await tx.subscriptionDelivery.create({
              data: {
                subscriptionId: sub.id,
                deliveryDate: searchDate,
                status: 'PENDING',
                quantity: sub.quantity,
                priceCharged: cost,
              },
            });

            // 4. Calculate and set next delivery date
            const tomorrow = new Date(searchDate);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const nextDelivery = this.calculateNextDelivery(sub.frequency, sub.daysOfWeek, tomorrow);

            await tx.subscription.update({
              where: { id: sub.id },
              data: {
                nextDelivery,
              },
            });
          });

          this.logger.log(`[Scheduler] SUCCESS: Scheduled delivery of ${sub.product.title} to user: ${sub.user.name ?? sub.user.phone}`);
          successCount++;
        } else {
          // Insufficient Balance: Log failed delivery, do not deduct, pause subscription
          await this.prisma.$transaction(async (tx) => {
            await tx.subscriptionDelivery.create({
              data: {
                subscriptionId: sub.id,
                deliveryDate: searchDate,
                status: 'FAILED_INSUFFICIENT_BALANCE',
                quantity: sub.quantity,
                priceCharged: 0.00,
              },
            });

            // Auto-pause to prevent recurring failures
            await tx.subscription.update({
              where: { id: sub.id },
              data: {
                status: 'PAUSED',
              },
            });
          });

          this.logger.warn(`[Scheduler] FAILED: Insufficient balance (${balance} INR < ${cost} INR) for user: ${sub.user.name ?? sub.user.phone}. Subscription paused.`);
          failCount++;
        }
      }

      this.logger.log(`[Scheduler Completed] Success: ${successCount}, Failed: ${failCount}`);
      return { successCount, failCount };
    } catch (error) {
      this.logger.error('Failed to run daily subscription delivery processing loop', error.stack);
      throw error;
    }
  }

  /**
   * Helper utility to calculate the next delivery date based on frequency rules.
   */
  private calculateNextDelivery(frequency: string, daysOfWeek: number[], fromDate: Date): Date {
    const next = new Date(fromDate);
    next.setHours(0, 0, 0, 0);

    if (frequency === 'DAILY') {
      return next;
    }

    if (frequency === 'ALTERNATE') {
      next.setDate(next.getDate() + 1);
      return next;
    }

    if (frequency === 'CUSTOM' && daysOfWeek && daysOfWeek.length > 0) {
      // Loop up to 7 days ahead to find the next matching day of the week
      for (let i = 0; i < 7; i++) {
        const currentDay = next.getDay();
        if (daysOfWeek.includes(currentDay)) {
          return next;
        }
        next.setDate(next.getDate() + 1);
      }
    }

    // Default fallback to next day
    return next;
  }
}
