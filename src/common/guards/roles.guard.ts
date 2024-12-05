import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true; // ไม่มีการกำหนด Role, อนุญาตให้เข้าถึง
    const { user } = context.switchToHttp().getRequest();
    if (!requiredRoles.some((role) => user?.role === role)) {
      throw new ForbiddenException('You do not have the required role');
    }
    return true;
  }
}
