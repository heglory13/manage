import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateSkuComboDto } from './dto/index.js';
export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
export declare class SkuComboService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    generateCompositeSku(classificationName: string, colorName: string, sizeName: string, materialName: string): string;
    create(dto: CreateSkuComboDto): Promise<{
        classification: {
            id: string;
            name: string;
            createdAt: Date;
        };
        color: {
            id: string;
            name: string;
            createdAt: Date;
        };
        size: {
            id: string;
            name: string;
            createdAt: Date;
        };
        material: {
            id: string;
            name: string;
            createdAt: Date;
        };
    } & {
        id: string;
        classificationId: string;
        colorId: string;
        sizeId: string;
        materialId: string;
        compositeSku: string;
        createdAt: Date;
    }>;
    getAll(query: {
        search?: string;
        page?: string;
        limit?: string;
    }): Promise<PaginatedResponse<unknown>>;
    delete(id: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
