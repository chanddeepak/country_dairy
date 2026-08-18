import { Module } from '@nestjs/common';
import { ShiprocketController } from './shiprocket.controller';
import { ShiprocketService } from './shiprocket.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ShiprocketController],
  providers: [ShiprocketService],
  exports: [ShiprocketService],
})
export class ShiprocketModule {}
