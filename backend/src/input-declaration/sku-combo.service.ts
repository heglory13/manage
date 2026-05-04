import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

  generateCompositeSku(
    classificationName: string,
    colorName: string,
    sizeName: string,
    materialName: string,
  ): string {
    return `${classificationName}-${colorName}-${sizeName}-${materialName}`;
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
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');

    const fields = [
      normalize(categoryName),         // index 0 - category
      normalize(classificationName),   // index 1 - classification
      normalize(colorName),            // index 2 - color
      normalize(sizeName),             // index 3 - size
      normalize(materialName),         // index 4 - material
    ];

    // Start with 2 chars each
    const lengths = [2, 2, 2, 2, 2];

    // Expansion priority: classification → size → color → material → category
    const expansionOrder = [1, 3, 2, 4, 0];

    const buildSku = () =>
      fields.map((f, i) => f.slice(0, lengths[i]).padEnd(lengths[i], 'X')).join('');

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
    // Check if combo already exists
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

    if (existingCombo) {
      return existingCombo;
    }

    // Validate all FKs exist
    const [classification, color, size, material] = await Promise.all([
      this.prisma.classification.findUnique({ where: { id: dto.classificationId } }),
      this.prisma.color.findUnique({ where: { id: dto.colorId } }),
      this.prisma.size.findUnique({ where: { id: dto.sizeId } }),
      this.prisma.material.findUnique({ where: { id: dto.materialId } }),
    ]);

    if (!classification) throw new NotFoundException('Không tìm thấy phân loại');
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

    return this.prisma.skuCombo.create({
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

    return this.prisma.skuCombo.create({
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
  }

  async getAll(query: {
    search?: string;
    page?: string;
    limit?: string;
  }): Promise<PaginatedResponse<unknown>> {
    const page = query.page ? parseInt(query.page, 10) : 1;
    const limit = query.limit ? parseInt(query.limit, 10) : 10;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (query.search) {
      where.OR = [
        {
          compositeSku: {
            contains: query.search,
          },
        },
        {
          classification: {
            name: { contains: query.search },
          },
        },
        {
          color: {
            name: { contains: query.search },
          },
        },
        {
          size: {
            name: { contains: query.search },
          },
        },
        {
          material: {
            name: { contains: query.search },
          },
        },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.skuCombo.findMany({
        where,
        skip,
        take: limit,
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
      }),
      this.prisma.skuCombo.count({ where }),
    ]);

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

    return {
      data: enriched,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
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
}
