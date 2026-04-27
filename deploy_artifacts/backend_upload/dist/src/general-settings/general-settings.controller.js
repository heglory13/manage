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
exports.GeneralSettingsController = void 0;
const common_1 = require("@nestjs/common");
const index_1 = require("@prisma/client/index");
const index_js_1 = require("../auth/decorators/index.js");
const general_settings_service_js_1 = require("./general-settings.service.js");
let GeneralSettingsController = class GeneralSettingsController {
    generalSettingsService;
    constructor(generalSettingsService) {
        this.generalSettingsService = generalSettingsService;
    }
    async getSettings() {
        return this.generalSettingsService.getSettings();
    }
    async updateSettings(body) {
        return this.generalSettingsService.updateSettings(body);
    }
};
exports.GeneralSettingsController = GeneralSettingsController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], GeneralSettingsController.prototype, "getSettings", null);
__decorate([
    (0, common_1.Put)(),
    (0, index_js_1.Roles)(index_1.Role.ADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], GeneralSettingsController.prototype, "updateSettings", null);
exports.GeneralSettingsController = GeneralSettingsController = __decorate([
    (0, common_1.Controller)('general-settings'),
    __metadata("design:paramtypes", [general_settings_service_js_1.GeneralSettingsService])
], GeneralSettingsController);
//# sourceMappingURL=general-settings.controller.js.map