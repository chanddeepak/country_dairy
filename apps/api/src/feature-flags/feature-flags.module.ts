import { Global, Module } from '@nestjs/common';
import { FeatureFlagsService } from './feature-flags.service';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Global so that auth, catalog, orders and cms can all read flags without
 * importing each other. Depends only on Prisma, which keeps it free of the
 * Auth <-> Cms cycle that a shared service in either module would create.
 */
@Global()
@Module({
  imports: [PrismaModule],
  providers: [FeatureFlagsService],
  exports: [FeatureFlagsService],
})
export class FeatureFlagsModule {}
