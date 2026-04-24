import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Product } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { SkuGeneratorService } from './sku-generator.service.js';
import { CreateProductDto, UpdateProductDto, ProductQueryDto } from './dto/index.js';

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

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        skip,
        take: limit,
        include: {
          category: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.product.count(),
    ]);

    return {
      data,
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
