"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityLogInterceptor = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const activity_log_service_js_1 = require("./activity-log.service.js");
const METHOD_ACTION_MAP = {
    POST: 'CREATE',
    PATCH: 'UPDATE',
    DELETE: 'DELETE',
};
function getTableNameFromPath(path) {
    const cleaned = path.replace(/^\/api\//, '').replace(/^\//, '');
    const segments = cleaned.split('/');
    const resource = segments[0] ?? '';
    const TABLE_MAP = {
        products: 'Product',
        inventory: 'InventoryTransaction',
        users: 'User',
        categories: 'Category',
        'input-declarations': 'InputDeclaration',
        'storage-zones': 'StorageZone',
        stocktaking: 'StocktakingRecord',
        'saved-filters': 'SavedFilter',
        'preliminary-checks': 'PreliminaryCheck',
        warehouse: 'WarehouseLayout',
    };
    return TABLE_MAP[resource] ?? resource;
}
function getRecordIdFromPath(path) {
    const segments = path.split('/').filter(Boolean);
    for (let i = segments.length - 1; i >= 0; i--) {
        if (segments[i].match(/^[0-9a-f-]{36}$/i)) {
            return segments[i];
        }
    }
    return '';
}
let ActivityLogInterceptor = class ActivityLogInterceptor {
    activityLogService;
    constructor(activityLogService) {
        this.activityLogService = activityLogService;
    }
    intercept(context, next) {
        const request = context.switchToHttp().getRequest();
        const method = request.method;
        if (!['POST', 'PATCH', 'DELETE'].includes(method)) {
            return next.handle();
        }
        const path = request.route?.path ?? request.url ?? '';
        if (path.includes('/auth/') || path.includes('/activity-logs')) {
            return next.handle();
        }
        const action = METHOD_ACTION_MAP[method] ?? method;
        const tableName = getTableNameFromPath(request.url ?? '');
        const recordId = getRecordIdFromPath(request.url ?? '');
        const user = request.user;
        if (!user) {
            return next.handle();
        }
        const userId = user.userId ?? '';
        const userName = user.name ?? user.email ?? '';
        return next.handle().pipe((0, rxjs_1.tap)((responseData) => {
            const newData = action === 'DELETE' ? null : responseData;
            const logRecordId = recordId || responseData?.id || '';
            this.activityLogService
                .create({
                userId,
                userName,
                action,
                tableName,
                recordId: String(logRecordId),
                oldData: null,
                newData: newData,
            })
                .catch(() => {
            });
        }));
    }
};
exports.ActivityLogInterceptor = ActivityLogInterceptor;
exports.ActivityLogInterceptor = ActivityLogInterceptor = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [activity_log_service_js_1.ActivityLogService])
], ActivityLogInterceptor);
//# sourceMappingURL=activity-log.interceptor.js.map