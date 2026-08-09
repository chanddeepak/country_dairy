import { Module } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { ReviewsAdminController, ReviewsController } from './reviews.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ReviewsAdminController, ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
