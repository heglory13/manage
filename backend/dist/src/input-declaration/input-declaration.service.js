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
exports.InputDeclarationService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_js_1 = require("../prisma/prisma.service.js");
const DUPLICATE_MESSAGES = {
    classification: 'Phân loại này đã tồn tại',
    color: 'Màu sắc này đã tồn tại',
    size: 'Size này đã tồn tại',
    material: 'Chất liệu này đã tồn tại',
    productCondition: 'Tình trạng hàng hoá này đã tồn tại',
    storageZone: 'Khu vực hàng hoá này đã tồn tại',
    warehouseType: 'Loại kho này đã tồn tại',
    category: 'Danh mục này đã tồn tại',
};
const TABLE_MESSAGES = {
    classification: 'Phân loại',
    color: 'Màu sắc',
    size: 'Size',
    material: 'Chất liệu',
    productCondition: 'Tình trạng hàng hoá',
    storageZone: 'Khu vực hàng hoá',
    warehouseType: 'Loại kho',
    category: 'Danh mục',
};
let InputDeclarationService = class InputDeclarationService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getAllDeclarations() {
        const [categories, classifications, colors, sizes, materials, productConditions, warehouseTypes, storageZones] = await Promise.all([
            this.prisma.category.findMany({ orderBy: { name: 'asc' } }),
            this.prisma.classification.findMany({ orderBy: { createdAt: 'desc' } }),
            this.prisma.color.findMany({ orderBy: { createdAt: 'desc' } }),
            this.prisma.size.findMany({ orderBy: { createdAt: 'desc' } }),
            this.prisma.material.findMany({ orderBy: { createdAt: 'desc' } }),
            this.prisma.productCondition.findMany({ orderBy: { createdAt: 'desc' } }),
            this.prisma.warehouseType.findMany({ orderBy: { createdAt: 'desc' } }),
            this.prisma.storageZone.findMany({ orderBy: { createdAt: 'desc' } }),
        ]);
        return {
            categories,
            classifications,
            colors,
            sizes,
            materials,
            productConditions,
            warehouseTypes,
            storageZones,
        };
    }
    async getAllCategories() {
        return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
    }
    async createCategory(name) {
        const trimmed = name.trim();
        if (!trimmed) {
            throw new common_1.BadRequestException('Tên không được để trống');
        }
        const existing = await this.prisma.category.findFirst({
            where: { name: { equals: trimmed, mode: 'insensitive' } },
        });
        if (existing) {
            throw new common_1.ConflictException('Danh mục này đã tồn tại');
        }
        const code = trimmed
            .toUpperCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '_')
            .replace(/[^A-Z0-9_]/g, '');
        return this.prisma.category.create({
            data: { name: trimmed, code: code || trimmed.toUpperCase().replace(/\s+/g, '_') },
        });
    }
    async getAll(type) {
        switch (type) {
            case 'classification':
                return this.prisma.classification.findMany({ orderBy: { createdAt: 'desc' } });
            case 'color':
                return this.prisma.color.findMany({ orderBy: { createdAt: 'desc' } });
            case 'size':
                return this.prisma.size.findMany({ orderBy: { createdAt: 'desc' } });
            case 'material':
                return this.prisma.material.findMany({ orderBy: { createdAt: 'desc' } });
            case 'productCondition':
                return this.prisma.productCondition.findMany({ orderBy: { createdAt: 'desc' } });
            case 'storageZone':
                return this.prisma.storageZone.findMany({ orderBy: { createdAt: 'desc' } });
            case 'warehouseType':
                return this.prisma.warehouseType.findMany({ orderBy: { createdAt: 'desc' } });
            case 'category':
                return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
        }
    }
    async create(type, name) {
        const trimmed = name.trim();
        if (!trimmed) {
            throw new common_1.BadRequestException('Tên không được để trống');
        }
        let existing = null;
        switch (type) {
            case 'classification':
                existing = await this.prisma.classification.findFirst({
                    where: { name: { equals: trimmed, mode: 'insensitive' } },
                });
                break;
            case 'color':
                existing = await this.prisma.color.findFirst({
                    where: { name: { equals: trimmed, mode: 'insensitive' } },
                });
                break;
            case 'size':
                existing = await this.prisma.size.findFirst({
                    where: { name: { equals: trimmed, mode: 'insensitive' } },
                });
                break;
            case 'material':
                existing = await this.prisma.material.findFirst({
                    where: { name: { equals: trimmed, mode: 'insensitive' } },
                });
                break;
        }
        if (existing) {
            throw new common_1.ConflictException(DUPLICATE_MESSAGES[type]);
        }
        switch (type) {
            case 'classification':
                return this.prisma.classification.create({ data: { name: trimmed } });
            case 'color':
                return this.prisma.color.create({ data: { name: trimmed } });
            case 'size':
                return this.prisma.size.create({ data: { name: trimmed } });
            case 'material':
                return this.prisma.material.create({ data: { name: trimmed } });
        }
    }
    async deleteAttribute(type, id) {
        let record = null;
        switch (type) {
            case 'classification':
                record = await this.prisma.classification.findUnique({ where: { id } });
                if (record) {
                    await this.prisma.classification.delete({ where: { id } });
                }
                break;
            case 'color':
                record = await this.prisma.color.findUnique({ where: { id } });
                if (record) {
                    await this.prisma.color.delete({ where: { id } });
                }
                break;
            case 'size':
                record = await this.prisma.size.findUnique({ where: { id } });
                if (record) {
                    await this.prisma.size.delete({ where: { id } });
                }
                break;
            case 'material':
                record = await this.prisma.material.findUnique({ where: { id } });
                if (record) {
                    await this.prisma.material.delete({ where: { id } });
                }
                break;
            case 'productCondition':
                record = await this.prisma.productCondition.findUnique({ where: { id } });
                if (record) {
                    await this.prisma.productCondition.delete({ where: { id } });
                }
                break;
            case 'storageZone':
                record = await this.prisma.storageZone.findUnique({ where: { id } });
                if (record) {
                    await this.prisma.storageZone.delete({ where: { id } });
                }
                break;
            case 'warehouseType':
                record = await this.prisma.warehouseType.findUnique({ where: { id } });
                if (record) {
                    await this.prisma.warehouseType.delete({ where: { id } });
                }
                break;
            case 'category':
                record = await this.prisma.category.findUnique({ where: { id } });
                if (record) {
                    await this.prisma.category.delete({ where: { id } });
                }
                break;
        }
        if (!record) {
            throw new common_1.NotFoundException(`${TABLE_MESSAGES[type]} không tồn tại`);
        }
        return { success: true, message: `${TABLE_MESSAGES[type]} đã được xóa` };
    }
    async getAllProductConditions() {
        return this.prisma.productCondition.findMany({
            orderBy: { createdAt: 'desc' },
        });
    }
    async createProductCondition(name) {
        const trimmed = name.trim();
        if (!trimmed) {
            throw new common_1.BadRequestException('Tên không được để trống');
        }
        const existing = await this.prisma.productCondition.findFirst({
            where: { name: { equals: trimmed, mode: 'insensitive' } },
        });
        if (existing) {
            throw new common_1.ConflictException('Tình trạng hàng hoá này đã tồn tại');
        }
        return this.prisma.productCondition.create({ data: { name: trimmed } });
    }
    async getAllStorageZones() {
        return this.prisma.storageZone.findMany({
            orderBy: { createdAt: 'desc' },
        });
    }
    async getAllWarehouseTypes() {
        return this.prisma.warehouseType.findMany({
            orderBy: { createdAt: 'desc' },
        });
    }
    async createWarehouseType(name) {
        const trimmed = name.trim();
        if (!trimmed) {
            throw new common_1.BadRequestException('Tên không được để trống');
        }
        const existing = await this.prisma.warehouseType.findFirst({
            where: { name: { equals: trimmed, mode: 'insensitive' } },
        });
        if (existing) {
            throw new common_1.ConflictException('Loại kho này đã tồn tại');
        }
        return this.prisma.warehouseType.create({ data: { name: trimmed } });
    }
    async createStorageZone(name, maxCapacity) {
        const trimmed = name.trim();
        if (!trimmed) {
            throw new common_1.BadRequestException('Tên không được để trống');
        }
        if (maxCapacity <= 0) {
            throw new common_1.BadRequestException('Sức chứa tối đa phải lớn hơn 0');
        }
        const existing = await this.prisma.storageZone.findFirst({
            where: { name: { equals: trimmed, mode: 'insensitive' } },
        });
        if (existing) {
            throw new common_1.ConflictException('Khu vực hàng hoá này đã tồn tại');
        }
        return this.prisma.storageZone.create({
            data: { name: trimmed, maxCapacity },
        });
    }
};
exports.InputDeclarationService = InputDeclarationService;
exports.InputDeclarationService = InputDeclarationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_js_1.PrismaService])
], InputDeclarationService);
//# sourceMappingURL=input-declaration.service.js.map