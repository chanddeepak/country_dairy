import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { MediaType, OrderStatus, PaymentStatus, ReviewStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FLAG, FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { MediaService } from '../media/media.service';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    private prisma: PrismaService,
    private featureFlags: FeatureFlagsService,
    private media: MediaService,
  ) {}

  /**
   * Storefront listing — approved reviews only, paginated.
   *
   * The aggregate is computed across every approved review, not just the page
   * being returned, so the average does not change as the reader pages through.
   */
  async getReviews(productId: string, options: { page?: number; pageSize?: number } = {}) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const pageSize = Math.min(Math.max(options.pageSize ?? 5, 1), 50);
    const page = Math.max(options.page ?? 1, 1);

    const where = { productId, status: ReviewStatus.APPROVED };

    const [grouped, reviews] = await Promise.all([
      this.prisma.productReview.groupBy({ by: ['rating'], where, _count: true }),
      this.prisma.productReview.findMany({
        where,
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const totalReviews = grouped.reduce((sum, g) => sum + g._count, 0);
    const ratingSum = grouped.reduce((sum, g) => sum + g.rating * g._count, 0);
    const averageRating = totalReviews > 0 ? Number((ratingSum / totalReviews).toFixed(2)) : 0;

    return {
      averageRating,
      totalReviews,
      // Star histogram for the ratings breakdown on the product page.
      distribution: [5, 4, 3, 2, 1].map((stars) => ({
        stars,
        count: grouped.find((g) => g.rating === stars)?._count ?? 0,
      })),
      reviews,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(totalReviews / pageSize)),
      hasMore: page * pageSize < totalReviews,
    };
  }

  /** Lets a customer withdraw their own review. Staff deletion is separate. */
  async deleteOwnReview(userId: string, reviewId: string) {
    const review = await this.prisma.productReview.findUnique({ where: { id: reviewId } });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.userId !== userId) {
      throw new ForbiddenException('You can only delete your own review');
    }

    await this.prisma.productReview.delete({ where: { id: reviewId } });
    await this.releaseMedia(review.mediaUrls);

    return { success: true };
  }

  async createReview(
    userId: string,
    productId: string,
    rating: number,
    title?: string,
    comment?: string,
    mediaUrls?: string[],
    mediaTypes?: MediaType[],
  ) {
    if (!(await this.featureFlags.isEnabled(FLAG.PRODUCT_RATINGS))) {
      throw new ForbiddenException('Reviews are not currently accepted');
    }

    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException('Product not found');
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
        // Default anything unlabelled to IMAGE so the arrays stay the same
        // length and the storefront can pair them positionally.
        mediaTypes: (mediaUrls ?? []).map((_, i) => mediaTypes?.[i] ?? MediaType.IMAGE),
        isVerifiedPurchase: !!purchased,
        // Published on submission. Moderation is a takedown rather than a
        // gate, so a customer sees their own words straight away.
        status: ReviewStatus.APPROVED,
      },
      include: { user: { select: { name: true } } },
    });
  }

  /** Lets a customer correct their own review. */
  async updateOwnReview(
    userId: string,
    reviewId: string,
    dto: {
      rating?: number;
      title?: string;
      comment?: string;
      mediaUrls?: string[];
      mediaTypes?: MediaType[];
    },
  ) {
    const review = await this.prisma.productReview.findUnique({ where: { id: reviewId } });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.userId !== userId) {
      throw new ForbiddenException('You can only edit your own review');
    }

    const mediaUrls = dto.mediaUrls ?? review.mediaUrls;

    // Anything the customer took off the review has no other referent, so it
    // would otherwise sit in the bucket for ever being paid for.
    if (dto.mediaUrls) {
      await this.releaseMedia(review.mediaUrls.filter((url) => !mediaUrls.includes(url)));
    }

    return this.prisma.productReview.update({
      where: { id: reviewId },
      data: {
        rating: dto.rating ?? review.rating,
        title: dto.title ?? review.title,
        comment: dto.comment ?? review.comment,
        mediaUrls,
        mediaTypes: mediaUrls.map(
          (_, i) => dto.mediaTypes?.[i] ?? review.mediaTypes[i] ?? MediaType.IMAGE,
        ),
        editedAt: new Date(),
      },
      include: { user: { select: { name: true } } },
    });
  }

  /** Every review this customer left on a product, newest first. */
  async getMyReviews(userId: string, productId: string) {
    return this.prisma.productReview.findMany({
      where: { userId, productId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // --- Admin moderation ---

  async listForModeration(
    status?: ReviewStatus,
    search?: string,
    options: { page?: number; pageSize?: number } = {},
  ) {
    const pageSize = Math.min(Math.max(options.pageSize ?? 20, 1), 100);
    const page = Math.max(options.page ?? 1, 1);

    const where = {
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
    };

    const [items, total] = await Promise.all([
      this.prisma.productReview.findMany({
        where,
        // mediaUrls/mediaTypes come through the model, so a moderator can see
        // the photos and video attached to what they are judging.
        include: {
          user: { select: { id: true, name: true, email: true } },
          product: { select: { id: true, title: true, slug: true } },
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.productReview.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
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
    await this.releaseMedia(review.mediaUrls);

    this.logger.log(`Review ${reviewId} removed with ${review.mediaUrls.length} attachment(s)`);
    return { success: true };
  }

  /**
   * Removes attachments that no longer belong to anything.
   *
   * Never throws: a customer deleting their review must not fail because the
   * storage provider is having a bad minute. A file left behind is a cost
   * problem; a failed delete they cannot retry is a correctness one.
   */
  private async releaseMedia(urls: string[]) {
    for (const url of urls) {
      try {
        await this.media.deleteMediaFile(url);
      } catch (err) {
        this.logger.warn(`Could not remove review attachment ${url}: ${(err as Error).message}`);
      }
    }
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
