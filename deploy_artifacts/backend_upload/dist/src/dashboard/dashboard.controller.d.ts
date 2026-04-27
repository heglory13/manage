import { DashboardService } from './dashboard.service.js';
import { ChartQueryDto, TopProductsQueryDto, TopZonesQueryDto, DetailQueryDto, DetailTransactionsQueryDto } from './dto/index.js';
export declare class DashboardController {
    private readonly dashboardService;
    constructor(dashboardService: DashboardService);
    getSummary(query: ChartQueryDto): Promise<import("./dashboard.service.js").DashboardSummary>;
    getChart(query: ChartQueryDto): Promise<import("./dashboard.service.js").ChartData>;
    getAlertsBelowMin(): Promise<import("./dashboard.service.js").AlertProduct[]>;
    getAlertsAboveMax(): Promise<import("./dashboard.service.js").AlertProduct[]>;
    getTopProducts(query: TopProductsQueryDto): Promise<import("./dashboard.service.js").TopProduct[]>;
    getTopZones(query: TopZonesQueryDto): Promise<import("./dashboard.service.js").TopZone[]>;
    getChartV2(query: ChartQueryDto): Promise<import("./dashboard.service.js").ChartDataV2>;
    getDetailProducts(query: DetailQueryDto): Promise<import("./dashboard.service.js").PaginatedResponse<unknown>>;
    getDetailStock(query: DetailQueryDto): Promise<import("./dashboard.service.js").PaginatedResponse<unknown>>;
    getDetailTransactions(query: DetailTransactionsQueryDto): Promise<import("./dashboard.service.js").PaginatedResponse<import("./dashboard.service.js").TransactionDetail>>;
}
