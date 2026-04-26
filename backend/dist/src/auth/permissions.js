"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.permissionActions = exports.permissionModules = void 0;
exports.createDefaultPermissions = createDefaultPermissions;
exports.normalizePermissions = normalizePermissions;
exports.hasPermission = hasPermission;
const index_1 = require("@prisma/client/index");
exports.permissionModules = [
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
];
exports.permissionActions = [
    'view',
    'create',
    'save',
    'edit',
    'delete',
];
function createFlags(overrides) {
    return {
        view: false,
        create: false,
        save: false,
        edit: false,
        delete: false,
        ...overrides,
    };
}
function createDefaultPermissions(role) {
    const base = {
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
    if (role === index_1.Role.ADMIN) {
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
    if (role === index_1.Role.MANAGER) {
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
function normalizePermissions(value, role) {
    const defaults = createDefaultPermissions(role);
    if (!value || typeof value !== 'object') {
        return defaults;
    }
    const candidate = value;
    for (const moduleKey of exports.permissionModules) {
        const moduleValue = candidate[moduleKey];
        if (!moduleValue || typeof moduleValue !== 'object') {
            continue;
        }
        for (const action of exports.permissionActions) {
            const raw = moduleValue[action];
            if (typeof raw === 'boolean') {
                defaults[moduleKey][action] = raw;
            }
        }
    }
    return defaults;
}
function hasPermission(permissions, moduleKey, action) {
    return Boolean(permissions?.[moduleKey]?.[action]);
}
//# sourceMappingURL=permissions.js.map