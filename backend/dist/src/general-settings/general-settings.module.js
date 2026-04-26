"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeneralSettingsModule = void 0;
const common_1 = require("@nestjs/common");
const general_settings_controller_js_1 = require("./general-settings.controller.js");
const general_settings_service_js_1 = require("./general-settings.service.js");
let GeneralSettingsModule = class GeneralSettingsModule {
};
exports.GeneralSettingsModule = GeneralSettingsModule;
exports.GeneralSettingsModule = GeneralSettingsModule = __decorate([
    (0, common_1.Module)({
        controllers: [general_settings_controller_js_1.GeneralSettingsController],
        providers: [general_settings_service_js_1.GeneralSettingsService],
        exports: [general_settings_service_js_1.GeneralSettingsService],
    })
], GeneralSettingsModule);
//# sourceMappingURL=general-settings.module.js.map