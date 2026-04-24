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
exports.UserController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const user_service_js_1 = require("./user.service.js");
const index_js_1 = require("./dto/index.js");
const index_js_2 = require("../auth/decorators/index.js");
const index_js_3 = require("../auth/decorators/index.js");
const index_js_4 = require("../auth/guards/index.js");
let UserController = class UserController {
    userService;
    constructor(userService) {
        this.userService = userService;
    }
    async findAll() {
        return this.userService.findAll();
    }
    async create(dto) {
        return this.userService.create(dto);
    }
    async updateRole(id, dto) {
        return this.userService.updateRole(id, dto.role);
    }
    async delete(id, currentUser) {
        const user = currentUser;
        await this.userService.delete(id, user.userId);
        return { message: 'User deleted successfully' };
    }
};
exports.UserController = UserController;
__decorate([
    (0, common_1.Get)(),
    (0, index_js_2.Roles)(client_1.Role.ADMIN),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], UserController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    (0, index_js_2.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [index_js_1.CreateUserDto]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id/role'),
    (0, index_js_2.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, index_js_1.UpdateRoleDto]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "updateRole", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, index_js_2.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, index_js_3.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "delete", null);
exports.UserController = UserController = __decorate([
    (0, common_1.Controller)('users'),
    (0, common_1.UseGuards)(index_js_4.RolesGuard),
    __metadata("design:paramtypes", [user_service_js_1.UserService])
], UserController);
//# sourceMappingURL=user.controller.js.map