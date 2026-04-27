"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const throttler_1 = require("@nestjs/throttler");
const app_controller_js_1 = require("./app.controller.js");
const app_service_js_1 = require("./app.service.js");
const prisma_module_js_1 = require("./prisma/prisma.module.js");
const auth_module_js_1 = require("./auth/auth.module.js");
const index_js_1 = require("./auth/guards/index.js");
const index_js_2 = require("./auth/guards/index.js");
const user_module_js_1 = require("./user/user.module.js");
const product_module_js_1 = require("./product/product.module.js");
const inventory_module_js_1 = require("./inventory/inventory.module.js");
const report_module_js_1 = require("./report/report.module.js");
const dashboard_module_js_1 = require("./dashboard/dashboard.module.js");
const warehouse_module_js_1 = require("./warehouse/warehouse.module.js");
const stocktaking_module_js_1 = require("./stocktaking/stocktaking.module.js");
const category_module_js_1 = require("./category/category.module.js");
const input_declaration_module_js_1 = require("./input-declaration/input-declaration.module.js");
const preliminary_check_module_js_1 = require("./preliminary-check/preliminary-check.module.js");
const saved_filter_module_js_1 = require("./saved-filter/saved-filter.module.js");
const activity_log_module_js_1 = require("./activity-log/activity-log.module.js");
const activity_log_interceptor_js_1 = require("./activity-log/activity-log.interceptor.js");
const general_settings_module_js_1 = require("./general-settings/general-settings.module.js");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            throttler_1.ThrottlerModule.forRoot([
                {
                    ttl: 60000,
                    limit: 100,
                },
            ]),
            prisma_module_js_1.PrismaModule,
            auth_module_js_1.AuthModule,
            user_module_js_1.UserModule,
            product_module_js_1.ProductModule,
            inventory_module_js_1.InventoryModule,
            report_module_js_1.ReportModule,
            dashboard_module_js_1.DashboardModule,
            warehouse_module_js_1.WarehouseModule,
            stocktaking_module_js_1.StocktakingModule,
            category_module_js_1.CategoryModule,
            input_declaration_module_js_1.InputDeclarationModule,
            preliminary_check_module_js_1.PreliminaryCheckModule,
            saved_filter_module_js_1.SavedFilterModule,
            activity_log_module_js_1.ActivityLogModule,
            general_settings_module_js_1.GeneralSettingsModule,
        ],
        controllers: [app_controller_js_1.AppController],
        providers: [
            app_service_js_1.AppService,
            {
                provide: core_1.APP_GUARD,
                useClass: index_js_1.JwtAuthGuard,
            },
            {
                provide: core_1.APP_GUARD,
                useClass: index_js_2.RolesGuard,
            },
            {
                provide: core_1.APP_GUARD,
                useClass: throttler_1.ThrottlerGuard,
            },
            {
                provide: core_1.APP_INTERCEPTOR,
                useClass: activity_log_interceptor_js_1.ActivityLogInterceptor,
            },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map