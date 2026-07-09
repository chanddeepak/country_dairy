import { Injectable, Logger, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(private prisma: PrismaService) {}

  async getReviews(productId: string) {
    this.logger.log(`Fetching reviews for productId: ${productId}`);
    try {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new NotFoundException(`Product not found`);
      }

      return await this.prisma.productReview.findMany({
        where: { productId },
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Failed to fetch reviews for product: ${productId}`, error.stack);
      throw error;
    }
  }

  async createReview(
    userId: string,
    productId: string,
    rating: number,
    title?: string,
    comment?: string,
    mediaUrls?: string[],
  ) {
    this.logger.log(`Submitting review: userId=${userId}, productId=${productId}, rating=${rating}`);
    try {
      // Validate product existence
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        this.logger.warn(`Failed to create review: Product ${productId} not found`);
        throw new NotFoundException('Product not found');
      }

      // Check if user has already submitted a review
      const existing = await this.prisma.productReview.findUnique({
        where: {
          userId_productId: {
            userId,
            productId,
          },
        },
      });

      if (existing) {
        this.logger.warn(`User ${userId} has already reviewed product ${productId}`);
        throw new ConflictException('You have already submitted a review for this product');
      }

      // Save new review
      return await this.prisma.productReview.create({
        data: {
          userId,
          productId,
          rating,
          title,
          comment,
          mediaUrls: mediaUrls || [],
        },
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) throw error;
      this.logger.error(`Failed to submit review for product: ${productId} by user: ${userId}`, error.stack);
      throw error;
    }
  }
}
