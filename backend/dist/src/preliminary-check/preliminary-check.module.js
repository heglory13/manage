"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PreliminaryCheckModule = void 0;
const common_1 = require("@nestjs/common");
const preliminary_check_controller_js_1 = require("./preliminary-check.controller.js");
const preliminary_check_service_js_1 = require("./preliminary-check.service.js");
let PreliminaryCheckModule = class PreliminaryCheckModule {
};
exports.PreliminaryCheckModule = PreliminaryCheckModule;
exports.PreliminaryCheckModule = PreliminaryCheckModule = __decorate([
    (0, common_1.Module)({
        controllers: [preliminary_check_controller_js_1.PreliminaryCheckController],
        providers: [preliminary_check_service_js_1.PreliminaryCheckService],
        exports: [preliminary_check_service_js_1.PreliminaryCheckService],
    })
], PreliminaryCheckModule);
//# sourceMappingURL=preliminary-check.module.js.map