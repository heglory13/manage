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
exports.ProductController = void 0;
const common_1 = require("@nestjs/common");
const product_service_js_1 = require("./product.service.js");
const index_js_1 = require("./dto/index.js");
let ProductController = class ProductController {
    productService;
    constructor(productService) {
        this.productService = productService;
    }
    async create(dto) {
        return this.productService.create(dto);
    }
    async findAll(query) {
        return this.productService.findAll(query);
    }
    async update(id, dto) {
        return this.productService.update(id, dto);
    }
    async updateThreshold(id, dto) {
        return this.productService.updateThreshold(id, dto.minThreshold);
    }
    async toggleDiscontinued(id) {
        return this.productService.toggleDiscontinued(id);
    }
    async updateMaxThreshold(id, dto) {
        return this.productService.updateMaxThreshold(id, dto.maxThreshold);
    }
    async delete(id) {
        await this.productService.delete(id);
        return { message: 'Product deleted successfully' };
    }
};
exports.ProductController = ProductController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [index_js_1.CreateProductDto]),
    __metadata("design:returntype", Promise)
], ProductController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [index_js_1.ProductQueryDto]),
    __metadata("design:returntype", Promise)
], ProductController.prototype, "findAll", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, index_js_1.UpdateProductDto]),
    __metadata("design:returntype", Promise)
], ProductController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)(':id/threshold'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, index_js_1.UpdateThresholdDto]),
    __metadata("design:returntype", Promise)
], ProductController.prototype, "updateThreshold", null);
__decorate([
    (0, common_1.Patch)(':id/discontinue'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProductController.prototype, "toggleDiscontinued", null);
__decorate([
    (0, common_1.Patch)(':id/max-threshold'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, index_js_1.UpdateMaxThresholdDto]),
    __metadata("design:returntype", Promise)
], ProductController.prototype, "updateMaxThreshold", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProductController.prototype, "delete", null);
exports.ProductController = ProductController = __decorate([
    (0, common_1.Controller)('products'),
    __metadata("design:paramtypes", [product_service_js_1.ProductService])
], ProductController);
//# sourceMappingURL=product.controller.js.map