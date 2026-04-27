import { PrismaService } from '../prisma/prisma.service.js';
export interface SkuComponents {
    category: string;
    id: string;
    date: string;
}
export declare class SkuGeneratorService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    removeDiacritics(text: string): string;
    generateSku(categoryName: string, createdAt: Date): Promise<string>;
    parseSku(sku: string): SkuComponents;
    formatSku(components: SkuComponents): string;
    private formatDate;
}
