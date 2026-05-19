import { SetMetadata } from '@nestjs/common';
import type { PermissionModule, PermissionAction } from '../permissions.js';

export const PERMISSION_KEY = 'require_permission';

export const RequirePermission = (
  module: PermissionModule,
  action: PermissionAction,
) => SetMetadata(PERMISSION_KEY, { module, action });
