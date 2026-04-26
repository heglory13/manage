import { Injectable } from '@nestjs/common';
import {
  InventoryTransactionStatus,
  TransactionType,
} from '@prisma/client/index';
import { PrismaService } from '../prisma/prisma.service.js';
import { buildInventoryValuationBuckets } from '../inventory/inventory-valuation.util.js';

export interface DashboardSummary {
  totalProducts: number;
  totalStock: number;
  totalInventoryValue: number;
  monthlyStockIn: number;
  monthlyStockOut: number;
  capacityRatio: number;
}

export interface ChartData {
  labels: string[];
  stockIn: number[];
  stockOut: number[];
  period: 'week' | 'month' | 'quarter';
}

export interface ChartDataV2 {
  labels: string[];
  stockIn: number[];
  stockOut: number[];
  inventory: number[];
  period: 'week' | 'month' | 'quarter';
}

export interface AlertProduct {
  id: string;
  name: string;
  sku: string;
  stock: number;
  minThreshold: number;
  maxThreshold: number;
  category?: { id: string; name: string };
}

export interface TopProduct {
  rank: number;
  id: string;
  name: string;
  sku: string;
  stock: number;
}

export interface TopZone {
  rank: number;
  id: string;
  name: string;
  maxCapacity: number;
  currentStock: number;
  usagePercent: number;
}

export interface TransactionDetail {
  id: string;
  createdAt: string;
  productName: string;
  productSku: string;
  quantity: number;
  userName: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private getDateRange(startDate?: string, endDate?: string) {
    const now = new Date();
    return {
      start: startDate
        ? new Date(`${startDate}T00:00:00`)
        : new Date(now.getFullYear(), now.getMonth(), 1),
      end: endDate
        ? new Date(`${endDate}T23:59:59.999`)
        : new Date(
            now.getFullYear(),
            now.getMonth() + 1,
            0,
            23,
            59,
            59,
            999,
          ),
    };
  }

