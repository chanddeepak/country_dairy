import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ReviewsService } from './reviews.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateReviewDto, UpdateReviewDto } from './dto/reviews.dto';

const REVIEW_STAFF = [Role.SUPER_ADMIN, Role.CATALOG_MANAGER] as const;

/** Admin moderation queue. Declared separately from the public product route. */
@Controller('reviews')
@UseGuards(AuthGuard, RolesGuard)
export class ReviewsAdminController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('admin')
  @Roles(...REVIEW_STAFF)
  async list(
    @Query('deleted') deleted?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.reviewsService.listForModeration(deleted === 'true', search, {
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 20,
    });
  }

  @Get('admin/stats')
  @Roles(...REVIEW_STAFF)
  async stats() {
    return this.reviewsService.getModerationStats();
  }

  /**
   * Take a review down. Recoverable — it moves to the deleted list rather
   * than disappearing, and the customer's photographs are kept so that
   * restoring it brings back what they actually wrote.
   */
  @Delete('admin/:id')
  @Roles(...REVIEW_STAFF)
  async remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.reviewsService.softDelete(id, user.id);
  }

  @Post('admin/:id/restore')
  @Roles(...REVIEW_STAFF)
  async restore(@Param('id') id: string) {
    return this.reviewsService.restore(id);
  }

  /**
   * Destroy it, attachments included. Separate verb and separate route from
   * the takedown on purpose: nothing on the day-to-day list should be one
   * click away from being unrecoverable.
   */
  @Delete('admin/:id/permanent')
  @Roles(...REVIEW_STAFF)
  async destroy(@Param('id') id: string) {
    return this.reviewsService.deleteForever(id);
  }
}

@Controller('products/:productId/reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  async getReviews(
    @Param('productId') productId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.reviewsService.getReviews(productId, {
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 5,
    });
  }

  /** Every review this customer has left on the product. */
  @Get('mine')
  @UseGuards(AuthGuard)
  async getMyReviews(
    @CurrentUser() user: { id: string },
    @Param('productId') productId: string,
  ) {
    return this.reviewsService.getMyReviews(user.id, productId);
  }

  @Patch(':reviewId')
  @UseGuards(AuthGuard)
  async updateOwnReview(
    @CurrentUser() user: { id: string },
    @Param('reviewId') reviewId: string,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.reviewsService.updateOwnReview(user.id, reviewId, dto);
  }

  @Delete(':reviewId')
  @UseGuards(AuthGuard)
  async deleteOwnReview(
    @CurrentUser() user: { id: string },
    @Param('reviewId') reviewId: string,
  ) {
    return this.reviewsService.deleteOwnReview(user.id, reviewId);
  }

  @Post()
  @UseGuards(AuthGuard)
  async createReview(
    @CurrentUser() user: { id: string },
    @Param('productId') productId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.createReview(
      user.id,
      productId,
      dto.rating,
      dto.title,
      dto.comment,
      dto.mediaUrls,
      dto.mediaTypes,
    );
  }
}
