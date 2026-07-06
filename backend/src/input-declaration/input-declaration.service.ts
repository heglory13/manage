import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client/index';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service.js';

export type AttributeType =
  | 'classification'
  | 'color'
  | 'size'
  | 'material'
  | 'productCondition'
  | 'storageZone'
  | 'warehouseType'
  | 'category';

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

  private ensureTrimmedName(name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new BadRequestException('Tên không được để trống');
    }

    return trimmed;
  }

  async getAllDeclarations() {
    const [
      categories,
      classifications,
      colors,
      sizes,
      materials,
      productConditions,
      warehouseTypes,
      storageZones,
    ] = await Promise.all([
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
      data: {
        name: trimmed,
        code: code || trimmed.toUpperCase().replace(/\s+/g, '_'),
      },
    });
  }

  async updateCategory(id: string, name: string) {
    const trimmed = this.ensureTrimmedName(name);
    const current = await this.prisma.category.findUnique({ where: { id } });

    if (!current) {
      throw new NotFoundException('Danh mục không tồn tại');
    }

    const existing = await this.prisma.category.findFirst({
      where: {
        name: { equals: trimmed },
        NOT: { id },
      },
    });

    if (existing) {
      throw new ConflictException('Danh mục này đã tồn tại');
    }

    const otherCategories = await this.prisma.category.findMany({
      where: { NOT: { id } },
      select: { code: true },
    });
    const code = this.generateCategoryCode(
      trimmed,
      new Set(otherCategories.map((item) => item.code)),
    );

    return this.prisma.category.update({
      where: { id },
      data: {
        name: trimmed,
        code,
      },
    });
  }

  async getAll(type: AttributeType) {
    switch (type) {
      case 'classification':
        return this.prisma.classification.findMany({
          orderBy: { createdAt: 'desc' },
        });
      case 'color':
        return this.prisma.color.findMany({ orderBy: { createdAt: 'desc' } });
      case 'size':
        return this.prisma.size.findMany({ orderBy: { createdAt: 'desc' } });
      case 'material':
        return this.prisma.material.findMany({
          orderBy: { createdAt: 'desc' },
        });
      case 'productCondition':
        return this.prisma.productCondition.findMany({
          orderBy: { createdAt: 'desc' },
        });
      case 'storageZone':
        return this.prisma.storageZone.findMany({
          orderBy: { createdAt: 'desc' },
        });
      case 'warehouseType':
        return this.prisma.warehouseType.findMany({
          orderBy: { createdAt: 'desc' },
        });
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

  async updateAttribute(
    type: Extract<
      AttributeType,
      'classification' | 'color' | 'size' | 'material'
    >,
    id: string,
    name: string,
  ) {
    const trimmed = this.ensureTrimmedName(name);

    switch (type) {
      case 'classification': {
        const record = await this.prisma.classification.findUnique({
          where: { id },
        });
        if (!record) {
          throw new NotFoundException('Phân loại không tồn tại');
        }

        const existing = await this.prisma.classification.findFirst({
          where: { name: { equals: trimmed }, NOT: { id } },
        });
        if (existing) {
          throw new ConflictException(DUPLICATE_MESSAGES[type]);
        }

        return this.prisma.classification.update({
          where: { id },
          data: { name: trimmed },
        });
      }
      case 'color': {
        const record = await this.prisma.color.findUnique({ where: { id } });
        if (!record) {
          throw new NotFoundException('Màu sắc không tồn tại');
        }

        const existing = await this.prisma.color.findFirst({
          where: { name: { equals: trimmed }, NOT: { id } },
        });
        if (existing) {
          throw new ConflictException(DUPLICATE_MESSAGES[type]);
        }

        return this.prisma.color.update({
          where: { id },
          data: { name: trimmed },
        });
      }
      case 'size': {
        const record = await this.prisma.size.findUnique({ where: { id } });
        if (!record) {
          throw new NotFoundException('Size không tồn tại');
        }

        const existing = await this.prisma.size.findFirst({
          where: { name: { equals: trimmed }, NOT: { id } },
        });
        if (existing) {
          throw new ConflictException(DUPLICATE_MESSAGES[type]);
        }

        return this.prisma.size.update({
          where: { id },
          data: { name: trimmed },
        });
      }
      case 'material': {
        const record = await this.prisma.material.findUnique({ where: { id } });
        if (!record) {
          throw new NotFoundException('Chất liệu không tồn tại');
        }

        const existing = await this.prisma.material.findFirst({
          where: { name: { equals: trimmed }, NOT: { id } },
        });
        if (existing) {
          throw new ConflictException(DUPLICATE_MESSAGES[type]);
        }

        return this.prisma.material.update({
          where: { id },
          data: { name: trimmed },
        });
      }
    }
  }

  private readonly activeTableFilters: Record<string, Record<string, unknown>> = {
    sku_combos: { isDiscontinued: false },
    inventory_transactions: { status: 'ACTIVE' },
    products: { isDiscontinued: false },
    preliminary_checks: { status: 'PENDING' },
  };

  private readonly tableDisplayAccessors: Record<string, {
    prismaModel: string;
    displayName: string;
    selectFields: Record<string, boolean>;
    transform: (r: Record<string, unknown>, ctx: { prisma: PrismaService; type: AttributeType; id: string }) => Promise<{ name: string; detail: string }>;
  }> = {
    sku_combos: {
      prismaModel: 'skuCombo',
      displayName: 'SKU combo',
      selectFields: {
        id: true,
        compositeSku: true,
        classificationId: true,
        colorId: true,
        sizeId: true,
        materialId: true,
        isDiscontinued: true,
      },
      transform: async (r: any, ctx) => {
        const parts: string[] = [];
        const load = async (model: string, id: string) => {
          if (!id) return '';
          const item = await (ctx.prisma as any)[model].findUnique({ where: { id }, select: { name: true } });
          return item?.name ?? '';
        };
        const c = await load('classification', r.classificationId);
        const co = await load('color', r.colorId);
        const s = await load('size', r.sizeId);
        const m = await load('material', r.materialId);
        if (c) parts.push(`PL:${c}`);
        if (co) parts.push(`MS:${co}`);
        if (s) parts.push(`SZ:${s}`);
        if (m) parts.push(`CL:${m}`);
        return {
          name: r.compositeSku,
          detail: parts.join(' - '),
        };
      },
    },
    inventory_transactions: {
      prismaModel: 'inventoryTransaction',
      displayName: 'Giao dịch nhập/xuất',
      selectFields: {
        id: true,
        notes: true,
        type: true,
        quantity: true,
        purchasePrice: true,
        status: true,
        storageZoneId: true,
        warehouseTypeId: true,
      },
      transform: async (r: any, ctx) => {
        const receiptCode = r.notes
          ? r.notes.match(/\[RECEIPT_GROUP:[^\]]+\]/)?.[0] ?? ''
          : '';
        const codeStr = receiptCode ? receiptCode.replace('[RECEIPT_GROUP:', 'PNK/').replace(']', '') : r.id.slice(0, 8);
        let zone = '';
        if (r.storageZoneId) {
          const z = await ctx.prisma.storageZone.findUnique({ where: { id: r.storageZoneId }, select: { name: true } });
          zone = z?.name ?? '';
        }
        return {
          name: codeStr,
          detail: `${r.type === 'STOCK_IN' ? 'Nhập' : 'Xuất'} ${r.quantity} cái${zone ? ` - ${zone}` : ''}`,
        };
      },
    },
    products: {
      prismaModel: 'product',
      displayName: 'Sản phẩm',
      selectFields: { id: true, name: true, sku: true, isDiscontinued: true },
      transform: async (r: any) => ({
        name: `${r.name} (${r.sku})`,
        detail: '',
      }),
    },
    preliminary_checks: {
      prismaModel: 'preliminaryCheck',
      displayName: 'Phiếu kiểm sơ bộ',
      selectFields: { id: true, quantity: true, status: true, note: true },
      transform: async (r: any) => ({
        name: `Kiểm sơ bộ #${r.id.slice(0, 8)}`,
        detail: `${r.quantity} cái - ${r.status}`,
      }),
    },
    stocktaking_items: {
      prismaModel: 'stocktakingItem',
      displayName: 'Phiếu kiểm kê',
      selectFields: { id: true, itemCode: true, itemLabel: true, systemQuantity: true, actualQuantity: true },
      transform: async (r: any) => ({
        name: r.itemCode || r.id.slice(0, 8),
        detail: `${r.itemLabel} (SL hệ thống: ${r.systemQuantity}, SL thực: ${r.actualQuantity})`,
      }),
    },
    order_plans: {
      prismaModel: 'orderPlan',
      displayName: 'Kế hoạch đặt hàng',
      selectFields: { id: true, quantity: true, customerName: true, note: true },
      transform: async (r: any) => ({
        name: `ĐH ${r.customerName || '#' + r.id.slice(0, 8)}`,
        detail: `${r.quantity} cái${r.note ? ` - ${r.note}` : ''}`,
      }),
    },
    storage_zones: {
      prismaModel: 'storageZone',
      displayName: 'Khu vực hàng hoá',
      selectFields: { id: true, name: true, maxCapacity: true, currentStock: true },
      transform: async (r: any) => ({
        name: r.name,
        detail: `Sức chứa: ${r.currentStock}/${r.maxCapacity}`,
      }),
    },
  };

  private readonly modelAccessor: Record<string, string> = {
    sku_combos: 'skuCombo',
    products: 'product',
    inventory_transactions: 'inventoryTransaction',
    preliminary_checks: 'preliminaryCheck',
    stocktaking_items: 'stocktakingItem',
    order_plans: 'orderPlan',
    storage_zones: 'storageZone',
  };

  private readonly prismaModelMap: Record<AttributeType, string> = {
    classification: 'classification',
    color: 'color',
    size: 'size',
    material: 'material',
    productCondition: 'productCondition',
    storageZone: 'storageZone',
    warehouseType: 'warehouseType',
    category: 'category',
  };

  private attributeReferenceChecks: Record<AttributeType, Array<{ table: string; field: string; label: string }>> = {
    classification: [
      { table: 'sku_combos', field: 'classificationId', label: 'SKU combo' },
      { table: 'preliminary_checks', field: 'classificationId', label: 'Phiếu kiểm sơ bộ' },
    ],
    color: [
      { table: 'sku_combos', field: 'colorId', label: 'SKU combo' },
    ],
    size: [
      { table: 'sku_combos', field: 'sizeId', label: 'SKU combo' },
    ],
    material: [
      { table: 'sku_combos', field: 'materialId', label: 'SKU combo' },
    ],
    category: [
      { table: 'products', field: 'categoryId', label: 'Sản phẩm' },
      { table: 'inventory_transactions', field: 'categoryId', label: 'Giao dịch nhập/xuất' },
      { table: 'preliminary_checks', field: 'categoryId', label: 'Phiếu kiểm sơ bộ' },
      { table: 'stocktaking_items', field: 'categoryId', label: 'Phiếu kiểm kê' },
      { table: 'order_plans', field: 'categoryId', label: 'Kế hoạch đặt hàng' },
    ],
    productCondition: [
      { table: 'inventory_transactions', field: 'productConditionId', label: 'Giao dịch nhập/xuất' },
    ],
    storageZone: [
      { table: 'inventory_transactions', field: 'storageZoneId', label: 'Giao dịch nhập/xuất' },
    ],
    warehouseType: [
      { table: 'preliminary_checks', field: 'warehouseTypeId', label: 'Phiếu kiểm sơ bộ' },
      { table: 'order_plans', field: 'warehouseTypeId', label: 'Kế hoạch đặt hàng' },
      { table: 'storage_zones', field: 'warehouseTypeId', label: 'Khu vực hàng hoá' },
      { table: 'inventory_transactions', field: 'warehouseTypeId', label: 'Giao dịch nhập/xuất' },
    ],
  };

  async getDetailedAttributeUsages(type: AttributeType, id: string) {
    const checks = this.attributeReferenceChecks[type] || [];
    const usages: Array<{
      table: string;
      label: string;
      count: number;
      records: Array<{ id: string; name: string; detail: string }>;
    }> = [];

    for (const check of checks) {
      const accessor = this.modelAccessor[check.table];
      if (!accessor) continue;

      const displayConfig = this.tableDisplayAccessors[check.table];
      if (!displayConfig) continue;

      const activeFilter = this.activeTableFilters[check.table] || {};
      const where: Record<string, unknown> = { [check.field]: id, ...activeFilter };

      const activeCount = await (this.prisma as any)[accessor].count({ where });

      if (activeCount === 0) continue;

      const rawRecords = await (this.prisma as any)[accessor].findMany({
        where,
        select: displayConfig.selectFields,
        take: 50,
        orderBy: { createdAt: 'desc' as const },
      });

      const ctx = { prisma: this.prisma as any, type, id };
      const records = await Promise.all(
        rawRecords.map(async (r: Record<string, unknown>) => {
          const { name, detail } = await displayConfig.transform(r as any, ctx);
          return { id: r.id as string, name, detail };
        }),
      );

      usages.push({
        table: check.table,
        label: check.label,
        count: activeCount,
        records,
      });
    }

    return {
      attributeType: type,
      attributeId: id,
      usages,
      totalActiveUsages: usages.reduce((s, u) => s + u.count, 0),
    };
  }

  async deleteAttribute(type: AttributeType, id: string, force: boolean = false) {
    const label = TABLE_MESSAGES[type];

    if (force) {
      return this.forceDeleteAttribute(type, id);
    }

    const refs = await this.getActiveAttributeRefs(type, id);

    if (refs.length > 0) {
      const usages = await this.getDetailedAttributeUsages(type, id);
      throw new BadRequestException({
        message: `${label} đang được sử dụng ở dữ liệu khác, không thể xoá. Dùng force delete để xoá tất cả dữ liệu liên quan.`,
        blocked: true,
        usages: usages.usages,
      });
    }

    try {
      const modelName = this.prismaModelMap[type];
      if (modelName) {
        await (this.prisma as any)[modelName].delete({ where: { id } });
      }
    } catch (error) {
      const prismaError = error as Record<string, unknown>;
      if (prismaError?.code === 'P2025') {
        throw new NotFoundException(`${label} không tồn tại`);
      }
      if (prismaError?.code === 'P2003' || prismaError?.code === 'P2014') {
        throw new BadRequestException(
          `${label} đang được sử dụng ở dữ liệu khác, không thể xoá.`,
        );
      }
      throw error;
    }

    return { success: true, message: `${label} đã được xóa` };
  }

  private async forceDeleteAttribute(type: AttributeType, id: string) {
    const label = TABLE_MESSAGES[type];

    await this.prisma.$transaction(async (tx) => {
      if (['classification', 'color', 'size', 'material'].includes(type)) {
        await (tx.skuCombo as any).deleteMany({
          where: { [`${type}Id`]: id },
        });
      }

      if (type === 'category') {
        const products = await (tx.product as any).findMany({
          where: { categoryId: id },
          select: { id: true },
        });
        if (products.length > 0) {
          await (tx.product as any).deleteMany({
            where: { id: { in: products.map((p: any) => p.id) } },
          });
        }
        const orderPlans = await (tx.orderPlan as any).findMany({
          where: { categoryId: id },
          select: { id: true },
        });
        if (orderPlans.length > 0) {
          await (tx.orderPlan as any).deleteMany({
            where: { id: { in: orderPlans.map((p: any) => p.id) } },
          });
        }
      }

      if (type === 'warehouseType') {
        const orderPlans = await (tx.orderPlan as any).findMany({
          where: { warehouseTypeId: id },
          select: { id: true },
        });
        if (orderPlans.length > 0) {
          await (tx.orderPlan as any).deleteMany({
            where: { id: { in: orderPlans.map((p: any) => p.id) } },
          });
        }
      }

      const modelName = this.prismaModelMap[type];
      if (modelName) {
        await (tx as any)[modelName].delete({ where: { id } });
      }
    });

    return {
      success: true,
      message: `${label} đã được xoá cùng với tất cả dữ liệu liên quan.`,
    };
  }

  private async getActiveAttributeRefs(type: AttributeType, id: string) {
    const checks = this.attributeReferenceChecks[type] || [];
    const results: Array<{
      table: string;
      label: string;
      count: number;
      sampleNames: string;
    }> = [];

    for (const check of checks) {
      const accessor = this.modelAccessor[check.table];
      if (!accessor) continue;

      const activeFilter = this.activeTableFilters[check.table] || {};
      const where: Record<string, unknown> = { [check.field]: id, ...activeFilter };

      const count = await (this.prisma as any)[accessor].count({ where });

      if (count > 0) {
        const displayConfig = this.tableDisplayAccessors[check.table];
        let sampleNames = '';
        if (displayConfig) {
          const samples = await (this.prisma as any)[accessor].findMany({
            where,
            select: displayConfig.selectFields,
            take: 3,
          });
          const ctx = { prisma: this.prisma as any, type, id };
          const names = await Promise.all(
            samples.map(async (s: Record<string, unknown>) => {
              const { name } = await displayConfig.transform(s as any, ctx);
              return name;
            }),
          );
          sampleNames = names.join(', ');
        } else {
          sampleNames = `${count} bản ghi`;
        }
        results.push({ table: check.table, label: check.label, count, sampleNames });
      }
    }

    return results;
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

  async updateProductCondition(id: string, name: string) {
    const trimmed = this.ensureTrimmedName(name);
    const record = await this.prisma.productCondition.findUnique({
      where: { id },
    });

    if (!record) {
      throw new NotFoundException('Tình trạng hàng hoá không tồn tại');
    }

    const existing = await this.prisma.productCondition.findFirst({
      where: {
        name: { equals: trimmed },
        NOT: { id },
      },
    });

    if (existing) {
      throw new ConflictException('Tình trạng hàng hoá này đã tồn tại');
    }

    return this.prisma.productCondition.update({
      where: { id },
      data: { name: trimmed },
    });
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

  async updateWarehouseType(id: string, name: string) {
    const trimmed = this.ensureTrimmedName(name);
    const record = await this.prisma.warehouseType.findUnique({
      where: { id },
    });

    if (!record) {
      throw new NotFoundException('Loại kho không tồn tại');
    }

    const existing = await this.prisma.warehouseType.findFirst({
      where: {
        name: { equals: trimmed },
        NOT: { id },
      },
    });

    if (existing) {
      throw new ConflictException('Loại kho này đã tồn tại');
    }

    return this.prisma.warehouseType.update({
      where: { id },
      data: { name: trimmed },
    });
  }

  async createStorageZone(
    name: string,
    maxCapacity: number,
    warehouseTypeId?: string,
  ) {
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
      data: {
        name: trimmed,
        maxCapacity,
        warehouseTypeId: warehouseTypeId || null,
      },
    });
  }

  async updateStorageZone(
    id: string,
    name: string,
    maxCapacity: number,
    warehouseTypeId?: string,
  ) {
    const trimmed = this.ensureTrimmedName(name);

    if (maxCapacity <= 0) {
      throw new BadRequestException('Sức chứa tối đa phải lớn hơn 0');
    }

    const record = await this.prisma.storageZone.findUnique({ where: { id } });
    if (!record) {
      throw new NotFoundException('Khu vực hàng hoá không tồn tại');
    }

    if (record.currentStock > maxCapacity) {
      throw new BadRequestException(
        'Sức chứa mới không được nhỏ hơn tồn hiện tại của khu vực',
      );
    }

    const existing = await this.prisma.storageZone.findFirst({
      where: {
        name: { equals: trimmed },
        NOT: { id },
      },
    });

    if (existing) {
      throw new ConflictException('Khu vực hàng hoá này đã tồn tại');
    }

    // Capture the old name so we can rename matching warehouse positions
    // and keep their products/links intact after the storage zone is renamed.
    const oldName = record.name;

    const updated = await this.prisma.storageZone.update({
      where: { id },
      data: {
        name: trimmed,
        maxCapacity,
        ...(warehouseTypeId !== undefined && {
          warehouseTypeId: warehouseTypeId || null,
        }),
      },
    });

    // If the name changed, rename the matching warehouse positions so
    // their `label` (which the warehouse map joins on to display stock
    // and products) stays in sync with the new storage zone name.
    // Without this, the products in the position appear to "disappear"
    // because `syncWarehouseLayoutPosition` looks up the storage zone by
    // `position.label` and fails to find it.
    if (oldName !== trimmed) {
      await this.renameWarehousePositions(oldName, trimmed);
    }

    // Sync the new maxCapacity to any active warehouse position that has
    // the same label. Without this, a position created earlier with a
    // different (often default 1) capacity would block imports even though
    // the user updated the storage zone's capacity in this screen.
    await this.syncPositionMaxCapacityByZoneName(trimmed, maxCapacity);

    return updated;
  }

  private async renameWarehousePositions(
    oldName: string,
    newName: string,
  ): Promise<void> {
    if (!oldName?.trim() || !newName?.trim()) return;
    const oldTarget = oldName.trim().toLowerCase();
    const positions = await this.prisma.warehousePosition.findMany({
      where: { isActive: true },
      select: { id: true, label: true },
    });
    const matched = positions
      .filter((p) => (p.label ?? '').trim().toLowerCase() === oldTarget)
      .map((p) => p.id);
    if (matched.length === 0) return;
    await this.prisma.warehousePosition.updateMany({
      where: { id: { in: matched } },
      data: { label: newName },
    });
  }

  private async syncPositionMaxCapacityByZoneName(
    zoneName: string,
    maxCapacity: number,
  ): Promise<void> {
    if (!zoneName?.trim()) return;
    // Fetch all active positions and filter case-insensitively in JS. Using
    // `findMany` + individual `update` keeps the call type-safe (no raw SQL
    // parameter binding quirks) and matches a small N of positions per zone.
    const positions = await this.prisma.warehousePosition.findMany({
      where: { isActive: true },
      select: { id: true, label: true },
    });
    const target = zoneName.trim().toLowerCase();
    const matched = positions.filter(
      (p) => (p.label ?? '').trim().toLowerCase() === target,
    );
    if (matched.length === 0) return;
    await this.prisma.warehousePosition.updateMany({
      where: { id: { in: matched.map((p) => p.id) } },
      data: { maxCapacity },
    });
  }

  async generateImportTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Input Declarations');

    worksheet.columns = [
      { header: IMPORT_COLUMN_LABELS.category, key: 'category', width: 24 },
      {
        header: IMPORT_COLUMN_LABELS.classification,
        key: 'classification',
        width: 24,
      },
      { header: IMPORT_COLUMN_LABELS.color, key: 'color', width: 20 },
      { header: IMPORT_COLUMN_LABELS.size, key: 'size', width: 18 },
      { header: IMPORT_COLUMN_LABELS.material, key: 'material', width: 22 },
      {
        header: IMPORT_COLUMN_LABELS.productCondition,
        key: 'productCondition',
        width: 24,
      },
      {
        header: IMPORT_COLUMN_LABELS.storageZone,
        key: 'storageZone',
        width: 24,
      },
      {
        header: IMPORT_COLUMN_LABELS.storageZoneCapacity,
        key: 'storageZoneCapacity',
        width: 18,
      },
      {
        header: IMPORT_COLUMN_LABELS.warehouseType,
        key: 'warehouseType',
        width: 20,
      },
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
    const missingColumns = IMPORT_COLUMNS.filter(
      (header) => !headerMap.has(this.normalizeHeader(header)),
    );

    if (missingColumns.length > 0) {
      throw new BadRequestException(
        `File Excel khong hop le. Thieu cot: ${missingColumns.join(', ')}`,
      );
    }

    const rows = this.parseImportRows(worksheet, headerMap);
    if (rows.length === 0) {
      throw new BadRequestException('File Excel khong co du lieu hop le');
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
    ] = await Promise.all([
      this.prisma.category.findMany({ select: { name: true, code: true } }),
      this.prisma.classification.findMany({ select: { name: true } }),
      this.prisma.color.findMany({ select: { name: true } }),
      this.prisma.size.findMany({ select: { name: true } }),
      this.prisma.material.findMany({ select: { name: true } }),
      this.prisma.productCondition.findMany({ select: { name: true } }),
      this.prisma.storageZone.findMany({
        select: { name: true, maxCapacity: true },
      }),
      this.prisma.warehouseType.findMany({ select: { name: true } }),
    ]);

    const categoryNames = new Set(
      categories.map((item) => this.normalizeValue(item.name)),
    );
    const categoryCodes = new Set(categories.map((item) => item.code));
    const classificationNames = new Set(
      classifications.map((item) => this.normalizeValue(item.name)),
    );
    const colorNames = new Set(
      colors.map((item) => this.normalizeValue(item.name)),
    );
    const sizeNames = new Set(
      sizes.map((item) => this.normalizeValue(item.name)),
    );
    const materialNames = new Set(
      materials.map((item) => this.normalizeValue(item.name)),
    );
    const productConditionNames = new Set(
      productConditions.map((item) => this.normalizeValue(item.name)),
    );
    const warehouseTypeNames = new Set(
      warehouseTypes.map((item) => this.normalizeValue(item.name)),
    );
    const storageZoneMap = new Map(
      storageZones.map((item) => [
        this.normalizeValue(item.name),
        item.maxCapacity,
      ]),
    );

    // --- Phase 1: Validate each row individually ---
    const fileStorageZoneMap = new Map<string, number>();
    const errors: ImportError[] = [];
    const errorRowNumbers = new Set<number>();
    const validRows: ImportRow[] = [];
    // Track storage zones to update (existing in DB but Excel has different capacity)
    const updateStorageZones = new Map<
      string,
      { name: string; maxCapacity: number }
    >();

    for (const row of rows) {
      const rowErrors: ImportError[] = [];

      if (
        row.storageZone &&
        (row.storageZoneCapacity === null || row.storageZoneCapacity <= 0)
      ) {
        rowErrors.push({
          row: row.rowNumber,
          field: IMPORT_COLUMN_LABELS.storageZoneCapacity,
          message:
            'Suc chua khu vuc bat buoc va phai lon hon 0 khi co khu vuc hang hoa',
        });
      }

      if (!row.storageZone && row.storageZoneCapacity !== null) {
        rowErrors.push({
          row: row.rowNumber,
          field: IMPORT_COLUMN_LABELS.storageZone,
          message: 'Khong duoc nhap suc chua khi thieu khu vuc hang hoa',
        });
      }

      if (
        row.storageZone &&
        row.storageZoneCapacity !== null &&
        row.storageZoneCapacity > 0
      ) {
        const normalized = this.normalizeValue(row.storageZone);
        const capacity = row.storageZoneCapacity;

        // If same zone appears multiple times in file, last value wins (overwrite)
        fileStorageZoneMap.set(normalized, capacity);
      }

      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
        errorRowNumbers.add(row.rowNumber);
      } else {
        validRows.push(row);
      }
    }

    // --- Phase 2: Collect new attributes from valid rows only ---
    const newCategories = new Map<string, { name: string; code: string }>();
    const newClassifications = new Map<string, string>();
    const newColors = new Map<string, string>();
    const newSizes = new Map<string, string>();
    const newMaterials = new Map<string, string>();
    const newProductConditions = new Map<string, string>();
    const newStorageZones = new Map<
      string,
      { name: string; maxCapacity: number }
    >();
    const newWarehouseTypes = new Map<string, string>();

    // Track skipped (already existing) counts per type
    const skippedCounts = {
      categories: 0,
      classifications: 0,
      colors: 0,
      sizes: 0,
      materials: 0,
      productConditions: 0,
      storageZones: 0,
      warehouseTypes: 0,
    };
    // Track unique skipped names to avoid double-counting
    const skippedCategories = new Set<string>();
    const skippedClassifications = new Set<string>();
    const skippedColors = new Set<string>();
    const skippedSizes = new Set<string>();
    const skippedMaterials = new Set<string>();
    const skippedProductConditions = new Set<string>();
    const skippedWarehouseTypes = new Set<string>();
    const skippedStorageZones = new Set<string>();

    for (const row of validRows) {
      if (row.category) {
        const normalized = this.normalizeValue(row.category);
        if (!categoryNames.has(normalized) && !newCategories.has(normalized)) {
          const code = this.generateCategoryCode(row.category, categoryCodes);
          newCategories.set(normalized, { name: row.category, code });
        } else if (
          categoryNames.has(normalized) &&
          !skippedCategories.has(normalized)
        ) {
          skippedCategories.add(normalized);
          skippedCounts.categories++;
        }
      }

      if (row.classification) {
        const normalized = this.normalizeValue(row.classification);
        if (
          !classificationNames.has(normalized) &&
          !newClassifications.has(normalized)
        ) {
          newClassifications.set(normalized, row.classification);
        } else if (
          classificationNames.has(normalized) &&
          !skippedClassifications.has(normalized)
        ) {
          skippedClassifications.add(normalized);
          skippedCounts.classifications++;
        }
      }

      if (row.color) {
        const normalized = this.normalizeValue(row.color);
        if (!colorNames.has(normalized) && !newColors.has(normalized)) {
          newColors.set(normalized, row.color);
        } else if (
          colorNames.has(normalized) &&
          !skippedColors.has(normalized)
        ) {
          skippedColors.add(normalized);
          skippedCounts.colors++;
        }
      }

      if (row.size) {
        const normalized = this.normalizeValue(row.size);
        if (!sizeNames.has(normalized) && !newSizes.has(normalized)) {
          newSizes.set(normalized, row.size);
        } else if (sizeNames.has(normalized) && !skippedSizes.has(normalized)) {
          skippedSizes.add(normalized);
          skippedCounts.sizes++;
        }
      }

      if (row.material) {
        const normalized = this.normalizeValue(row.material);
        if (!materialNames.has(normalized) && !newMaterials.has(normalized)) {
          newMaterials.set(normalized, row.material);
        } else if (
          materialNames.has(normalized) &&
          !skippedMaterials.has(normalized)
        ) {
          skippedMaterials.add(normalized);
          skippedCounts.materials++;
        }
      }

      if (row.productCondition) {
        const normalized = this.normalizeValue(row.productCondition);
        if (
          !productConditionNames.has(normalized) &&
          !newProductConditions.has(normalized)
        ) {
          newProductConditions.set(normalized, row.productCondition);
        } else if (
          productConditionNames.has(normalized) &&
          !skippedProductConditions.has(normalized)
        ) {
          skippedProductConditions.add(normalized);
          skippedCounts.productConditions++;
        }
      }

      if (row.storageZone) {
        const normalized = this.normalizeValue(row.storageZone);
        const capacity =
          fileStorageZoneMap.get(normalized) ?? row.storageZoneCapacity ?? 0;
        const existingCapacity = storageZoneMap.get(normalized);

        if (existingCapacity !== undefined) {
          // Zone exists in DB — if capacity differs, mark for update
          if (capacity !== existingCapacity) {
            updateStorageZones.set(normalized, {
              name: row.storageZone,
              maxCapacity: capacity,
            });
          }
          // Count as skipped (existing) — but may be updated
          if (!skippedStorageZones.has(normalized)) {
            skippedCounts.storageZones++;
            skippedStorageZones.add(normalized);
          }
        } else if (!newStorageZones.has(normalized)) {
          // Zone is new — create it
          newStorageZones.set(normalized, {
            name: row.storageZone,
            maxCapacity: capacity,
          });
        } else {
          // Already queued for creation — update capacity if file had a later value
          newStorageZones.set(normalized, {
            name: row.storageZone,
            maxCapacity: capacity,
          });
        }
      }

      if (row.warehouseType) {
        const normalized = this.normalizeValue(row.warehouseType);
        if (
          !warehouseTypeNames.has(normalized) &&
          !newWarehouseTypes.has(normalized)
        ) {
          newWarehouseTypes.set(normalized, row.warehouseType);
        } else if (
          warehouseTypeNames.has(normalized) &&
          !skippedWarehouseTypes.has(normalized)
        ) {
          skippedWarehouseTypes.add(normalized);
          skippedCounts.warehouseTypes++;
        }
      }
    }

    // --- Phase 3: Import valid rows (even if some rows had errors) ---
    let updatedStorageZonesCount = 0;

    if (validRows.length > 0) {
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

        // Update existing storage zones with new capacity from Excel
        for (const item of updateStorageZones.values()) {
          await tx.storageZone.update({
            where: { name: item.name },
            data: { maxCapacity: item.maxCapacity },
          });
          updatedStorageZonesCount++;
        }

        for (const name of newWarehouseTypes.values()) {
          await tx.warehouseType.create({ data: { name } });
        }
      });
    }

    const hasErrors = errors.length > 0;
    const hasImported = validRows.length > 0;

    return {
      success: !hasErrors,
      partialSuccess: hasErrors && hasImported,
      totalRows: rows.length,
      importedRows: validRows.length,
      errorRows:
        errors.length > 0 ? [...errorRowNumbers].sort((a, b) => a - b) : [],
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
      updatedCounts: {
        storageZones: updatedStorageZonesCount,
      },
      skippedCounts,
      errors: hasErrors ? errors : undefined,
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
        throw new BadRequestException(
          `File Excel khong hop le. Thieu cot: ${label}`,
        );
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
        category: this.cleanString(
          row.getCell(getColumnIndex(IMPORT_COLUMN_LABELS.category)).value,
        ),
        classification: this.cleanString(
          row.getCell(getColumnIndex(IMPORT_COLUMN_LABELS.classification))
            .value,
        ),
        color: this.cleanString(
          row.getCell(getColumnIndex(IMPORT_COLUMN_LABELS.color)).value,
        ),
        size: this.cleanString(
          row.getCell(getColumnIndex(IMPORT_COLUMN_LABELS.size)).value,
        ),
        material: this.cleanString(
          row.getCell(getColumnIndex(IMPORT_COLUMN_LABELS.material)).value,
        ),
        productCondition: this.cleanString(
          row.getCell(getColumnIndex(IMPORT_COLUMN_LABELS.productCondition))
            .value,
        ),
        storageZone: this.cleanString(
          row.getCell(getColumnIndex(IMPORT_COLUMN_LABELS.storageZone)).value,
        ),
        storageZoneCapacity: this.parseOptionalNumber(
          row.getCell(getColumnIndex(IMPORT_COLUMN_LABELS.storageZoneCapacity))
            .value,
        ),
        warehouseType: this.cleanString(
          row.getCell(getColumnIndex(IMPORT_COLUMN_LABELS.warehouseType)).value,
        ),
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

  private parseOptionalNumber(
    value: ExcelJS.CellValue | undefined,
  ): number | null {
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

      if (
        'result' in value &&
        value.result !== undefined &&
        value.result !== null
      ) {
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
    const baseCode =
      name
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
