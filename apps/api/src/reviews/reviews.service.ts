import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, PaymentStatus, ReviewStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FLAG, FeatureFlagsService } from '../feature-flags/feature-flags.service';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    private prisma: PrismaService,
    private featureFlags: FeatureFlagsService,
  ) {}

  /** Storefront listing — approved reviews only. */
  async getReviews(productId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const reviews = await this.prisma.productReview.findMany({
      where: { productId, status: ReviewStatus.APPROVED },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const total = reviews.length;
    const averageRating =
      total > 0 ? Number((reviews.reduce((sum, r) => sum + r.rating, 0) / total).toFixed(2)) : 0;

    return {
      averageRating,
      totalReviews: total,
      // Star histogram for the ratings breakdown on the product page.
      distribution: [5, 4, 3, 2, 1].map((stars) => ({
        stars,
        count: reviews.filter((r) => r.rating === stars).length,
      })),
      reviews,
    };
  }

  async createReview(
    userId: string,
    productId: string,
    rating: number,
    title?: string,
    comment?: string,
    mediaUrls?: string[],
  ) {
    if (!(await this.featureFlags.isEnabled(FLAG.PRODUCT_RATINGS))) {
      throw new ForbiddenException('Reviews are not currently accepted');
    }

    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const existing = await this.prisma.productReview.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    if (existing) {
      throw new ConflictException('You have already reviewed this product');
    }

    // A "Verified Purchase" badge has to mean something, so it is derived from
    // a paid order rather than taken on trust from the client. Payment is the
    // proof the badge actually claims; a cancelled order is not.
    const purchased = await this.prisma.orderItem.findFirst({
      where: {
        productId,
        order: {
          userId,
          paymentStatus: PaymentStatus.PAID,
          status: { not: OrderStatus.CANCELLED },
        },
      },
      select: { id: true },
    });

    return this.prisma.productReview.create({
      data: {
        userId,
        productId,
        rating,
        title,
        comment,
        mediaUrls: mediaUrls ?? [],
        isVerifiedPurchase: !!purchased,
        status: ReviewStatus.PENDING,
      },
    });
  }

  // --- Admin moderation ---

  async listForModeration(status?: ReviewStatus, search?: string) {
    return this.prisma.productReview.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' as const } },
                { comment: { contains: search, mode: 'insensitive' as const } },
                { product: { title: { contains: search, mode: 'insensitive' as const } } },
              ],
            }
          : {}),
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        product: { select: { id: true, title: true, slug: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    });
  }

  async moderate(reviewId: string, status: ReviewStatus, moderatorId: string) {
    if (status === ReviewStatus.PENDING) {
      throw new BadRequestException('Choose approve or reject');
    }

    const review = await this.prisma.productReview.findUnique({ where: { id: reviewId } });
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return this.prisma.productReview.update({
      where: { id: reviewId },
      data: { status, moderatedBy: moderatorId, moderatedAt: new Date() },
      include: {
        user: { select: { id: true, name: true, email: true } },
        product: { select: { id: true, title: true, slug: true } },
      },
    });
  }

  async deleteReview(reviewId: string) {
    const review = await this.prisma.productReview.findUnique({ where: { id: reviewId } });
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    await this.prisma.productReview.delete({ where: { id: reviewId } });
    return { success: true };
  }

  async getModerationStats() {
    const counts = await this.prisma.productReview.groupBy({
      by: ['status'],
      _count: true,
    });

    return {
      pending: counts.find((c) => c.status === ReviewStatus.PENDING)?._count ?? 0,
      approved: counts.find((c) => c.status === ReviewStatus.APPROVED)?._count ?? 0,
      rejected: counts.find((c) => c.status === ReviewStatus.REJECTED)?._count ?? 0,
    };
  }
}
