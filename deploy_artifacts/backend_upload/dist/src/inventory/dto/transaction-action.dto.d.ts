import { InventoryTransactionStatus } from '@prisma/client/index';
export declare class TransactionStatusActionDto {
    transactionIds: string[];
    status: InventoryTransactionStatus;
}
export declare class DeleteTransactionsDto {
    transactionIds: string[];
}
