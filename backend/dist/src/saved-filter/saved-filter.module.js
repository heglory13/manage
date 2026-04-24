"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SavedFilterModule = void 0;
const common_1 = require("@nestjs/common");
const saved_filter_controller_js_1 = require("./saved-filter.controller.js");
const saved_filter_service_js_1 = require("./saved-filter.service.js");
let SavedFilterModule = class SavedFilterModule {
};
exports.SavedFilterModule = SavedFilterModule;
exports.SavedFilterModule = SavedFilterModule = __decorate([
    (0, common_1.Module)({
        controllers: [saved_filter_controller_js_1.SavedFilterController],
        providers: [saved_filter_service_js_1.SavedFilterService],
    })
], SavedFilterModule);
//# sourceMappingURL=saved-filter.module.js.map