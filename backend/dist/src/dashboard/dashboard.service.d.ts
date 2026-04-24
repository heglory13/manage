import { PrismaService } from '../prisma/prisma.service.js';
export interface DashboardSummary {
    totalProducts: number;
    totalStock: number;
    monthlyStockIn: number;
    monthlyStockOut: number;
    capacityRatio: number;
}
export interface ChartData {
    labels: string[];
    stockIn: number[];
    stockOut: number[];
    period: 'week' | 'month';
}
export interface ChartDataV2 {
    labels: string[];
    stockIn: number[];
    stockOut: number[];
    inventory: number[];
    period: 'week' | 'month';
}
export interface AlertProduct {
    id: string;
    name: string;
    sku: string;
    stock: number;
    minThreshold: number;
    maxThreshold: number;
    category?: {
        id: string;
        name: string;
    };
}
export interface TopProduct {
    rank: number;
    id: string;
    name: string;
    sku: string;
    stock: number;
}
export interface TopZone {
    rank: number;
    id: string;
    name: string;
    maxCapacity: number;
    currentStock: number;
    usagePercent: number;
}
export interface TransactionDetail {
    id: string;
    createdAt: string;
    productName: string;
    productSku: string;
    quantity: number;
    userName: string;
}
export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
export declare class DashboardService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getSummary(): Promise<DashboardSummary>;
    getChartData(period?: 'week' | 'month'): Promise<ChartData>;
    getAlertsBelowMin(): Promise<AlertProduct[]>;
    getAlertsAboveMax(): Promise<AlertProduct[]>;
    getTopProducts(type: 'highest' | 'lowest', limit?: number): Promise<TopProduct[]>;
    getTopZones(type: 'highest' | 'lowest', limit?: number): Promise<TopZone[]>;
    static getWeekCutoff(date: Date): Date;
    getChartDataV2(period?: 'week' | 'month'): Promise<ChartDataV2>;
    getDetailProducts(page?: number, limit?: number): Promise<PaginatedResponse<unknown>>;
    getDetailStock(page?: number, limit?: number): Promise<PaginatedResponse<unknown>>;
    getDetailTransactions(type: 'stock_in' | 'stock_out', page?: number, limit?: number): Promise<PaginatedResponse<TransactionDetail>>;
}
