import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateLayoutDto } from './dto/create-layout.dto.js';
import type { UpdateLayoutDto } from './dto/update-layout.dto.js';
import type { UpdatePositionLayoutDto } from './dto/update-position-layout.dto.js';
import type { CreatePositionDto } from './dto/create-position.dto.js';
export declare class WarehouseService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private buildGridPosition;
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
    deleteLayout(id: string): Promise<void>;
    updateLayoutMode(id: string, mode: 'GRID' | 'FREE', canvasWidth?: number, canvasHeight?: number): Promise<{
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
    assignProductToPosition(positionId: string, productId: string | null): Promise<{
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
    validatePosition(positionId: string): Promise<boolean>;
    movePosition(id: string, targetRow: number, targetCol: number): Promise<({
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
    updateLabel(id: string, label: string): Promise<{
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
    updateCapacity(id: string, maxCapacity: number): Promise<{
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
    deletePosition(id: string, force?: boolean): Promise<{
        success: boolean;
    }>;
    getPositionSkus(id: string): Promise<{
        skuComboId: string;
        compositeSku: string;
        quantity: number;
    }[]>;
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
    }[]>;
    getSingleLayoutWithSkus(): Promise<{
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
}
