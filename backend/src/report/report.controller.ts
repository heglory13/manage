import { Controller, Get, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/index.js';
import { CurrentUser } from '../auth/decorators/index.js';
import type { UserPayload } from '../auth/interfaces/index.js';
import { ReportService } from './report.service.js';
import { ReportQueryDto, NxtReportQueryDto } from './dto/index.js';

@Controller('reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get('export')
  @Roles(Role.MANAGER, Role.ADMIN)
  async exportExcel(
    @Query() query: ReportQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.reportService.generateExcelReport({
      categoryId: query.categoryId,
      startDate: query.startDate,
      endDate: query.endDate,
    });

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="bao-cao-ton-kho-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      'Content-Length': buffer.length.toString(),
    });

    res.end(buffer);
  }

  @Get('nxt')
  @Roles(Role.MANAGER, Role.ADMIN)
  async getNxtReport(@Query() query: NxtReportQueryDto) {
    return this.reportService.getNxtReport(query.startDate, query.endDate);
  }

  @Get('nxt/export')
  @Roles(Role.MANAGER, Role.ADMIN)
  async exportNxtExcel(
    @Query() query: NxtReportQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.reportService.exportNxtExcel(query.startDate, query.endDate);

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="bao-cao-nxt-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      'Content-Length': buffer.length.toString(),
    });

    res.end(buffer);
  }

  @Get('stock-in/template')
  async downloadTemplate(@Res() res: Response): Promise<void> {
    const buffer = await this.reportService.generateTemplate();

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="template-nhap-kho.xlsx"',
      'Content-Length': buffer.length.toString(),
    });

    res.end(buffer);
  }

  @Post('stock-in/import')
  @Roles(Role.MANAGER, Role.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  async importExcel(
    @UploadedFile() file: { buffer: Buffer; originalname: string },
    @CurrentUser() currentUser: Record<string, unknown>,
  ) {
    const user = currentUser as unknown as UserPayload;
    return this.reportService.importStockIn(file.buffer, user.userId);
  }
}
