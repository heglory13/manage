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
exports.InventoryController = void 0;
const common_1 = require("@nestjs/common");
const common_2 = require("@nestjs/common");
const index_1 = require("@prisma/client/index");
const index_js_1 = require("../auth/decorators/index.js");
const index_js_2 = require("../auth/decorators/index.js");
const permissions_js_1 = require("../auth/permissions.js");
const inventory_service_js_1 = require("./inventory.service.js");
const index_js_3 = require("./dto/index.js");
let InventoryController = class InventoryController {
    inventoryService;
    constructor(inventoryService) {
        this.inventoryService = inventoryService;
    }
    async stockIn(dto, currentUser) {
        const user = currentUser;
        return this.inventoryService.stockIn(dto.productId, dto.quantity, user.userId, {
            purchasePrice: dto.purchasePrice,
            salePrice: dto.salePrice,
            skuComboId: dto.skuComboId,
            productConditionId: dto.productConditionId,
            storageZoneId: dto.storageZoneId,
            warehousePositionId: dto.warehousePositionId,
            preliminaryCheckId: dto.preliminaryCheckId,
            actualStockDate: dto.actualStockDate,
            notes: dto.notes,
        });
    }
    async stockOut(dto, currentUser) {
        const user = currentUser;
        return this.inventoryService.stockOut(dto.productId, dto.quantity, user.userId, {
            skuComboId: dto.skuComboId,
            productConditionId: dto.productConditionId,
            storageZoneId: dto.storageZoneId,
            warehousePositionId: dto.warehousePositionId,
            notes: dto.notes,
        });
    }
    async adjustStock(dto, currentUser) {
        const user = currentUser;
        return this.inventoryService.adjustStock(dto.productId, dto.quantity, dto.type, user.userId, {
            warehousePositionId: dto.warehousePositionId,
            reason: dto.reason,
        });
    }
    async updateTransactionStatus(dto, currentUser) {
        const user = currentUser;
        if (!(0, permissions_js_1.hasPermission)(user.permissions, 'transactions', 'edit')) {
            throw new common_2.ForbiddenException('Ban khong co quyen sua giao dich');
        }
        return this.inventoryService.updateTransactionStatus(dto.transactionIds, dto.status);
    }
    async deleteTransactions(dto, currentUser) {
        const user = currentUser;
        if (!(0, permissions_js_1.hasPermission)(user.permissions, 'transactions', 'delete')) {
            throw new common_2.ForbiddenException('Ban khong co quyen xoa giao dich');
        }
        return this.inventoryService.deleteTransactions(dto.transactionIds);
    }
    async getInventory(query) {
        return this.inventoryService.getInventory({
            categoryId: query.categoryId,
            startDate: query.startDate,
            endDate: query.endDate,
            positionId: query.positionId,
            page: query.page ? parseInt(query.page, 10) : undefined,
            limit: query.limit ? parseInt(query.limit, 10) : undefined,
        });
    }
    async getCapacity() {
        return this.inventoryService.getCapacityRatio();
    }
    async getInventoryV2(query) {
        return this.inventoryService.getInventoryV2({
            categoryId: query.categoryId,
            businessStatus: query.businessStatus,
            productConditionId: query.productConditionId,
            classificationId: query.classificationId,
            materialId: query.materialId,
            colorId: query.colorId,
            sizeId: query.sizeId,
            storageZoneId: query.storageZoneId,
            positionId: query.positionId,
            startDate: query.startDate,
            endDate: query.endDate,
            search: query.search,
            page: query.page ? parseInt(query.page, 10) : undefined,
            limit: query.limit ? parseInt(query.limit, 10) : undefined,
        });
    }
    async getTransactionHistory(query) {
        return this.inventoryService.getTransactionHistory({
            kind: query.kind,
            page: query.page ? parseInt(query.page, 10) : undefined,
            limit: query.limit ? parseInt(query.limit, 10) : undefined,
        });
    }
    async exportExcelV2(query, res) {
        const buffer = await this.inventoryService.exportExcelV2({
            categoryId: query.categoryId,
            businessStatus: query.businessStatus,
            productConditionId: query.productConditionId,
            classificationId: query.classificationId,
            materialId: query.materialId,
            colorId: query.colorId,
            sizeId: query.sizeId,
            storageZoneId: query.storageZoneId,
            search: query.search,
        });
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="ton-kho-v2-${new Date().toISOString().slice(0, 10)}.xlsx"`,
            'Content-Length': buffer.length.toString(),
        });
        res.end(buffer);
    }
};
exports.InventoryController = InventoryController;
__decorate([
    (0, common_1.Post)('stock-in'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, index_js_2.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [index_js_3.StockInDto, Object]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "stockIn", null);
__decorate([
    (0, common_1.Post)('stock-out'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, index_js_2.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [index_js_3.StockOutDto, Object]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "stockOut", null);
__decorate([
    (0, common_1.Post)('adjust'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, index_js_2.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [index_js_3.StockAdjustDto, Object]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "adjustStock", null);
__decorate([
    (0, common_1.Patch)('transactions/status'),
    (0, index_js_1.Roles)(index_1.Role.MANAGER, index_1.Role.ADMIN),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, index_js_2.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [index_js_3.TransactionStatusActionDto, Object]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "updateTransactionStatus", null);
__decorate([
    (0, common_1.Delete)('transactions'),
    (0, index_js_1.Roles)(index_1.Role.ADMIN),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, index_js_2.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [index_js_3.DeleteTransactionsDto, Object]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "deleteTransactions", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [index_js_3.InventoryQueryDto]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "getInventory", null);
__decorate([
    (0, common_1.Get)('capacity'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "getCapacity", null);
__decorate([
    (0, common_1.Get)('v2'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [index_js_3.InventoryQueryV2Dto]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "getInventoryV2", null);
__decorate([
    (0, common_1.Get)('transactions'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [index_js_3.TransactionHistoryQueryDto]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "getTransactionHistory", null);
__decorate([
    (0, common_1.Get)('export-v2'),
    (0, index_js_1.Roles)(index_1.Role.MANAGER, index_1.Role.ADMIN),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [index_js_3.InventoryQueryV2Dto, Object]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "exportExcelV2", null);
exports.InventoryController = InventoryController = __decorate([
    (0, common_1.Controller)('inventory'),
    __metadata("design:paramtypes", [inventory_service_js_1.InventoryService])
], InventoryController);
//# sourceMappingURL=inventory.controller.js.map