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
exports.InventoryService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_js_1 = require("../prisma/prisma.service.js");
let InventoryService = class InventoryService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    computeBusinessStatus(product) {
        if (product.isDiscontinued)
            return 'NGUNG_KD';
        if (product.stock === 0)
            return 'HET_HANG';
        if (product.stock < product.minThreshold)
            return 'SAP_HET';
        return 'CON_HANG';
    }
    async stockIn(productId, quantity, userId, options) {
        if (quantity <= 0) {
            throw new common_1.BadRequestException('Số lượng nhập kho phải lớn hơn 0');
        }
        const product = await this.prisma.product.findUnique({
            where: { id: productId },
        });
        if (!product) {
            throw new common_1.NotFoundException('Sản phẩm không tồn tại');
        }
        const storageZoneId = options?.storageZoneId;
        if (storageZoneId) {
            const zone = await this.prisma.storageZone.findUnique({
                where: { id: storageZoneId },
            });
            if (!zone) {
                throw new common_1.NotFoundException('Khu vực hàng hoá không tồn tại');
            }
            const remaining = zone.maxCapacity - zone.currentStock;
            if (remaining <= 0) {
                throw new common_1.BadRequestException('Khu vực này đã đầy, không thể nhập thêm hàng');
            }
            if (quantity > remaining) {
                throw new common_1.BadRequestException(`Chỉ được nhập tối đa ${remaining}`);
            }
        }
        const actualStockDate = options?.actualStockDate
            ? new Date(options.actualStockDate)
            : new Date();
        const transactionOps = [
            this.prisma.product.update({
                where: { id: productId },
                data: { stock: { increment: quantity } },
            }),
            this.prisma.inventoryTransaction.create({
                data: {
                    productId,
                    type: client_1.TransactionType.STOCK_IN,
                    quantity,
                    userId,
                    skuComboId: options?.skuComboId,
                    productConditionId: options?.productConditionId,
                    storageZoneId,
                    warehousePositionId: options?.warehousePositionId,
                    preliminaryCheckId: options?.preliminaryCheckId,
                    actualStockDate,
                    notes: options?.notes,
                },
            }),
        ];
        const warehousePositionId = options?.warehousePositionId;
        if (warehousePositionId) {
            const position = await this.prisma.warehousePosition.findUnique({
                where: { id: warehousePositionId },
            });
            if (!position) {
                throw new common_1.NotFoundException('Vị trí kho không tồn tại');
            }
            if (position.maxCapacity !== null) {
                const remaining = position.maxCapacity - position.currentStock;
                if (remaining <= 0) {
                    throw new common_1.BadRequestException('Vị trí này đã đầy, không thể nhập thêm hàng');
                }
                if (quantity > remaining) {
                    throw new common_1.BadRequestException(`Chỉ cho phép nhập tối đa ${remaining}`);
                }
            }
            transactionOps.push(this.prisma.warehousePosition.update({
                where: { id: warehousePositionId },
                data: { currentStock: { increment: quantity } },
            }));
        }
        if (storageZoneId) {
            transactionOps.push(this.prisma.storageZone.update({
                where: { id: storageZoneId },
                data: { currentStock: { increment: quantity } },
            }));
        }
        if (options?.preliminaryCheckId) {
            transactionOps.push(this.prisma.preliminaryCheck.update({
                where: { id: options.preliminaryCheckId },
                data: { status: 'COMPLETED' },
            }));
        }
        const results = await this.prisma.$transaction(transactionOps);
        return results[1];
    }
    async stockOut(productId, quantity, userId, options) {
        if (quantity <= 0) {
            throw new common_1.BadRequestException('Số lượng xuất kho phải lớn hơn 0');
        }
        const product = await this.prisma.product.findUnique({
            where: { id: productId },
        });
        if (!product) {
            throw new common_1.NotFoundException('Sản phẩm không tồn tại');
        }
        if (quantity > product.stock) {
            throw new common_1.BadRequestException('Không thể xuất quá số lượng tồn kho hiện tại');
        }
        const storageZoneId = options?.storageZoneId;
        const warehousePositionId = options?.warehousePositionId;
        if (warehousePositionId) {
            const position = await this.prisma.warehousePosition.findUnique({
                where: { id: warehousePositionId },
            });
            if (!position) {
                throw new common_1.NotFoundException('Vị trí kho không tồn tại');
            }
            if (quantity > position.currentStock) {
                throw new common_1.BadRequestException('Không thể xuất quá số lượng hiện có tại vị trí kho đã chọn');
            }
        }
        const transactionOps = [
            this.prisma.product.update({
                where: { id: productId },
                data: { stock: { decrement: quantity } },
            }),
            this.prisma.inventoryTransaction.create({
                data: {
                    productId,
                    type: client_1.TransactionType.STOCK_OUT,
                    quantity,
                    userId,
                    skuComboId: options?.skuComboId,
                    productConditionId: options?.productConditionId,
                    storageZoneId,
                    warehousePositionId,
                    notes: options?.notes,
                },
            }),
        ];
        if (storageZoneId) {
            transactionOps.push(this.prisma.storageZone.update({
                where: { id: storageZoneId },
                data: { currentStock: { decrement: quantity } },
            }));
        }
        if (warehousePositionId) {
            transactionOps.push(this.prisma.warehousePosition.update({
                where: { id: warehousePositionId },
                data: { currentStock: { decrement: quantity } },
            }));
        }
        const results = await this.prisma.$transaction(transactionOps);
        return results[1];
    }
    async adjustStock(productId, quantity, type, userId, options) {
        const adjustmentNote = options?.reason
            ? `[ADJUSTMENT] ${options.reason}`
            : '[ADJUSTMENT]';
        if (type === 'INCREASE') {
            return this.stockIn(productId, quantity, userId, {
                warehousePositionId: options?.warehousePositionId,
                notes: adjustmentNote,
            });
        }
        return this.stockOut(productId, quantity, userId, {
            warehousePositionId: options?.warehousePositionId,
            notes: adjustmentNote,
        });
    }
    async getTransactionHistory(filters) {
        const page = filters.page ?? 1;
        const limit = filters.limit ?? 20;
        const skip = (page - 1) * limit;
        const transactions = await this.prisma.inventoryTransaction.findMany({
            include: {
                product: true,
                user: {
                    select: {
                        name: true,
                    },
                },
                warehousePosition: {
                    select: {
                        label: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
        const mapped = transactions.map((transaction) => {
            const isAdjustment = transaction.notes?.startsWith('[ADJUSTMENT]') ?? false;
            const note = isAdjustment
                ? transaction.notes?.replace('[ADJUSTMENT]', '').trim() || ''
                : transaction.notes || '';
            const kind = isAdjustment
                ? 'ADJUSTMENT'
                : transaction.type === client_1.TransactionType.STOCK_IN
                    ? 'STOCK_IN'
                    : 'STOCK_OUT';
            return {
                id: transaction.id,
                createdAt: transaction.createdAt.toISOString(),
                actualStockDate: transaction.actualStockDate?.toISOString() ?? null,
                kind,
                type: transaction.type,
                quantity: transaction.quantity,
                signedQuantity: transaction.type === client_1.TransactionType.STOCK_IN
                    ? transaction.quantity
                    : -transaction.quantity,
                productName: transaction.product.name,
                productSku: transaction.product.sku,
                positionLabel: transaction.warehousePosition?.label ?? null,
                userName: transaction.user.name,
                note,
            };
        });
        const normalizedKind = (filters.kind ?? 'ALL').toUpperCase();
        const filtered = normalizedKind === 'ALL'
            ? mapped
            : mapped.filter((item) => item.kind === normalizedKind);
        const paged = filtered.slice(skip, skip + limit);
        return {
            data: paged,
            total: filtered.length,
            page,
            limit,
            totalPages: Math.ceil(filtered.length / limit) || 1,
        };
    }
    async getInventory(filters) {
        const { categoryId, startDate, endDate, positionId } = filters;
        const hasFilter = categoryId || startDate || endDate || positionId;
        if (!hasFilter) {
            throw new common_1.BadRequestException('Vui lòng chọn ít nhất một điều kiện lọc');
        }
        const page = filters.page ?? 1;
        const limit = filters.limit ?? 10;
        const skip = (page - 1) * limit;
        const where = {};
        if (categoryId) {
            where.categoryId = categoryId;
        }
        if (startDate || endDate) {
            const createdAt = {};
            if (startDate) {
                createdAt.gte = new Date(startDate);
            }
            if (endDate) {
                createdAt.lte = new Date(endDate);
            }
            where.createdAt = createdAt;
        }
        if (positionId) {
            where.warehousePositions = {
                some: { id: positionId },
            };
        }
        const [data, total] = await Promise.all([
            this.prisma.product.findMany({
                where,
                skip,
                take: limit,
                include: {
                    category: true,
                    warehousePositions: true,
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.product.count({ where }),
        ]);
        return {
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }
    async getCapacityRatio() {
        const config = await this.prisma.warehouseConfig.findFirst();
        const maxCapacity = config?.maxCapacity ?? 1000;
        const result = await this.prisma.product.aggregate({
            _sum: { stock: true },
        });
        const currentTotal = result._sum.stock ?? 0;
        const ratio = maxCapacity > 0 ? currentTotal / maxCapacity : 0;
        return {
            currentTotal,
            maxCapacity,
            ratio,
            isWarning: ratio > 0.9,
        };
    }
    async getCurrentStock(productId) {
        const product = await this.prisma.product.findUnique({
            where: { id: productId },
        });
        if (!product) {
            throw new common_1.NotFoundException('Sản phẩm không tồn tại');
        }
        return product.stock;
    }
    async getInventoryV2(filters) {
        const page = filters.page ?? 1;
        const limit = filters.limit ?? 10;
        const skip = (page - 1) * limit;
        const where = {};
        if (filters.categoryId) {
            where.categoryId = filters.categoryId;
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
        if (filters.search) {
            where.OR = [
                {
                    sku: { contains: filters.search, mode: 'insensitive' },
                },
                {
                    name: { contains: filters.search, mode: 'insensitive' },
                },
                {
                    warehousePositions: {
                        some: {
                            label: { contains: filters.search, mode: 'insensitive' },
                        },
                    },
                },
            ];
        }
        if (filters.productConditionId) {
            where.transactions = {
                some: {
                    productConditionId: filters.productConditionId,
                },
            };
        }
        if (filters.positionId) {
            where.warehousePositions = {
                some: {
                    id: filters.positionId,
                },
            };
        }
        const [allProducts, total] = await Promise.all([
            this.prisma.product.findMany({
                where,
                skip,
                take: limit,
                include: {
                    category: true,
                    warehousePositions: true,
                    transactions: {
                        take: 1,
                        orderBy: { createdAt: 'desc' },
                        include: {
                            skuCombo: {
                                include: {
                                    classification: true,
                                    color: true,
                                    size: true,
                                    material: true,
                                },
                            },
                            productCondition: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.product.count({ where }),
        ]);
        const data = allProducts.map((product) => {
            const latestTransaction = product.transactions[0];
            const latestSkuCombo = latestTransaction?.skuCombo;
            const attributes = latestSkuCombo
                ? [
                    latestSkuCombo.classification?.name,
                    latestSkuCombo.material?.name,
                    latestSkuCombo.color?.name,
                    latestSkuCombo.size?.name,
                ]
                    .filter(Boolean)
                    .join(' / ')
                : '-';
            return {
                ...product,
                attributes,
                latestSkuCombo,
                latestProductCondition: latestTransaction?.productCondition ?? null,
                positionLabels: product.warehousePositions
                    ?.map((position) => position.label)
                    .filter(Boolean) ?? [],
                businessStatus: this.computeBusinessStatus({
                    stock: product.stock,
                    minThreshold: product.minThreshold,
                    isDiscontinued: product.isDiscontinued,
                }),
            };
        });
        const filtered = filters.businessStatus
            ? data.filter((p) => p.businessStatus === filters.businessStatus)
            : data;
        return {
            data: filtered,
            total: filters.businessStatus ? filtered.length : total,
            page,
            limit,
            totalPages: Math.ceil((filters.businessStatus ? filtered.length : total) / limit),
        };
    }
    async exportExcelV2(filters) {
        const where = {};
        if (filters.categoryId) {
            where.categoryId = filters.categoryId;
        }
        if (filters.search) {
            where.OR = [
                {
                    sku: { contains: filters.search, mode: 'insensitive' },
                },
                {
                    name: { contains: filters.search, mode: 'insensitive' },
                },
                {
                    warehousePositions: {
                        some: {
                            label: { contains: filters.search, mode: 'insensitive' },
                        },
                    },
                },
            ];
        }
        const products = await this.prisma.product.findMany({
            where,
            include: {
                category: true,
                warehousePositions: true,
                transactions: {
                    take: 1,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        skuCombo: {
                            include: {
                                classification: true,
                                color: true,
                                size: true,
                                material: true,
                            },
                        },
                        productCondition: true,
                    },
                },
            },
            orderBy: { name: 'asc' },
        });
        let data = products.map((product) => {
            const latestTransaction = product.transactions[0];
            const latestSkuCombo = latestTransaction?.skuCombo;
            return {
                ...product,
                attributes: latestSkuCombo
                    ? [
                        latestSkuCombo.classification?.name,
                        latestSkuCombo.material?.name,
                        latestSkuCombo.color?.name,
                        latestSkuCombo.size?.name,
                    ]
                        .filter(Boolean)
                        .join(' / ')
                    : '-',
                positionLabels: product.warehousePositions
                    ?.map((position) => position.label)
                    .filter(Boolean)
                    .join(', ') || '-',
                productConditionName: latestTransaction?.productCondition?.name || '-',
                businessStatus: this.computeBusinessStatus({
                    stock: product.stock,
                    minThreshold: product.minThreshold,
                    isDiscontinued: product.isDiscontinued,
                }),
            };
        });
        if (filters.businessStatus) {
            data = data.filter((p) => p.businessStatus === filters.businessStatus);
        }
        if (data.length === 0) {
            throw new common_1.NotFoundException('Không có dữ liệu để xuất báo cáo');
        }
        const ExcelJS = await import('exceljs');
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Tồn kho V2');
        const statusLabels = {
            CON_HANG: 'Còn hàng',
            HET_HANG: 'Hết hàng',
            SAP_HET: 'Sắp hết hàng',
            NGUNG_KD: 'Ngừng kinh doanh',
        };
        worksheet.columns = [
            { header: 'Mã SKU', key: 'sku', width: 24 },
            { header: 'Tên sản phẩm', key: 'name', width: 28 },
            { header: 'Thuộc tính', key: 'attributes', width: 32 },
            { header: 'Vị trí', key: 'positionLabels', width: 20 },
            { header: 'Số lượng', key: 'stock', width: 14 },
            { header: 'Trạng thái', key: 'businessStatus', width: 18 },
            { header: 'Tình trạng', key: 'productConditionName', width: 18 },
        ];
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.alignment = { horizontal: 'center' };
        for (const product of data) {
            worksheet.addRow({
                sku: product.sku,
                name: product.name,
                attributes: product.attributes,
                positionLabels: product.positionLabels,
                stock: product.stock,
                businessStatus: statusLabels[product.businessStatus] ?? product.businessStatus,
                productConditionName: product.productConditionName,
            });
        }
        const buffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }
};
exports.InventoryService = InventoryService;
exports.InventoryService = InventoryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_js_1.PrismaService])
], InventoryService);
//# sourceMappingURL=inventory.service.js.map