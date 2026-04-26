import type { Response } from 'express';
import { InventoryService } from './inventory.service.js';
import { DeleteTransactionsDto, StockAdjustDto, StockInDto, StockOutDto, InventoryQueryDto, InventoryQueryV2Dto, TransactionHistoryQueryDto, TransactionStatusActionDto } from './dto/index.js';
export declare class InventoryController {
    private readonly inventoryService;
    constructor(inventoryService: InventoryService);
    stockIn(dto: StockInDto, currentUser: Record<string, unknown>): Promise<{
        id: string;
        createdAt: Date;
        type: import(".prisma/client").$Enums.TransactionType;
        quantity: number;
        purchasePrice: import("@prisma/client/runtime/library").Decimal | null;
        salePrice: import("@prisma/client/runtime/library").Decimal | null;
        status: import(".prisma/client").$Enums.InventoryTransactionStatus;
        actualStockDate: Date | null;
        notes: string | null;
        productId: string;
        userId: string;
        skuComboId: string | null;
        productConditionId: string | null;
        storageZoneId: string | null;
        warehousePositionId: string | null;
        preliminaryCheckId: string | null;
    }>;
    stockOut(dto: StockOutDto, currentUser: Record<string, unknown>): Promise<{
        id: string;
        createdAt: Date;
        type: import(".prisma/client").$Enums.TransactionType;
        quantity: number;
        purchasePrice: import("@prisma/client/runtime/library").Decimal | null;
        salePrice: import("@prisma/client/runtime/library").Decimal | null;
        status: import(".prisma/client").$Enums.InventoryTransactionStatus;
        actualStockDate: Date | null;
        notes: string | null;
        productId: string;
        userId: string;
        skuComboId: string | null;
        productConditionId: string | null;
        storageZoneId: string | null;
        warehousePositionId: string | null;
        preliminaryCheckId: string | null;
    }>;
    adjustStock(dto: StockAdjustDto, currentUser: Record<string, unknown>): Promise<{
        id: string;
        createdAt: Date;
        type: import(".prisma/client").$Enums.TransactionType;
        quantity: number;
        purchasePrice: import("@prisma/client/runtime/library").Decimal | null;
        salePrice: import("@prisma/client/runtime/library").Decimal | null;
        status: import(".prisma/client").$Enums.InventoryTransactionStatus;
        actualStockDate: Date | null;
        notes: string | null;
        productId: string;
        userId: string;
        skuComboId: string | null;
        productConditionId: string | null;
        storageZoneId: string | null;
        warehousePositionId: string | null;
        preliminaryCheckId: string | null;
    }>;
    updateTransactionStatus(dto: TransactionStatusActionDto, currentUser: Record<string, unknown>): Promise<{
        updated: number;
        status: import(".prisma/client").$Enums.InventoryTransactionStatus;
    }>;
    deleteTransactions(dto: DeleteTransactionsDto, currentUser: Record<string, unknown>): Promise<{
        deleted: number;
    }>;
    getInventory(query: InventoryQueryDto): Promise<import("./inventory.service.js").PaginatedResponse<unknown>>;
    getCapacity(): Promise<import("./inventory.service.js").CapacityInfo>;
    getInventoryV2(query: InventoryQueryV2Dto): Promise<import("./inventory.service.js").PaginatedResponse<unknown>>;
    getTransactionHistory(query: TransactionHistoryQueryDto): Promise<import("./inventory.service.js").PaginatedResponse<import("./inventory.service.js").InventoryTransactionHistoryItem>>;
    exportExcelV2(query: InventoryQueryV2Dto, res: Response): Promise<void>;
}
