import { Module } from '@nestjs/common';
import { ShiprocketController } from './shiprocket.controller';
import { ShiprocketService } from './shiprocket.service';
import { ShiprocketOrderService } from './shiprocket-order.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [ShiprocketController],
  providers: [ShiprocketService, ShiprocketOrderService],
  exports: [ShiprocketService, ShiprocketOrderService],
})
export class ShiprocketModule {}
