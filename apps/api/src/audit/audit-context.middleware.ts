import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { requestContext } from './request-context';

interface RequestWithUser extends Request {
  user?: { id: string; name?: string | null; email?: string | null };
}

/**
 * Opens an AsyncLocalStorage scope for each request so audit entries can name
 * the acting user without every service method taking a userId parameter.
 *
 * Middleware runs before guards, so `req.user` is not populated yet — the
 * store is mutated in place by the guard once the token is verified.
 */
@Injectable()
export class AuditContextMiddleware implements NestMiddleware {
  use(req: RequestWithUser, _res: Response, next: NextFunction) {
    const forwarded = req.headers['x-forwarded-for'];
    const ipAddress =
      (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]?.trim()) ||
      req.socket.remoteAddress;

    requestContext.run({ ipAddress }, () => next());
  }
}
