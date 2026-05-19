import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryTransactionStatus,
  Product,
  TransactionType,
} from '@prisma/client/index';
import { PrismaService } from '../prisma/prisma.service.js';
import { SkuGeneratorService } from './sku-generator.service.js';
import {
  CreateProductDto,
  UpdateProductDto,
  ProductQueryDto,
} from './dto/index.js';

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly skuGenerator: SkuGeneratorService,
  ) {}

  async create(dto: CreateProductDto): Promise<Product> {
    // Validate name is not empty/whitespace
    if (!dto.name || dto.name.trim().length === 0) {
      throw new BadRequestException('Tên sản phẩm là bắt buộc');
    }

    // Get category to use its code for SKU generation
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const createdAt = new Date();
    // Use category.code (already uppercase, no diacritics) for SKU generation
    const sku = await this.skuGenerator.generateSku(category.code, createdAt);

    return this.prisma.product.create({
      data: {
        name: dto.name.trim(),
        sku,
        price: dto.price,
        categoryId: dto.categoryId,
        createdAt,
      },
      include: {
        category: true,
      },
    });
  }

  async findAll(query: ProductQueryDto): Promise<PaginatedResponse<Product>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};

    if (query.search?.trim()) {
      where.OR = [
        { name: { contains: query.search.trim() } },
        { sku: { contains: query.search.trim() } },
      ];
    }

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        skip,
        take: limit,
        where,
        include: {
          category: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    const categoryIds = [
      ...new Set(data.map((item) => item.categoryId).filter(Boolean)),
    ];
    const transactions = categoryIds.length
      ? await this.prisma.inventoryTransaction.findMany({
          where: {
            status: InventoryTransactionStatus.ACTIVE,
            categoryId: { in: categoryIds },
          },
          select: {
            categoryId: true,
            type: true,
            quantity: true,
          },
        })
      : [];

    const stockByCategory = new Map<string, number>();
    for (const transaction of transactions) {
      if (!transaction.categoryId) continue;
      const current = stockByCategory.get(transaction.categoryId) ?? 0;
      stockByCategory.set(
        transaction.categoryId,
        current +
          (transaction.type === TransactionType.STOCK_IN
            ? transaction.quantity
            : -transaction.quantity),
      );
    }

    const hydratedData = data.map((product) => ({
      ...product,
      stock: stockByCategory.get(product.categoryId) ?? 0,
    }));

    return {
      data: hydratedData,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Validate name if provided
    if (dto.name !== undefined && dto.name.trim().length === 0) {
      throw new BadRequestException('Tên sản phẩm là bắt buộc');
    }

    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) {
      updateData.name = dto.name.trim();
    }
    if (dto.price !== undefined) {
      updateData.price = dto.price;
    }

    return this.prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
      },
    });
  }

  async delete(id: string): Promise<void> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    await this.prisma.product.delete({ where: { id } });
  }

  async updateThreshold(id: string, minThreshold: number): Promise<Product> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (minThreshold < 0) {
      throw new BadRequestException('Ngưỡng Min phải là số không âm');
    }

    return this.prisma.product.update({
      where: { id },
      data: { minThreshold },
      include: { category: true },
    });
  }

  async toggleDiscontinued(id: string): Promise<Product> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.prisma.product.update({
      where: { id },
      data: { isDiscontinued: !product.isDiscontinued },
      include: { category: true },
    });
  }

  async updateDiscontinuedByCategoryIds(
    categoryIds: string[],
    isDiscontinued: boolean,
  ) {
    const normalizedCategoryIds = [
      ...new Set(categoryIds.map((id) => id.trim()).filter(Boolean)),
    ];
    if (normalizedCategoryIds.length === 0) {
      throw new BadRequestException('Danh sach danh muc khong hop le');
    }

    const products = await this.prisma.product.findMany({
      where: { categoryId: { in: normalizedCategoryIds } },
      select: { id: true, categoryId: true },
    });

    if (products.length === 0) {
      throw new NotFoundException('Khong tim thay san pham nao de cap nhat');
    }

    await this.prisma.product.updateMany({
      where: { categoryId: { in: normalizedCategoryIds } },
      data: { isDiscontinued },
    });

    return {
      updated: products.length,
      categoryIds: [...new Set(products.map((item) => item.categoryId))],
      isDiscontinued,
    };
  }

  async updateMaxThreshold(id: string, maxThreshold: number): Promise<Product> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (maxThreshold < 0) {
      throw new BadRequestException('Ngưỡng Max phải là số không âm');
    }

    return this.prisma.product.update({
      where: { id },
      data: { maxThreshold },
      include: { category: true },
    });
  }
}
