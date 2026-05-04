import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InventoryTransactionStatus, TransactionType } from '@prisma/client/index';
import { PrismaService } from '../prisma/prisma.service.js';
import * as ExcelJS from 'exceljs';

export interface ReportFilters {
  categoryId?: string;
  startDate?: string;
  endDate?: string;
}

export interface NxtReportItem {
  categoryId: string | null;
  categoryName: string;
  openingStock: number;
  openingValue: number;
  totalIn: number;
  totalInValue: number;
  totalOut: number;
  totalOutValue: number;
  closingStock: number;
  closingValue: number;
}

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  private computeValue(quantity: number, price?: number | null) {
    return quantity * Number(price ?? 0);
  }

  async generateExcelReport(filters: ReportFilters): Promise<Buffer> {
    const data = await this.getNxtReport(
      filters.startDate ?? new Date(0).toISOString().slice(0, 10),
      filters.endDate ?? new Date().toISOString().slice(0, 10),
      filters.categoryId,
    );

    if (data.length === 0) {
      throw new NotFoundException('Không có dữ liệu để xuất báo cáo');
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Bao cao ton kho');

    worksheet.columns = [
      { header: 'Danh mục', key: 'categoryName', width: 28 },
      { header: 'Tồn đầu kỳ', key: 'openingStock', width: 14 },
      { header: 'Giá trị đầu kỳ', key: 'openingValue', width: 16 },
      { header: 'Nhập', key: 'totalIn', width: 12 },
      { header: 'Giá trị nhập', key: 'totalInValue', width: 16 },
      { header: 'Xuất', key: 'totalOut', width: 12 },
      { header: 'Giá trị xuất', key: 'totalOutValue', width: 16 },
      { header: 'Tồn cuối kỳ', key: 'closingStock', width: 14 },
      { header: 'Giá trị cuối kỳ', key: 'closingValue', width: 16 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: 'center' };

    for (const row of data) {
      worksheet.addRow(row);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async getNxtReport(startDate: string, endDate: string, categoryId?: string): Promise<NxtReportItem[]> {
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T23:59:59.999`);

    const categories = await this.prisma.category.findMany({
      where: categoryId ? { id: categoryId } : undefined,
      orderBy: { name: 'asc' },
    });

    const transactions = await this.prisma.inventoryTransaction.findMany({
      where: {
        status: InventoryTransactionStatus.ACTIVE,
        ...(categoryId ? { categoryId } : {}),
        createdAt: { lte: end },
      },
      include: {
        category: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const rows = new Map<string, NxtReportItem>();
    for (const category of categories) {
      rows.set(category.id, {
        categoryId: category.id,
        categoryName: category.name,
        openingStock: 0,
        openingValue: 0,
        totalIn: 0,
        totalInValue: 0,
        totalOut: 0,
        totalOutValue: 0,
        closingStock: 0,
        closingValue: 0,
      });
    }

    for (const transaction of transactions) {
      if (!transaction.categoryId || !transaction.category) continue;
      const row =
        rows.get(transaction.categoryId) ??
        {
          categoryId: transaction.categoryId,
          categoryName: transaction.category.name,
          openingStock: 0,
          openingValue: 0,
          totalIn: 0,
          totalInValue: 0,
          totalOut: 0,
          totalOutValue: 0,
          closingStock: 0,
          closingValue: 0,
        };

      const value = this.computeValue(transaction.quantity, Number(transaction.purchasePrice ?? 0));
      const isInbound = transaction.type === TransactionType.STOCK_IN;

      if (transaction.createdAt < start) {
        row.openingStock += isInbound ? transaction.quantity : -transaction.quantity;
        row.openingValue += isInbound ? value : -value;
      }

      if (transaction.createdAt >= start && transaction.createdAt <= end) {
        if (isInbound) {
          row.totalIn += transaction.quantity;
          row.totalInValue += value;
        } else {
          row.totalOut += transaction.quantity;
          row.totalOutValue += value;
        }
      }

      row.closingStock += isInbound ? transaction.quantity : -transaction.quantity;
      row.closingValue += isInbound ? value : -value;
      rows.set(row.categoryId!, row);
    }

    return Array.from(rows.values()).map((row) => ({
      ...row,
      openingValue: Math.max(row.openingValue, 0),
      totalInValue: Math.max(row.totalInValue, 0),
      totalOutValue: Math.max(row.totalOutValue, 0),
      closingValue: Math.max(row.closingValue, 0),
    }));
  }

  async exportNxtExcel(startDate: string, endDate: string): Promise<Buffer> {
    const data = await this.getNxtReport(startDate, endDate);

    if (data.length === 0) {
      throw new NotFoundException('Không có dữ liệu trong khoảng thời gian đã chọn');
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Bao cao NXT');

    worksheet.columns = [
      { header: 'Danh mục', key: 'categoryName', width: 30 },
      { header: 'Tồn đầu kỳ', key: 'openingStock', width: 15 },
      { header: 'Giá trị tồn đầu', key: 'openingValue', width: 18 },
      { header: 'Nhập', key: 'totalIn', width: 12 },
      { header: 'Giá trị nhập', key: 'totalInValue', width: 18 },
      { header: 'Xuất', key: 'totalOut', width: 12 },
      { header: 'Giá trị xuất', key: 'totalOutValue', width: 18 },
      { header: 'Tồn cuối kỳ', key: 'closingStock', width: 15 },
      { header: 'Giá trị tồn cuối', key: 'closingValue', width: 18 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: 'center' };

    for (const item of data) {
      worksheet.addRow(item);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async generateTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Template Nhap kho');

    worksheet.columns = [
      { header: 'Danh mục', key: 'category', width: 24 },
      { header: 'Số lượng', key: 'quantity', width: 12 },
      { header: 'Giá nhập', key: 'purchasePrice', width: 14 },
      { header: 'Giá bán', key: 'salePrice', width: 14 },
      { header: 'Tình trạng hàng', key: 'condition', width: 20 },
      { header: 'Vị trí kho', key: 'position', width: 15 },
      { header: 'Loại kho', key: 'warehouseType', width: 15 },
      { header: 'Ghi chú', key: 'note', width: 25 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: 'center' };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  validateImportRow(
    row: Record<string, unknown>,
    rowIndex: number,
    lookups: {
      categories: Map<string, string>;
      conditions: Map<string, string>;
    },
  ): { valid: boolean; errors: Array<{ row: number; field: string; message: string }> } {
    const errors: Array<{ row: number; field: string; message: string }> = [];

    const category = String(row.category || '').trim();
    const quantity = Number(row.quantity);
    const purchasePrice =
      row.purchasePrice === undefined || row.purchasePrice === null || row.purchasePrice === ''
        ? null
        : Number(row.purchasePrice);
    const salePrice =
      row.salePrice === undefined || row.salePrice === null || row.salePrice === ''
        ? null
        : Number(row.salePrice);

    if (!category) {
      errors.push({ row: rowIndex, field: 'Danh mục', message: 'Danh mục là bắt buộc' });
    } else if (!lookups.categories.has(category.toLowerCase())) {
      errors.push({ row: rowIndex, field: 'Danh mục', message: `Danh mục "${category}" không tồn tại` });
    }

    if (isNaN(quantity) || quantity <= 0) {
      errors.push({ row: rowIndex, field: 'Số lượng', message: 'Số lượng phải lớn hơn 0' });
    }

    if (purchasePrice !== null && (isNaN(purchasePrice) || purchasePrice <= 0)) {
      errors.push({ row: rowIndex, field: 'Giá nhập', message: 'Giá nhập phải lớn hơn 0' });
    }

    if (salePrice !== null && (isNaN(salePrice) || salePrice <= 0)) {
      errors.push({ row: rowIndex, field: 'Giá bán', message: 'Giá bán phải lớn hơn 0' });
    }

    return { valid: errors.length === 0, errors };
  }

  async importStockIn(
    fileBuffer: Buffer,
    userId: string,
  ): Promise<{ success: boolean; totalRows: number; importedRows: number; errors?: Array<{ row: number; field: string; message: string }> }> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer as unknown as ExcelJS.Buffer);

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new BadRequestException('File không đúng định dạng template');
    }

    const [categories, conditions] = await Promise.all([
      this.prisma.category.findMany(),
      this.prisma.productCondition.findMany(),
    ]);

    const categoryMap = new Map(categories.map((item) => [item.name.toLowerCase(), item.id]));
    const conditionMap = new Map(conditions.map((item) => [item.name.toLowerCase(), item.id]));

    const rows: Array<Record<string, unknown>> = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      rows.push({
        category: row.getCell(1).value,
        quantity: row.getCell(2).value,
        purchasePrice: row.getCell(3).value,
        salePrice: row.getCell(4).value,
        condition: row.getCell(5).value,
        position: row.getCell(6).value,
        warehouseType: row.getCell(7).value,
        note: row.getCell(8).value,
      });
    });

    if (rows.length === 0) {
      throw new BadRequestException('File không có dữ liệu');
    }

    const allErrors: Array<{ row: number; field: string; message: string }> = [];
    for (let i = 0; i < rows.length; i++) {
      const { errors } = this.validateImportRow(rows[i], i + 2, {
        categories: categoryMap,
        conditions: conditionMap,
      });
      allErrors.push(...errors);
    }

    if (allErrors.length > 0) {
      return {
        success: false,
        totalRows: rows.length,
        importedRows: 0,
        errors: allErrors,
      };
    }

    let importedRows = 0;
    for (const row of rows) {
      const categoryId = categoryMap.get(String(row.category).trim().toLowerCase())!;
      await this.prisma.inventoryTransaction.create({
        data: {
          categoryId,
          type: 'STOCK_IN',
          quantity: Number(row.quantity),
          purchasePrice: Number(row.purchasePrice),
          salePrice: Number(row.salePrice),
          status: InventoryTransactionStatus.ACTIVE,
          userId,
          productConditionId: row.condition
            ? conditionMap.get(String(row.condition).trim().toLowerCase()) || null
            : null,
          actualStockDate: new Date(),
          notes: row.note ? String(row.note) : null,
        },
      });
      importedRows++;
    }

    return {
      success: true,
      totalRows: rows.length,
      importedRows,
    };
  }
}
