import { PrismaService } from '../prisma/prisma.service.js';
export type AttributeType = 'classification' | 'color' | 'size' | 'material' | 'productCondition' | 'storageZone' | 'warehouseType' | 'category';
export declare class InputDeclarationService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getAllDeclarations(): Promise<{
        categories: {
            id: string;
            name: string;
            code: string;
        }[];
        classifications: {
            id: string;
            name: string;
            createdAt: Date;
        }[];
        colors: {
            id: string;
            name: string;
            createdAt: Date;
        }[];
        sizes: {
            id: string;
            name: string;
            createdAt: Date;
        }[];
        materials: {
            id: string;
            name: string;
            createdAt: Date;
        }[];
        productConditions: {
            id: string;
            name: string;
            createdAt: Date;
        }[];
        warehouseTypes: {
            id: string;
            name: string;
            createdAt: Date;
        }[];
        storageZones: {
            id: string;
            name: string;
            maxCapacity: number;
            currentStock: number;
            createdAt: Date;
        }[];
    }>;
    getAllCategories(): Promise<{
        id: string;
        name: string;
        code: string;
    }[]>;
    createCategory(name: string): Promise<{
        id: string;
        name: string;
        code: string;
    }>;
    getAll(type: AttributeType): Promise<{
        id: string;
        name: string;
        createdAt: Date;
    }[] | {
        id: string;
        name: string;
        code: string;
    }[]>;
    create(type: AttributeType, name: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
    } | undefined>;
    deleteAttribute(type: AttributeType, id: string): Promise<{
        success: boolean;
        message: string;
    }>;
    getAllProductConditions(): Promise<{
        id: string;
        name: string;
        createdAt: Date;
    }[]>;
    createProductCondition(name: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
    }>;
    getAllStorageZones(): Promise<{
        id: string;
        name: string;
        maxCapacity: number;
        currentStock: number;
        createdAt: Date;
    }[]>;
    getAllWarehouseTypes(): Promise<{
        id: string;
        name: string;
        createdAt: Date;
    }[]>;
    createWarehouseType(name: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
    }>;
    createStorageZone(name: string, maxCapacity: number): Promise<{
        id: string;
        name: string;
        maxCapacity: number;
        currentStock: number;
        createdAt: Date;
    }>;
}
