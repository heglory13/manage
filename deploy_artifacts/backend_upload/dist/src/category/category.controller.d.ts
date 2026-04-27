import { PrismaService } from '../prisma/prisma.service.js';
export declare class CategoryController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAll(): Promise<{
        id: string;
        name: string;
        code: string;
    }[]>;
}
