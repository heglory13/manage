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
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.skuCombo.count({ where }),
    ]);

    return {
      data,
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
