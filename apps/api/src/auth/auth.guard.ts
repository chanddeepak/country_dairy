import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { requestContext } from '../audit/request-context';

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
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
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
      throw new ForbiddenException('This account has been deactivated');
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
