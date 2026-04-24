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
exports.ReportController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const client_1 = require("@prisma/client");
const index_js_1 = require("../auth/decorators/index.js");
const index_js_2 = require("../auth/decorators/index.js");
const report_service_js_1 = require("./report.service.js");
const index_js_3 = require("./dto/index.js");
let ReportController = class ReportController {
    reportService;
    constructor(reportService) {
        this.reportService = reportService;
    }
    async exportExcel(query, res) {
        const buffer = await this.reportService.generateExcelReport({
            categoryId: query.categoryId,
            startDate: query.startDate,
            endDate: query.endDate,
        });
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="bao-cao-ton-kho-${new Date().toISOString().slice(0, 10)}.xlsx"`,
            'Content-Length': buffer.length.toString(),
        });
        res.end(buffer);
    }
    async getNxtReport(query) {
        return this.reportService.getNxtReport(query.startDate, query.endDate);
    }
    async exportNxtExcel(query, res) {
        const buffer = await this.reportService.exportNxtExcel(query.startDate, query.endDate);
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="bao-cao-nxt-${new Date().toISOString().slice(0, 10)}.xlsx"`,
            'Content-Length': buffer.length.toString(),
        });
        res.end(buffer);
    }
    async downloadTemplate(res) {
        const buffer = await this.reportService.generateTemplate();
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="template-nhap-kho.xlsx"',
            'Content-Length': buffer.length.toString(),
        });
        res.end(buffer);
    }
    async importExcel(file, currentUser) {
        const user = currentUser;
        return this.reportService.importStockIn(file.buffer, user.userId);
    }
};
exports.ReportController = ReportController;
__decorate([
    (0, common_1.Get)('export'),
    (0, index_js_1.Roles)(client_1.Role.MANAGER, client_1.Role.ADMIN),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [index_js_3.ReportQueryDto, Object]),
    __metadata("design:returntype", Promise)
], ReportController.prototype, "exportExcel", null);
__decorate([
    (0, common_1.Get)('nxt'),
    (0, index_js_1.Roles)(client_1.Role.MANAGER, client_1.Role.ADMIN),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [index_js_3.NxtReportQueryDto]),
    __metadata("design:returntype", Promise)
], ReportController.prototype, "getNxtReport", null);
__decorate([
    (0, common_1.Get)('nxt/export'),
    (0, index_js_1.Roles)(client_1.Role.MANAGER, client_1.Role.ADMIN),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [index_js_3.NxtReportQueryDto, Object]),
    __metadata("design:returntype", Promise)
], ReportController.prototype, "exportNxtExcel", null);
__decorate([
    (0, common_1.Get)('stock-in/template'),
    __param(0, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ReportController.prototype, "downloadTemplate", null);
__decorate([
    (0, common_1.Post)('stock-in/import'),
    (0, index_js_1.Roles)(client_1.Role.MANAGER, client_1.Role.ADMIN),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, index_js_2.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ReportController.prototype, "importExcel", null);
exports.ReportController = ReportController = __decorate([
    (0, common_1.Controller)('reports'),
    __metadata("design:paramtypes", [report_service_js_1.ReportService])
], ReportController);
//# sourceMappingURL=report.controller.js.map