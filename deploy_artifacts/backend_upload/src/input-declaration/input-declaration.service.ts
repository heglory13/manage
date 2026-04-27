import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service.js';

export type AttributeType = 'classification' | 'color' | 'size' | 'material' | 'productCondition' | 'storageZone' | 'warehouseType' | 'category';

const DUPLICATE_MESSAGES: Record<AttributeType, string> = {
  classification: 'Phân loại này đã tồn tại',
  color: 'Màu sắc này đã tồn tại',
  size: 'Size này đã tồn tại',
  material: 'Chất liệu này đã tồn tại',
  productCondition: 'Tình trạng hàng hoá này đã tồn tại',
  storageZone: 'Khu vực hàng hoá này đã tồn tại',
  warehouseType: 'Loại kho này đã tồn tại',
  category: 'Danh mục này đã tồn tại',
};

const TABLE_MESSAGES: Record<AttributeType, string> = {
  classification: 'Phân loại',
  color: 'Màu sắc',
  size: 'Size',
  material: 'Chất liệu',
  productCondition: 'Tình trạng hàng hoá',
  storageZone: 'Khu vực hàng hoá',
  warehouseType: 'Loại kho',
  category: 'Danh mục',
};

const IMPORT_COLUMN_LABELS = {
  category: 'Danh muc',
  classification: 'Phan loai',
  color: 'Mau sac',
  size: 'Kich thuoc',
  material: 'Chat lieu',
  productCondition: 'Tinh trang hang hoa',
  storageZone: 'Khu vuc hang hoa',
  storageZoneCapacity: 'Suc chua khu vuc',
  warehouseType: 'Loai kho',
} as const;

const IMPORT_COLUMNS = [
  IMPORT_COLUMN_LABELS.category,
  IMPORT_COLUMN_LABELS.classification,
  IMPORT_COLUMN_LABELS.color,
  IMPORT_COLUMN_LABELS.size,
  IMPORT_COLUMN_LABELS.material,
  IMPORT_COLUMN_LABELS.productCondition,
  IMPORT_COLUMN_LABELS.storageZone,
  IMPORT_COLUMN_LABELS.storageZoneCapacity,
  IMPORT_COLUMN_LABELS.warehouseType,
] as const;

type ImportRow = {
  rowNumber: number;
  category: string;
  classification: string;
  color: string;
  size: string;
  material: string;
  productCondition: string;
  storageZone: string;
  storageZoneCapacity: number | null;
  warehouseType: string;
};

type ImportError = {
  row: number;
  field: string;
  message: string;
};

@Injectable()
export class InputDeclarationService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllDeclarations() {
    const [categories, classifications, colors, sizes, materials, productConditions, warehouseTypes, storageZones] = await Promise.all([
      this.prisma.category.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.classification.findMany({ orderBy: { createdAt: 'desc' } }),
      this.prisma.color.findMany({ orderBy: { createdAt: 'desc' } }),
      this.prisma.size.findMany({ orderBy: { createdAt: 'desc' } }),
      this.prisma.material.findMany({ orderBy: { createdAt: 'desc' } }),
      this.prisma.productCondition.findMany({ orderBy: { createdAt: 'desc' } }),
      this.prisma.warehouseType.findMany({ orderBy: { createdAt: 'desc' } }),
      this.prisma.storageZone.findMany({ orderBy: { createdAt: 'desc' } }),
    ]);

