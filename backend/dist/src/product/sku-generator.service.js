"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkuGeneratorService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_js_1 = require("../prisma/prisma.service.js");
const DIACRITICS_MAP = {
    à: 'a', á: 'a', ả: 'a', ã: 'a', ạ: 'a',
    ă: 'a', ằ: 'a', ắ: 'a', ẳ: 'a', ẵ: 'a', ặ: 'a',
    â: 'a', ầ: 'a', ấ: 'a', ẩ: 'a', ẫ: 'a', ậ: 'a',
    è: 'e', é: 'e', ẻ: 'e', ẽ: 'e', ẹ: 'e',
    ê: 'e', ề: 'e', ế: 'e', ể: 'e', ễ: 'e', ệ: 'e',
    ì: 'i', í: 'i', ỉ: 'i', ĩ: 'i', ị: 'i',
    ò: 'o', ó: 'o', ỏ: 'o', õ: 'o', ọ: 'o',
    ô: 'o', ồ: 'o', ố: 'o', ổ: 'o', ỗ: 'o', ộ: 'o',
    ơ: 'o', ờ: 'o', ớ: 'o', ở: 'o', ỡ: 'o', ợ: 'o',
    ù: 'u', ú: 'u', ủ: 'u', ũ: 'u', ụ: 'u',
    ư: 'u', ừ: 'u', ứ: 'u', ử: 'u', ữ: 'u', ự: 'u',
    ỳ: 'y', ý: 'y', ỷ: 'y', ỹ: 'y', ỵ: 'y',
    đ: 'd',
};
let SkuGeneratorService = class SkuGeneratorService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    removeDiacritics(text) {
        let result = '';
        const lower = text.toLowerCase();
        for (const char of lower) {
            if (DIACRITICS_MAP[char]) {
                result += DIACRITICS_MAP[char];
            }
            else if (/[a-z0-9]/.test(char)) {
                result += char;
            }
        }
        return result.toUpperCase();
    }
    async generateSku(categoryName, createdAt) {
        const categoryCode = this.removeDiacritics(categoryName);
        const dateStr = this.formatDate(createdAt);
        const prefix = `${categoryCode}-`;
        const existingProducts = await this.prisma.product.findMany({
            where: {
                sku: { startsWith: prefix },
            },
            select: { sku: true },
            orderBy: { sku: 'desc' },
        });
        let nextId = 1;
        if (existingProducts.length > 0) {
            for (const product of existingProducts) {
                const parsed = this.parseSku(product.sku);
                const id = parseInt(parsed.id, 10);
                if (id >= nextId) {
                    nextId = id + 1;
                }
            }
        }
        let sku;
        do {
            const idStr = String(nextId).padStart(3, '0');
            sku = this.formatSku({ category: categoryCode, id: idStr, date: dateStr });
            const existing = await this.prisma.product.findUnique({
                where: { sku },
            });
            if (!existing)
                break;
            nextId++;
        } while (true);
        return sku;
    }
    parseSku(sku) {
        const lastDashIndex = sku.lastIndexOf('-');
        const date = sku.substring(lastDashIndex + 1);
        const rest = sku.substring(0, lastDashIndex);
        const secondLastDashIndex = rest.lastIndexOf('-');
        const category = rest.substring(0, secondLastDashIndex);
        const id = rest.substring(secondLastDashIndex + 1);
        return { category, id, date };
    }
    formatSku(components) {
        return `${components.category}-${components.id}-${components.date}`;
    }
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
    }
};
exports.SkuGeneratorService = SkuGeneratorService;
exports.SkuGeneratorService = SkuGeneratorService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_js_1.PrismaService])
], SkuGeneratorService);
//# sourceMappingURL=sku-generator.service.js.map