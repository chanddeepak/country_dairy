import { Module } from '@nestjs/common';
import { CmsController } from './cms.controller';
import { CmsService } from './cms.service';
import { FeatureFlagsService } from './feature-flags.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MediaModule } from '../media/media.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, MediaModule, AuthModule],
  controllers: [CmsController],
  providers: [CmsService, FeatureFlagsService],
  exports: [CmsService, FeatureFlagsService],
})
export class CmsModule {}
