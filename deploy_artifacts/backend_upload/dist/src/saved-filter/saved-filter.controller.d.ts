import type { UserPayload } from '../auth/interfaces/index.js';
import { SavedFilterService } from './saved-filter.service.js';
import { CreateSavedFilterDto } from './dto/index.js';
export declare class SavedFilterController {
    private readonly savedFilterService;
    constructor(savedFilterService: SavedFilterService);
    findAll(user: UserPayload, pageKey: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        userId: string;
        pageKey: string;
        filters: import("@prisma/client/runtime/library").JsonValue;
    }[]>;
    create(user: UserPayload, dto: CreateSavedFilterDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        userId: string;
        pageKey: string;
        filters: import("@prisma/client/runtime/library").JsonValue;
    }>;
    delete(id: string, user: UserPayload): Promise<{
        message: string;
    }>;
}
