import { PreliminaryCheckService } from './preliminary-check.service.js';
import { CreatePreliminaryCheckDto, PreliminaryCheckQueryDto, CompletePreliminaryCheckDto } from './dto/index.js';
export declare class PreliminaryCheckController {
    private readonly preliminaryCheckService;
    constructor(preliminaryCheckService: PreliminaryCheckService);
    create(dto: CreatePreliminaryCheckDto, currentUser: Record<string, unknown>): Promise<{
        warehouseType: {
            id: string;
            name: string;
            createdAt: Date;
        } | null;
        classification: {
            id: string;
            name: string;
            createdAt: Date;
        };
        creator: {
            id: string;
            email: string;
            name: string;
        };
    } & {
        id: string;
        classificationId: string;
        createdAt: Date;
        updatedAt: Date;
        quantity: number;
        imageUrl: string | null;
        note: string | null;
        status: import(".prisma/client").$Enums.PreliminaryCheckStatus;
        warehouseTypeId: string | null;
        createdBy: string;
    }>;
    findAll(query: PreliminaryCheckQueryDto): Promise<import("./preliminary-check.service.js").PaginatedResponse<unknown>>;
    findOne(id: string): Promise<{
        warehouseType: {
            id: string;
            name: string;
            createdAt: Date;
        } | null;
        classification: {
            id: string;
            name: string;
            createdAt: Date;
        };
        creator: {
            id: string;
            email: string;
            name: string;
        };
    } & {
        id: string;
        classificationId: string;
        createdAt: Date;
        updatedAt: Date;
        quantity: number;
        imageUrl: string | null;
        note: string | null;
        status: import(".prisma/client").$Enums.PreliminaryCheckStatus;
        warehouseTypeId: string | null;
        createdBy: string;
    }>;
    complete(id: string, dto: CompletePreliminaryCheckDto): Promise<{
        warehouseType: {
            id: string;
            name: string;
            createdAt: Date;
        } | null;
        classification: {
            id: string;
            name: string;
            createdAt: Date;
        };
        creator: {
            id: string;
            email: string;
            name: string;
        };
    } & {
        id: string;
        classificationId: string;
        createdAt: Date;
        updatedAt: Date;
        quantity: number;
        imageUrl: string | null;
        note: string | null;
        status: import(".prisma/client").$Enums.PreliminaryCheckStatus;
        warehouseTypeId: string | null;
        createdBy: string;
    }>;
}
