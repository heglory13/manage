import { PrismaService } from '../prisma/prisma.service.js';
export interface ReportFilters {
    categoryId?: string;
    startDate?: string;
    endDate?: string;
}
export interface NxtReportItem {
    skuComboId: string;
    compositeSku: string;
    classification: string;
    color: string;
    size: string;
    material: string;
    openingStock: number;
    totalIn: number;
    totalOut: number;
    closingStock: number;
}
export declare function computeNxtReport(skuCombos: Array<{
    id: string;
    compositeSku: string;
    classification: {
        name: string;
    };
    color: {
        name: string;
    };
    size: {
        name: string;
    };
    material: {
        name: string;
    };
}>, transactionsBefore: Array<{
    skuComboId: string | null;
    type: string;
    quantity: number;
}>, transactionsInPeriod: Array<{
    skuComboId: string | null;
    type: string;
    quantity: number;
}>): NxtReportItem[];
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
