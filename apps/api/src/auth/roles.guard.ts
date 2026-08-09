import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from './roles.decorator';
import { AuthenticatedUser } from './auth.guard';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles?.length) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    if (!user) {
      throw new ForbiddenException('Insufficient permissions');
    }

    // Super admin is implicitly granted every role, matching the admin
    // console's own permission model.
    if (user.role === Role.SUPER_ADMIN) {
      return true;
    }

    if (!requiredRoles.includes(user.role as Role)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
