import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as fc from 'fast-check';
import { RolesGuard } from './roles.guard.js';

/**
 * **Validates: Requirements 2.1, 10.1, 11.5, 13.1, 15.4**
 *
 * Property 1: RBAC access control
 * Với bất kỳ cặp (vai trò, tài nguyên), hệ thống chỉ cho phép truy cập
 * khi vai trò nằm trong danh sách được phép của tài nguyên đó.
 */
describe('RolesGuard - Property-Based Tests', () => {
  // Define the RBAC access control matrix
  const RBAC_MATRIX: Record<string, string[]> = {
    'dashboard:view': ['MANAGER', 'ADMIN'],
    'warehouse:manage': ['ADMIN'],
    'stocktaking:approve': ['MANAGER', 'ADMIN'],
    'users:manage': ['ADMIN'],
    'products:read': ['ADMIN', 'MANAGER', 'STAFF'],
    'inventory:operate': ['ADMIN', 'MANAGER', 'STAFF'],
  };

  const ALL_ROLES = ['ADMIN', 'MANAGER', 'STAFF'] as const;
  const ALL_RESOURCES = Object.keys(RBAC_MATRIX);

  function createMockContext(
    userRole: string,
    requiredRoles: string[] | undefined,
  ): { context: ExecutionContext; reflector: Reflector } {
    const mockRequest = {
      user: { userId: 'test-user', email: 'test@example.com', role: userRole },
    };

    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as unknown as ExecutionContext;

    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(requiredRoles),
    } as unknown as Reflector;

    return { context, reflector };
  }

  it('[PBT] Property 1: For any (role, resource) pair, access is allowed iff role is in the allowed list', () => {
    const roleArb = fc.constantFrom(...ALL_ROLES);
    const resourceArb = fc.constantFrom(...ALL_RESOURCES);

    fc.assert(
      fc.property(roleArb, resourceArb, (role, resource) => {
        const allowedRoles = RBAC_MATRIX[resource];
        const { context, reflector } = createMockContext(role, allowedRoles);
        const guard = new RolesGuard(reflector);

        const shouldAllow = allowedRoles.includes(role);

        if (shouldAllow) {
          expect(guard.canActivate(context)).toBe(true);
        } else {
          expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
        }
      }),
    );
  });

  it('[PBT] Property 1a: When no roles are required, any role should be allowed', () => {
    const roleArb = fc.constantFrom(...ALL_ROLES);

    fc.assert(
      fc.property(roleArb, (role) => {
        const { context, reflector } = createMockContext(role, undefined);
        const guard = new RolesGuard(reflector);

        expect(guard.canActivate(context)).toBe(true);
      }),
    );
  });

  it('[PBT] Property 1b: When roles are required but empty array, any role should be allowed', () => {
    const roleArb = fc.constantFrom(...ALL_ROLES);

    fc.assert(
      fc.property(roleArb, (role) => {
        const { context, reflector } = createMockContext(role, []);
        const guard = new RolesGuard(reflector);

        expect(guard.canActivate(context)).toBe(true);
      }),
    );
  });
});
