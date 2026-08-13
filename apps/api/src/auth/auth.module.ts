import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { MediaModule } from '../media/media.module';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * There is deliberately no fallback secret here. A shared default is worse
 * than a crash: the previous one was also hardcoded in the admin bundle, so
 * anyone who read the shipped JavaScript could mint a SUPER_ADMIN token.
 */
function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      'JWT_SECRET must be set to a random value of at least 32 characters. ' +
        'Generate one with: openssl rand -base64 48',
    );
  }

  return secret;
}

@Module({
  imports: [
    PrismaModule,
    // Mutual by nature rather than by accident: closing an account has to
    // remove the customer's uploaded review photographs, and MediaModule's
    // own controller is guarded by AuthGuard, which injects AuthService.
    forwardRef(() => MediaModule),
    JwtModule.register({
      global: true,
      secret: requireJwtSecret(),
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as `${number}d` },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
