import { PrismaService } from '../prisma/prisma.service.js';
export interface ReportFilters {
    categoryId?: string;
    startDate?: string;
    endDate?: string;
}
export interface NxtReportItem {
    skuComboId: string | null;
    compositeSku: string;
    productName: string;
    classification: string;
    color: string;
    size: string;
    material: string;
    openingStock: number;
    openingValue: number;
    totalIn: number;
    totalInValue: number;
    totalOut: number;
    totalOutValue: number;
    closingStock: number;
    closingValue: number;
}
type LegacySkuComboInput = {
    id: string;
    compositeSku: string;
    classification?: {
        name?: string | null;
    } | null;
    color?: {
        name?: string | null;
    } | null;
    size?: {
        name?: string | null;
    } | null;
    material?: {
        name?: string | null;
    } | null;
};
type LegacyTransactionInput = {
    skuComboId: string | null;
    type: 'STOCK_IN' | 'STOCK_OUT';
    quantity: number;
    purchasePrice?: number | null;
};
export declare function computeNxtReport(skuCombos: LegacySkuComboInput[], transactionsBefore: LegacyTransactionInput[], transactionsInPeriod: LegacyTransactionInput[]): NxtReportItem[];
export declare class ReportService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    generateExcelReport(filters: ReportFilters): Promise<Buffer>;
    getNxtReport(startDate: string, endDate: string): Promise<NxtReportItem[]>;
    exportNxtExcel(startDate: string, endDate: string): Promise<Buffer>;
    generateTemplate(): Promise<Buffer>;
    validateImportRow(row: Record<string, unknown>, rowIndex: number, lookups: {
        classifications: Map<string, string>;
        colors: Map<string, string>;
        sizes: Map<string, string>;
        materials: Map<string, string>;
        conditions: Map<string, string>;
    }): {
        valid: boolean;
        errors: Array<{
            row: number;
            field: string;
            message: string;
        }>;
    };
    importStockIn(fileBuffer: Buffer, userId: string): Promise<{
        success: boolean;
        totalRows: number;
        importedRows: number;
        errors?: Array<{
            row: number;
            field: string;
            message: string;
        }>;
    }>;
}
export {};
