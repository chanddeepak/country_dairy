import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import * as crypto from 'crypto';

/**
 * Guards the endpoints Shiprocket calls on us.
 *
 * Their scheme, both directions: `X-Api-Key` identifies the caller and
 * `X-Api-HMAC-SHA256` carries a base64 HMAC-SHA256 of the request body,
 * signed with the shared secret. Their documented failure code for a bad key
 * or digest is 511, so that is what we answer with rather than 401 — a
 * client written against their spec will be looking for it.
 *
 * These endpoints expose the whole catalogue including stock levels, so the
 * key alone is not enough: without the digest, a leaked key read from a log
 * would be sufficient to pull it.
 */
@Injectable()
export class ShiprocketAuthGuard implements CanActivate {
  private readonly logger = new Logger(ShiprocketAuthGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { rawBody?: Buffer }>();

    const apiKey = process.env.SHIPROCKET_API_KEY;
    const apiSecret = process.env.SHIPROCKET_API_SECRET;

    // Unconfigured means closed. An integration that silently accepts
    // everything because a variable is missing is worse than one that is off.
    if (!apiKey || !apiSecret) {
      this.logger.warn('Shiprocket credentials are not configured; refusing the request');
      throw new UnauthenticatedError();
    }

    const presentedKey = req.header('X-Api-Key') ?? '';
    if (!safeEqual(presentedKey, apiKey)) {
      throw new UnauthenticatedError();
    }

    const presentedDigest = req.header('X-Api-HMAC-SHA256') ?? '';

    // A GET carries no body, so the digest is over an empty string. Their
    // collection sends the header on every request either way.
    const body = req.rawBody ? req.rawBody.toString('utf8') : '';
    const expected = crypto.createHmac('sha256', apiSecret).update(body).digest('base64');

    if (!safeEqual(presentedDigest, expected)) {
      this.logger.warn('Shiprocket request rejected: HMAC mismatch');
      throw new UnauthenticatedError();
    }

    return true;
  }
}

/**
 * 511, because that is the code their documentation tells callers to expect.
 *
 * An HttpException rather than a bare Error: a plain throw leaves Nest to
 * treat it as an unhandled crash and answer 500, which tells their client the
 * fault is ours and buries a rejected key in our error logs as a bug.
 */
class UnauthenticatedError extends HttpException {
  constructor() {
    super('Invalid X-Api-Key or X-Api-HMAC-SHA256', 511);
  }
}

/**
 * Constant-time compare that does not leak length.
 *
 * timingSafeEqual throws when the buffers differ in size, and that throw is
 * itself a timing signal, so unequal lengths are compared against a known
 * value first and then reported false. Same shape as the Razorpay verifier.
 */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}
