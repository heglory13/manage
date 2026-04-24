import { ProductService } from './product.service.js';
import { CreateProductDto, UpdateProductDto, ProductQueryDto, UpdateThresholdDto, UpdateMaxThresholdDto } from './dto/index.js';
export declare class ProductController {
    private readonly productService;
    constructor(productService: ProductService);
    create(dto: CreateProductDto): Promise<{
        id: string;
        name: string;
        sku: string;
        price: import("@prisma/client/runtime/library").Decimal;
        categoryId: string;
        stock: number;
        minThreshold: number;
        maxThreshold: number;
        isDiscontinued: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    findAll(query: ProductQueryDto): Promise<import("./product.service.js").PaginatedResponse<{
        id: string;
        name: string;
        sku: string;
        price: import("@prisma/client/runtime/library").Decimal;
        categoryId: string;
        stock: number;
        minThreshold: number;
        maxThreshold: number;
        isDiscontinued: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>>;
    update(id: string, dto: UpdateProductDto): Promise<{
        id: string;
        name: string;
        sku: string;
        price: import("@prisma/client/runtime/library").Decimal;
        categoryId: string;
        stock: number;
        minThreshold: number;
        maxThreshold: number;
        isDiscontinued: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    updateThreshold(id: string, dto: UpdateThresholdDto): Promise<{
        id: string;
        name: string;
        sku: string;
        price: import("@prisma/client/runtime/library").Decimal;
        categoryId: string;
        stock: number;
        minThreshold: number;
        maxThreshold: number;
        isDiscontinued: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    toggleDiscontinued(id: string): Promise<{
        id: string;
        name: string;
        sku: string;
        price: import("@prisma/client/runtime/library").Decimal;
        categoryId: string;
        stock: number;
        minThreshold: number;
        maxThreshold: number;
        isDiscontinued: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    updateMaxThreshold(id: string, dto: UpdateMaxThresholdDto): Promise<{
        id: string;
        name: string;
        sku: string;
        price: import("@prisma/client/runtime/library").Decimal;
        categoryId: string;
        stock: number;
        minThreshold: number;
        maxThreshold: number;
        isDiscontinued: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    delete(id: string): Promise<{
        message: string;
    }>;
}
