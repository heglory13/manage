import { Role } from '@prisma/client/index';

export const permissionModules = [
  'dashboard',
  'inventory',
  'barcodePrint',
  'preliminaryChecks',
  'transactions',
  'audit',
  'warehouse',
  'input',
  'orderPlans',
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
    barcodePrint: createFlags({ view: true }),
    preliminaryChecks: createFlags({ view: true }),
    transactions: createFlags({ view: true }),
    audit: createFlags({ view: true }),
    warehouse: createFlags({ view: true }),
    input: createFlags({ view: true }),
    orderPlans: createFlags({ view: true }),
    activityLogs: createFlags(),
    users: createFlags(),
    generalSettings: createFlags(),
  };

  if (role === Role.ADMIN) {
    base.inventory = createFlags({
      view: true,
      create: true,
      save: true,
      edit: true,
      delete: true,
    });
    base.barcodePrint = createFlags({
      view: true,
      create: true,
      save: true,
      edit: true,
      delete: true,
    });
    base.preliminaryChecks = createFlags({
      view: true,
      create: true,
      save: true,
      edit: true,
      delete: true,
    });
    base.transactions = createFlags({
      view: true,
      create: true,
      save: true,
      edit: true,
      delete: true,
    });
    base.audit = createFlags({
      view: true,
      create: true,
      save: true,
      edit: true,
      delete: true,
    });
    base.warehouse = createFlags({
      view: true,
      create: true,
      save: true,
      edit: true,
      delete: true,
    });
    base.input = createFlags({
      view: true,
      create: true,
      save: true,
      edit: true,
      delete: true,
    });
    base.orderPlans = createFlags({
      view: true,
      create: true,
      save: true,
      edit: true,
      delete: true,
    });
    base.activityLogs = createFlags({ view: true });
    base.users = createFlags({
      view: true,
      create: true,
      save: true,
      edit: true,
      delete: true,
    });
    base.generalSettings = createFlags({ view: true, save: true, edit: true });
    return base;
  }

  if (role === Role.MANAGER) {
    base.inventory = createFlags({
      view: true,
      create: true,
      save: true,
      edit: true,
    });
    base.barcodePrint = createFlags({
      view: true,
      create: true,
      save: true,
      edit: true,
    });
    base.preliminaryChecks = createFlags({
      view: true,
      create: true,
      save: true,
      edit: true,
    });
    base.transactions = createFlags({
      view: true,
      create: true,
      save: true,
      edit: true,
    });
    base.audit = createFlags({
      view: true,
      create: true,
      save: true,
      edit: true,
    });
    base.warehouse = createFlags({
      view: true,
      create: true,
      save: true,
      edit: true,
    });
    base.input = createFlags({
      view: true,
      create: true,
      save: true,
      edit: true,
    });
    base.orderPlans = createFlags({
      view: true,
      create: true,
      save: true,
      edit: true,
    });
    base.activityLogs = createFlags({ view: true });
    base.users = createFlags({
      view: true,
      create: true,
      save: true,
      edit: true,
      delete: true,
    });
    base.generalSettings = createFlags({ view: true, save: true, edit: true });
    return base;
  }

  // STAFF — chỉ view mặc định khi tạo mới, Admin/Quản lý có thể cấp thêm qua phân quyền
  base.barcodePrint = createFlags({ view: true, create: true });
  base.preliminaryChecks = createFlags({
    view: true,
    create: true,
    save: true,
  });
  base.transactions = createFlags({ view: true, create: true, save: true });
  base.audit = createFlags({ view: true, create: true, save: true });
  base.orderPlans = createFlags({ view: true, create: true, save: true });
  return base;
}

// Trần quyền (ceiling): quyền tối đa có thể cấp cho từng role.
// Admin có thể cấp tất cả (kể cả delete) cho mọi role.
// Manager không thể cấp delete — logic này được enforce ở frontend.
function createCeilingPermissions(_role: Role): PermissionState {
  // Với mọi role, ceiling = full quyền — Admin được tự do quyết định cấp gì
  const full = createFlags({
    view: true,
    create: true,
    save: true,
    edit: true,
    delete: true,
  });
  return {
    dashboard: full,
    inventory: full,
    barcodePrint: full,
    preliminaryChecks: full,
    transactions: full,
    audit: full,
    warehouse: full,
    input: full,
    orderPlans: full,
    activityLogs: full,
    users: full,
    generalSettings: full,
  };
}

export function normalizePermissions(
  value: unknown,
  role: Role,
): PermissionState {
  const defaults = createDefaultPermissions(role);
  const ceiling = createCeilingPermissions(role);

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
        // Chỉ cho phép true nếu ceiling của role cho phép action đó
        defaults[moduleKey][action] = ceiling[moduleKey][action] ? raw : false;
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
