export declare class StockAdjustDto {
    productId: string;
    warehousePositionId?: string;
    quantity: number;
    type: 'INCREASE' | 'DECREASE';
    reason?: string;
}
