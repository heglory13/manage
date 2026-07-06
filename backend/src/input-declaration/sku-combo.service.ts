import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryTransactionStatus,
  Prisma,
  TransactionType,
} from '@prisma/client/index';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateSkuComboDto } from './dto/index.js';

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class SkuComboService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeSearchValue(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[Đđ]/g, 'd')
      .toLowerCase()
      .trim();
  }

  generateCompositeSku(
    classificationName: string,
    colorName: string,
    sizeName: string,
    materialName: string,
  ): string {
    return [
      classificationName.trim(),
      colorName.trim(),
      sizeName.trim(),
      materialName.trim(),
    ]
      .map((s) => s.replace(/\s+/g, ' '))
      .join('-');
  }

  /**
   * Generate SKU code from 5 fields: Category + Classification + Color + Size + Material.
   * Base: 2 chars from each field, concatenated without separator.
   * Example: Ốp lưng + Buff + Nâu + IP11 + Da → OPBUNAIPDA
   *
   * When duplicate, increase chars in the field that creates differentiation.
   * Priority: Classification → Size → Color → Material → Category.
   */
  private async generateShortSku(
    categoryName: string,
    classificationName: string,
    colorName: string,
    sizeName: string,
    materialName: string,
  ): Promise<string> {
    const normalize = (s: string) =>
      s
        .trim()
        .replace(/\s+/g, ' ')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');

    const fields = [
      normalize(categoryName), // index 0 - category
      normalize(classificationName), // index 1 - classification
      normalize(colorName), // index 2 - color
      normalize(sizeName), // index 3 - size
      normalize(materialName), // index 4 - material
    ];

    // Start with 2 chars each
    const lengths = [2, 2, 2, 2, 2];

    // Expansion priority: classification → size → color → material → category
    const expansionOrder = [1, 3, 2, 4, 0];

    const buildSku = () =>
      fields
        .map((f, i) => f.slice(0, lengths[i]).padEnd(lengths[i], 'X'))
        .join('');

    // Try base SKU first
    let candidate = buildSku();
    let existing = await this.prisma.skuCombo.findFirst({
      where: { compositeSku: candidate },
    });
    if (!existing) return candidate;

    // Expand one field at a time in priority order
    for (const fieldIndex of expansionOrder) {
      const maxLen = fields[fieldIndex].length + 2;
      while (lengths[fieldIndex] < maxLen) {
        lengths[fieldIndex]++;
        candidate = buildSku();
        existing = await this.prisma.skuCombo.findFirst({
          where: { compositeSku: candidate },
        });
        if (!existing) return candidate;
      }
    }

    // Fallback: append timestamp
    return `${buildSku()}${Date.now().toString(36).toUpperCase()}`;
  }

  async findOrCreate(dto: CreateSkuComboDto & { categoryId?: string }) {
    // Validate all FKs exist first
    const [classification, color, size, material] = await Promise.all([
      this.prisma.classification.findUnique({
        where: { id: dto.classificationId },
      }),
      this.prisma.color.findUnique({ where: { id: dto.colorId } }),
      this.prisma.size.findUnique({ where: { id: dto.sizeId } }),
      this.prisma.material.findUnique({ where: { id: dto.materialId } }),
    ]);

    if (!classification)
      throw new NotFoundException('Không tìm thấy phân loại');
    if (!color) throw new NotFoundException('Không tìm thấy màu sắc');
    if (!size) throw new NotFoundException('Không tìm thấy size');
    if (!material) throw new NotFoundException('Không tìm thấy chất liệu');

    // Get category name for SKU generation
    let categoryName = 'XX';
    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
        select: { name: true },
      });
      if (category) categoryName = category.name;
    }

    const compositeSku = await this.generateShortSku(
      categoryName,
      classification.name,
      color.name,
      size.name,
      material.name,
    );

    try {
      return await this.prisma.skuCombo.create({
        data: {
          classificationId: dto.classificationId,
          colorId: dto.colorId,
          sizeId: dto.sizeId,
          materialId: dto.materialId,
          compositeSku,
        },
        include: {
          classification: true,
          color: true,
          size: true,
          material: true,
        },
      });
    } catch (error) {
      const prismaError = error as Record<string, unknown>;
      if (prismaError?.code === 'P2002') {
        const existingCombo = await this.prisma.skuCombo.findUnique({
          where: {
            classificationId_colorId_sizeId_materialId: {
              classificationId: dto.classificationId,
              colorId: dto.colorId,
              sizeId: dto.sizeId,
              materialId: dto.materialId,
            },
          },
          include: {
            classification: true,
            color: true,
            size: true,
            material: true,
          },
        });
        if (existingCombo) return existingCombo;
        // Race condition: retry with fallback SKU
        const fallbackSku = `${compositeSku}-${Date.now().toString(36).toUpperCase()}`;
        return this.prisma.skuCombo.create({
          data: {
            classificationId: dto.classificationId,
            colorId: dto.colorId,
            sizeId: dto.sizeId,
            materialId: dto.materialId,
            compositeSku: fallbackSku,
          },
          include: {
            classification: true,
            color: true,
            size: true,
            material: true,
          },
        });
      }
      throw error;
    }
  }

  async create(dto: CreateSkuComboDto) {
    // Validate all 4 FKs exist
    const [classification, color, size, material] = await Promise.all([
      this.prisma.classification.findUnique({
        where: { id: dto.classificationId },
      }),
      this.prisma.color.findUnique({ where: { id: dto.colorId } }),
      this.prisma.size.findUnique({ where: { id: dto.sizeId } }),
      this.prisma.material.findUnique({ where: { id: dto.materialId } }),
    ]);

    if (!classification) {
      throw new NotFoundException('Không tìm thấy phân loại');
    }
    if (!color) {
      throw new NotFoundException('Không tìm thấy màu sắc');
    }
    if (!size) {
      throw new NotFoundException('Không tìm thấy size');
    }
    if (!material) {
      throw new NotFoundException('Không tìm thấy chất liệu');
    }

    // Check unique combo
    const existingCombo = await this.prisma.skuCombo.findUnique({
      where: {
        classificationId_colorId_sizeId_materialId: {
          classificationId: dto.classificationId,
          colorId: dto.colorId,
          sizeId: dto.sizeId,
          materialId: dto.materialId,
        },
      },
    });

    if (existingCombo) {
      throw new ConflictException('Tổ hợp SKU này đã tồn tại');
    }

    const compositeSku = this.generateCompositeSku(
      classification.name,
      color.name,
      size.name,
      material.name,
    );

    try {
      return await this.prisma.skuCombo.create({
        data: {
          classificationId: dto.classificationId,
          colorId: dto.colorId,
          sizeId: dto.sizeId,
          materialId: dto.materialId,
          compositeSku,
        },
        include: {
          classification: true,
          color: true,
          size: true,
          material: true,
        },
      });
    } catch (error) {
      const prismaError = error as Record<string, unknown>;
      if (prismaError?.code === 'P2002') {
        throw new ConflictException('Tổ hợp SKU này đã tồn tại');
      }
      throw error;
    }
  }

  async getAll(query: {
    search?: string;
    page?: string;
    limit?: string;
    stockOut?: string;
  }): Promise<PaginatedResponse<unknown>> {
    const page = query.page ? parseInt(query.page, 10) : 1;
    const limit = query.limit ? parseInt(query.limit, 10) : 10;
    const skip = (page - 1) * limit;

    const isSearchEnabled = Boolean(query.search?.trim());
    const keywords = isSearchEnabled
      ? query.search!
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .map((item) => this.normalizeSearchValue(item))
      : [];

    const data = await this.prisma.skuCombo.findMany({
        include: {
          classification: true,
          color: true,
          size: true,
          material: true,
          inventoryTransactions: {
            select: {
              categoryId: true,
              category: { select: { id: true, name: true } },
            },
            where: { categoryId: { not: null } },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
      });

    const enriched = data.map((combo) => {
      const latestTx = combo.inventoryTransactions[0];
      return {
        id: combo.id,
        compositeSku: combo.compositeSku,
        classification: combo.classification,
        color: combo.color,
        size: combo.size,
        material: combo.material,
        createdAt: combo.createdAt,
        categoryId: latestTx?.category?.id ?? null,
        categoryName: latestTx?.category?.name ?? null,
      };
    });

    const searchMatches = (item: {
      compositeSku: string;
      classification: { name: string };
      color: { name: string };
      size: { name: string };
      material: { name: string };
      categoryName: string | null;
    }) => {
      if (!isSearchEnabled) return true;

      const fields = [
        item.compositeSku,
        item.classification?.name,
        item.color?.name,
        item.size?.name,
        item.material?.name,
        item.categoryName ?? '',
      ].map((field) => this.normalizeSearchValue(field ?? ''));

      if (keywords.length === 1) {
        return fields.some((field) => field.includes(keywords[0]));
      }

      return keywords.every((keyword) =>
        fields.some((field) => field.includes(keyword)),
      );
    };

    const categoryIds = [
      ...new Set(enriched.map((item) => item.categoryId).filter(Boolean)),
    ] as string[];
    const skuComboIds = enriched.map((item) => item.id);

    const [products, stockTransactions] = await Promise.all([
      categoryIds.length > 0
        ? this.prisma.product.findMany({
            where: { categoryId: { in: categoryIds } },
            select: { categoryId: true, isDiscontinued: true },
          })
        : [],
      skuComboIds.length > 0
        ? this.prisma.inventoryTransaction.findMany({
            where: {
              skuComboId: { in: skuComboIds },
              status: InventoryTransactionStatus.ACTIVE,
            },
            select: { skuComboId: true, type: true, quantity: true },
          })
        : [],
    ]);

    const discontinuedMap = new Map(
      products.map((item) => [item.categoryId, item.isDiscontinued]),
    );

    const stockBySkuCombo = new Map<string, number>();
    for (const tx of stockTransactions) {
      if (!tx.skuComboId) continue;
      const current = stockBySkuCombo.get(tx.skuComboId) ?? 0;
      stockBySkuCombo.set(
        tx.skuComboId,
        current +
          (tx.type === TransactionType.STOCK_IN ? tx.quantity : -tx.quantity),
      );
    }

    const isStockOutMode = query.stockOut === 'true';
    const searchFiltered = isSearchEnabled ? enriched.filter(searchMatches) : enriched;
    const stockFiltered = searchFiltered.filter((item) => {
      if (item.categoryId && discontinuedMap.get(item.categoryId)) return false;
      if (isStockOutMode) return (stockBySkuCombo.get(item.id) ?? 0) > 0;
      return true;
    });

    const paged = stockFiltered.slice(skip, skip + limit);

    const effectiveTotal = stockFiltered.length;
    return {
      data: paged,
      total: effectiveTotal,
      page,
      limit,
      totalPages: Math.ceil(effectiveTotal / limit),
    };
  }

  async delete(id: string) {
    const existing = await this.prisma.skuCombo.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('SKU combo không tồn tại');
    }

    await this.prisma.skuCombo.delete({ where: { id } });
    return { success: true, message: 'SKU combo đã được xóa' };
  }

  async updateThreshold(
    id: string,
    minThreshold: number,
    maxThreshold: number,
  ) {
    if (maxThreshold > 0 && minThreshold > maxThreshold) {
      throw new BadRequestException('Ngưỡng Min không được lớn hơn Ngưỡng Max');
    }

    const existing = await this.prisma.skuCombo.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('SKU combo không tồn tại');
    }

    return this.prisma.skuCombo.update({
      where: { id },
      data: { minThreshold, maxThreshold },
    });
  }

  async batchUpdateThreshold(
    items: Array<{ sku: string; minThreshold: number; maxThreshold: number }>,
  ): Promise<{ updated: number; errors: Array<{ sku: string; message: string }> }> {
    if (!items || items.length === 0) {
      throw new BadRequestException('Danh sách cập nhật không được rỗng');
    }

    const errors: Array<{ sku: string; message: string }> = [];
    let updated = 0;

    for (const item of items) {
      const { sku, minThreshold, maxThreshold } = item;

      if (isNaN(minThreshold) || minThreshold < 0) {
        errors.push({ sku, message: 'Ngưỡng Min phải là số không âm' });
        continue;
      }
      if (isNaN(maxThreshold) || maxThreshold < 0) {
        errors.push({ sku, message: 'Ngưỡng Max phải là số không âm' });
        continue;
      }
      if (maxThreshold > 0 && minThreshold > maxThreshold) {
        errors.push({ sku, message: 'Ngưỡng Min không được lớn hơn Ngưỡng Max' });
        continue;
      }

      const existing = await this.prisma.skuCombo.findFirst({
        where: { compositeSku: sku },
      });
      if (!existing) {
        errors.push({ sku, message: 'Không tìm thấy SKU trong hệ thống' });
        continue;
      }

      await this.prisma.skuCombo.update({
        where: { id: existing.id },
        data: { minThreshold, maxThreshold },
      });
      updated++;
    }

    return { updated, errors };
  }

  async batchUpdateDiscontinued(ids: string[], isDiscontinued: boolean) {
    if (ids.length === 0) {
      throw new BadRequestException('Không có SKU nào được chọn');
    }

    const count = await this.prisma.skuCombo.count({
      where: { id: { in: ids } },
    });
    if (count === 0) {
      throw new NotFoundException('Không tìm thấy SKU nào để cập nhật');
    }

    await this.prisma.skuCombo.updateMany({
      where: { id: { in: ids } },
      data: { isDiscontinued },
    });

    return { success: true, updated: count };
  }
}
