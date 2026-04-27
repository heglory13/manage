import { InventoryTransactionStatus, TransactionType } from '@prisma/client/index';
export interface TransactionValuationRow {
    id: string;
    productId: string;
    productName: string;
    productSku: string;
    skuComboId: string | null;
    compositeSku: string | null;
    classification?: string | null;
    color?: string | null;
    size?: string | null;
    material?: string | null;
    type: TransactionType;
    quantity: number;
    purchasePrice: number | null;
    createdAt: Date;
    status: InventoryTransactionStatus;
}
export interface InventoryValuationBucket {
    key: string;
    productId: string;
    productName: string;
    productSku: string;
    compositeSku: string;
    classification: string;
    color: string;
    size: string;
    material: string;
    openingQty: number;
    openingValue: number;
    totalInQty: number;
    totalInValue: number;
    totalOutQty: number;
    totalOutValue: number;
    closingQty: number;
    closingValue: number;
    averageCost: number;
}
export declare function buildInventoryValuationBuckets(rows: TransactionValuationRow[], startDate?: Date, endDate?: Date): InventoryValuationBucket[];
