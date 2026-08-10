import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditContextMiddleware } from './audit-context.middleware';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

/**
 * Global so any service can record an audit entry without importing this
 * module — mutations happen across catalog, cms, orders and users.
 */
@Global()
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Every route, so the actor and IP are available wherever a write happens.
    consumer.apply(AuditContextMiddleware).forRoutes('*');
  }
}
