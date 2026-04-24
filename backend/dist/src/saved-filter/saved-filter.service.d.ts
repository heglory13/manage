import { SavedFilter } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
export declare class SavedFilterService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAll(userId: string, pageKey: string): Promise<SavedFilter[]>;
    create(userId: string, dto: {
        pageKey: string;
        name: string;
        filters: Record<string, unknown>;
    }): Promise<SavedFilter>;
    delete(id: string, userId: string): Promise<void>;
}
