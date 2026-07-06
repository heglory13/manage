import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  InventoryTransactionStatus,
  TransactionType,
} from '@prisma/client/index';
import { PrismaService } from '../prisma/prisma.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { SkuComboService } from '../input-declaration/sku-combo.service.js';
import * as ExcelJS from 'exceljs';

const IMPORT_COLUMNS = [
  'Danh mục',       // 1
  'Phân loại',      // 2
  'Màu sắc',        // 3
  'Kích thước',     // 4
  'Chất liệu',      // 5
  'Tình trạng hàng', // 6
  'Loại kho',       // 7
  'Khu vực / Thùng', // 8
  'Số lượng',       // 9
  'Giá nhập',       // 10
  'Thời gian nhập kho thực tế', // 11
  'Ghi chú',        // 12
];

const MAX_IMPORT_ROWS = 2000;

export interface ReportFilters {
  categoryId?: string;
  startDate?: string;
  endDate?: string;
}

export interface NxtReportItem {
  categoryId: string | null;
  categoryName: string;
  productName: string;
  sku: string;
  openingStock: number;
  openingValue: number;
  totalIn: number;
  totalInValue: number;
  totalOut: number;
  totalOutValue: number;
  closingStock: number;
  closingValue: number;
}

interface ImportRow {
  rowNumber: number;
  category: string;
  classification: string;
  color: string;
  size: string;
  material: string;
  condition: string;
  warehouseType: string;
  storageZone: string;
  quantity: string;
  purchasePrice: string;
  actualStockDate: string;
  note: string;
}

