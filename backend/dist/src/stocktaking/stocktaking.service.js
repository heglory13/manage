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
exports.StocktakingService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_js_1 = require("../prisma/prisma.service.js");
let StocktakingService = class StocktakingService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    calculateDiscrepancies(items) {
        return items.map((item) => ({
            ...item,
            discrepancy: item.actualQuantity - item.systemQuantity,
        }));
    }
    validateDiscrepancyReasons(items) {
        const missingReason = items.some((item) => item.discrepancy !== 0 && (!item.discrepancyReason || item.discrepancyReason.trim() === ''));
        if (missingReason) {
            return {
                valid: false,
                message: 'Vui lòng điền nguyên nhân chênh lệch cho tất cả các dòng có sai lệch',
            };
        }
        return { valid: true };
    }
    validateEvidence(items) {
        const missingEvidence = items.some((item) => item.discrepancy !== 0 && !item.evidenceUrl);
        if (missingEvidence) {
            return {
                valid: false,
                message: 'Yêu cầu đính kèm ảnh/file minh chứng cho các sản phẩm có sai lệch',
            };
        }
        return { valid: true };
    }
    async create(mode, userId, productIds) {
        if (mode === 'selected' && (!productIds || productIds.length === 0)) {
            throw new common_1.BadRequestException('Vui lòng chọn ít nhất một sản phẩm khi kiểm kê theo danh sách');
        }
        const where = mode === 'selected' ? { id: { in: productIds } } : {};
        const products = await this.prisma.product.findMany({ where });
        if (products.length === 0) {
            throw new common_1.BadRequestException('Không tìm thấy sản phẩm nào');
        }
        const cutoffTime = new Date();
        const record = await this.prisma.stocktakingRecord.create({
            data: {
                createdBy: userId,
                status: client_1.StocktakingStatus.CHECKING,
                mode,
                cutoffTime,
                items: {
                    create: products.map((product) => ({
                        productId: product.id,
                        systemQuantity: product.stock,
                        actualQuantity: 0,
                        discrepancy: 0,
                    })),
                },
            },
            include: {
                items: {
                    include: { product: true },
                },
                creator: {
                    select: { id: true, name: true, email: true, role: true },
                },
            },
        });
        await this.recordStatusChange(record.id, client_1.StocktakingStatus.CHECKING, userId);
        return record;
    }
    async submit(id, items, userId) {
        const record = await this.prisma.stocktakingRecord.findUnique({
            where: { id },
            include: { items: true },
        });
        if (!record) {
            throw new common_1.NotFoundException('Biên bản kiểm kê không tồn tại');
        }
        if (record.status !== client_1.StocktakingStatus.CHECKING) {
            throw new common_1.BadRequestException('Chỉ có thể submit biên bản ở trạng thái Đang kiểm kê');
        }
        const submittedMap = new Map(items.map((i) => [i.itemId, i]));
        const updatedItems = record.items.map((existingItem) => {
            const submitted = submittedMap.get(existingItem.id);
            if (!submitted) {
                return existingItem;
            }
            const discrepancy = submitted.actualQuantity - existingItem.systemQuantity;
            return {
                ...existingItem,
                actualQuantity: submitted.actualQuantity,
                discrepancy,
                discrepancyReason: submitted.discrepancyReason || null,
                evidenceUrl: submitted.evidenceUrl || existingItem.evidenceUrl,
            };
        });
        const validation = this.validateDiscrepancyReasons(updatedItems);
        if (!validation.valid) {
            throw new common_1.BadRequestException(validation.message);
        }
        const updateOps = updatedItems.map((item) => {
            const submitted = submittedMap.get(item.id);
            if (!submitted)
                return null;
            return this.prisma.stocktakingItem.update({
                where: { id: item.id },
                data: {
                    actualQuantity: submitted.actualQuantity,
                    discrepancy: submitted.actualQuantity - item.systemQuantity,
                    discrepancyReason: submitted.discrepancyReason || null,
                    evidenceUrl: submitted.evidenceUrl || undefined,
                },
            });
        }).filter(Boolean);
        const submittedAt = new Date();
        await this.prisma.$transaction([
            ...updateOps,
            this.prisma.stocktakingRecord.update({
                where: { id },
                data: {
                    status: client_1.StocktakingStatus.PENDING,
                    submittedAt,
                },
            }),
        ]);
        await this.recordStatusChange(id, client_1.StocktakingStatus.PENDING, userId);
        return this.prisma.stocktakingRecord.findUnique({
            where: { id },
            include: {
                items: { include: { product: true } },
                creator: {
                    select: { id: true, name: true, email: true, role: true },
                },
            },
        });
    }
    async approve(id, userId) {
        const record = await this.prisma.stocktakingRecord.findUnique({
            where: { id },
            include: { items: true },
        });
        if (!record) {
            throw new common_1.NotFoundException('Biên bản kiểm kê không tồn tại');
        }
        if (record.status !== client_1.StocktakingStatus.PENDING) {
            throw new common_1.BadRequestException('Chỉ có thể phê duyệt biên bản ở trạng thái Chờ duyệt');
        }
        const updateOperations = record.items.map((item) => this.prisma.product.update({
            where: { id: item.productId },
            data: { stock: item.actualQuantity },
        }));
        const [updatedRecord] = await this.prisma.$transaction([
            this.prisma.stocktakingRecord.update({
                where: { id },
                data: { status: client_1.StocktakingStatus.APPROVED },
                include: {
                    items: { include: { product: true } },
                    creator: {
                        select: { id: true, name: true, email: true, role: true },
                    },
                },
            }),
            ...updateOperations,
        ]);
        await this.recordStatusChange(id, client_1.StocktakingStatus.APPROVED, userId);
        return updatedRecord;
    }
    async reject(id, userId, note) {
        const record = await this.prisma.stocktakingRecord.findUnique({
            where: { id },
        });
        if (!record) {
            throw new common_1.NotFoundException('Biên bản kiểm kê không tồn tại');
        }
        if (record.status !== client_1.StocktakingStatus.PENDING) {
            throw new common_1.BadRequestException('Chỉ có thể từ chối biên bản ở trạng thái Chờ duyệt');
        }
        const updatedRecord = await this.prisma.stocktakingRecord.update({
            where: { id },
            data: { status: client_1.StocktakingStatus.REJECTED },
            include: {
                items: { include: { product: true } },
                creator: {
                    select: { id: true, name: true, email: true, role: true },
                },
            },
        });
        await this.recordStatusChange(id, client_1.StocktakingStatus.REJECTED, userId, note);
        return updatedRecord;
    }
    async recordStatusChange(recordId, status, changedBy, note) {
        return this.prisma.stocktakingStatusHistory.create({
            data: {
                recordId,
                status,
                changedBy: changedBy || null,
                note: note || null,
            },
        });
    }
    async getStatusHistory(recordId) {
        const record = await this.prisma.stocktakingRecord.findUnique({
            where: { id: recordId },
        });
        if (!record) {
            throw new common_1.NotFoundException('Biên bản kiểm kê không tồn tại');
        }
        return this.prisma.stocktakingStatusHistory.findMany({
            where: { recordId },
            orderBy: { changedAt: 'asc' },
        });
    }
    async findOne(id) {
        const record = await this.prisma.stocktakingRecord.findUnique({
            where: { id },
            include: {
                items: {
                    include: {
                        product: true,
                    },
                    orderBy: {
                        product: {
                            sku: 'asc',
                        },
                    },
                },
                creator: {
                    select: { id: true, name: true, email: true, role: true },
                },
                statusHistory: {
                    orderBy: { changedAt: 'asc' },
                },
            },
        });
        if (!record) {
            throw new common_1.NotFoundException('Biên bản kiểm kê không tồn tại');
        }
        return record;
    }
    async updateItem(itemId, dto) {
        const item = await this.prisma.stocktakingItem.findUnique({
            where: { id: itemId },
            include: {
                record: true,
            },
        });
        if (!item) {
            throw new common_1.NotFoundException('Dòng kiểm kê không tồn tại');
        }
        if (item.record.status !== client_1.StocktakingStatus.CHECKING) {
            throw new common_1.BadRequestException('Chỉ có thể cập nhật khi biên bản đang ở trạng thái kiểm kê');
        }
        const discrepancy = dto.actualQuantity - item.systemQuantity;
        return this.prisma.stocktakingItem.update({
            where: { id: itemId },
            data: {
                actualQuantity: dto.actualQuantity,
                discrepancy,
                discrepancyReason: dto.discrepancyReason || null,
                evidenceUrl: dto.evidenceUrl || null,
            },
            include: {
                product: true,
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
        if (filters.startDate || filters.endDate) {
            const createdAt = {};
            if (filters.startDate) {
                createdAt.gte = new Date(filters.startDate);
            }
            if (filters.endDate) {
                createdAt.lte = new Date(filters.endDate);
            }
            where.createdAt = createdAt;
        }
        const [data, total] = await Promise.all([
            this.prisma.stocktakingRecord.findMany({
                where,
                skip,
                take: limit,
                include: {
                    items: { include: { product: true } },
                    creator: {
                        select: { id: true, name: true, email: true, role: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.stocktakingRecord.count({ where }),
        ]);
        return {
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }
};
exports.StocktakingService = StocktakingService;
exports.StocktakingService = StocktakingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_js_1.PrismaService])
], StocktakingService);
//# sourceMappingURL=stocktaking.service.js.map