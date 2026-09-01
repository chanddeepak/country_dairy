import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';

/**
 * Lets a scheduled job in, and nothing else.
 *
 * The sweep has to run every quarter of an hour for ever, and the staff routes
 * it would otherwise use are behind a JWT that expires in a week — a scheduler
 * holding one would silently stop working on day eight, which is exactly the
 * kind of failure nobody notices until stock has been held for a month.
 *
 * So: a shared secret, sent as a header, compared in constant time. It grants
 * no user, no role and no session; it opens one route that takes no input a
 * caller can steer.
 *
 * With CRON_SECRET unset the route is closed rather than open — an empty
 * secret matching an empty header is how this pattern usually goes wrong.
 */
@Injectable()
export class CronGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.CRON_SECRET;
    if (!expected) {
      throw new UnauthorizedException('Scheduled tasks are not configured');
    }

    const req = context.switchToHttp().getRequest<Request>();
    const header = req.header('x-cron-secret');
    if (!header) {
      throw new UnauthorizedException('Not authorised');
    }

    // Buffers of unequal length make timingSafeEqual throw, and the length
    // itself is not a secret worth protecting here.
    const a = Buffer.from(header);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Not authorised');
    }

    return true;
  }
}
