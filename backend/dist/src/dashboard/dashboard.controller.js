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
exports.DashboardController = void 0;
const common_1 = require("@nestjs/common");
const index_1 = require("@prisma/client/index");
const index_js_1 = require("../auth/decorators/index.js");
const dashboard_service_js_1 = require("./dashboard.service.js");
const index_js_2 = require("./dto/index.js");
let DashboardController = class DashboardController {
    dashboardService;
    constructor(dashboardService) {
        this.dashboardService = dashboardService;
    }
    async getSummary(query) {
        return this.dashboardService.getSummary(query.startDate, query.endDate);
    }
    async getChart(query) {
        return this.dashboardService.getChartData(query.period ?? 'month');
    }
    async getAlertsBelowMin() {
        return this.dashboardService.getAlertsBelowMin();
    }
    async getAlertsAboveMax() {
        return this.dashboardService.getAlertsAboveMax();
    }
    async getTopProducts(query) {
        return this.dashboardService.getTopProducts(query.type ?? 'highest', query.limit ?? 20);
    }
    async getTopZones(query) {
        return this.dashboardService.getTopZones(query.type ?? 'highest', query.limit ?? 10);
    }
    async getChartV2(query) {
        return this.dashboardService.getChartDataV2(query.period ?? 'month');
    }
    async getDetailProducts(query) {
        return this.dashboardService.getDetailProducts(query.page ?? 1, query.limit ?? 20, query.startDate, query.endDate);
    }
    async getDetailStock(query) {
        return this.dashboardService.getDetailStock(query.page ?? 1, query.limit ?? 20, query.startDate, query.endDate);
    }
    async getDetailTransactions(query) {
        return this.dashboardService.getDetailTransactions(query.type ?? 'stock_in', query.page ?? 1, query.limit ?? 20, query.startDate, query.endDate);
    }
};
exports.DashboardController = DashboardController;
__decorate([
    (0, common_1.Get)('summary'),
    (0, index_js_1.Roles)(index_1.Role.MANAGER, index_1.Role.ADMIN),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [index_js_2.ChartQueryDto]),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "getSummary", null);
__decorate([
    (0, common_1.Get)('chart'),
    (0, index_js_1.Roles)(index_1.Role.MANAGER, index_1.Role.ADMIN),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [index_js_2.ChartQueryDto]),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "getChart", null);
__decorate([
    (0, common_1.Get)('alerts/below-min'),
    (0, index_js_1.Roles)(index_1.Role.MANAGER, index_1.Role.ADMIN),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "getAlertsBelowMin", null);
__decorate([
    (0, common_1.Get)('alerts/above-max'),
    (0, index_js_1.Roles)(index_1.Role.MANAGER, index_1.Role.ADMIN),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "getAlertsAboveMax", null);
__decorate([
    (0, common_1.Get)('top-products'),
    (0, index_js_1.Roles)(index_1.Role.MANAGER, index_1.Role.ADMIN),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [index_js_2.TopProductsQueryDto]),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "getTopProducts", null);
__decorate([
    (0, common_1.Get)('top-zones'),
    (0, index_js_1.Roles)(index_1.Role.MANAGER, index_1.Role.ADMIN),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [index_js_2.TopZonesQueryDto]),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "getTopZones", null);
__decorate([
    (0, common_1.Get)('chart-v2'),
    (0, index_js_1.Roles)(index_1.Role.MANAGER, index_1.Role.ADMIN),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [index_js_2.ChartQueryDto]),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "getChartV2", null);
__decorate([
    (0, common_1.Get)('detail/products'),
    (0, index_js_1.Roles)(index_1.Role.MANAGER, index_1.Role.ADMIN),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [index_js_2.DetailQueryDto]),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "getDetailProducts", null);
__decorate([
    (0, common_1.Get)('detail/stock'),
    (0, index_js_1.Roles)(index_1.Role.MANAGER, index_1.Role.ADMIN),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [index_js_2.DetailQueryDto]),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "getDetailStock", null);
__decorate([
    (0, common_1.Get)('detail/transactions'),
    (0, index_js_1.Roles)(index_1.Role.MANAGER, index_1.Role.ADMIN),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [index_js_2.DetailTransactionsQueryDto]),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "getDetailTransactions", null);
exports.DashboardController = DashboardController = __decorate([
    (0, common_1.Controller)('dashboard'),
    __metadata("design:paramtypes", [dashboard_service_js_1.DashboardService])
], DashboardController);
//# sourceMappingURL=dashboard.controller.js.map