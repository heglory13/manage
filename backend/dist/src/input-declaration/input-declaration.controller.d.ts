import { InputDeclarationService } from './input-declaration.service.js';
import { SkuComboService } from './sku-combo.service.js';
import { CreateAttributeDto, CreateStorageZoneDto, CreateSkuComboDto, SkuComboQueryDto } from './dto/index.js';
export declare class InputDeclarationController {
    private readonly inputDeclarationService;
    private readonly skuComboService;
    constructor(inputDeclarationService: InputDeclarationService, skuComboService: SkuComboService);
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
    getCategories(): Promise<{
        id: string;
        name: string;
        code: string;
    }[]>;
    createCategory(dto: CreateAttributeDto): Promise<{
        id: string;
        name: string;
        code: string;
    }>;
    deleteCategory(id: string): Promise<{
        success: boolean;
        message: string;
    }>;
    getClassifications(): Promise<{
        id: string;
        name: string;
        createdAt: Date;
    }[] | {
        id: string;
        name: string;
        code: string;
    }[]>;
    createClassification(dto: CreateAttributeDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
    } | undefined>;
    deleteClassification(id: string): Promise<{
        success: boolean;
        message: string;
    }>;
    getColors(): Promise<{
        id: string;
        name: string;
        createdAt: Date;
    }[] | {
        id: string;
        name: string;
        code: string;
    }[]>;
    createColor(dto: CreateAttributeDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
    } | undefined>;
    deleteColor(id: string): Promise<{
        success: boolean;
        message: string;
    }>;
    getSizes(): Promise<{
        id: string;
        name: string;
        createdAt: Date;
    }[] | {
        id: string;
        name: string;
        code: string;
    }[]>;
    createSize(dto: CreateAttributeDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
    } | undefined>;
    deleteSize(id: string): Promise<{
        success: boolean;
        message: string;
    }>;
    getMaterials(): Promise<{
        id: string;
        name: string;
        createdAt: Date;
    }[] | {
        id: string;
        name: string;
        code: string;
    }[]>;
    createMaterial(dto: CreateAttributeDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
    } | undefined>;
    deleteMaterial(id: string): Promise<{
        success: boolean;
        message: string;
    }>;
    getProductConditions(): Promise<{
        id: string;
        name: string;
        createdAt: Date;
    }[]>;
    createProductCondition(dto: CreateAttributeDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
    }>;
    deleteProductCondition(id: string): Promise<{
        success: boolean;
        message: string;
    }>;
    getWarehouseTypes(): Promise<{
        id: string;
        name: string;
        createdAt: Date;
    }[]>;
    createWarehouseType(dto: CreateAttributeDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
    }>;
    deleteWarehouseType(id: string): Promise<{
        success: boolean;
        message: string;
    }>;
    getStorageZones(): Promise<{
        id: string;
        name: string;
        maxCapacity: number;
        currentStock: number;
        createdAt: Date;
    }[]>;
    createStorageZone(dto: CreateStorageZoneDto): Promise<{
        id: string;
        name: string;
        maxCapacity: number;
        currentStock: number;
        createdAt: Date;
    }>;
    deleteStorageZone(id: string): Promise<{
        success: boolean;
        message: string;
    }>;
    getSkuCombos(query: SkuComboQueryDto): Promise<import("./sku-combo.service.js").PaginatedResponse<unknown>>;
    createSkuCombo(dto: CreateSkuComboDto): Promise<{
        classification: {
            id: string;
            name: string;
            createdAt: Date;
        };
        color: {
            id: string;
            name: string;
            createdAt: Date;
        };
        size: {
            id: string;
            name: string;
            createdAt: Date;
        };
        material: {
            id: string;
            name: string;
            createdAt: Date;
        };
    } & {
        id: string;
        classificationId: string;
        colorId: string;
        sizeId: string;
        materialId: string;
        compositeSku: string;
        createdAt: Date;
    }>;
    deleteSkuCombo(id: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
