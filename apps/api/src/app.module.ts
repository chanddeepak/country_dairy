import { Module } from '@nestjs/common';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { CartModule } from './cart/cart.module';
import { ReviewsModule } from './reviews/reviews.module';
import { MediaModule } from './media/media.module';
import { OrdersModule } from './orders/orders.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { CmsModule } from './cms/cms.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    FeatureFlagsModule,
    PrismaModule,
    AuthModule,
    CatalogModule,
    CartModule,
    ReviewsModule,
    MediaModule,
    OrdersModule,
    SubscriptionsModule,
    CmsModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
