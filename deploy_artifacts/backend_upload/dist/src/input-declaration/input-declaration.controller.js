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
exports.InputDeclarationController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const input_declaration_service_js_1 = require("./input-declaration.service.js");
const sku_combo_service_js_1 = require("./sku-combo.service.js");
const index_js_1 = require("./dto/index.js");
let InputDeclarationController = class InputDeclarationController {
    inputDeclarationService;
    skuComboService;
    constructor(inputDeclarationService, skuComboService) {
        this.inputDeclarationService = inputDeclarationService;
        this.skuComboService = skuComboService;
    }
    getAllDeclarations() {
        return this.inputDeclarationService.getAllDeclarations();
    }
    async downloadImportTemplate(res) {
        const buffer = await this.inputDeclarationService.generateImportTemplate();
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="input-declarations-template.xlsx"',
            'Content-Length': buffer.length.toString(),
        });
        res.end(buffer);
    }
    importDeclarations(file) {
        if (!file?.buffer) {
            throw new common_1.BadRequestException('File is required');
        }
        return this.inputDeclarationService.importDeclarationsFromExcel(file.buffer);
    }
    getCategories() {
        return this.inputDeclarationService.getAllCategories();
    }
    createCategory(dto) {
        return this.inputDeclarationService.createCategory(dto.name);
    }
    deleteCategory(id) {
        return this.inputDeclarationService.deleteAttribute('category', id);
    }
    getClassifications() {
        return this.inputDeclarationService.getAll('classification');
    }
    createClassification(dto) {
        return this.inputDeclarationService.create('classification', dto.name);
    }
    deleteClassification(id) {
        return this.inputDeclarationService.deleteAttribute('classification', id);
    }
    getColors() {
        return this.inputDeclarationService.getAll('color');
    }
    createColor(dto) {
        return this.inputDeclarationService.create('color', dto.name);
    }
    deleteColor(id) {
        return this.inputDeclarationService.deleteAttribute('color', id);
    }
    getSizes() {
        return this.inputDeclarationService.getAll('size');
    }
    createSize(dto) {
        return this.inputDeclarationService.create('size', dto.name);
    }
    deleteSize(id) {
        return this.inputDeclarationService.deleteAttribute('size', id);
    }
    getMaterials() {
        return this.inputDeclarationService.getAll('material');
    }
    createMaterial(dto) {
        return this.inputDeclarationService.create('material', dto.name);
    }
    deleteMaterial(id) {
        return this.inputDeclarationService.deleteAttribute('material', id);
    }
    getProductConditions() {
        return this.inputDeclarationService.getAllProductConditions();
    }
    createProductCondition(dto) {
        return this.inputDeclarationService.createProductCondition(dto.name);
    }
    deleteProductCondition(id) {
        return this.inputDeclarationService.deleteAttribute('productCondition', id);
    }
    getWarehouseTypes() {
        return this.inputDeclarationService.getAllWarehouseTypes();
    }
    createWarehouseType(dto) {
        return this.inputDeclarationService.createWarehouseType(dto.name);
    }
    deleteWarehouseType(id) {
        return this.inputDeclarationService.deleteAttribute('warehouseType', id);
    }
    getStorageZones() {
        return this.inputDeclarationService.getAllStorageZones();
    }
    createStorageZone(dto) {
        return this.inputDeclarationService.createStorageZone(dto.name, dto.maxCapacity);
    }
    deleteStorageZone(id) {
        return this.inputDeclarationService.deleteAttribute('storageZone', id);
    }
    getSkuCombos(query) {
        return this.skuComboService.getAll(query);
    }
    createSkuCombo(dto) {
        return this.skuComboService.create(dto);
    }
    deleteSkuCombo(id) {
        return this.skuComboService.delete(id);
    }
};
exports.InputDeclarationController = InputDeclarationController;
__decorate([
    (0, common_1.Get)('all'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], InputDeclarationController.prototype, "getAllDeclarations", null);
__decorate([
    (0, common_1.Get)('import-template'),
    __param(0, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], InputDeclarationController.prototype, "downloadImportTemplate", null);
__decorate([
    (0, common_1.Post)('import'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], InputDeclarationController.prototype, "importDeclarations", null);
__decorate([
    (0, common_1.Get)('categories'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], InputDeclarationController.prototype, "getCategories", null);
__decorate([
    (0, common_1.Post)('categories'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [index_js_1.CreateAttributeDto]),
    __metadata("design:returntype", void 0)
], InputDeclarationController.prototype, "createCategory", null);
__decorate([
    (0, common_1.Delete)('categories/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], InputDeclarationController.prototype, "deleteCategory", null);
__decorate([
    (0, common_1.Get)('classifications'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], InputDeclarationController.prototype, "getClassifications", null);
__decorate([
    (0, common_1.Post)('classifications'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [index_js_1.CreateAttributeDto]),
    __metadata("design:returntype", void 0)
], InputDeclarationController.prototype, "createClassification", null);
__decorate([
    (0, common_1.Delete)('classifications/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], InputDeclarationController.prototype, "deleteClassification", null);
__decorate([
    (0, common_1.Get)('colors'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], InputDeclarationController.prototype, "getColors", null);
__decorate([
    (0, common_1.Post)('colors'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [index_js_1.CreateAttributeDto]),
    __metadata("design:returntype", void 0)
], InputDeclarationController.prototype, "createColor", null);
__decorate([
    (0, common_1.Delete)('colors/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], InputDeclarationController.prototype, "deleteColor", null);
__decorate([
    (0, common_1.Get)('sizes'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], InputDeclarationController.prototype, "getSizes", null);
__decorate([
    (0, common_1.Post)('sizes'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [index_js_1.CreateAttributeDto]),
    __metadata("design:returntype", void 0)
], InputDeclarationController.prototype, "createSize", null);
__decorate([
    (0, common_1.Delete)('sizes/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], InputDeclarationController.prototype, "deleteSize", null);
__decorate([
    (0, common_1.Get)('materials'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], InputDeclarationController.prototype, "getMaterials", null);
__decorate([
    (0, common_1.Post)('materials'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [index_js_1.CreateAttributeDto]),
    __metadata("design:returntype", void 0)
], InputDeclarationController.prototype, "createMaterial", null);
__decorate([
    (0, common_1.Delete)('materials/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], InputDeclarationController.prototype, "deleteMaterial", null);
__decorate([
    (0, common_1.Get)('product-conditions'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], InputDeclarationController.prototype, "getProductConditions", null);
__decorate([
    (0, common_1.Post)('product-conditions'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [index_js_1.CreateAttributeDto]),
    __metadata("design:returntype", void 0)
], InputDeclarationController.prototype, "createProductCondition", null);
__decorate([
    (0, common_1.Delete)('product-conditions/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], InputDeclarationController.prototype, "deleteProductCondition", null);
__decorate([
    (0, common_1.Get)('warehouse-types'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], InputDeclarationController.prototype, "getWarehouseTypes", null);
__decorate([
    (0, common_1.Post)('warehouse-types'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [index_js_1.CreateAttributeDto]),
    __metadata("design:returntype", void 0)
], InputDeclarationController.prototype, "createWarehouseType", null);
__decorate([
    (0, common_1.Delete)('warehouse-types/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], InputDeclarationController.prototype, "deleteWarehouseType", null);
__decorate([
    (0, common_1.Get)('storage-zones'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], InputDeclarationController.prototype, "getStorageZones", null);
__decorate([
    (0, common_1.Post)('storage-zones'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [index_js_1.CreateStorageZoneDto]),
    __metadata("design:returntype", void 0)
], InputDeclarationController.prototype, "createStorageZone", null);
__decorate([
    (0, common_1.Delete)('storage-zones/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], InputDeclarationController.prototype, "deleteStorageZone", null);
__decorate([
    (0, common_1.Get)('sku-combos'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [index_js_1.SkuComboQueryDto]),
    __metadata("design:returntype", void 0)
], InputDeclarationController.prototype, "getSkuCombos", null);
__decorate([
    (0, common_1.Post)('sku-combos'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [index_js_1.CreateSkuComboDto]),
    __metadata("design:returntype", void 0)
], InputDeclarationController.prototype, "createSkuCombo", null);
__decorate([
    (0, common_1.Delete)('sku-combos/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], InputDeclarationController.prototype, "deleteSkuCombo", null);
exports.InputDeclarationController = InputDeclarationController = __decorate([
    (0, common_1.Controller)('input-declarations'),
    __metadata("design:paramtypes", [input_declaration_service_js_1.InputDeclarationService,
        sku_combo_service_js_1.SkuComboService])
], InputDeclarationController);
//# sourceMappingURL=input-declaration.controller.js.map