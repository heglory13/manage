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
exports.ProductService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_js_1 = require("../prisma/prisma.service.js");
const sku_generator_service_js_1 = require("./sku-generator.service.js");
let ProductService = class ProductService {
    prisma;
    skuGenerator;
    constructor(prisma, skuGenerator) {
        this.prisma = prisma;
        this.skuGenerator = skuGenerator;
    }
    async create(dto) {
        if (!dto.name || dto.name.trim().length === 0) {
            throw new common_1.BadRequestException('Tên sản phẩm là bắt buộc');
        }
        const category = await this.prisma.category.findUnique({
            where: { id: dto.categoryId },
        });
        if (!category) {
            throw new common_1.NotFoundException('Category not found');
        }
        const createdAt = new Date();
        const sku = await this.skuGenerator.generateSku(category.code, createdAt);
        return this.prisma.product.create({
            data: {
                name: dto.name.trim(),
                sku,
                price: dto.price,
                categoryId: dto.categoryId,
                createdAt,
            },
            include: {
                category: true,
            },
        });
    }
    async findAll(query) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 10;
        const skip = (page - 1) * limit;
        const [data, total] = await Promise.all([
            this.prisma.product.findMany({
                skip,
                take: limit,
                include: {
                    category: true,
                },
                orderBy: {
                    createdAt: 'desc',
                },
            }),
            this.prisma.product.count(),
        ]);
        return {
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }
    async update(id, dto) {
        const product = await this.prisma.product.findUnique({ where: { id } });
        if (!product) {
            throw new common_1.NotFoundException('Product not found');
        }
        if (dto.name !== undefined && dto.name.trim().length === 0) {
            throw new common_1.BadRequestException('Tên sản phẩm là bắt buộc');
        }
        const updateData = {};
        if (dto.name !== undefined) {
            updateData.name = dto.name.trim();
        }
        if (dto.price !== undefined) {
            updateData.price = dto.price;
        }
        return this.prisma.product.update({
            where: { id },
            data: updateData,
            include: {
                category: true,
            },
        });
    }
    async delete(id) {
        const product = await this.prisma.product.findUnique({ where: { id } });
        if (!product) {
            throw new common_1.NotFoundException('Product not found');
        }
        await this.prisma.product.delete({ where: { id } });
    }
    async updateThreshold(id, minThreshold) {
        const product = await this.prisma.product.findUnique({ where: { id } });
        if (!product) {
            throw new common_1.NotFoundException('Product not found');
        }
        if (minThreshold < 0) {
            throw new common_1.BadRequestException('Ngưỡng Min phải là số không âm');
        }
        return this.prisma.product.update({
            where: { id },
            data: { minThreshold },
            include: { category: true },
        });
    }
    async toggleDiscontinued(id) {
        const product = await this.prisma.product.findUnique({ where: { id } });
        if (!product) {
            throw new common_1.NotFoundException('Product not found');
        }
        return this.prisma.product.update({
            where: { id },
            data: { isDiscontinued: !product.isDiscontinued },
            include: { category: true },
        });
    }
    async updateMaxThreshold(id, maxThreshold) {
        const product = await this.prisma.product.findUnique({ where: { id } });
        if (!product) {
            throw new common_1.NotFoundException('Product not found');
        }
        if (maxThreshold < 0) {
            throw new common_1.BadRequestException('Ngưỡng Max phải là số không âm');
        }
        return this.prisma.product.update({
            where: { id },
            data: { maxThreshold },
            include: { category: true },
        });
    }
};
exports.ProductService = ProductService;
exports.ProductService = ProductService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_js_1.PrismaService,
        sku_generator_service_js_1.SkuGeneratorService])
], ProductService);
//# sourceMappingURL=product.service.js.map