import { Controller, Get, Query } from '@nestjs/common';
import { RequirePermission } from '../auth/decorators/index.js';
import { DashboardService } from './dashboard.service.js';
import {
  ChartQueryDto,
  TopCategoriesQueryDto,
  TopZonesQueryDto,
  DetailQueryDto,
  DetailTransactionsQueryDto,
} from './dto/index.js';

@Controller('dashboard')
@RequirePermission('dashboard', 'view')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  async getSummary(@Query() query: ChartQueryDto) {
    return this.dashboardService.getSummary(
      query.startDate,
      query.endDate,
      query.warehouseTypeId,
    );
  }

  @Get('chart')
  async getChart(@Query() query: ChartQueryDto) {
    return this.dashboardService.getChartData(
      query.period ?? 'month',
      query.warehouseTypeId,
    );
  }

  @Get('alerts/below-min')
  async getAlertsBelowMin(@Query() query: ChartQueryDto) {
    return this.dashboardService.getAlertsBelowMin(query.warehouseTypeId);
  }

  @Get('alerts/above-max')
  async getAlertsAboveMax(@Query() query: ChartQueryDto) {
    return this.dashboardService.getAlertsAboveMax(query.warehouseTypeId);
  }

  @Get('top-categories')
  async getTopCategories(@Query() query: TopCategoriesQueryDto) {
    return this.dashboardService.getTopCategories(
      query.type ?? 'highest',
      query.limit ?? 20,
      query.warehouseTypeId,
    );
  }

  @Get('top-zones')
  async getTopZones(@Query() query: TopZonesQueryDto) {
    return this.dashboardService.getTopZones(
      query.type ?? 'highest',
      query.limit ?? 10,
      query.warehouseTypeId,
    );
  }

  @Get('chart-v2')
  async getChartV2(@Query() query: ChartQueryDto) {
    return this.dashboardService.getChartDataV2(
      query.period ?? 'month',
      query.warehouseTypeId,
    );
  }

  @Get('detail/categories')
  async getDetailCategories(@Query() query: DetailQueryDto) {
    return this.dashboardService.getDetailCategories(
      query.page ?? 1,
      query.limit ?? 20,
      query.startDate,
      query.endDate,
      query.warehouseTypeId,
    );
  }

  @Get('detail/stock')
  async getDetailStock(@Query() query: DetailQueryDto) {
    return this.dashboardService.getDetailStock(
      query.page ?? 1,
      query.limit ?? 20,
      query.startDate,
      query.endDate,
      query.warehouseTypeId,
    );
  }

  @Get('detail/transactions')
  async getDetailTransactions(@Query() query: DetailTransactionsQueryDto) {
    return this.dashboardService.getDetailTransactions(
      query.type ?? 'stock_in',
      query.page ?? 1,
      query.limit ?? 20,
      query.startDate,
      query.endDate,
      query.warehouseTypeId,
    );
  }

  @Get('detail/order-plans')
  async getDetailOrderPlans(@Query() query: DetailQueryDto) {
    return this.dashboardService.getDetailOrderPlans(
      query.page ?? 1,
      query.limit ?? 20,
      query.startDate,
      query.endDate,
      query.warehouseTypeId,
    );
  }
}
