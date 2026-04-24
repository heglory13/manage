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
exports.PreliminaryCheckController = void 0;
const common_1 = require("@nestjs/common");
const index_js_1 = require("../auth/decorators/index.js");
const preliminary_check_service_js_1 = require("./preliminary-check.service.js");
const index_js_2 = require("./dto/index.js");
let PreliminaryCheckController = class PreliminaryCheckController {
    preliminaryCheckService;
    constructor(preliminaryCheckService) {
        this.preliminaryCheckService = preliminaryCheckService;
    }
    async create(dto, currentUser) {
        const user = currentUser;
        return this.preliminaryCheckService.create(dto, user.userId);
    }
    async findAll(query) {
        return this.preliminaryCheckService.findAll({
            status: query.status,
            page: query.page ? parseInt(query.page, 10) : undefined,
            limit: query.limit ? parseInt(query.limit, 10) : undefined,
        });
    }
    async findOne(id) {
        return this.preliminaryCheckService.findOne(id);
    }
    async complete(id, dto) {
        return this.preliminaryCheckService.complete(id, dto.status);
    }
};
exports.PreliminaryCheckController = PreliminaryCheckController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, index_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [index_js_2.CreatePreliminaryCheckDto, Object]),
    __metadata("design:returntype", Promise)
], PreliminaryCheckController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [index_js_2.PreliminaryCheckQueryDto]),
    __metadata("design:returntype", Promise)
], PreliminaryCheckController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PreliminaryCheckController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id/complete'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, index_js_2.CompletePreliminaryCheckDto]),
    __metadata("design:returntype", Promise)
], PreliminaryCheckController.prototype, "complete", null);
exports.PreliminaryCheckController = PreliminaryCheckController = __decorate([
    (0, common_1.Controller)('preliminary-checks'),
    __metadata("design:paramtypes", [preliminary_check_service_js_1.PreliminaryCheckService])
], PreliminaryCheckController);
//# sourceMappingURL=preliminary-check.controller.js.map