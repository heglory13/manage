import { PrismaService } from '../prisma/prisma.service.js';
export interface PreliminaryCheckFilters {
    status?: string;
    page?: number;
    limit?: number;
}
export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
export declare class PreliminaryCheckService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(dto: {
        classificationId: string;
        quantity: number;
        warehouseTypeId?: string;
        imageUrl?: string;
        note?: string;
    }, userId: string): Promise<{
        warehouseType: {
            id: string;
            name: string;
            createdAt: Date;
        } | null;
        classification: {
            id: string;
            name: string;
            createdAt: Date;
        };
        creator: {
            id: string;
            email: string;
            name: string;
        };
    } & {
        id: string;
        classificationId: string;
        createdAt: Date;
        updatedAt: Date;
        quantity: number;
        status: import(".prisma/client").$Enums.PreliminaryCheckStatus;
        imageUrl: string | null;
        note: string | null;
        warehouseTypeId: string | null;
        createdBy: string;
    }>;
    findAll(filters: PreliminaryCheckFilters): Promise<PaginatedResponse<unknown>>;
    findOne(id: string): Promise<{
        warehouseType: {
            id: string;
            name: string;
            createdAt: Date;
        } | null;
        classification: {
            id: string;
            name: string;
            createdAt: Date;
        };
        creator: {
            id: string;
            email: string;
            name: string;
        };
    } & {
        id: string;
        classificationId: string;
        createdAt: Date;
        updatedAt: Date;
        quantity: number;
        status: import(".prisma/client").$Enums.PreliminaryCheckStatus;
        imageUrl: string | null;
        note: string | null;
        warehouseTypeId: string | null;
        createdBy: string;
    }>;
    complete(id: string, status: 'APPROVED' | 'REJECTED'): Promise<{
        warehouseType: {
            id: string;
            name: string;
            createdAt: Date;
        } | null;
        classification: {
            id: string;
            name: string;
            createdAt: Date;
        };
        creator: {
            id: string;
            email: string;
            name: string;
        };
    } & {
        id: string;
        classificationId: string;
        createdAt: Date;
        updatedAt: Date;
        quantity: number;
        status: import(".prisma/client").$Enums.PreliminaryCheckStatus;
        imageUrl: string | null;
        note: string | null;
        warehouseTypeId: string | null;
        createdBy: string;
    }>;
}