@Injectable()
export class ReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly skuComboService: SkuComboService,
  ) {}

  private computeValue(quantity: number, price?: number | null) {
    return quantity * Number(price ?? 0);
  }

  private normalizeValue(value: string): string {
    return value
      .replace(/[\u00A0\u200B\u200C\u200D\uFEFF\u202F\u2060]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private buildNameMap<T extends { id: string; name: string }>(items: T[]): Map<string, string> {
    return new Map(items.map((item) => [this.normalizeValue(item.name), item.id]));
  }

  private parseNumeric(value: unknown): number | null {
    if (value === undefined || value === null || value === '') return null;
    const cleaned = String(value).replace(/,/g, '.').replace(/[^0-9.-]/g, '');
    const num = Number(cleaned);
    return isNaN(num) ? null : num;
  }

  /**
   * Parse a date cell from Excel/CSV that can be:
   * - A Date object (ExcelJS auto-parses when cellDates: true)
   * - An Excel serial number (e.g. 46178 for 2026-05-27). Excel epoch is
   *   1899-12-30 (taking into account the 1900 leap-year bug).
   * - A string in DD/MM/YYYY or DD/MM/YYYY HH:mm format
   * - An ISO date string
   *
   * Returns a valid Date or null when the value cannot be interpreted.
   */
  private parseDate(value: unknown): Date | null {
    if (value === undefined || value === null || value === '') return null;

    // 1. Already a Date instance
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value;
    }

    // 2. Excel serial number (positive number, typically 1..100000)
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      // Excel's epoch is 1899-12-30; serial 1 = 1900-01-01.
      // Add the timezone offset so the resulting Date represents the same
      // calendar day the user saw in Excel.
      const excelEpoch = Date.UTC(1899, 11, 30);
      const millis = excelEpoch + value * 24 * 60 * 60 * 1000;
      const date = new Date(millis);
      return isNaN(date.getTime()) ? null : date;
    }

    const str = String(value).trim();
    if (!str) return null;

    // 3. DD/MM/YYYY or DD/MM/YYYY HH:mm
    const dmy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (dmy) {
      const [, dd, mm, yyyy, hh, mi, ss] = dmy;
      const date = new Date(
        Number(yyyy),
        Number(mm) - 1,
        Number(dd),
        hh ? Number(hh) : 0,
        mi ? Number(mi) : 0,
        ss ? Number(ss) : 0,
      );
      return isNaN(date.getTime()) ? null : date;
    }

    // 4. ISO or any other parseable format
    const date = new Date(str);
    return isNaN(date.getTime()) ? null : date;
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

  async getNxtReport(
    startDate: string,
    endDate: string,
    categoryId?: string,
  ): Promise<NxtReportItem[]> {
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T23:59:59.999`);

    const transactions = await this.prisma.inventoryTransaction.findMany({
      where: {
        status: InventoryTransactionStatus.ACTIVE,
        ...(categoryId ? { categoryId } : {}),
        createdAt: { lte: end },
      },
      include: {
        category: true,
        skuCombo: {
          include: {
            classification: true,
            color: true,
            size: true,
            material: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by skuComboId (or categoryId if no skuCombo)
    const rows = new Map<string, NxtReportItem>();

    for (const transaction of transactions) {
      const skuCombo = transaction.skuCombo;
      const key = skuCombo
        ? `sku:${skuCombo.id}`
        : `cat:${transaction.categoryId || transaction.id}`;

      const productName = skuCombo
        ? [
            skuCombo.classification?.name,
            skuCombo.color?.name,
            skuCombo.size?.name,
            skuCombo.material?.name,
          ]
            .filter(Boolean)
            .join(' - ')
        : transaction.category?.name || '-';
      const sku = skuCombo?.compositeSku || '-';

      const row = rows.get(key) ?? {
        categoryId: transaction.categoryId,
        categoryName: transaction.category?.name || '-',
        productName,
        sku,
        openingStock: 0,
        openingValue: 0,
        totalIn: 0,
        totalInValue: 0,
        totalOut: 0,
        totalOutValue: 0,
        closingStock: 0,
        closingValue: 0,
      };

      const value = this.computeValue(
        transaction.quantity,
        Number(transaction.purchasePrice ?? 0),
      );
      const isInbound = transaction.type === TransactionType.STOCK_IN;

      if (transaction.createdAt < start) {
        row.openingStock += isInbound
          ? transaction.quantity
          : -transaction.quantity;
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

      row.closingStock += isInbound
        ? transaction.quantity
        : -transaction.quantity;
      row.closingValue += isInbound ? value : -value;
      rows.set(key, row);
    }

    return Array.from(rows.values())
      .sort((a, b) => a.productName.localeCompare(b.productName, 'vi'))
      .map((row) => ({
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
      throw new NotFoundException(
        'Không có dữ liệu trong khoảng thời gian đã chọn',
      );
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Bao cao NXT');

    worksheet.columns = [
      { header: 'Tên sản phẩm', key: 'productName', width: 35 },
      { header: 'SKU', key: 'sku', width: 18 },
      { header: 'Danh mục', key: 'categoryName', width: 20 },
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
    const worksheet = workbook.addWorksheet('Nhap kho');

    worksheet.columns = IMPORT_COLUMNS.map((header) => ({
      header,
      key: `col${header}`,
      width: 20,
    }));

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: 'center' };

    worksheet.addRow([
      'ÁO',            // Danh mục
      'Polo Nam',      // Phân loại
      'Đen',           // Màu sắc
      'XL',            // Kích thước
      'Cotton',        // Chất liệu
      'Đạt tiêu chuẩn', // Tình trạng hàng
      'KHO LE',        // Loại kho
      'BA1',           // Khu vực / Thùng
      10,              // Số lượng
      150000,          // Giá nhập
      '2026-05-30',    // Thời gian nhập kho thực tế
      'Hàng mới',      // Ghi chú
    ]);

    worksheet.addRow([
      'BALO',          // Danh mục
      'Balo Laptop',   // Phân loại
      'Xanh lá',       // Màu sắc
      'L',             // Kích thước
      'Polyester',     // Chất liệu
      'Hàng ký gửi',   // Tình trạng hàng
      'KESAT2',        // Loại kho
      'A1',            // Khu vực / Thùng
      5,               // Số lượng
      200000,          // Giá nhập
      '2026-05-30',    // Thời gian nhập kho thực tế
      'Test nhập kho', // Ghi chú
    ]);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async importStockIn(
    fileBuffer: Buffer,
    userId: string,
  ) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer as unknown as ExcelJS.Buffer);

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new BadRequestException('File Excel không hợp lệ');
    }

    const headerRow = worksheet.getRow(1);
    const missingColumns: string[] = [];
    for (let i = 0; i < IMPORT_COLUMNS.length; i++) {
      const cellValue = String(headerRow.getCell(i + 1).value ?? '').trim();
      if (this.normalizeValue(cellValue) !== this.normalizeValue(IMPORT_COLUMNS[i])) {
        missingColumns.push(IMPORT_COLUMNS[i]);
      }
    }
    if (missingColumns.length > 0) {
      throw new BadRequestException(
        `File Excel thiếu cột: ${missingColumns.join(', ')}. Vui lòng tải mẫu mới nhất.`,
      );
    }

    const rows: ImportRow[] = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      rows.push({
        rowNumber,
        category: String(row.getCell(1).value ?? '').trim(),
        classification: String(row.getCell(2).value ?? '').trim(),
        color: String(row.getCell(3).value ?? '').trim(),
        size: String(row.getCell(4).value ?? '').trim(),
        material: String(row.getCell(5).value ?? '').trim(),
        condition: String(row.getCell(6).value ?? '').trim(),
        warehouseType: String(row.getCell(7).value ?? '').trim(),
        storageZone: String(row.getCell(8).value ?? '').trim(),
        quantity: String(row.getCell(9).value ?? '').trim(),
        purchasePrice: String(row.getCell(10).value ?? '').trim(),
        actualStockDate: String(row.getCell(11).value ?? '').trim(),
        note: String(row.getCell(12).value ?? '').trim(),
      });
    });

    if (rows.length === 0) {
      throw new BadRequestException('File Excel không có dữ liệu');
    }

    if (rows.length > MAX_IMPORT_ROWS) {
      throw new BadRequestException(
        `Tối đa ${MAX_IMPORT_ROWS} dòng mỗi lần nhập. File hiện có ${rows.length} dòng. Vui lòng chia nhỏ file.`,
      );
    }

    const [
      categories,
      classifications,
      colors,
      sizes,
      materials,
      productConditions,
      storageZones,
      warehouseTypes,
      positions,
    ] = await Promise.all([
      this.prisma.category.findMany({ select: { id: true, name: true } }),
      this.prisma.classification.findMany({ select: { id: true, name: true } }),
      this.prisma.color.findMany({ select: { id: true, name: true } }),
      this.prisma.size.findMany({ select: { id: true, name: true } }),
      this.prisma.material.findMany({ select: { id: true, name: true } }),
      this.prisma.productCondition.findMany({ select: { id: true, name: true } }),
      this.prisma.storageZone.findMany({ select: { id: true, name: true, maxCapacity: true, currentStock: true, warehouseTypeId: true } }),
      this.prisma.warehouseType.findMany({ select: { id: true, name: true } }),
      this.prisma.warehousePosition.findMany({
        select: { id: true, label: true, layout: { select: { name: true } } },
      }),
    ]);

    const categoryMap = this.buildNameMap(categories);
    const classificationMap = this.buildNameMap(classifications);
    const colorMap = this.buildNameMap(colors);
    const sizeMap = this.buildNameMap(sizes);
    const materialMap = this.buildNameMap(materials);
    const conditionMap = this.buildNameMap(productConditions);
    const warehouseTypeMap = this.buildNameMap(warehouseTypes);
    const storageZoneMap = new Map(storageZones.map((z) => [this.normalizeValue(z.name), z]));
    const warehouseTypeNameMap = new Map(warehouseTypes.map((wt) => [wt.id, wt.name]));

    const positionsByLayoutName = new Map<string, Array<{ id: string; label: string }>>();
    for (const pos of positions) {
      const layout = pos.layout;
      if (layout && layout.name && pos.label) {
        const existing = positionsByLayoutName.get(layout.name) || [];
        existing.push({ id: pos.id, label: pos.label });
        positionsByLayoutName.set(layout.name, existing);
      }
    }

    const errors: Array<{ row: number; field: string; message: string }> = [];
    const parsedItems: Array<{
      categoryId: string;
      classificationId: string;
      colorId: string;
      sizeId: string;
      materialId: string;
      productConditionId: string;
      warehouseTypeId: string;
      storageZoneId: string;
      warehousePositionId?: string;
      quantity: number;
      purchasePrice: number;
      notes?: string;
      actualStockDate?: string;
    }> = [];

    for (const row of rows) {
      const rn = row.rowNumber;
      const rowErrors: Array<{ row: number; field: string; message: string }> = [];

      if (!row.category) {
        rowErrors.push({ row: rn, field: 'Danh mục', message: 'Danh mục là bắt buộc' });
      } else if (!categoryMap.has(this.normalizeValue(row.category))) {
        rowErrors.push({ row: rn, field: 'Danh mục', message: `Danh mục "${row.category}" không tồn tại` });
      }

      if (!row.classification) {
        rowErrors.push({ row: rn, field: 'Phân loại', message: 'Phân loại là bắt buộc' });
      } else if (!classificationMap.has(this.normalizeValue(row.classification))) {
        rowErrors.push({ row: rn, field: 'Phân loại', message: `Phân loại "${row.classification}" không tồn tại` });
      }

      if (!row.color) {
        rowErrors.push({ row: rn, field: 'Màu sắc', message: 'Màu sắc là bắt buộc' });
      } else if (!colorMap.has(this.normalizeValue(row.color))) {
        rowErrors.push({ row: rn, field: 'Màu sắc', message: `Màu sắc "${row.color}" không tồn tại` });
      }

      if (!row.size) {
        rowErrors.push({ row: rn, field: 'Kích thước', message: 'Kích thước là bắt buộc' });
      } else if (!sizeMap.has(this.normalizeValue(row.size))) {
        rowErrors.push({ row: rn, field: 'Kích thước', message: `Kích thước "${row.size}" không tồn tại` });
      }

      if (!row.material) {
        rowErrors.push({ row: rn, field: 'Chất liệu', message: 'Chất liệu là bắt buộc' });
      } else if (!materialMap.has(this.normalizeValue(row.material))) {
        rowErrors.push({ row: rn, field: 'Chất liệu', message: `Chất liệu "${row.material}" không tồn tại` });
      }

      if (!row.condition) {
        rowErrors.push({ row: rn, field: 'Tình trạng hàng', message: 'Tình trạng hàng là bắt buộc' });
      } else if (!conditionMap.has(this.normalizeValue(row.condition))) {
        rowErrors.push({ row: rn, field: 'Tình trạng hàng', message: `Tình trạng hàng "${row.condition}" không tồn tại` });
      }

      if (!row.warehouseType) {
        rowErrors.push({ row: rn, field: 'Loại kho', message: 'Loại kho là bắt buộc' });
      } else if (!warehouseTypeMap.has(this.normalizeValue(row.warehouseType))) {
        rowErrors.push({ row: rn, field: 'Loại kho', message: `Loại kho "${row.warehouseType}" không tồn tại` });
      }

      if (!row.storageZone) {
        rowErrors.push({ row: rn, field: 'Khu vực / Thùng', message: 'Khu vực / Thùng là bắt buộc' });
      } else if (!storageZoneMap.has(this.normalizeValue(row.storageZone))) {
        rowErrors.push({ row: rn, field: 'Khu vực / Thùng', message: `Khu vực/Thùng "${row.storageZone}" không tồn tại` });
      }

      const quantity = this.parseNumeric(row.quantity);
      if (quantity === null || quantity <= 0) {
        rowErrors.push({ row: rn, field: 'Số lượng', message: 'Số lượng phải là số nguyên dương' });
      }

      const purchasePrice = this.parseNumeric(row.purchasePrice);
      if (purchasePrice === null || purchasePrice < 0) {
        rowErrors.push({ row: rn, field: 'Giá nhập', message: 'Giá nhập không hợp lệ' });
      }

      // Validate date format
      let actualStockDate: string | undefined;
      if (row.actualStockDate) {
        const d = this.parseDate(row.actualStockDate);
        if (!d) {
          rowErrors.push({ row: rn, field: 'Thời gian nhập kho thực tế', message: 'Định dạng ngày không hợp lệ' });
        } else {
          actualStockDate = d.toISOString();
        }
      }

      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
        continue;
      }

      // Resolve IDs
      const categoryId = categoryMap.get(this.normalizeValue(row.category))!;
      const classificationId = classificationMap.get(this.normalizeValue(row.classification))!;
      const colorId = colorMap.get(this.normalizeValue(row.color))!;
      const sizeId = sizeMap.get(this.normalizeValue(row.size))!;
      const materialId = materialMap.get(this.normalizeValue(row.material))!;
      const productConditionId = conditionMap.get(this.normalizeValue(row.condition))!;
      const warehouseTypeId = warehouseTypeMap.get(this.normalizeValue(row.warehouseType))!;
      const zone = storageZoneMap.get(this.normalizeValue(row.storageZone))!;

      // Find warehouse position by matching storage zone name within the warehouse type's layout
      let warehousePositionId: string | undefined;
      const wtName = warehouseTypeNameMap.get(warehouseTypeId);
      if (wtName) {
        const layoutPositions = positionsByLayoutName.get(wtName);
        if (layoutPositions) {
          const match = layoutPositions.find(
            (p) => this.normalizeValue(p.label) === this.normalizeValue(zone.name),
          );
          if (match) {
            warehousePositionId = match.id;
          }
        }
      }

      parsedItems.push({
        categoryId,
        classificationId,
        colorId,
        sizeId,
        materialId,
        productConditionId,
        warehouseTypeId,
        storageZoneId: zone.id,
        warehousePositionId,
        quantity: quantity!,
        purchasePrice: purchasePrice!,
        notes: row.note || undefined,
        actualStockDate,
      });
    }

    if (errors.length > 0) {
      return {
        success: false,
        totalRows: rows.length,
        importedRows: 0,
        errors,
      };
    }

    // Pre-validate total quantity per storage zone to avoid partial-failure errors
    // when a single import hits the capacity check at the wrong item.
    const zoneTotals = new Map<string, { name: string; maxCapacity: number; currentStock: number; total: number; rowNumbers: number[] }>();
    for (let i = 0; i < parsedItems.length; i++) {
      const item = parsedItems[i];
      const entry = zoneTotals.get(item.storageZoneId) || {
        name: storageZones.find((z) => z.id === item.storageZoneId)?.name ?? item.storageZoneId,
        maxCapacity: storageZones.find((z) => z.id === item.storageZoneId)?.maxCapacity ?? 0,
        currentStock: storageZones.find((z) => z.id === item.storageZoneId)?.currentStock ?? 0,
        total: 0,
        rowNumbers: [],
      };
      entry.total += item.quantity;
      entry.rowNumbers.push(rows[i].rowNumber);
      zoneTotals.set(item.storageZoneId, entry);
    }
    for (const [, entry] of zoneTotals) {
      const remaining = entry.maxCapacity - entry.currentStock;
      if (entry.total > remaining) {
        errors.push({
          row: entry.rowNumbers[0],
          field: 'Khu vực / Thùng',
          message: `Thùng "${entry.name}" không đủ sức chứa: còn ${Math.max(remaining, 0)} chỗ nhưng file yêu cầu nhập ${entry.total} sản phẩm (gồm ${entry.rowNumbers.length} dòng: ${entry.rowNumbers.join(', ')}). Vui lòng chia nhỏ file hoặc tăng sức chứa thùng.`,
        });
      }
    }
    if (errors.length > 0) {
      return {
        success: false,
        totalRows: rows.length,
        importedRows: 0,
        errors,
      };
    }

    // Resolve SKU combos (deduplicated by attribute combination)
    const skuComboCache = new Map<string, string>();
    const skuCacheKey = (item: typeof parsedItems[0]) =>
      `${item.categoryId}:${item.classificationId}:${item.colorId}:${item.sizeId}:${item.materialId}`;

    for (const item of parsedItems) {
      const key = skuCacheKey(item);
      if (!skuComboCache.has(key)) {
        const combo = await this.skuComboService.findOrCreate({
          classificationId: item.classificationId,
          colorId: item.colorId,
          sizeId: item.sizeId,
          materialId: item.materialId,
          categoryId: item.categoryId,
        });
        skuComboCache.set(key, combo.id);
      }
    }

    // Build batch items
    const batchItems = parsedItems.map((item) => {
      const key = skuCacheKey(item);
      return {
        categoryId: item.categoryId,
        quantity: item.quantity,
        purchasePrice: item.purchasePrice,
        skuComboId: skuComboCache.get(key),
        productConditionId: item.productConditionId,
        storageZoneId: item.storageZoneId,
        warehouseTypeId: item.warehouseTypeId,
        warehousePositionId: item.warehousePositionId,
        actualStockDate: item.actualStockDate,
        notes: item.notes,
      };
    });

    // Delegate to stockInBatch which handles $transaction, stock sync, receiptGroupId, activity logs
    return this.inventoryService.stockInBatch(batchItems, userId);
  }
}
