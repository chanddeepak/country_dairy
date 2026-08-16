import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { MediaType, OrderStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FLAG, FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { MediaService } from '../media/media.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    private prisma: PrismaService,
    private featureFlags: FeatureFlagsService,
    private media: MediaService,
    private audit: AuditService,
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

    // Everything that has not been taken down. There is no approval gate.
    const where = { productId, deletedAt: null };

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

  /**
   * The moderation list, in one of two states.
   *
   * There is no approval queue: reviews publish the moment they are written,
   * so the only question a moderator ever answers is whether something should
   * come down. `deleted` picks which of the two lists they are looking at.
   */
  async listForModeration(
    deleted: boolean,
    search?: string,
    options: { page?: number; pageSize?: number } = {},
  ) {
    const pageSize = Math.min(Math.max(options.pageSize ?? 20, 1), 100);
    const page = Math.max(options.page ?? 1, 1);

    const where = {
      deletedAt: deleted ? { not: null } : null,
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
        // Most recently removed first when looking at the deleted list —
        // a mistake is usually noticed straight after it is made.
        orderBy: deleted ? { deletedAt: 'desc' } : { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.productReview.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  /**
   * Take a review down. Recoverable, and the attachments stay where they are.
   *
   * Removing the photographs here would make "restore" a lie: the review would
   * come back with empty frames where the customer's pictures used to be.
   */
  async softDelete(reviewId: string, actorId: string) {
    const review = await this.prisma.productReview.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('Review not found');
    if (review.deletedAt) throw new BadRequestException('That review is already deleted');

    const updated = await this.prisma.productReview.update({
      where: { id: reviewId },
      data: { deletedAt: new Date(), deletedBy: actorId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        product: { select: { id: true, title: true, slug: true } },
      },
    });

    await this.audit.record({
      action: 'UPDATE',
      entity: 'ProductReview',
      entityId: reviewId,
      before: { deletedAt: null },
      after: { deletedAt: updated.deletedAt },
    });

    this.logger.log(`Review ${reviewId} hidden from customers`);
    return updated;
  }

  /** Put it back on the product page, exactly as it was. */
  async restore(reviewId: string) {
    const review = await this.prisma.productReview.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('Review not found');
    if (!review.deletedAt) throw new BadRequestException('That review is not deleted');

    const updated = await this.prisma.productReview.update({
      where: { id: reviewId },
      data: { deletedAt: null, deletedBy: null },
      include: {
        user: { select: { id: true, name: true, email: true } },
        product: { select: { id: true, title: true, slug: true } },
      },
    });

    await this.audit.record({
      action: 'UPDATE',
      entity: 'ProductReview',
      entityId: reviewId,
      before: { deletedAt: review.deletedAt },
      after: { deletedAt: null },
    });

    this.logger.log(`Review ${reviewId} restored`);
    return updated;
  }

  /**
   * Gone for good, attachments and all.
   *
   * Only reachable from the deleted list, so nothing can be destroyed in one
   * step from the page a moderator spends their time on. Refusing to do this
   * to a live review is the guard that makes that true rather than merely
   * conventional.
   */
  async deleteForever(reviewId: string) {
    const review = await this.prisma.productReview.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('Review not found');
    if (!review.deletedAt) {
      throw new BadRequestException('Delete the review first, then remove it permanently');
    }

    await this.prisma.productReview.delete({ where: { id: reviewId } });
    await this.releaseMedia(review.mediaUrls);

    await this.audit.record({
      action: 'DELETE',
      entity: 'ProductReview',
      entityId: reviewId,
      before: { rating: review.rating, productId: review.productId },
      after: { permanent: true, attachmentsRemoved: review.mediaUrls.length },
    });

    this.logger.log(`Review ${reviewId} destroyed with ${review.mediaUrls.length} attachment(s)`);
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
    const [live, deleted] = await Promise.all([
      this.prisma.productReview.count({ where: { deletedAt: null } }),
      this.prisma.productReview.count({ where: { deletedAt: { not: null } } }),
    ]);

    return { live, deleted };
  }
}
