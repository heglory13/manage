"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StocktakingModule = void 0;
const common_1 = require("@nestjs/common");
const stocktaking_controller_js_1 = require("./stocktaking.controller.js");
const stocktaking_service_js_1 = require("./stocktaking.service.js");
let StocktakingModule = class StocktakingModule {
};
exports.StocktakingModule = StocktakingModule;
exports.StocktakingModule = StocktakingModule = __decorate([
    (0, common_1.Module)({
        controllers: [stocktaking_controller_js_1.StocktakingController],
        providers: [stocktaking_service_js_1.StocktakingService],
        exports: [stocktaking_service_js_1.StocktakingService],
    })
], StocktakingModule);
//# sourceMappingURL=stocktaking.module.js.map