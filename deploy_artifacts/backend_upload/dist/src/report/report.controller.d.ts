import type { Response } from 'express';
import { ReportService } from './report.service.js';
import { ReportQueryDto, NxtReportQueryDto } from './dto/index.js';
export declare class ReportController {
    private readonly reportService;
    constructor(reportService: ReportService);
    exportExcel(query: ReportQueryDto, res: Response): Promise<void>;
    getNxtReport(query: NxtReportQueryDto): Promise<import("./report.service.js").NxtReportItem[]>;
    exportNxtExcel(query: NxtReportQueryDto, res: Response): Promise<void>;
    downloadTemplate(res: Response): Promise<void>;
    importExcel(file: {
        buffer: Buffer;
        originalname: string;
    }, currentUser: Record<string, unknown>): Promise<{
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
