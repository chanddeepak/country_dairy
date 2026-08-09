import { Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { AuthModule } from '../auth/auth.module';
import { CmsModule } from '../cms/cms.module';

@Module({
  imports: [AuthModule, CmsModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
