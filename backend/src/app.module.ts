import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/guards/index.js';
import { RolesGuard } from './auth/guards/index.js';
import { UserModule } from './user/user.module.js';
import { ProductModule } from './product/product.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { ReportModule } from './report/report.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { WarehouseModule } from './warehouse/warehouse.module.js';
import { StocktakingModule } from './stocktaking/stocktaking.module.js';
import { CategoryModule } from './category/category.module.js';
import { InputDeclarationModule } from './input-declaration/input-declaration.module.js';
import { PreliminaryCheckModule } from './preliminary-check/preliminary-check.module.js';
import { SavedFilterModule } from './saved-filter/saved-filter.module.js';
import { ActivityLogModule } from './activity-log/activity-log.module.js';
import { ActivityLogInterceptor } from './activity-log/activity-log.interceptor.js';
import { GeneralSettingsModule } from './general-settings/general-settings.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 seconds
        limit: 100, // 100 requests per ttl window
      },
    ]),
    PrismaModule,
    AuthModule,
    UserModule,
    ProductModule,
    InventoryModule,
    ReportModule,
    DashboardModule,
    WarehouseModule,
    StocktakingModule,
    CategoryModule,
    InputDeclarationModule,
    PreliminaryCheckModule,
    SavedFilterModule,
    ActivityLogModule,
    GeneralSettingsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ActivityLogInterceptor,
    },
  ],
})
export class AppModule {}
