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
exports.StocktakingController = void 0;
const common_1 = require("@nestjs/common");
const index_1 = require("@prisma/client/index");
const index_js_1 = require("../auth/decorators/index.js");
const index_js_2 = require("../auth/decorators/index.js");
const stocktaking_service_js_1 = require("./stocktaking.service.js");
const index_js_3 = require("./dto/index.js");
let StocktakingController = class StocktakingController {
    stocktakingService;
    constructor(stocktakingService) {
        this.stocktakingService = stocktakingService;
    }
    async create(dto, currentUser) {
        const user = currentUser;
        return this.stocktakingService.create(dto.mode, user.userId, dto.productIds, dto.cutoffTime);
    }
    async submit(id, dto, currentUser) {
        const user = currentUser;
        return this.stocktakingService.submit(id, dto.items, user.userId);
    }
    async approve(id, currentUser) {
        const user = currentUser;
        return this.stocktakingService.approve(id, user.userId);
    }
    async reject(id, currentUser) {
        const user = currentUser;
        return this.stocktakingService.reject(id, user.userId);
    }
    async getStatusHistory(id) {
        return this.stocktakingService.getStatusHistory(id);
    }
    async findOne(id) {
        return this.stocktakingService.findOne(id);
    }
    async updateItem(itemId, dto) {
        return this.stocktakingService.updateItem(itemId, dto);
    }
    async findAll(query) {
        return this.stocktakingService.findAll({
            status: query.status,
            startDate: query.startDate,
            endDate: query.endDate,
            page: query.page ? parseInt(query.page, 10) : undefined,
            limit: query.limit ? parseInt(query.limit, 10) : undefined,
        });
    }
};
exports.StocktakingController = StocktakingController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, index_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [index_js_3.CreateStocktakingDto, Object]),
    __metadata("design:returntype", Promise)
], StocktakingController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id/submit'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, index_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, index_js_3.SubmitStocktakingDto, Object]),
    __metadata("design:returntype", Promise)
], StocktakingController.prototype, "submit", null);
__decorate([
    (0, common_1.Patch)(':id/approve'),
    (0, index_js_2.Roles)(index_1.Role.MANAGER, index_1.Role.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, index_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], StocktakingController.prototype, "approve", null);
__decorate([
    (0, common_1.Patch)(':id/reject'),
    (0, index_js_2.Roles)(index_1.Role.MANAGER, index_1.Role.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, index_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], StocktakingController.prototype, "reject", null);
__decorate([
    (0, common_1.Get)(':id/history'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StocktakingController.prototype, "getStatusHistory", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StocktakingController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)('items/:itemId'),
    __param(0, (0, common_1.Param)('itemId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, index_js_3.UpdateStocktakingItemDto]),
    __metadata("design:returntype", Promise)
], StocktakingController.prototype, "updateItem", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [index_js_3.StocktakingQueryDto]),
    __metadata("design:returntype", Promise)
], StocktakingController.prototype, "findAll", null);
exports.StocktakingController = StocktakingController = __decorate([
    (0, common_1.Controller)('stocktaking'),
    __metadata("design:paramtypes", [stocktaking_service_js_1.StocktakingService])
], StocktakingController);
//# sourceMappingURL=stocktaking.controller.js.map