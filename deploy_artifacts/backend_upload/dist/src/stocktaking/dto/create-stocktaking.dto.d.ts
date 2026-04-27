export declare class CreateStocktakingItemDto {
    productId: string;
    actualQuantity: number;
    evidenceUrl?: string;
}
export declare class CreateStocktakingDto {
    mode: 'full' | 'selected';
    productIds?: string[];
    cutoffTime?: string;
}
export declare class SubmitStocktakingItemDto {
    itemId: string;
    actualQuantity: number;
    discrepancyReason?: string;
    evidenceUrl?: string;
}
export declare class SubmitStocktakingDto {
    items: SubmitStocktakingItemDto[];
}