  private async getInventoryValueAt(endDate?: string) {
    const cutoff = endDate
      ? new Date(`${endDate}T23:59:59.999`)
      : new Date();

    const transactions = await this.prisma.inventoryTransaction.findMany({
      where: {
        createdAt: { lte: cutoff },
        status: InventoryTransactionStatus.ACTIVE,
      },
      include: {
        product: true,
        skuCombo: {
          include: {
            classification: true,
            color: true,
            size: true,
            material: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return buildInventoryValuationBuckets(
      transactions.map((transaction) => ({
        id: transaction.id,
        productId: transaction.productId,
        productName: transaction.product.name,
        productSku: transaction.product.sku,
        skuComboId: transaction.skuComboId,
        compositeSku: transaction.skuCombo?.compositeSku ?? null,
        classification: transaction.skuCombo?.classification?.name ?? null,
        color: transaction.skuCombo?.color?.name ?? null,
        size: transaction.skuCombo?.size?.name ?? null,
        material: transaction.skuCombo?.material?.name ?? null,
        type: transaction.type,
        quantity: transaction.quantity,
        purchasePrice:
          transaction.purchasePrice
            ? Number(transaction.purchasePrice)
            : Number(transaction.product.price ?? 0),
        createdAt: transaction.createdAt,
        status: transaction.status,
      })),
      undefined,
      cutoff,
    ).reduce((sum, bucket) => sum + bucket.closingValue, 0);
  }

  async getSummary(startDate?: string, endDate?: string): Promise<DashboardSummary> {
    const totalProducts = await this.prisma.product.count();

    const stockResult = await this.prisma.product.aggregate({
      _sum: { stock: true },
    });
    const totalStock = stockResult._sum.stock ?? 0;

    const { start: startOfMonth, end: endOfMonth } = this.getDateRange(
      startDate,
      endDate,
    );

    const monthlyTransactions = await this.prisma.inventoryTransaction.groupBy({
      by: ['type'],
      where: {
        status: InventoryTransactionStatus.ACTIVE,
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      _sum: { quantity: true },
    });

    const monthlyStockIn =
      monthlyTransactions.find((t) => t.type === TransactionType.STOCK_IN)?._sum
        .quantity ?? 0;
    const monthlyStockOut =
      monthlyTransactions.find((t) => t.type === TransactionType.STOCK_OUT)
        ?._sum.quantity ?? 0;

    // Capacity ratio
    const config = await this.prisma.warehouseConfig.findFirst();
    const maxCapacity = config?.maxCapacity ?? 1000;
    const capacityRatio = maxCapacity > 0 ? totalStock / maxCapacity : 0;
    const totalInventoryValue = await this.getInventoryValueAt(endDate);

    return {
      totalProducts,
      totalStock,
      totalInventoryValue,
      monthlyStockIn,
      monthlyStockOut,
      capacityRatio,
    };
  }

  async getChartData(period: 'week' | 'month' | 'quarter' = 'month'): Promise<ChartData> {
    const now = new Date();
    const labels: string[] = [];
    const stockIn: number[] = [];
    const stockOut: number[] = [];

    if (period === 'week') {
      // Last 12 weeks
      for (let i = 11; i >= 0; i--) {
        const weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() - i * 7);
        weekEnd.setHours(23, 59, 59, 999);

        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekStart.getDate() - 6);
        weekStart.setHours(0, 0, 0, 0);

        const label = `${weekStart.getDate().toString().padStart(2, '0')}/${(weekStart.getMonth() + 1).toString().padStart(2, '0')}`;
        labels.push(label);

        const transactions =
          await this.prisma.inventoryTransaction.groupBy({
            by: ['type'],
            where: {
              status: InventoryTransactionStatus.ACTIVE,
              createdAt: {
                gte: weekStart,
                lte: weekEnd,
              },
            },
            _sum: { quantity: true },
          });

        stockIn.push(
          transactions.find((t) => t.type === TransactionType.STOCK_IN)?._sum
            .quantity ?? 0,
        );
        stockOut.push(
          transactions.find((t) => t.type === TransactionType.STOCK_OUT)?._sum
            .quantity ?? 0,
        );
      }
    } else {
      const step = period === 'quarter' ? 3 : 1;
      for (let i = 12 - step; i >= 0; i -= step) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(
          monthDate.getFullYear(),
          monthDate.getMonth() + step,
          0,
          23,
          59,
          59,
          999,
        );

        const label =
          period === 'quarter'
            ? `Q${Math.floor(monthDate.getMonth() / 3) + 1}/${monthDate.getFullYear()}`
            : `${(monthDate.getMonth() + 1).toString().padStart(2, '0')}/${monthDate.getFullYear()}`;
        labels.push(label);

        const transactions =
          await this.prisma.inventoryTransaction.groupBy({
            by: ['type'],
            where: {
              status: InventoryTransactionStatus.ACTIVE,
              createdAt: {
                gte: monthDate,
                lte: monthEnd,
              },
            },
            _sum: { quantity: true },
          });

        stockIn.push(
          transactions.find((t) => t.type === TransactionType.STOCK_IN)?._sum
            .quantity ?? 0,
        );
        stockOut.push(
          transactions.find((t) => t.type === TransactionType.STOCK_OUT)?._sum
            .quantity ?? 0,
        );
      }
    }

    return { labels, stockIn, stockOut, period };
  }

  // === V3: Alerts ===

  async getAlertsBelowMin(): Promise<AlertProduct[]> {
    const products = await this.prisma.product.findMany({
      where: {
        minThreshold: { gt: 0 },
        stock: { lt: this.prisma.product.fields?.minThreshold as unknown as number ?? 0 },
      },
      include: { category: true },
    });

    // Prisma doesn't support comparing two columns directly, so we filter in JS
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

  async getAlertsAboveMax(): Promise<AlertProduct[]> {
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

  // === V3: Top Products & Zones ===

  async getTopProducts(type: 'highest' | 'lowest', limit: number = 20): Promise<TopProduct[]> {
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

  async getTopZones(type: 'highest' | 'lowest', limit: number = 10): Promise<TopZone[]> {
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

  // === V3: Chart V2 (3 lines) ===

  static getWeekCutoff(date: Date): Date {
    // Week cutoff = Sunday 12:00 GMT+7 = Sunday 05:00 UTC
    // Find the most recent Sunday 05:00 UTC that is <= date
    const d = new Date(date);
    const day = d.getUTCDay(); // 0 = Sunday
    // Go back to the most recent Sunday
    d.setUTCDate(d.getUTCDate() - day);
    d.setUTCHours(5, 0, 0, 0); // 05:00 UTC = 12:00 GMT+7

    // If the cutoff is in the future (e.g., date is Sunday before 05:00 UTC),
    // go back one more week
    if (d.getTime() > date.getTime()) {
      d.setUTCDate(d.getUTCDate() - 7);
    }

    return d;
  }

  async getChartDataV2(period: 'week' | 'month' | 'quarter' = 'month'): Promise<ChartDataV2> {
    const now = new Date();
    const labels: string[] = [];
    const stockInArr: number[] = [];
    const stockOutArr: number[] = [];
    const inventoryArr: number[] = [];

    if (period === 'week') {
      // Last 12 weeks, cutoff = Sunday 12:00 GMT+7 (05:00 UTC)
      const currentCutoff = DashboardService.getWeekCutoff(now);

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
            status: InventoryTransactionStatus.ACTIVE,
            createdAt: {
              gt: weekStart,
              lte: weekEnd,
            },
          },
          _sum: { quantity: true },
        });

        stockInArr.push(
          transactions.find((t) => t.type === TransactionType.STOCK_IN)?._sum.quantity ?? 0,
        );
        stockOutArr.push(
          transactions.find((t) => t.type === TransactionType.STOCK_OUT)?._sum.quantity ?? 0,
        );

        // Inventory at cutoff: sum of all product stock at that point
        // We approximate by computing: current stock - net changes after cutoff
        const stockResult = await this.prisma.product.aggregate({
          _sum: { stock: true },
        });
        const currentTotalStock = stockResult._sum.stock ?? 0;

        // Get net changes after this cutoff
        const changesAfter = await this.prisma.inventoryTransaction.findMany({
          where: {
            status: InventoryTransactionStatus.ACTIVE,
            createdAt: { gt: weekEnd },
          },
          select: { type: true, quantity: true },
        });

        let netAfter = 0;
        for (const tx of changesAfter) {
          if (tx.type === TransactionType.STOCK_IN) {
            netAfter += tx.quantity;
          } else {
            netAfter -= tx.quantity;
          }
        }

        inventoryArr.push(currentTotalStock - netAfter);
      }
    } else {
      const step = period === 'quarter' ? 3 : 1;
      for (let i = 12 - step; i >= 0; i -= step) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(
          monthDate.getFullYear(),
          monthDate.getMonth() + step,
          0,
          23, 59, 59, 999,
        );

        const label =
          period === 'quarter'
            ? `Q${Math.floor(monthDate.getMonth() / 3) + 1}/${monthDate.getFullYear()}`
            : `${(monthDate.getMonth() + 1).toString().padStart(2, '0')}/${monthDate.getFullYear()}`;
        labels.push(label);

        const transactions = await this.prisma.inventoryTransaction.groupBy({
          by: ['type'],
          where: {
            status: InventoryTransactionStatus.ACTIVE,
            createdAt: {
              gte: monthDate,
              lte: monthEnd,
            },
          },
          _sum: { quantity: true },
        });

        stockInArr.push(
          transactions.find((t) => t.type === TransactionType.STOCK_IN)?._sum.quantity ?? 0,
        );
        stockOutArr.push(
          transactions.find((t) => t.type === TransactionType.STOCK_OUT)?._sum.quantity ?? 0,
        );

        // Inventory at month end
        const stockResult = await this.prisma.product.aggregate({
          _sum: { stock: true },
        });
        const currentTotalStock = stockResult._sum.stock ?? 0;

        const changesAfter = await this.prisma.inventoryTransaction.findMany({
          where: {
            status: InventoryTransactionStatus.ACTIVE,
            createdAt: { gt: monthEnd },
          },
          select: { type: true, quantity: true },
        });

        let netAfter = 0;
        for (const tx of changesAfter) {
          if (tx.type === TransactionType.STOCK_IN) {
            netAfter += tx.quantity;
          } else {
            netAfter -= tx.quantity;
          }
        }

        inventoryArr.push(currentTotalStock - netAfter);
      }
    }

    return { labels, stockIn: stockInArr, stockOut: stockOutArr, inventory: inventoryArr, period };
  }

  // === V3: Detail Drill-down ===

  async getDetailProducts(
    page: number = 1,
    limit: number = 20,
    startDate?: string,
    endDate?: string,
  ): Promise<PaginatedResponse<unknown>> {
    const skip = (page - 1) * limit;
    const { start, end } = this.getDateRange(startDate, endDate);
    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where: {
          createdAt: {
            gte: start,
            lte: end,
          },
        },
        skip,
        take: limit,
        include: { category: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({
        where: {
          createdAt: {
            gte: start,
            lte: end,
          },
        },
      }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getDetailStock(
    page: number = 1,
    limit: number = 20,
    _startDate?: string,
    _endDate?: string,
  ): Promise<PaginatedResponse<unknown>> {
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

  async getDetailTransactions(
    type: 'stock_in' | 'stock_out',
    page: number = 1,
    limit: number = 20,
    startDate?: string,
    endDate?: string,
  ): Promise<PaginatedResponse<TransactionDetail>> {
    const { start: startOfMonth, end: endOfMonth } = this.getDateRange(
      startDate,
      endDate,
    );
    const skip = (page - 1) * limit;

    const txType = type === 'stock_in' ? TransactionType.STOCK_IN : TransactionType.STOCK_OUT;

    const [transactions, total] = await Promise.all([
      this.prisma.inventoryTransaction.findMany({
        where: {
          type: txType,
          status: InventoryTransactionStatus.ACTIVE,
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
          status: InventoryTransactionStatus.ACTIVE,
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
      }),
    ]);

    const data: TransactionDetail[] = transactions.map((tx) => ({
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
}
