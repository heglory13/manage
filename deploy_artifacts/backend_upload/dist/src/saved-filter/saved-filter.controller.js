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
exports.SavedFilterController = void 0;
const common_1 = require("@nestjs/common");
const index_js_1 = require("../auth/decorators/index.js");
const saved_filter_service_js_1 = require("./saved-filter.service.js");
const index_js_2 = require("./dto/index.js");
let SavedFilterController = class SavedFilterController {
    savedFilterService;
    constructor(savedFilterService) {
        this.savedFilterService = savedFilterService;
    }
    async findAll(user, pageKey) {
        return this.savedFilterService.findAll(user.userId, pageKey);
    }
    async create(user, dto) {
        return this.savedFilterService.create(user.userId, dto);
    }
    async delete(id, user) {
        await this.savedFilterService.delete(id, user.userId);
        return { message: 'Đã xóa bộ lọc' };
    }
};
exports.SavedFilterController = SavedFilterController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, index_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('pageKey')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], SavedFilterController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, index_js_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, index_js_2.CreateSavedFilterDto]),
    __metadata("design:returntype", Promise)
], SavedFilterController.prototype, "create", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, index_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], SavedFilterController.prototype, "delete", null);
exports.SavedFilterController = SavedFilterController = __decorate([
    (0, common_1.Controller)('saved-filters'),
    __metadata("design:paramtypes", [saved_filter_service_js_1.SavedFilterService])
], SavedFilterController);
//# sourceMappingURL=saved-filter.controller.js.map