import { StocktakingStatus } from '@prisma/client/index';
import { PrismaService } from '../prisma/prisma.service.js';
import type { SubmitStocktakingItemDto } from './dto/create-stocktaking.dto.js';
import type { UpdateStocktakingItemDto } from './dto/update-stocktaking-item.dto.js';
export interface StocktakingFilters {
    status?: string;
    startDate?: string;
    endDate?: string;
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
export declare class StocktakingService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    calculateDiscrepancies(items: Array<{
        systemQuantity: number;
        actualQuantity: number;
    }>): Array<{
        systemQuantity: number;
        actualQuantity: number;
        discrepancy: number;
    }>;
    validateDiscrepancyReasons(items: Array<{
        discrepancy: number;
        discrepancyReason?: string | null;
    }>): {
        valid: boolean;
        message?: string;
    };
    validateEvidence(items: Array<{
        discrepancy: number;
        evidenceUrl?: string | null;
    }>): {
        valid: boolean;
        message?: string;
    };
    create(mode: 'full' | 'selected', userId: string, productIds?: string[], cutoffTime?: string): Promise<{
        creator: {
            id: string;
            email: string;
            name: string;
            role: import(".prisma/client").$Enums.Role;
        };
        items: ({
            product: {
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
            };
        } & {
            id: string;
            productId: string;
            systemQuantity: number;
            actualQuantity: number;
            discrepancy: number;
            evidenceUrl: string | null;
            discrepancyReason: string | null;
            recordId: string;
        })[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import(".prisma/client").$Enums.StocktakingStatus;
        createdBy: string;
        cutoffTime: Date;
        submittedAt: Date | null;
        mode: string;
    }>;
    submit(id: string, items: SubmitStocktakingItemDto[], userId?: string): Promise<({
        creator: {
            id: string;
            email: string;
            name: string;
            role: import(".prisma/client").$Enums.Role;
        };
        items: ({
            product: {
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
            };
        } & {
            id: string;
            productId: string;
            systemQuantity: number;
            actualQuantity: number;
            discrepancy: number;
            evidenceUrl: string | null;
            discrepancyReason: string | null;
            recordId: string;
        })[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import(".prisma/client").$Enums.StocktakingStatus;
        createdBy: string;
        cutoffTime: Date;
        submittedAt: Date | null;
        mode: string;
    }) | null>;
    approve(id: string, userId?: string): Promise<{
        creator: {
            id: string;
            email: string;
            name: string;
            role: import(".prisma/client").$Enums.Role;
        };
        items: ({
            product: {
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
            };
        } & {
            id: string;
            productId: string;
            systemQuantity: number;
            actualQuantity: number;
            discrepancy: number;
            evidenceUrl: string | null;
            discrepancyReason: string | null;
            recordId: string;
        })[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import(".prisma/client").$Enums.StocktakingStatus;
        createdBy: string;
        cutoffTime: Date;
        submittedAt: Date | null;
        mode: string;
    }>;
    reject(id: string, userId?: string, note?: string): Promise<{
        creator: {
            id: string;
            email: string;
            name: string;
            role: import(".prisma/client").$Enums.Role;
        };
        items: ({
            product: {
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
            };
        } & {
            id: string;
            productId: string;
            systemQuantity: number;
            actualQuantity: number;
            discrepancy: number;
            evidenceUrl: string | null;
            discrepancyReason: string | null;
            recordId: string;
        })[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import(".prisma/client").$Enums.StocktakingStatus;
        createdBy: string;
        cutoffTime: Date;
        submittedAt: Date | null;
        mode: string;
    }>;
    recordStatusChange(recordId: string, status: StocktakingStatus, changedBy?: string, note?: string): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.StocktakingStatus;
        note: string | null;
        recordId: string;
        changedBy: string | null;
        changedAt: Date;
    }>;
    getStatusHistory(recordId: string): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.StocktakingStatus;
        note: string | null;
        recordId: string;
        changedBy: string | null;
        changedAt: Date;
    }[]>;
    findOne(id: string): Promise<{
        creator: {
            id: string;
            email: string;
            name: string;
            role: import(".prisma/client").$Enums.Role;
        };
        items: ({
            product: {
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
            };
        } & {
            id: string;
            productId: string;
            systemQuantity: number;
            actualQuantity: number;
            discrepancy: number;
            evidenceUrl: string | null;
            discrepancyReason: string | null;
            recordId: string;
        })[];
        statusHistory: {
            id: string;
            status: import(".prisma/client").$Enums.StocktakingStatus;
            note: string | null;
            recordId: string;
            changedBy: string | null;
            changedAt: Date;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import(".prisma/client").$Enums.StocktakingStatus;
        createdBy: string;
        cutoffTime: Date;
        submittedAt: Date | null;
        mode: string;
    }>;
    updateItem(itemId: string, dto: UpdateStocktakingItemDto): Promise<{
        product: {
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
        };
    } & {
        id: string;
        productId: string;
        systemQuantity: number;
        actualQuantity: number;
        discrepancy: number;
        evidenceUrl: string | null;
        discrepancyReason: string | null;
        recordId: string;
    }>;
    findAll(filters: StocktakingFilters): Promise<PaginatedResponse<unknown>>;
}
