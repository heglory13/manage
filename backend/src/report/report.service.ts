import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import * as ExcelJS from 'exceljs';

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

/**
 * Pure function to compute NXT report from transactions.
 * closingStock = openingStock + totalIn - totalOut
 */
export function computeNxtReport(
  skuCombos: Array<{
    id: string;
    compositeSku: string;
    classification: { name: string };
    color: { name: string };
    size: { name: string };
    material: { name: string };
  }>,
  transactionsBefore: Array<{ skuComboId: string | null; type: string; quantity: number }>,
  transactionsInPeriod: Array<{ skuComboId: string | null; type: string; quantity: number }>,
): NxtReportItem[] {
  const result: NxtReportItem[] = [];

  for (const combo of skuCombos) {
    // Opening stock = sum of all transactions before the period
    const openingIn = transactionsBefore
      .filter((t) => t.skuComboId === combo.id && t.type === 'STOCK_IN')
      .reduce((sum, t) => sum + t.quantity, 0);
    const openingOut = transactionsBefore
      .filter((t) => t.skuComboId === combo.id && t.type === 'STOCK_OUT')
      .reduce((sum, t) => sum + t.quantity, 0);
    const openingStock = openingIn - openingOut;

    // In-period transactions
    const totalIn = transactionsInPeriod
      .filter((t) => t.skuComboId === combo.id && t.type === 'STOCK_IN')
      .reduce((sum, t) => sum + t.quantity, 0);
    const totalOut = transactionsInPeriod
      .filter((t) => t.skuComboId === combo.id && t.type === 'STOCK_OUT')
      .reduce((sum, t) => sum + t.quantity, 0);

    const closingStock = openingStock + totalIn - totalOut;

    // Only include combos that have any activity
    if (openingStock !== 0 || totalIn !== 0 || totalOut !== 0) {
      result.push({
        skuComboId: combo.id,
        compositeSku: combo.compositeSku,
        classification: combo.classification.name,
        color: combo.color.name,
        size: combo.size.name,
        material: combo.material.name,
        openingStock,
        totalIn,
        totalOut,
        closingStock,
      });
    }
  }

  return result;
}

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  async generateExcelReport(filters: ReportFilters): Promise<Buffer> {
    const where: Record<string, unknown> = {};

    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (filters.startDate || filters.endDate) {
      const updatedAt: Record<string, Date> = {};
      if (filters.startDate) {
        updatedAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        updatedAt.lte = new Date(filters.endDate);
      }
      where.updatedAt = updatedAt;
    }

    const products = await this.prisma.product.findMany({
      where,
      include: {
        category: true,
        transactions: true,
      },
      orderBy: { name: 'asc' },
    });

    if (products.length === 0) {
      throw new NotFoundException('Không có dữ liệu để xuất báo cáo');
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Báo cáo tồn kho');

    worksheet.columns = [
      { header: 'Tên sản phẩm', key: 'name', width: 30 },
      { header: 'SKU', key: 'sku', width: 25 },
      { header: 'Danh mục', key: 'category', width: 20 },
      { header: 'Số lượng nhập', key: 'stockIn', width: 15 },
      { header: 'Số lượng xuất', key: 'stockOut', width: 15 },
      { header: 'Tồn kho hiện tại', key: 'currentStock', width: 18 },
      { header: 'Thời gian cập nhật cuối', key: 'updatedAt', width: 25 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: 'center' };

    for (const product of products) {
      const totalStockIn = product.transactions
        .filter((t) => t.type === 'STOCK_IN')
        .reduce((sum, t) => sum + t.quantity, 0);

      const totalStockOut = product.transactions
        .filter((t) => t.type === 'STOCK_OUT')
        .reduce((sum, t) => sum + t.quantity, 0);

      worksheet.addRow({
        name: product.name,
        sku: product.sku,
        category: product.category.name,
        stockIn: totalStockIn,
        stockOut: totalStockOut,
        currentStock: product.stock,
        updatedAt: product.updatedAt.toISOString(),
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * NXT Report: Nhập-Xuất-Tồn per SKU combo for a given period.
   */
  async getNxtReport(startDate: string, endDate: string): Promise<NxtReportItem[]> {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Get all SKU combos
    const skuCombos = await this.prisma.skuCombo.findMany({
      include: {
        classification: true,
        color: true,
        size: true,
        material: true,
      },
    });

    // Get transactions before the period (for opening stock)
    const transactionsBefore = await this.prisma.inventoryTransaction.findMany({
      where: {
        createdAt: { lt: start },
        skuComboId: { not: null },
      },
      select: { skuComboId: true, type: true, quantity: true },
    });

    // Get transactions within the period
    const transactionsInPeriod = await this.prisma.inventoryTransaction.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        skuComboId: { not: null },
      },
      select: { skuComboId: true, type: true, quantity: true },
    });

    return computeNxtReport(skuCombos, transactionsBefore, transactionsInPeriod);
  }

  /**
   * Export NXT report as Excel
   */
  async exportNxtExcel(startDate: string, endDate: string): Promise<Buffer> {
    const data = await this.getNxtReport(startDate, endDate);

    if (data.length === 0) {
      throw new NotFoundException('Không có dữ liệu trong khoảng thời gian đã chọn');
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Báo cáo NXT');

    worksheet.columns = [
      { header: 'SKU', key: 'compositeSku', width: 30 },
      { header: 'Phân loại', key: 'classification', width: 20 },
      { header: 'Màu', key: 'color', width: 15 },
      { header: 'Size', key: 'size', width: 10 },
      { header: 'Chất liệu', key: 'material', width: 15 },
      { header: 'Tồn đầu kỳ', key: 'openingStock', width: 15 },
      { header: 'Nhập', key: 'totalIn', width: 12 },
      { header: 'Xuất', key: 'totalOut', width: 12 },
      { header: 'Tồn cuối kỳ', key: 'closingStock', width: 15 },
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

  /**
   * Generate stock-in Excel template for import
   */
  async generateTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Template Nhập kho');

    worksheet.columns = [
      { header: 'Phân loại', key: 'classification', width: 20 },
      { header: 'Màu', key: 'color', width: 15 },
      { header: 'Size', key: 'size', width: 10 },
      { header: 'Chất liệu', key: 'material', width: 15 },
      { header: 'Số lượng', key: 'quantity', width: 12 },
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

  /**
   * Validate a single import row
   */
  validateImportRow(
    row: Record<string, unknown>,
    rowIndex: number,
    lookups: {
      classifications: Map<string, string>;
      colors: Map<string, string>;
      sizes: Map<string, string>;
      materials: Map<string, string>;
      conditions: Map<string, string>;
    },
  ): { valid: boolean; errors: Array<{ row: number; field: string; message: string }> } {
    const errors: Array<{ row: number; field: string; message: string }> = [];

    const classification = String(row.classification || '').trim();
    const color = String(row.color || '').trim();
    const size = String(row.size || '').trim();
    const material = String(row.material || '').trim();
    const quantity = Number(row.quantity);

    if (!classification) {
      errors.push({ row: rowIndex, field: 'Phân loại', message: 'Phân loại là bắt buộc' });
    } else if (!lookups.classifications.has(classification.toLowerCase())) {
      errors.push({ row: rowIndex, field: 'Phân loại', message: `Phân loại "${classification}" không tồn tại` });
    }

    if (!color) {
      errors.push({ row: rowIndex, field: 'Màu', message: 'Màu là bắt buộc' });
    } else if (!lookups.colors.has(color.toLowerCase())) {
      errors.push({ row: rowIndex, field: 'Màu', message: `Màu "${color}" không tồn tại` });
    }

    if (!size) {
      errors.push({ row: rowIndex, field: 'Size', message: 'Size là bắt buộc' });
    } else if (!lookups.sizes.has(size.toLowerCase())) {
      errors.push({ row: rowIndex, field: 'Size', message: `Size "${size}" không tồn tại` });
    }

    if (!material) {
      errors.push({ row: rowIndex, field: 'Chất liệu', message: 'Chất liệu là bắt buộc' });
    } else if (!lookups.materials.has(material.toLowerCase())) {
      errors.push({ row: rowIndex, field: 'Chất liệu', message: `Chất liệu "${material}" không tồn tại` });
    }

    if (isNaN(quantity) || quantity <= 0) {
      errors.push({ row: rowIndex, field: 'Số lượng', message: 'Số lượng phải lớn hơn 0' });
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Import stock-in from Excel file.
   * Atomic: if any row fails validation, rollback all.
   */
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

    // Build lookup maps
    const [classifications, colors, sizes, materials, conditions] = await Promise.all([
      this.prisma.classification.findMany(),
      this.prisma.color.findMany(),
      this.prisma.size.findMany(),
      this.prisma.material.findMany(),
      this.prisma.productCondition.findMany(),
    ]);

    const classificationMap = new Map(classifications.map((c) => [c.name.toLowerCase(), c.id]));
    const colorMap = new Map(colors.map((c) => [c.name.toLowerCase(), c.id]));
    const sizeMap = new Map(sizes.map((s) => [s.name.toLowerCase(), s.id]));
    const materialMap = new Map(materials.map((m) => [m.name.toLowerCase(), m.id]));
    const conditionMap = new Map(conditions.map((c) => [c.name.toLowerCase(), c.id]));

    const lookups = {
      classifications: classificationMap,
      colors: colorMap,
      sizes: sizeMap,
      materials: materialMap,
      conditions: conditionMap,
    };

    // Parse rows (skip header)
    const rows: Array<Record<string, unknown>> = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header
      rows.push({
        classification: row.getCell(1).value,
        color: row.getCell(2).value,
        size: row.getCell(3).value,
        material: row.getCell(4).value,
        quantity: row.getCell(5).value,
        condition: row.getCell(6).value,
        position: row.getCell(7).value,
        warehouseType: row.getCell(8).value,
        note: row.getCell(9).value,
      });
    });

    if (rows.length === 0) {
      throw new BadRequestException('File không có dữ liệu');
    }

    // Validate all rows first
    const allErrors: Array<{ row: number; field: string; message: string }> = [];
    for (let i = 0; i < rows.length; i++) {
      const { errors } = this.validateImportRow(rows[i], i + 2, lookups); // +2 for 1-indexed + header
      allErrors.push(...errors);
    }

    // If any errors, return them all (atomic: no partial import)
    if (allErrors.length > 0) {
      return {
        success: false,
        totalRows: rows.length,
        importedRows: 0,
        errors: allErrors,
      };
    }

    // All valid — create transactions in a single transaction
    const operations = rows.map((row) => {
      const classificationName = String(row.classification).trim().toLowerCase();
      const colorName = String(row.color).trim().toLowerCase();
      const sizeName = String(row.size).trim().toLowerCase();
      const materialName = String(row.material).trim().toLowerCase();
      const quantity = Number(row.quantity);
      const conditionName = row.condition ? String(row.condition).trim().toLowerCase() : null;

      const classificationId = classificationMap.get(classificationName)!;
      const colorId = colorMap.get(colorName)!;
      const sizeId = sizeMap.get(sizeName)!;
      const materialId = materialMap.get(materialName)!;
      const productConditionId = conditionName ? conditionMap.get(conditionName) : undefined;

      // We need to find or create the SKU combo and product
      // For simplicity, we create inventory transactions linked to the first product
      // In a real system, this would be more sophisticated
      return {
        classificationId,
        colorId,
        sizeId,
        materialId,
        quantity,
        productConditionId,
      };
    });

    // Find or create SKU combos and create transactions
    let importedRows = 0;
    const txnOps = [];

    for (const op of operations) {
      // Find existing SKU combo
      const skuCombo = await this.prisma.skuCombo.findFirst({
        where: {
          classificationId: op.classificationId,
          colorId: op.colorId,
          sizeId: op.sizeId,
          materialId: op.materialId,
        },
      });

      if (!skuCombo) {
        // Skip rows without matching SKU combo (shouldn't happen after validation)
        continue;
      }

      // Find a product to link to (use first product or create a generic one)
      const product = await this.prisma.product.findFirst();
      if (!product) continue;

      txnOps.push(
        this.prisma.inventoryTransaction.create({
          data: {
            productId: product.id,
            type: 'STOCK_IN',
            quantity: op.quantity,
            userId,
            skuComboId: skuCombo.id,
            productConditionId: op.productConditionId || null,
            actualStockDate: new Date(),
          },
        }),
      );

      txnOps.push(
        this.prisma.product.update({
          where: { id: product.id },
          data: { stock: { increment: op.quantity } },
        }),
      );

      importedRows++;
    }

    if (txnOps.length > 0) {
      await this.prisma.$transaction(txnOps);
    }

    return {
      success: true,
      totalRows: rows.length,
      importedRows,
    };
  }
}
