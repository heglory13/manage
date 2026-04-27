import { InventoryTransaction, InventoryTransactionStatus, TransactionType } from '@prisma/client/index';
import { PrismaService } from '../prisma/prisma.service.js';
export interface CapacityInfo {
    currentTotal: number;
    maxCapacity: number;
    ratio: number;
    isWarning: boolean;
}
export interface InventoryFilters {
    categoryId?: string;
    startDate?: string;
    endDate?: string;
    positionId?: string;
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
export interface InventoryTransactionHistoryItem {
    id: string;
    productId: string;
    createdAt: string;
    actualStockDate: string | null;
    kind: 'ALL' | 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT';
    type: TransactionType;
    status: InventoryTransactionStatus;
    quantity: number;
    signedQuantity: number;
    purchasePrice: number | null;
    salePrice: number | null;
    productName: string;
    productSku: string;
    positionLabel: string | null;
    userName: string;
    note: string;
}
export declare class InventoryService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private toPrismaDecimal;
    private asNumber;
    private getLatestActivePurchasePrice;
    private ensureCanApplyStockDelta;
    private syncPreliminaryCheckStatus;
    private applyTransactionImpact;
    computeBusinessStatus(product: {
        stock: number;
        minThreshold: number;
        isDiscontinued: boolean;
    }): 'CON_HANG' | 'HET_HANG' | 'SAP_HET' | 'NGUNG_KD';
    stockIn(productId: string, quantity: number, userId: string, options?: {
        purchasePrice?: number;
        salePrice?: number;
        skuComboId?: string;
        productConditionId?: string;
        storageZoneId?: string;
        warehousePositionId?: string;
        preliminaryCheckId?: string;
        actualStockDate?: string;
        notes?: string;
    }): Promise<InventoryTransaction>;
    stockOut(productId: string, quantity: number, userId: string, options?: {
        purchasePrice?: number;
        salePrice?: number;
        skuComboId?: string;
        productConditionId?: string;
        storageZoneId?: string;
        warehousePositionId?: string;
        notes?: string;
    }): Promise<InventoryTransaction>;
    adjustStock(productId: string, quantity: number, type: 'INCREASE' | 'DECREASE', userId: string, options?: {
        warehousePositionId?: string;
        reason?: string;
    }): Promise<InventoryTransaction>;
    updateTransactionStatus(transactionIds: string[], status: InventoryTransactionStatus): Promise<{
        updated: number;
        status: import(".prisma/client").$Enums.InventoryTransactionStatus;
    }>;
    deleteTransactions(transactionIds: string[]): Promise<{
        deleted: number;
    }>;
    getTransactionHistory(filters: {
        kind?: string;
        page?: number;
        limit?: number;
    }): Promise<PaginatedResponse<InventoryTransactionHistoryItem>>;
    getInventory(filters: InventoryFilters): Promise<PaginatedResponse<unknown>>;
    getCapacityRatio(): Promise<CapacityInfo>;
    getCurrentStock(productId: string): Promise<number>;
    getInventoryV2(filters: {
        categoryId?: string;
        businessStatus?: string;
        productConditionId?: string;
        classificationId?: string;
        materialId?: string;
        colorId?: string;
        sizeId?: string;
        storageZoneId?: string;
        positionId?: string;
        startDate?: string;
        endDate?: string;
        search?: string;
        page?: number;
        limit?: number;
    }): Promise<PaginatedResponse<unknown>>;
    exportExcelV2(filters: {
        categoryId?: string;
        businessStatus?: string;
        productConditionId?: string;
        classificationId?: string;
        materialId?: string;
        colorId?: string;
        sizeId?: string;
        storageZoneId?: string;
        search?: string;
    }): Promise<Buffer>;
}
