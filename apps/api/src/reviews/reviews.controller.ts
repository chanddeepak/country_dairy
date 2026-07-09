import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('products/:productId/reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  async getReviews(@Param('productId') productId: string) {
    return this.reviewsService.getReviews(productId);
  }

  @Post()
  @UseGuards(AuthGuard)
  async createReview(
    @CurrentUser() user: any,
    @Param('productId') productId: string,
    @Body('rating') rating: number,
    @Body('title') title?: string,
    @Body('comment') comment?: string,
    @Body('mediaUrls') mediaUrls?: string[],
  ) {
    return this.reviewsService.createReview(
      user.id,
      productId,
      Number(rating),
      title,
      comment,
      mediaUrls,
    );
  }
}
