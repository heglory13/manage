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
exports.WarehouseController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const index_js_1 = require("../auth/decorators/index.js");
const warehouse_service_js_1 = require("./warehouse.service.js");
const index_js_2 = require("./dto/index.js");
let WarehouseController = class WarehouseController {
    warehouseService;
    constructor(warehouseService) {
        this.warehouseService = warehouseService;
    }
    async createLayout(dto) {
        return this.warehouseService.createLayout(dto);
    }
    async updateLayout(id, dto) {
        return this.warehouseService.updateLayout(id, dto);
    }
    async updateLayoutMode(id, dto) {
        return this.warehouseService.updateLayoutMode(id, dto.mode, dto.canvasWidth, dto.canvasHeight);
    }
    async deleteLayout(id) {
        return this.warehouseService.deleteLayout(id);
    }
    async getLayout() {
        return this.warehouseService.getLayout();
    }
    async getLayoutWithSkus() {
        return this.warehouseService.getSingleLayoutWithSkus();
    }
    async getLayoutsWithSkus() {
        return this.warehouseService.getLayoutWithSkus();
    }
    async assignProduct(positionId, dto) {
        return this.warehouseService.assignProductToPosition(positionId, dto.productId ?? null);
    }
    async movePosition(id, dto) {
        return this.warehouseService.movePosition(id, dto.targetRow, dto.targetColumn);
    }
    async updateLabel(id, dto) {
        return this.warehouseService.updateLabel(id, dto.label);
    }
    async toggleActive(id) {
        return this.warehouseService.toggleActive(id);
    }
    async updateCapacity(id, dto) {
        return this.warehouseService.updateCapacity(id, dto.maxCapacity);
    }
    async updatePositionLayout(id, dto) {
        return this.warehouseService.updatePositionLayout(id, dto);
    }
    async getPositionSkus(id) {
        return this.warehouseService.getPositionSkus(id);
    }
    async createPosition(dto) {
        return this.warehouseService.createPosition(dto);
    }
    async deletePosition(id, dto) {
        return this.warehouseService.deletePosition(id, dto.force);
    }
};
exports.WarehouseController = WarehouseController;
__decorate([
    (0, common_1.Post)('layout'),
    (0, index_js_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [index_js_2.CreateLayoutDto]),
    __metadata("design:returntype", Promise)
], WarehouseController.prototype, "createLayout", null);
__decorate([
    (0, common_1.Patch)('layout/:id'),
    (0, index_js_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, index_js_2.UpdateLayoutDto]),
    __metadata("design:returntype", Promise)
], WarehouseController.prototype, "updateLayout", null);
__decorate([
    (0, common_1.Patch)('layout/:id/mode'),
    (0, index_js_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, index_js_2.UpdateLayoutModeDto]),
    __metadata("design:returntype", Promise)
], WarehouseController.prototype, "updateLayoutMode", null);
__decorate([
    (0, common_1.Delete)('layout/:id'),
    (0, index_js_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WarehouseController.prototype, "deleteLayout", null);
__decorate([
    (0, common_1.Get)('layout'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], WarehouseController.prototype, "getLayout", null);
__decorate([
    (0, common_1.Get)('layout/with-skus'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], WarehouseController.prototype, "getLayoutWithSkus", null);
__decorate([
    (0, common_1.Get)('layouts/with-skus'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], WarehouseController.prototype, "getLayoutsWithSkus", null);
__decorate([
    (0, common_1.Patch)('positions/:positionId/product'),
    __param(0, (0, common_1.Param)('positionId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, index_js_2.AssignProductDto]),
    __metadata("design:returntype", Promise)
], WarehouseController.prototype, "assignProduct", null);
__decorate([
    (0, common_1.Patch)('positions/:id/move'),
    (0, index_js_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, index_js_2.MovePositionDto]),
    __metadata("design:returntype", Promise)
], WarehouseController.prototype, "movePosition", null);
__decorate([
    (0, common_1.Patch)('positions/:id/label'),
    (0, index_js_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, index_js_2.UpdateLabelDto]),
    __metadata("design:returntype", Promise)
], WarehouseController.prototype, "updateLabel", null);
__decorate([
    (0, common_1.Patch)('positions/:id/toggle-active'),
    (0, index_js_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WarehouseController.prototype, "toggleActive", null);
__decorate([
    (0, common_1.Patch)('positions/:id/capacity'),
    (0, index_js_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, index_js_2.UpdateCapacityDto]),
    __metadata("design:returntype", Promise)
], WarehouseController.prototype, "updateCapacity", null);
__decorate([
    (0, common_1.Patch)('positions/:id/layout'),
    (0, index_js_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, index_js_2.UpdatePositionLayoutDto]),
    __metadata("design:returntype", Promise)
], WarehouseController.prototype, "updatePositionLayout", null);
__decorate([
    (0, common_1.Get)('positions/:id/skus'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WarehouseController.prototype, "getPositionSkus", null);
__decorate([
    (0, common_1.Post)('positions'),
    (0, index_js_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [index_js_2.CreatePositionDto]),
    __metadata("design:returntype", Promise)
], WarehouseController.prototype, "createPosition", null);
__decorate([
    (0, common_1.Delete)('positions/:id'),
    (0, index_js_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, index_js_2.DeletePositionDto]),
    __metadata("design:returntype", Promise)
], WarehouseController.prototype, "deletePosition", null);
exports.WarehouseController = WarehouseController = __decorate([
    (0, common_1.Controller)('warehouse'),
    __metadata("design:paramtypes", [warehouse_service_js_1.WarehouseService])
], WarehouseController);
//# sourceMappingURL=warehouse.controller.js.map