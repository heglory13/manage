import { WarehouseService } from './warehouse.service.js';
import { CreateLayoutDto, UpdateLayoutDto, AssignProductDto, MovePositionDto, UpdateLabelDto, UpdateCapacityDto, UpdatePositionLayoutDto, UpdateLayoutModeDto, CreatePositionDto, DeletePositionDto } from './dto/index.js';
export declare class WarehouseController {
    private readonly warehouseService;
    constructor(warehouseService: WarehouseService);
    createLayout(dto: CreateLayoutDto): Promise<({
        positions: ({
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
            } | null;
        } & {
            id: string;
            maxCapacity: number | null;
            currentStock: number;
            layoutId: string;
            row: number;
            column: number;
            x: number;
            y: number;
            width: number;
            height: number;
            label: string | null;
            isActive: boolean;
            productId: string | null;
        })[];
    } & {
        id: string;
        name: string;
        rows: number;
        columns: number;
        layoutMode: string;
        canvasWidth: number;
        canvasHeight: number;
        createdAt: Date;
        updatedAt: Date;
    }) | null>;
    updateLayout(id: string, dto: UpdateLayoutDto): Promise<({
        positions: ({
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
            } | null;
        } & {
            id: string;
            maxCapacity: number | null;
            currentStock: number;
            layoutId: string;
            row: number;
            column: number;
            x: number;
            y: number;
            width: number;
            height: number;
            label: string | null;
            isActive: boolean;
            productId: string | null;
        })[];
    } & {
        id: string;
        name: string;
        rows: number;
        columns: number;
        layoutMode: string;
        canvasWidth: number;
        canvasHeight: number;
        createdAt: Date;
        updatedAt: Date;
    }) | null>;
    updateLayoutMode(id: string, dto: UpdateLayoutModeDto): Promise<{
        positions: ({
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
            } | null;
        } & {
            id: string;
            maxCapacity: number | null;
            currentStock: number;
            layoutId: string;
            row: number;
            column: number;
            x: number;
            y: number;
            width: number;
            height: number;
            label: string | null;
            isActive: boolean;
            productId: string | null;
        })[];
    } & {
        id: string;
        name: string;
        rows: number;
        columns: number;
        layoutMode: string;
        canvasWidth: number;
        canvasHeight: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    deleteLayout(id: string): Promise<void>;
    getLayout(): Promise<({
        positions: ({
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
            } | null;
        } & {
            id: string;
            maxCapacity: number | null;
            currentStock: number;
            layoutId: string;
            row: number;
            column: number;
            x: number;
            y: number;
            width: number;
            height: number;
            label: string | null;
            isActive: boolean;
            productId: string | null;
        })[];
    } & {
        id: string;
        name: string;
        rows: number;
        columns: number;
        layoutMode: string;
        canvasWidth: number;
        canvasHeight: number;
        createdAt: Date;
        updatedAt: Date;
    }) | null>;
    getLayoutWithSkus(): Promise<{
        positions: {
            skus: {
                compositeSku: string;
                quantity: number;
            }[];
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
            } | null;
            id: string;
            maxCapacity: number | null;
            currentStock: number;
            layoutId: string;
            row: number;
            column: number;
            x: number;
            y: number;
            width: number;
            height: number;
            label: string | null;
            isActive: boolean;
            productId: string | null;
        }[];
        id: string;
        name: string;
        rows: number;
        columns: number;
        layoutMode: string;
        canvasWidth: number;
        canvasHeight: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    getLayoutsWithSkus(): Promise<{
        positions: {
            skus: {
                compositeSku: string;
                quantity: number;
            }[];
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
            } | null;
            id: string;
            maxCapacity: number | null;
            currentStock: number;
            layoutId: string;
            row: number;
            column: number;
            x: number;
            y: number;
            width: number;
            height: number;
            label: string | null;
            isActive: boolean;
            productId: string | null;
        }[];
        id: string;
        name: string;
        rows: number;
        columns: number;
        layoutMode: string;
        canvasWidth: number;
        canvasHeight: number;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    assignProduct(positionId: string, dto: AssignProductDto): Promise<{
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
        } | null;
    } & {
        id: string;
        maxCapacity: number | null;
        currentStock: number;
        layoutId: string;
        row: number;
        column: number;
        x: number;
        y: number;
        width: number;
        height: number;
        label: string | null;
        isActive: boolean;
        productId: string | null;
    }>;
    movePosition(id: string, dto: MovePositionDto): Promise<({
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
        } | null;
    } & {
        id: string;
        maxCapacity: number | null;
        currentStock: number;
        layoutId: string;
        row: number;
        column: number;
        x: number;
        y: number;
        width: number;
        height: number;
        label: string | null;
        isActive: boolean;
        productId: string | null;
    })[]>;
    updateLabel(id: string, dto: UpdateLabelDto): Promise<{
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
        } | null;
    } & {
        id: string;
        maxCapacity: number | null;
        currentStock: number;
        layoutId: string;
        row: number;
        column: number;
        x: number;
        y: number;
        width: number;
        height: number;
        label: string | null;
        isActive: boolean;
        productId: string | null;
    }>;
    toggleActive(id: string): Promise<{
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
        } | null;
    } & {
        id: string;
        maxCapacity: number | null;
        currentStock: number;
        layoutId: string;
        row: number;
        column: number;
        x: number;
        y: number;
        width: number;
        height: number;
        label: string | null;
        isActive: boolean;
        productId: string | null;
    }>;
    updateCapacity(id: string, dto: UpdateCapacityDto): Promise<{
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
        } | null;
    } & {
        id: string;
        maxCapacity: number | null;
        currentStock: number;
        layoutId: string;
        row: number;
        column: number;
        x: number;
        y: number;
        width: number;
        height: number;
        label: string | null;
        isActive: boolean;
        productId: string | null;
    }>;
    updatePositionLayout(id: string, dto: UpdatePositionLayoutDto): Promise<{
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
        } | null;
    } & {
        id: string;
        maxCapacity: number | null;
        currentStock: number;
        layoutId: string;
        row: number;
        column: number;
        x: number;
        y: number;
        width: number;
        height: number;
        label: string | null;
        isActive: boolean;
        productId: string | null;
    }>;
    getPositionSkus(id: string): Promise<{
        skuComboId: string;
        compositeSku: string;
        quantity: number;
    }[]>;
    createPosition(dto: CreatePositionDto): Promise<{
        id: string;
        maxCapacity: number | null;
        currentStock: number;
        layoutId: string;
        row: number;
        column: number;
        x: number;
        y: number;
        width: number;
        height: number;
        label: string | null;
        isActive: boolean;
        productId: string | null;
    }>;
    deletePosition(id: string, dto: DeletePositionDto): Promise<{
        success: boolean;
    }>;
}
