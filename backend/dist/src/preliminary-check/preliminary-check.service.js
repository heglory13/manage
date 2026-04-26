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
exports.PreliminaryCheckService = void 0;
const common_1 = require("@nestjs/common");
const index_1 = require("@prisma/client/index");
const prisma_service_js_1 = require("../prisma/prisma.service.js");
let PreliminaryCheckService = class PreliminaryCheckService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(dto, userId) {
        const classification = await this.prisma.classification.findUnique({
            where: { id: dto.classificationId },
        });
        if (!classification) {
            throw new common_1.NotFoundException('Phân loại hàng hoá không tồn tại');
        }
        if (dto.warehouseTypeId) {
            const warehouseType = await this.prisma.warehouseType.findUnique({
                where: { id: dto.warehouseTypeId },
            });
            if (!warehouseType) {
                throw new common_1.NotFoundException('Loại kho không tồn tại');
            }
        }
        return this.prisma.preliminaryCheck.create({
            data: {
                classificationId: dto.classificationId,
                quantity: dto.quantity,
                warehouseTypeId: dto.warehouseTypeId || null,
                imageUrl: dto.imageUrl || null,
                note: dto.note || null,
                status: index_1.PreliminaryCheckStatus.PENDING,
                createdBy: userId,
            },
            include: {
                classification: true,
                warehouseType: true,
                creator: {
                    select: { id: true, name: true, email: true },
                },
            },
        });
    }
    async findAll(filters) {
        const page = filters.page ?? 1;
        const limit = filters.limit ?? 10;
        const skip = (page - 1) * limit;
        const where = {};
        if (filters.status) {
            where.status = filters.status;
        }
        const [data, total] = await Promise.all([
            this.prisma.preliminaryCheck.findMany({
                where,
                skip,
                take: limit,
                include: {
                    classification: true,
                    warehouseType: true,
                    creator: {
                        select: { id: true, name: true, email: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.preliminaryCheck.count({ where }),
        ]);
        return {
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }
    async findOne(id) {
        const check = await this.prisma.preliminaryCheck.findUnique({
            where: { id },
            include: {
                classification: true,
                warehouseType: true,
                creator: {
                    select: { id: true, name: true, email: true },
                },
            },
        });
        if (!check) {
            throw new common_1.NotFoundException('Phiếu kiểm sơ bộ không tồn tại');
        }
        return check;
    }
    async complete(id, status) {
        const check = await this.prisma.preliminaryCheck.findUnique({
            where: { id },
        });
        if (!check) {
            throw new common_1.NotFoundException('Phiếu kiểm sơ bộ không tồn tại');
        }
        if (check.status !== index_1.PreliminaryCheckStatus.PENDING) {
            throw new common_1.NotFoundException('Phiếu đã được xử lý trước đó');
        }
        return this.prisma.preliminaryCheck.update({
            where: { id },
            data: { status: status },
            include: {
                classification: true,
                warehouseType: true,
                creator: {
                    select: { id: true, name: true, email: true },
                },
            },
        });
    }
};
exports.PreliminaryCheckService = PreliminaryCheckService;
exports.PreliminaryCheckService = PreliminaryCheckService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_js_1.PrismaService])
], PreliminaryCheckService);
//# sourceMappingURL=preliminary-check.service.js.map