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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityLogController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const index_js_1 = require("../auth/decorators/index.js");
const activity_log_service_js_1 = require("./activity-log.service.js");
const index_js_2 = require("./dto/index.js");
let ActivityLogController = class ActivityLogController {
    activityLogService;
    constructor(activityLogService) {
        this.activityLogService = activityLogService;
    }
    async findAll(query) {
        return this.activityLogService.findAll(query);
    }
};
exports.ActivityLogController = ActivityLogController;
__decorate([
    (0, common_1.Get)(),
    (0, index_js_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [index_js_2.ActivityLogQueryDto]),
    __metadata("design:returntype", Promise)
], ActivityLogController.prototype, "findAll", null);
exports.ActivityLogController = ActivityLogController = __decorate([
    (0, common_1.Controller)('activity-logs'),
    __metadata("design:paramtypes", [activity_log_service_js_1.ActivityLogService])
], ActivityLogController);
//# sourceMappingURL=activity-log.controller.js.map