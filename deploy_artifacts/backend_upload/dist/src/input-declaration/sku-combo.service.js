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
exports.SkuComboService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_js_1 = require("../prisma/prisma.service.js");
let SkuComboService = class SkuComboService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    generateCompositeSku(classificationName, colorName, sizeName, materialName) {
        return `${classificationName}-${colorName}-${sizeName}-${materialName}`;
    }
    async create(dto) {
        const [classification, color, size, material] = await Promise.all([
            this.prisma.classification.findUnique({
                where: { id: dto.classificationId },
            }),
            this.prisma.color.findUnique({ where: { id: dto.colorId } }),
            this.prisma.size.findUnique({ where: { id: dto.sizeId } }),
            this.prisma.material.findUnique({ where: { id: dto.materialId } }),
        ]);
        if (!classification) {
            throw new common_1.NotFoundException('Không tìm thấy phân loại');
        }
        if (!color) {
            throw new common_1.NotFoundException('Không tìm thấy màu sắc');
        }
        if (!size) {
            throw new common_1.NotFoundException('Không tìm thấy size');
        }
        if (!material) {
            throw new common_1.NotFoundException('Không tìm thấy chất liệu');
        }
        const existingCombo = await this.prisma.skuCombo.findUnique({
            where: {
                classificationId_colorId_sizeId_materialId: {
                    classificationId: dto.classificationId,
                    colorId: dto.colorId,
                    sizeId: dto.sizeId,
                    materialId: dto.materialId,
                },
            },
        });
        if (existingCombo) {
            throw new common_1.ConflictException('Tổ hợp SKU này đã tồn tại');
        }
        const compositeSku = this.generateCompositeSku(classification.name, color.name, size.name, material.name);
        return this.prisma.skuCombo.create({
            data: {
                classificationId: dto.classificationId,
                colorId: dto.colorId,
                sizeId: dto.sizeId,
                materialId: dto.materialId,
                compositeSku,
            },
            include: {
                classification: true,
                color: true,
                size: true,
                material: true,
            },
        });
    }
    async getAll(query) {
        const page = query.page ? parseInt(query.page, 10) : 1;
        const limit = query.limit ? parseInt(query.limit, 10) : 10;
        const skip = (page - 1) * limit;
        const where = {};
        if (query.search) {
            where.OR = [
                {
                    compositeSku: {
                        contains: query.search,
                    },
                },
                {
                    classification: {
                        name: { contains: query.search },
                    },
                },
                {
                    color: {
                        name: { contains: query.search },
                    },
                },
                {
                    size: {
                        name: { contains: query.search },
                    },
                },
                {
                    material: {
                        name: { contains: query.search },
                    },
                },
            ];
        }
        const [data, total] = await Promise.all([
            this.prisma.skuCombo.findMany({
                where,
                skip,
                take: limit,
                include: {
                    classification: true,
                    color: true,
                    size: true,
                    material: true,
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.skuCombo.count({ where }),
        ]);
        return {
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }
    async delete(id) {
        const existing = await this.prisma.skuCombo.findUnique({ where: { id } });
        if (!existing) {
            throw new common_1.NotFoundException('SKU combo không tồn tại');
        }
        await this.prisma.skuCombo.delete({ where: { id } });
        return { success: true, message: 'SKU combo đã được xóa' };
    }
};
exports.SkuComboService = SkuComboService;
exports.SkuComboService = SkuComboService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_js_1.PrismaService])
], SkuComboService);
//# sourceMappingURL=sku-combo.service.js.map