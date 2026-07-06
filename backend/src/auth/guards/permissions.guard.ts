import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator.js';
import type { PermissionModule, PermissionAction } from '../permissions.js';

interface RequiredPermission {
  module: PermissionModule;
  action: PermissionAction;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RequiredPermission>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('Forbidden');

    const hasAccess = Boolean(
      (
        user.permissions as Record<string, Record<string, boolean>> | undefined
      )?.[required.module]?.[required.action],
    );

    if (!hasAccess) throw new ForbiddenException('Forbidden');

    return true;
  }
}