    return {
      categories,
      classifications,
      colors,
      sizes,
      materials,
      productConditions,
      warehouseTypes,
      storageZones,
    };
  }

  async getAllCategories() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  async createCategory(name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new BadRequestException('Tên không được để trống');
    }

    const existing = await this.prisma.category.findFirst({
      where: { name: { equals: trimmed } },
    });

    if (existing) {
      throw new ConflictException('Danh mục này đã tồn tại');
    }

    // Generate code from name (uppercase, no accents, no spaces)
    const code = trimmed
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_')
      .replace(/[^A-Z0-9_]/g, '');

    return this.prisma.category.create({
      data: { name: trimmed, code: code || trimmed.toUpperCase().replace(/\s+/g, '_') },
    });
  }

  async getAll(type: AttributeType) {
    switch (type) {
      case 'classification':
        return this.prisma.classification.findMany({ orderBy: { createdAt: 'desc' } });
      case 'color':
        return this.prisma.color.findMany({ orderBy: { createdAt: 'desc' } });
      case 'size':
        return this.prisma.size.findMany({ orderBy: { createdAt: 'desc' } });
      case 'material':
        return this.prisma.material.findMany({ orderBy: { createdAt: 'desc' } });
      case 'productCondition':
        return this.prisma.productCondition.findMany({ orderBy: { createdAt: 'desc' } });
      case 'storageZone':
        return this.prisma.storageZone.findMany({ orderBy: { createdAt: 'desc' } });
      case 'warehouseType':
        return this.prisma.warehouseType.findMany({ orderBy: { createdAt: 'desc' } });
      case 'category':
        return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
    }
  }

  async create(type: AttributeType, name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new BadRequestException('Tên không được để trống');
    }

    // Check duplicate case-insensitive
    let existing: { id: string; name: string } | null = null;
    switch (type) {
      case 'classification':
        existing = await this.prisma.classification.findFirst({
          where: { name: { equals: trimmed } },
        });
        break;
      case 'color':
        existing = await this.prisma.color.findFirst({
          where: { name: { equals: trimmed } },
        });
        break;
      case 'size':
        existing = await this.prisma.size.findFirst({
          where: { name: { equals: trimmed } },
        });
        break;
      case 'material':
        existing = await this.prisma.material.findFirst({
          where: { name: { equals: trimmed } },
        });
        break;
    }

    if (existing) {
      throw new ConflictException(DUPLICATE_MESSAGES[type]);
    }

    switch (type) {
      case 'classification':
        return this.prisma.classification.create({ data: { name: trimmed } });
      case 'color':
        return this.prisma.color.create({ data: { name: trimmed } });
      case 'size':
        return this.prisma.size.create({ data: { name: trimmed } });
      case 'material':
        return this.prisma.material.create({ data: { name: trimmed } });
    }
  }

  async deleteAttribute(type: AttributeType, id: string) {
    // Check if the record exists
    let record: { id: string } | null = null;
    switch (type) {
      case 'classification':
        record = await this.prisma.classification.findUnique({ where: { id } });
        if (record) {
          await this.prisma.classification.delete({ where: { id } });
        }
        break;
      case 'color':
        record = await this.prisma.color.findUnique({ where: { id } });
        if (record) {
          await this.prisma.color.delete({ where: { id } });
        }
        break;
      case 'size':
        record = await this.prisma.size.findUnique({ where: { id } });
        if (record) {
          await this.prisma.size.delete({ where: { id } });
        }
        break;
      case 'material':
        record = await this.prisma.material.findUnique({ where: { id } });
        if (record) {
          await this.prisma.material.delete({ where: { id } });
        }
        break;
      case 'productCondition':
        record = await this.prisma.productCondition.findUnique({ where: { id } });
        if (record) {
          await this.prisma.productCondition.delete({ where: { id } });
        }
        break;
      case 'storageZone':
        record = await this.prisma.storageZone.findUnique({ where: { id } });
        if (record) {
          await this.prisma.storageZone.delete({ where: { id } });
        }
        break;
      case 'warehouseType':
        record = await this.prisma.warehouseType.findUnique({ where: { id } });
        if (record) {
          await this.prisma.warehouseType.delete({ where: { id } });
        }
        break;
      case 'category':
        record = await this.prisma.category.findUnique({ where: { id } });
        if (record) {
          await this.prisma.category.delete({ where: { id } });
        }
        break;
    }

    if (!record) {
      throw new NotFoundException(`${TABLE_MESSAGES[type]} không tồn tại`);
    }

    return { success: true, message: `${TABLE_MESSAGES[type]} đã được xóa` };
  }

  async getAllProductConditions() {
    return this.prisma.productCondition.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async createProductCondition(name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new BadRequestException('Tên không được để trống');
    }

    const existing = await this.prisma.productCondition.findFirst({
      where: { name: { equals: trimmed } },
    });

    if (existing) {
      throw new ConflictException('Tình trạng hàng hoá này đã tồn tại');
    }

    return this.prisma.productCondition.create({ data: { name: trimmed } });
  }

  async getAllStorageZones() {
    return this.prisma.storageZone.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAllWarehouseTypes() {
    return this.prisma.warehouseType.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async createWarehouseType(name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new BadRequestException('Tên không được để trống');
    }

    const existing = await this.prisma.warehouseType.findFirst({
      where: { name: { equals: trimmed } },
    });

    if (existing) {
      throw new ConflictException('Loại kho này đã tồn tại');
    }

    return this.prisma.warehouseType.create({ data: { name: trimmed } });
  }

  async createStorageZone(name: string, maxCapacity: number) {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new BadRequestException('Tên không được để trống');
    }

    if (maxCapacity <= 0) {
      throw new BadRequestException('Sức chứa tối đa phải lớn hơn 0');
    }

    const existing = await this.prisma.storageZone.findFirst({
      where: { name: { equals: trimmed } },
    });

    if (existing) {
      throw new ConflictException('Khu vực hàng hoá này đã tồn tại');
    }

    return this.prisma.storageZone.create({
      data: { name: trimmed, maxCapacity },
    });
  }

  async generateImportTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Input Declarations');

    worksheet.columns = [
      { header: IMPORT_COLUMN_LABELS.category, key: 'category', width: 24 },
      { header: IMPORT_COLUMN_LABELS.classification, key: 'classification', width: 24 },
      { header: IMPORT_COLUMN_LABELS.color, key: 'color', width: 20 },
      { header: IMPORT_COLUMN_LABELS.size, key: 'size', width: 18 },
      { header: IMPORT_COLUMN_LABELS.material, key: 'material', width: 22 },
      { header: IMPORT_COLUMN_LABELS.productCondition, key: 'productCondition', width: 24 },
      { header: IMPORT_COLUMN_LABELS.storageZone, key: 'storageZone', width: 24 },
      { header: IMPORT_COLUMN_LABELS.storageZoneCapacity, key: 'storageZoneCapacity', width: 18 },
      { header: IMPORT_COLUMN_LABELS.warehouseType, key: 'warehouseType', width: 20 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: 'center' };

    worksheet.addRow({
      category: 'Dien tu',
      classification: 'Laptop',
      color: 'Den',
      size: '15 inch',
      material: 'Hop kim',
      productCondition: 'Moi',
      storageZone: 'Zone A1',
      storageZoneCapacity: 100,
      warehouseType: 'Kho chinh',
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async importDeclarationsFromExcel(fileBuffer: Buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer as unknown as ExcelJS.Buffer);

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new BadRequestException('File Excel khong hop le');
    }

    const headerMap = this.extractHeaderMap(worksheet);
    const missingColumns = IMPORT_COLUMNS.filter((header) => !headerMap.has(this.normalizeHeader(header)));

    if (missingColumns.length > 0) {
      throw new BadRequestException(
        `File Excel khong hop le. Thieu cot: ${missingColumns.join(', ')}`,
      );
    }

    const rows = this.parseImportRows(worksheet, headerMap);
    if (rows.length === 0) {
      throw new BadRequestException('File Excel khong co du lieu hop le');
    }

    const [categories, classifications, colors, sizes, materials, productConditions, storageZones, warehouseTypes] = await Promise.all([
      this.prisma.category.findMany({ select: { name: true, code: true } }),
      this.prisma.classification.findMany({ select: { name: true } }),
      this.prisma.color.findMany({ select: { name: true } }),
      this.prisma.size.findMany({ select: { name: true } }),
      this.prisma.material.findMany({ select: { name: true } }),
      this.prisma.productCondition.findMany({ select: { name: true } }),
      this.prisma.storageZone.findMany({ select: { name: true, maxCapacity: true } }),
      this.prisma.warehouseType.findMany({ select: { name: true } }),
    ]);

    const categoryNames = new Set(categories.map((item) => this.normalizeValue(item.name)));
    const categoryCodes = new Set(categories.map((item) => item.code));
    const classificationNames = new Set(classifications.map((item) => this.normalizeValue(item.name)));
    const colorNames = new Set(colors.map((item) => this.normalizeValue(item.name)));
    const sizeNames = new Set(sizes.map((item) => this.normalizeValue(item.name)));
    const materialNames = new Set(materials.map((item) => this.normalizeValue(item.name)));
    const productConditionNames = new Set(productConditions.map((item) => this.normalizeValue(item.name)));
    const warehouseTypeNames = new Set(warehouseTypes.map((item) => this.normalizeValue(item.name)));
    const storageZoneMap = new Map(
      storageZones.map((item) => [this.normalizeValue(item.name), item.maxCapacity]),
    );

    const fileStorageZoneMap = new Map<string, number>();
    const errors: ImportError[] = [];
    const newCategories = new Map<string, { name: string; code: string }>();
    const newClassifications = new Map<string, string>();
    const newColors = new Map<string, string>();
    const newSizes = new Map<string, string>();
    const newMaterials = new Map<string, string>();
    const newProductConditions = new Map<string, string>();
    const newStorageZones = new Map<string, { name: string; maxCapacity: number }>();
    const newWarehouseTypes = new Map<string, string>();

    for (const row of rows) {
      if (row.storageZone && (row.storageZoneCapacity === null || row.storageZoneCapacity <= 0)) {
        errors.push({
          row: row.rowNumber,
          field: IMPORT_COLUMN_LABELS.storageZoneCapacity,
          message: 'Suc chua khu vuc bat buoc va phai lon hon 0 khi co khu vuc hang hoa',
        });
      }

      if (!row.storageZone && row.storageZoneCapacity !== null) {
        errors.push({
          row: row.rowNumber,
          field: IMPORT_COLUMN_LABELS.storageZone,
          message: 'Khong duoc nhap suc chua khi thieu khu vuc hang hoa',
        });
      }

      if (row.category) {
        const normalized = this.normalizeValue(row.category);
        if (!categoryNames.has(normalized) && !newCategories.has(normalized)) {
          const code = this.generateCategoryCode(row.category, categoryCodes);
          newCategories.set(normalized, { name: row.category, code });
        }
      }

      if (row.classification) {
        const normalized = this.normalizeValue(row.classification);
        if (!classificationNames.has(normalized)) {
          newClassifications.set(normalized, row.classification);
        }
      }

      if (row.color) {
        const normalized = this.normalizeValue(row.color);
        if (!colorNames.has(normalized)) {
          newColors.set(normalized, row.color);
        }
      }

      if (row.size) {
        const normalized = this.normalizeValue(row.size);
        if (!sizeNames.has(normalized)) {
          newSizes.set(normalized, row.size);
        }
      }

      if (row.material) {
        const normalized = this.normalizeValue(row.material);
        if (!materialNames.has(normalized)) {
          newMaterials.set(normalized, row.material);
        }
      }

      if (row.productCondition) {
        const normalized = this.normalizeValue(row.productCondition);
        if (!productConditionNames.has(normalized)) {
          newProductConditions.set(normalized, row.productCondition);
        }
      }

      if (row.storageZone) {
        const normalized = this.normalizeValue(row.storageZone);
        const capacity = row.storageZoneCapacity ?? 0;
        const existingCapacity = storageZoneMap.get(normalized);
        const fileCapacity = fileStorageZoneMap.get(normalized);

        if (
          existingCapacity !== undefined &&
          row.storageZoneCapacity !== null &&
          existingCapacity !== capacity
        ) {
          errors.push({
            row: row.rowNumber,
            field: IMPORT_COLUMN_LABELS.storageZoneCapacity,
            message: `Khu vuc "${row.storageZone}" da ton tai voi suc chua ${existingCapacity}`,
          });
        } else if (fileCapacity !== undefined && row.storageZoneCapacity !== null && fileCapacity !== capacity) {
          errors.push({
            row: row.rowNumber,
            field: IMPORT_COLUMN_LABELS.storageZoneCapacity,
            message: `Khu vuc "${row.storageZone}" bi trung voi suc chua khac nhau trong file`,
          });
        } else if (existingCapacity === undefined && row.storageZoneCapacity !== null) {
          fileStorageZoneMap.set(normalized, capacity);
          newStorageZones.set(normalized, {
            name: row.storageZone,
            maxCapacity: capacity,
          });
        }
      }

      if (row.warehouseType) {
        const normalized = this.normalizeValue(row.warehouseType);
        if (!warehouseTypeNames.has(normalized)) {
          newWarehouseTypes.set(normalized, row.warehouseType);
        }
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        totalRows: rows.length,
        importedRows: 0,
        createdCounts: {
          categories: 0,
          classifications: 0,
          colors: 0,
          sizes: 0,
          materials: 0,
          productConditions: 0,
          storageZones: 0,
          warehouseTypes: 0,
        },
        errors,
      };
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of newCategories.values()) {
        await tx.category.create({ data: item });
      }

      for (const name of newClassifications.values()) {
        await tx.classification.create({ data: { name } });
      }

      for (const name of newColors.values()) {
        await tx.color.create({ data: { name } });
      }

      for (const name of newSizes.values()) {
        await tx.size.create({ data: { name } });
      }

      for (const name of newMaterials.values()) {
        await tx.material.create({ data: { name } });
      }

      for (const name of newProductConditions.values()) {
        await tx.productCondition.create({ data: { name } });
      }

      for (const item of newStorageZones.values()) {
        await tx.storageZone.create({ data: item });
      }

      for (const name of newWarehouseTypes.values()) {
        await tx.warehouseType.create({ data: { name } });
      }
    });

    return {
      success: true,
      totalRows: rows.length,
      importedRows: rows.length,
      createdCounts: {
        categories: newCategories.size,
        classifications: newClassifications.size,
        colors: newColors.size,
        sizes: newSizes.size,
        materials: newMaterials.size,
        productConditions: newProductConditions.size,
        storageZones: newStorageZones.size,
        warehouseTypes: newWarehouseTypes.size,
      },
    };
  }

  private extractHeaderMap(worksheet: ExcelJS.Worksheet) {
    const headerRow = worksheet.getRow(1);
    const headerMap = new Map<string, number>();

    headerRow.eachCell((cell, colNumber) => {
      const header = this.normalizeHeader(this.stringifyCellValue(cell.value));
      if (header) {
        headerMap.set(header, colNumber);
      }
    });

    return headerMap;
  }

  private parseImportRows(
    worksheet: ExcelJS.Worksheet,
    headerMap: Map<string, number>,
  ): ImportRow[] {
    const getColumnIndex = (label: string) => {
      const columnIndex = headerMap.get(this.normalizeHeader(label));
      if (!columnIndex) {
        throw new BadRequestException(`File Excel khong hop le. Thieu cot: ${label}`);
      }

      return columnIndex;
    };

    const rows: ImportRow[] = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        return;
      }

      const parsedRow: ImportRow = {
        rowNumber,
        category: this.cleanString(row.getCell(getColumnIndex(IMPORT_COLUMN_LABELS.category)).value),
        classification: this.cleanString(row.getCell(getColumnIndex(IMPORT_COLUMN_LABELS.classification)).value),
        color: this.cleanString(row.getCell(getColumnIndex(IMPORT_COLUMN_LABELS.color)).value),
        size: this.cleanString(row.getCell(getColumnIndex(IMPORT_COLUMN_LABELS.size)).value),
        material: this.cleanString(row.getCell(getColumnIndex(IMPORT_COLUMN_LABELS.material)).value),
        productCondition: this.cleanString(row.getCell(getColumnIndex(IMPORT_COLUMN_LABELS.productCondition)).value),
        storageZone: this.cleanString(row.getCell(getColumnIndex(IMPORT_COLUMN_LABELS.storageZone)).value),
        storageZoneCapacity: this.parseOptionalNumber(
          row.getCell(getColumnIndex(IMPORT_COLUMN_LABELS.storageZoneCapacity)).value,
        ),
        warehouseType: this.cleanString(row.getCell(getColumnIndex(IMPORT_COLUMN_LABELS.warehouseType)).value),
      };

      const hasAnyValue = Object.entries(parsedRow)
        .filter(([key]) => key !== 'rowNumber')
        .some(([, value]) => value !== '' && value !== null);

      if (hasAnyValue) {
        rows.push(parsedRow);
      }
    });

    return rows;
  }

  private cleanString(value: ExcelJS.CellValue | undefined): string {
    return this.stringifyCellValue(value).trim();
  }

  private parseOptionalNumber(value: ExcelJS.CellValue | undefined): number | null {
    const raw = this.stringifyCellValue(value).trim();
    if (!raw) {
      return null;
    }

    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }

  private stringifyCellValue(value: ExcelJS.CellValue | undefined): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'object') {
      if ('text' in value && typeof value.text === 'string') {
        return value.text;
      }

      if ('result' in value && value.result !== undefined && value.result !== null) {
        return String(value.result);
      }

      if ('richText' in value && Array.isArray(value.richText)) {
        return value.richText.map((item) => item.text).join('');
      }
    }

    return String(value);
  }

  private normalizeValue(value: string): string {
    return value.trim().toLowerCase();
  }

  private normalizeHeader(value: string): string {
    return this.normalizeValue(value).replace(/\s+/g, ' ');
  }

  private generateCategoryCode(name: string, usedCodes: Set<string>): string {
    const baseCode = name
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_')
      .replace(/[^A-Z0-9_]/g, '') || 'CATEGORY';

    let candidate = baseCode;
    let suffix = 1;

    while (usedCodes.has(candidate)) {
      suffix += 1;
      candidate = `${baseCode}_${suffix}`;
    }

    usedCodes.add(candidate);
    return candidate;
  }
}
