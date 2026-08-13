import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { RazorpayService } from './razorpay.service';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { AuthModule } from '../auth/auth.module';
import { CmsModule } from '../cms/cms.module';

@Module({
  imports: [AuthModule, CmsModule],
  controllers: [OrdersController, WebhookController],
  providers: [OrdersService, RazorpayService, WebhookService],
  exports: [OrdersService],
})
export class OrdersModule {}
