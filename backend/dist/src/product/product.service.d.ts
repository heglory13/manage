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
export declare class ProductService {
    private readonly prisma;
    private readonly skuGenerator;
    constructor(prisma: PrismaService, skuGenerator: SkuGeneratorService);
    create(dto: CreateProductDto): Promise<Product>;
    findAll(query: ProductQueryDto): Promise<PaginatedResponse<Product>>;
    update(id: string, dto: UpdateProductDto): Promise<Product>;
    delete(id: string): Promise<void>;
    updateThreshold(id: string, minThreshold: number): Promise<Product>;
    toggleDiscontinued(id: string): Promise<Product>;
    updateMaxThreshold(id: string, maxThreshold: number): Promise<Product>;
}
