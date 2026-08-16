import { Module } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { ReviewsAdminController, ReviewsController } from './reviews.controller';
import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuthModule, MediaModule, AuditModule],
  controllers: [ReviewsAdminController, ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
