import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
      where: { name: { equals: trimmed, mode: 'insensitive' } },
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
          where: { name: { equals: trimmed, mode: 'insensitive' } },
        });
        break;
      case 'color':
        existing = await this.prisma.color.findFirst({
          where: { name: { equals: trimmed, mode: 'insensitive' } },
        });
        break;
      case 'size':
        existing = await this.prisma.size.findFirst({
          where: { name: { equals: trimmed, mode: 'insensitive' } },
        });
        break;
      case 'material':
        existing = await this.prisma.material.findFirst({
          where: { name: { equals: trimmed, mode: 'insensitive' } },
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
      where: { name: { equals: trimmed, mode: 'insensitive' } },
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
      where: { name: { equals: trimmed, mode: 'insensitive' } },
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
      where: { name: { equals: trimmed, mode: 'insensitive' } },
    });

    if (existing) {
      throw new ConflictException('Khu vực hàng hoá này đã tồn tại');
    }

    return this.prisma.storageZone.create({
      data: { name: trimmed, maxCapacity },
    });
  }
}
