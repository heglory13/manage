import { Role } from '@prisma/client/index';
import type { PermissionState } from '../permissions.js';
export interface UserPayload {
    userId: string;
    email: string;
    role: Role;
    permissions?: PermissionState;
}
