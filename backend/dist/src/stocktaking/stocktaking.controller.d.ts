import { StocktakingService } from './stocktaking.service.js';
import { CreateStocktakingDto, SubmitStocktakingDto, StocktakingQueryDto, UpdateStocktakingItemDto } from './dto/index.js';
export declare class StocktakingController {
    private readonly stocktakingService;
    constructor(stocktakingService: StocktakingService);
    create(dto: CreateStocktakingDto, currentUser: Record<string, unknown>): Promise<{
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
    submit(id: string, dto: SubmitStocktakingDto, currentUser: Record<string, unknown>): Promise<({
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
    approve(id: string, currentUser: Record<string, unknown>): Promise<{
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
    reject(id: string, currentUser: Record<string, unknown>): Promise<{
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
    getStatusHistory(id: string): Promise<{
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
    findAll(query: StocktakingQueryDto): Promise<import("./stocktaking.service.js").PaginatedResponse<unknown>>;
}
