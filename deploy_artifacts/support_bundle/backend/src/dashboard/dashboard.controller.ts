import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client/index';
import { Roles } from '../auth/decorators/index.js';
import { DashboardService } from './dashboard.service.js';
import { ChartQueryDto, TopProductsQueryDto, TopZonesQueryDto, DetailQueryDto, DetailTransactionsQueryDto } from './dto/index.js';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @Roles(Role.MANAGER, Role.ADMIN)
  async getSummary(@Query() query: ChartQueryDto) {
    return this.dashboardService.getSummary(query.startDate, query.endDate);
  }

  @Get('chart')
  @Roles(Role.MANAGER, Role.ADMIN)
  async getChart(@Query() query: ChartQueryDto) {
    return this.dashboardService.getChartData(query.period ?? 'month');
  }

  @Get('alerts/below-min')
  @Roles(Role.MANAGER, Role.ADMIN)
  async getAlertsBelowMin() {
    return this.dashboardService.getAlertsBelowMin();
  }

  @Get('alerts/above-max')
  @Roles(Role.MANAGER, Role.ADMIN)
  async getAlertsAboveMax() {
    return this.dashboardService.getAlertsAboveMax();
  }

  @Get('top-products')
  @Roles(Role.MANAGER, Role.ADMIN)
  async getTopProducts(@Query() query: TopProductsQueryDto) {
    return this.dashboardService.getTopProducts(query.type ?? 'highest', query.limit ?? 20);
  }

  @Get('top-zones')
  @Roles(Role.MANAGER, Role.ADMIN)
  async getTopZones(@Query() query: TopZonesQueryDto) {
    return this.dashboardService.getTopZones(query.type ?? 'highest', query.limit ?? 10);
  }

  @Get('chart-v2')
  @Roles(Role.MANAGER, Role.ADMIN)
  async getChartV2(@Query() query: ChartQueryDto) {
    return this.dashboardService.getChartDataV2(query.period ?? 'month');
  }

  @Get('detail/products')
  @Roles(Role.MANAGER, Role.ADMIN)
  async getDetailProducts(@Query() query: DetailQueryDto) {
    return this.dashboardService.getDetailProducts(
      query.page ?? 1,
      query.limit ?? 20,
      query.startDate,
      query.endDate,
    );
  }

  @Get('detail/stock')
  @Roles(Role.MANAGER, Role.ADMIN)
  async getDetailStock(@Query() query: DetailQueryDto) {
    return this.dashboardService.getDetailStock(
      query.page ?? 1,
      query.limit ?? 20,
      query.startDate,
      query.endDate,
    );
  }

  @Get('detail/transactions')
  @Roles(Role.MANAGER, Role.ADMIN)
  async getDetailTransactions(@Query() query: DetailTransactionsQueryDto) {
    return this.dashboardService.getDetailTransactions(
      query.type ?? 'stock_in',
      query.page ?? 1,
      query.limit ?? 20,
      query.startDate,
      query.endDate,
    );
  }
}
