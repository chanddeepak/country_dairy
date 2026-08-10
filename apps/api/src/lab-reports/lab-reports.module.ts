import { Module } from '@nestjs/common';
import { LabReportsController } from './lab-reports.controller';
import { LabReportsService } from './lab-reports.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MediaModule } from '../media/media.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, MediaModule, AuthModule],
  controllers: [LabReportsController],
  providers: [LabReportsService],
  exports: [LabReportsService],
})
export class LabReportsModule {}
