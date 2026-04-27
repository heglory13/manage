import { Role } from '@prisma/client/index';

export const permissionModules = [
  'dashboard',
  'inventory',
  'preliminaryChecks',
  'transactions',
  'audit',
  'warehouse',
  'input',
  'activityLogs',
  'users',
  'generalSettings',
] as const;

export const permissionActions = [
  'view',
  'create',
  'save',
  'edit',
  'delete',
] as const;

export type PermissionModule = (typeof permissionModules)[number];
export type PermissionAction = (typeof permissionActions)[number];
export type PermissionFlags = Record<PermissionAction, boolean>;
export type PermissionState = Record<PermissionModule, PermissionFlags>;

function createFlags(overrides?: Partial<PermissionFlags>): PermissionFlags {
  return {
    view: false,
    create: false,
    save: false,
    edit: false,
    delete: false,
    ...overrides,
  };
}

export function createDefaultPermissions(role: Role): PermissionState {
  const base: PermissionState = {
    dashboard: createFlags({ view: true }),
    inventory: createFlags({ view: true }),
    preliminaryChecks: createFlags({ view: true }),
    transactions: createFlags({ view: true }),
    audit: createFlags({ view: true }),
    warehouse: createFlags({ view: true }),
    input: createFlags({ view: true }),
    activityLogs: createFlags(),
    users: createFlags(),
    generalSettings: createFlags(),
  };

  if (role === Role.ADMIN) {
    base.inventory = createFlags({ view: true, create: true, save: true, edit: true, delete: true });
    base.preliminaryChecks = createFlags({ view: true, create: true, save: true, edit: true, delete: true });
    base.transactions = createFlags({ view: true, create: true, save: true, edit: true, delete: true });
    base.audit = createFlags({ view: true, create: true, save: true, edit: true, delete: true });
    base.warehouse = createFlags({ view: true, create: true, save: true, edit: true, delete: true });
    base.input = createFlags({ view: true, create: true, save: true, edit: true, delete: true });
    base.activityLogs = createFlags({ view: true });
    base.users = createFlags({ view: true, create: true, save: true, edit: true, delete: true });
    base.generalSettings = createFlags({ view: true, save: true, edit: true });
    return base;
  }

  if (role === Role.MANAGER) {
    base.inventory = createFlags({ view: true, create: true, save: true, edit: true });
    base.preliminaryChecks = createFlags({ view: true, create: true, save: true, edit: true });
    base.transactions = createFlags({ view: true, create: true, save: true, edit: true });
    base.audit = createFlags({ view: true, create: true, save: true, edit: true });
    base.warehouse = createFlags({ view: true, create: true, save: true, edit: true });
    base.input = createFlags({ view: true, create: true, save: true, edit: true });
    base.activityLogs = createFlags({ view: true });
    base.users = createFlags({ view: true, create: true, save: true, edit: true });
    return base;
  }

  base.inventory = createFlags({ view: true });
  base.preliminaryChecks = createFlags({ view: true, create: true, save: true });
  base.transactions = createFlags({ view: true, create: true, save: true });
  base.audit = createFlags({ view: true, create: true, save: true });
  base.warehouse = createFlags({ view: true });
  base.input = createFlags({ view: true });
  return base;
}

export function normalizePermissions(value: unknown, role: Role): PermissionState {
  const defaults = createDefaultPermissions(role);
  if (!value || typeof value !== 'object') {
    return defaults;
  }

  const candidate = value as Record<string, unknown>;
  for (const moduleKey of permissionModules) {
    const moduleValue = candidate[moduleKey];
    if (!moduleValue || typeof moduleValue !== 'object') {
      continue;
    }

    for (const action of permissionActions) {
      const raw = (moduleValue as Record<string, unknown>)[action];
      if (typeof raw === 'boolean') {
        defaults[moduleKey][action] = raw;
      }
    }
  }

  return defaults;
}

export function hasPermission(
  permissions: PermissionState | undefined,
  moduleKey: PermissionModule,
  action: PermissionAction,
) {
  return Boolean(permissions?.[moduleKey]?.[action]);
}
