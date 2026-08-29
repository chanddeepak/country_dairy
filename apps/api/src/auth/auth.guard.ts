import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { requestContext } from '../audit/request-context';
import { ALLOW_GUEST } from './allow-guest.decorator';

export interface AuthenticatedUser {
  id: string;
  role: string;
  email: string | null;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private authService: AuthService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      /*
       * Guest routes run with no user rather than being refused. Note the
       * order: only a *missing* token takes this path. A token that is present
       * but invalid still fails below, because silently downgrading an expired
       * session to a guest would attach a customer's order to nobody.
       */
      const allowGuest = this.reflector.getAllAndOverride<boolean>(ALLOW_GUEST, [
        context.getHandler(),
        context.getClass(),
      ]);

      if (allowGuest) return true;

      throw new UnauthorizedException('Authentication token missing');
    }

    let payload: { sub: string };
    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired authentication token');
    }

    // The token proves who signed in; the database decides what they are now.
    // Trusting the token's own role claim would keep deleted or demoted
    // accounts working until their token happened to expire.
    const user = await this.authService.validateUserById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('Account no longer exists');
    }

    if (!user.isActive) {
      // 401, not 403. A 403 means "you are authenticated but not allowed this
      // resource" — what RolesGuard returns when a customer hits an admin
      // route, and something a client must not treat as the session ending.
      // A deactivated account cannot authenticate at all, so its session is
      // over and the client should sign it out.
      throw new UnauthorizedException('This account has been deactivated');
    }

    (request as Request & { user: AuthenticatedUser }).user = {
      id: user.id,
      role: user.role,
      email: user.email,
    };

    // Name the actor for any audit entry written later in this request. The
    // middleware opened the scope before the token was available.
    const store = requestContext.getStore();
    if (store) {
      store.userId = user.id;
      store.userName = user.name || user.email || 'Unknown';
    }

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
