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
var DashboardService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_js_1 = require("../prisma/prisma.service.js");
let DashboardService = DashboardService_1 = class DashboardService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getSummary() {
        const totalProducts = await this.prisma.product.count();
        const stockResult = await this.prisma.product.aggregate({
            _sum: { stock: true },
        });
        const totalStock = stockResult._sum.stock ?? 0;
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        const monthlyTransactions = await this.prisma.inventoryTransaction.groupBy({
            by: ['type'],
            where: {
                createdAt: {
                    gte: startOfMonth,
                    lte: endOfMonth,
                },
            },
            _sum: { quantity: true },
        });
        const monthlyStockIn = monthlyTransactions.find((t) => t.type === client_1.TransactionType.STOCK_IN)?._sum
            .quantity ?? 0;
        const monthlyStockOut = monthlyTransactions.find((t) => t.type === client_1.TransactionType.STOCK_OUT)
            ?._sum.quantity ?? 0;
        const config = await this.prisma.warehouseConfig.findFirst();
        const maxCapacity = config?.maxCapacity ?? 1000;
        const capacityRatio = maxCapacity > 0 ? totalStock / maxCapacity : 0;
        return {
            totalProducts,
            totalStock,
            monthlyStockIn,
            monthlyStockOut,
            capacityRatio,
        };
    }
    async getChartData(period = 'month') {
        const now = new Date();
        const labels = [];
        const stockIn = [];
        const stockOut = [];
        if (period === 'week') {
            for (let i = 11; i >= 0; i--) {
                const weekEnd = new Date(now);
                weekEnd.setDate(weekEnd.getDate() - i * 7);
                weekEnd.setHours(23, 59, 59, 999);
                const weekStart = new Date(weekEnd);
                weekStart.setDate(weekStart.getDate() - 6);
                weekStart.setHours(0, 0, 0, 0);
                const label = `${weekStart.getDate().toString().padStart(2, '0')}/${(weekStart.getMonth() + 1).toString().padStart(2, '0')}`;
                labels.push(label);
                const transactions = await this.prisma.inventoryTransaction.groupBy({
                    by: ['type'],
                    where: {
                        createdAt: {
                            gte: weekStart,
                            lte: weekEnd,
                        },
                    },
                    _sum: { quantity: true },
                });
                stockIn.push(transactions.find((t) => t.type === client_1.TransactionType.STOCK_IN)?._sum
                    .quantity ?? 0);
                stockOut.push(transactions.find((t) => t.type === client_1.TransactionType.STOCK_OUT)?._sum
                    .quantity ?? 0);
            }
        }
        else {
            for (let i = 11; i >= 0; i--) {
                const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);
                const label = `${(monthDate.getMonth() + 1).toString().padStart(2, '0')}/${monthDate.getFullYear()}`;
                labels.push(label);
                const transactions = await this.prisma.inventoryTransaction.groupBy({
                    by: ['type'],
                    where: {
                        createdAt: {
                            gte: monthDate,
                            lte: monthEnd,
                        },
                    },
                    _sum: { quantity: true },
                });
                stockIn.push(transactions.find((t) => t.type === client_1.TransactionType.STOCK_IN)?._sum
                    .quantity ?? 0);
                stockOut.push(transactions.find((t) => t.type === client_1.TransactionType.STOCK_OUT)?._sum
                    .quantity ?? 0);
            }
        }
        return { labels, stockIn, stockOut, period };
    }
    async getAlertsBelowMin() {
        const products = await this.prisma.product.findMany({
            where: {
                minThreshold: { gt: 0 },
                stock: { lt: this.prisma.product.fields?.minThreshold ?? 0 },
            },
            include: { category: true },
        });
        const allProducts = await this.prisma.product.findMany({
            where: { minThreshold: { gt: 0 } },
            include: { category: true },
        });
        return allProducts
            .filter((p) => p.stock < p.minThreshold)
            .map((p) => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            stock: p.stock,
            minThreshold: p.minThreshold,
            maxThreshold: p.maxThreshold,
            category: p.category ? { id: p.category.id, name: p.category.name } : undefined,
        }));
    }
    async getAlertsAboveMax() {
        const allProducts = await this.prisma.product.findMany({
            where: { maxThreshold: { gt: 0 } },
            include: { category: true },
        });
        return allProducts
            .filter((p) => p.stock > p.maxThreshold)
            .map((p) => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            stock: p.stock,
            minThreshold: p.minThreshold,
            maxThreshold: p.maxThreshold,
            category: p.category ? { id: p.category.id, name: p.category.name } : undefined,
        }));
    }
    async getTopProducts(type, limit = 20) {
        const products = await this.prisma.product.findMany({
            orderBy: { stock: type === 'highest' ? 'desc' : 'asc' },
            take: limit,
        });
        return products.map((p, index) => ({
            rank: index + 1,
            id: p.id,
            name: p.name,
            sku: p.sku,
            stock: p.stock,
        }));
    }
    async getTopZones(type, limit = 10) {
        const zones = await this.prisma.storageZone.findMany({
            orderBy: { currentStock: type === 'highest' ? 'desc' : 'asc' },
            take: limit,
        });
        return zones.map((z, index) => ({
            rank: index + 1,
            id: z.id,
            name: z.name,
            maxCapacity: z.maxCapacity,
            currentStock: z.currentStock,
            usagePercent: z.maxCapacity > 0 ? Math.round((z.currentStock / z.maxCapacity) * 10000) / 100 : 0,
        }));
    }
    static getWeekCutoff(date) {
        const d = new Date(date);
        const day = d.getUTCDay();
        d.setUTCDate(d.getUTCDate() - day);
        d.setUTCHours(5, 0, 0, 0);
        if (d.getTime() > date.getTime()) {
            d.setUTCDate(d.getUTCDate() - 7);
        }
        return d;
    }
    async getChartDataV2(period = 'month') {
        const now = new Date();
        const labels = [];
        const stockInArr = [];
        const stockOutArr = [];
        const inventoryArr = [];
        if (period === 'week') {
            const currentCutoff = DashboardService_1.getWeekCutoff(now);
            for (let i = 11; i >= 0; i--) {
                const weekEnd = new Date(currentCutoff);
                weekEnd.setUTCDate(weekEnd.getUTCDate() - i * 7);
                const weekStart = new Date(weekEnd);
                weekStart.setUTCDate(weekStart.getUTCDate() - 7);
                const label = `${weekEnd.getUTCDate().toString().padStart(2, '0')}/${(weekEnd.getUTCMonth() + 1).toString().padStart(2, '0')}`;
                labels.push(label);
                const transactions = await this.prisma.inventoryTransaction.groupBy({
                    by: ['type'],
                    where: {
                        createdAt: {
                            gt: weekStart,
                            lte: weekEnd,
                        },
                    },
                    _sum: { quantity: true },
                });
                stockInArr.push(transactions.find((t) => t.type === client_1.TransactionType.STOCK_IN)?._sum.quantity ?? 0);
                stockOutArr.push(transactions.find((t) => t.type === client_1.TransactionType.STOCK_OUT)?._sum.quantity ?? 0);
                const stockResult = await this.prisma.product.aggregate({
                    _sum: { stock: true },
                });
                const currentTotalStock = stockResult._sum.stock ?? 0;
                const changesAfter = await this.prisma.inventoryTransaction.findMany({
                    where: {
                        createdAt: { gt: weekEnd },
                    },
                    select: { type: true, quantity: true },
                });
                let netAfter = 0;
                for (const tx of changesAfter) {
                    if (tx.type === client_1.TransactionType.STOCK_IN) {
                        netAfter += tx.quantity;
                    }
                    else {
                        netAfter -= tx.quantity;
                    }
                }
                inventoryArr.push(currentTotalStock - netAfter);
            }
        }
        else {
            for (let i = 11; i >= 0; i--) {
                const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);
                const label = `${(monthDate.getMonth() + 1).toString().padStart(2, '0')}/${monthDate.getFullYear()}`;
                labels.push(label);
                const transactions = await this.prisma.inventoryTransaction.groupBy({
                    by: ['type'],
                    where: {
                        createdAt: {
                            gte: monthDate,
                            lte: monthEnd,
                        },
                    },
                    _sum: { quantity: true },
                });
                stockInArr.push(transactions.find((t) => t.type === client_1.TransactionType.STOCK_IN)?._sum.quantity ?? 0);
                stockOutArr.push(transactions.find((t) => t.type === client_1.TransactionType.STOCK_OUT)?._sum.quantity ?? 0);
                const stockResult = await this.prisma.product.aggregate({
                    _sum: { stock: true },
                });
                const currentTotalStock = stockResult._sum.stock ?? 0;
                const changesAfter = await this.prisma.inventoryTransaction.findMany({
                    where: {
                        createdAt: { gt: monthEnd },
                    },
                    select: { type: true, quantity: true },
                });
                let netAfter = 0;
                for (const tx of changesAfter) {
                    if (tx.type === client_1.TransactionType.STOCK_IN) {
                        netAfter += tx.quantity;
                    }
                    else {
                        netAfter -= tx.quantity;
                    }
                }
                inventoryArr.push(currentTotalStock - netAfter);
            }
        }
        return { labels, stockIn: stockInArr, stockOut: stockOutArr, inventory: inventoryArr, period };
    }
    async getDetailProducts(page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [data, total] = await Promise.all([
            this.prisma.product.findMany({
                skip,
                take: limit,
                include: { category: true },
                orderBy: { createdAt: 'desc' },
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
    async getDetailStock(page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [data, total] = await Promise.all([
            this.prisma.product.findMany({
                skip,
                take: limit,
                orderBy: { stock: 'desc' },
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
    async getDetailTransactions(type, page = 1, limit = 20) {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        const skip = (page - 1) * limit;
        const txType = type === 'stock_in' ? client_1.TransactionType.STOCK_IN : client_1.TransactionType.STOCK_OUT;
        const [transactions, total] = await Promise.all([
            this.prisma.inventoryTransaction.findMany({
                where: {
                    type: txType,
                    createdAt: { gte: startOfMonth, lte: endOfMonth },
                },
                skip,
                take: limit,
                include: {
                    product: true,
                    user: { select: { name: true } },
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.inventoryTransaction.count({
                where: {
                    type: txType,
                    createdAt: { gte: startOfMonth, lte: endOfMonth },
                },
            }),
        ]);
        const data = transactions.map((tx) => ({
            id: tx.id,
            createdAt: tx.createdAt.toISOString(),
            productName: tx.product.name,
            productSku: tx.product.sku,
            quantity: tx.quantity,
            userName: tx.user.name,
        }));
        return {
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = DashboardService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_js_1.PrismaService])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map