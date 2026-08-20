import { Module } from '@nestjs/common';
import { ShiprocketController } from './shiprocket.controller';
import { ShiprocketService } from './shiprocket.service';
import { ShiprocketOrderService } from './shiprocket-order.service';
import { ShiprocketClient } from './shiprocket-client.service';
import { ShiprocketCheckoutService } from './shiprocket-checkout.service';
import { ShiprocketCheckoutController } from './shiprocket-checkout.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [ShiprocketController, ShiprocketCheckoutController],
  providers: [
    ShiprocketService,
    ShiprocketOrderService,
    ShiprocketClient,
    ShiprocketCheckoutService,
  ],
  exports: [ShiprocketService, ShiprocketOrderService, ShiprocketClient],
})
export class ShiprocketModule {}
