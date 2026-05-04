import { Injectable } from '@nestjs/common';
import {
  InventoryTransactionStatus,
  TransactionType,
} from '@prisma/client/index';
import { PrismaService } from '../prisma/prisma.service.js';

export interface DashboardSummary {
  totalCategories: number;
  totalStock: number;
  totalInventoryValue: number;
  monthlyStockIn: number;
  monthlyStockOut: number;
  totalOrderPlanQuantity: number;
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

export interface AlertCategory {
  categoryId: string;
  categoryName: string;
  stock: number;
}

export interface TopCategory {
  rank: number;
  categoryId: string;
  categoryName: string;
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
  categoryId: string | null;
  categoryName: string;
  quantity: number;
  userName: string;
}

export interface OrderPlanDetail {
  id: string;
  createdAt: string;
  categoryName: string;
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

  private async getActiveTransactions(where: Record<string, unknown> = {}) {
    return this.prisma.inventoryTransaction.findMany({
      where: {
        status: InventoryTransactionStatus.ACTIVE,
        ...where,
      },
      include: {
        category: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async buildUserNameMap(userIds: Array<string | null | undefined>) {
    const uniqueUserIds = [...new Set(userIds.filter(Boolean))] as string[];
    if (uniqueUserIds.length === 0) {
      return new Map<string, string>();
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: uniqueUserIds } },
      select: { id: true, name: true },
    });

    return new Map(users.map((user) => [user.id, user.name]));
  }

  private computeNetStock(
    transactions: Array<{ type: TransactionType; quantity: number }>,
  ) {
    return transactions.reduce((sum, transaction) => {
      return sum + (transaction.type === TransactionType.STOCK_IN ? transaction.quantity : -transaction.quantity);
    }, 0);
  }

  private async getCategoryStockMap() {
    const categories = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
    });
    const transactions = await this.prisma.inventoryTransaction.findMany({
      where: { status: InventoryTransactionStatus.ACTIVE },
      select: { categoryId: true, type: true, quantity: true },
    });

    const stockMap = new Map<string, number>();
    for (const category of categories) {
      stockMap.set(category.id, 0);
    }

    for (const transaction of transactions) {
      if (!transaction.categoryId) continue;
      const current = stockMap.get(transaction.categoryId) ?? 0;
      stockMap.set(
        transaction.categoryId,
        current + (transaction.type === TransactionType.STOCK_IN ? transaction.quantity : -transaction.quantity),
      );
    }

    return { categories, stockMap };
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
      select: {
        type: true,
        quantity: true,
        purchasePrice: true,
      },
    });

    let totalValue = 0;
    for (const transaction of transactions) {
      const value = Number(transaction.purchasePrice ?? 0) * transaction.quantity;
      totalValue += transaction.type === TransactionType.STOCK_IN ? value : -value;
    }

    return Math.max(totalValue, 0);
  }

  async getSummary(startDate?: string, endDate?: string): Promise<DashboardSummary> {
    const { categories, stockMap } = await this.getCategoryStockMap();
    const totalCategories = categories.length;
    const totalStock = Array.from(stockMap.values()).reduce((sum, value) => sum + value, 0);

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
      monthlyTransactions.find((t) => t.type === TransactionType.STOCK_IN)?._sum.quantity ?? 0;
    const monthlyStockOut =
      monthlyTransactions.find((t) => t.type === TransactionType.STOCK_OUT)?._sum.quantity ?? 0;

    const orderPlanAggregate = await this.prisma.orderPlan.aggregate({
      where: {
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      _sum: { quantity: true },
    });

    const config = await this.prisma.warehouseConfig.findFirst();
    const maxCapacity = config?.maxCapacity ?? 1000;
    const capacityRatio = maxCapacity > 0 ? totalStock / maxCapacity : 0;
    const totalInventoryValue = await this.getInventoryValueAt(endDate);

    return {
      totalCategories,
      totalStock,
      totalInventoryValue,
      monthlyStockIn,
      monthlyStockOut,
      totalOrderPlanQuantity: orderPlanAggregate._sum.quantity ?? 0,
      capacityRatio,
    };
  }

  async getChartData(period: 'week' | 'month' | 'quarter' = 'month'): Promise<ChartData> {
    const now = new Date();
    const labels: string[] = [];
    const stockIn: number[] = [];
    const stockOut: number[] = [];

    if (period === 'week') {
      for (let i = 11; i >= 0; i--) {
        const weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() - i * 7);
        weekEnd.setHours(23, 59, 59, 999);

        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekStart.getDate() - 6);
        weekStart.setHours(0, 0, 0, 0);

        labels.push(`${weekStart.getDate().toString().padStart(2, '0')}/${(weekStart.getMonth() + 1).toString().padStart(2, '0')}`);

        const transactions = await this.prisma.inventoryTransaction.groupBy({
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

        stockIn.push(transactions.find((t) => t.type === TransactionType.STOCK_IN)?._sum.quantity ?? 0);
        stockOut.push(transactions.find((t) => t.type === TransactionType.STOCK_OUT)?._sum.quantity ?? 0);
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

        labels.push(
          period === 'quarter'
            ? `Q${Math.floor(monthDate.getMonth() / 3) + 1}/${monthDate.getFullYear()}`
            : `${(monthDate.getMonth() + 1).toString().padStart(2, '0')}/${monthDate.getFullYear()}`,
        );

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

        stockIn.push(transactions.find((t) => t.type === TransactionType.STOCK_IN)?._sum.quantity ?? 0);
        stockOut.push(transactions.find((t) => t.type === TransactionType.STOCK_OUT)?._sum.quantity ?? 0);
      }
    }

    return { labels, stockIn, stockOut, period };
  }

  async getAlertsBelowMin(): Promise<AlertCategory[]> {
    const { categories, stockMap } = await this.getCategoryStockMap();
    return categories
      .map((category) => ({
        categoryId: category.id,
        categoryName: category.name,
        stock: stockMap.get(category.id) ?? 0,
      }))
      .filter((item) => item.stock <= 0);
  }

  async getAlertsAboveMax(): Promise<AlertCategory[]> {
    return [];
  }

  async getTopCategories(type: 'highest' | 'lowest', limit: number = 20): Promise<TopCategory[]> {
    const { categories, stockMap } = await this.getCategoryStockMap();

    return categories
      .map((category) => ({
        categoryId: category.id,
        categoryName: category.name,
        stock: stockMap.get(category.id) ?? 0,
      }))
      .sort((a, b) => {
        const diff = type === 'highest' ? b.stock - a.stock : a.stock - b.stock;
        return diff !== 0 ? diff : a.categoryName.localeCompare(b.categoryName, 'vi');
      })
      .slice(0, limit)
      .map((item, index) => ({
        rank: index + 1,
        ...item,
      }));
  }

  async getTopZones(type: 'highest' | 'lowest', limit: number = 10): Promise<TopZone[]> {
    const zones = await this.prisma.storageZone.findMany({
      orderBy: { name: 'asc' },
    });

    return zones
      .map((z) => ({
        id: z.id,
        name: z.name,
        maxCapacity: z.maxCapacity,
        currentStock: z.currentStock,
        usagePercent:
          z.maxCapacity > 0
            ? Math.round((z.currentStock / z.maxCapacity) * 10000) / 100
            : 0,
      }))
      .sort((a, b) => {
        const usageDiff =
          type === 'highest' ? b.usagePercent - a.usagePercent : a.usagePercent - b.usagePercent;
        return usageDiff !== 0 ? usageDiff : a.name.localeCompare(b.name, 'vi');
      })
      .slice(0, limit)
      .map((zone, index) => ({
        rank: index + 1,
        ...zone,
      }));
  }

  static getWeekCutoff(date: Date): Date {
    const d = new Date(date);
    const day = d.getUTCDay();
    d.setUTCDate(d.getUTCDate() - day);
    d.setUTCHours(5, 0, 0, 0);
    if (d.getTime() > date.getTime()) {
      d.setUTCDate(d.getUTCDate() - 7);
    }
    return d;
  }

  async getChartDataV2(period: 'week' | 'month' | 'quarter' = 'month'): Promise<ChartDataV2> {
    const chart = await this.getChartData(period);
    const inventory: number[] = [];
    const now = new Date();

    if (period === 'week') {
      const currentCutoff = DashboardService.getWeekCutoff(now);
      for (let i = 11; i >= 0; i--) {
        const cutoff = new Date(currentCutoff);
        cutoff.setUTCDate(cutoff.getUTCDate() - i * 7);

        const transactions = await this.prisma.inventoryTransaction.findMany({
          where: {
            status: InventoryTransactionStatus.ACTIVE,
            createdAt: { lte: cutoff },
          },
          select: { type: true, quantity: true },
        });
        inventory.push(this.computeNetStock(transactions));
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

        const transactions = await this.prisma.inventoryTransaction.findMany({
          where: {
            status: InventoryTransactionStatus.ACTIVE,
            createdAt: { lte: monthEnd },
          },
          select: { type: true, quantity: true },
        });
        inventory.push(this.computeNetStock(transactions));
      }
    }

    return { ...chart, inventory };
  }

  async getDetailCategories(
    page: number = 1,
    limit: number = 20,
    _startDate?: string,
    _endDate?: string,
  ): Promise<PaginatedResponse<unknown>> {
    const { categories, stockMap } = await this.getCategoryStockMap();
    const rows = categories.map((category) => ({
      categoryId: category.id,
      categoryName: category.name,
      stock: stockMap.get(category.id) ?? 0,
    }));

    const skip = (page - 1) * limit;
    return {
      data: rows.slice(skip, skip + limit),
      total: rows.length,
      page,
      limit,
      totalPages: Math.ceil(rows.length / limit) || 1,
    };
  }

  async getDetailStock(
    page: number = 1,
    limit: number = 20,
    _startDate?: string,
    _endDate?: string,
  ): Promise<PaginatedResponse<unknown>> {
    return this.getDetailCategories(page, limit);
  }

  async getDetailTransactions(
    type: 'stock_in' | 'stock_out',
    page: number = 1,
    limit: number = 20,
    startDate?: string,
    endDate?: string,
  ): Promise<PaginatedResponse<TransactionDetail>> {
    const { start, end } = this.getDateRange(startDate, endDate);
    const txType = type === 'stock_in' ? TransactionType.STOCK_IN : TransactionType.STOCK_OUT;
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      this.prisma.inventoryTransaction.findMany({
        where: {
          type: txType,
          status: InventoryTransactionStatus.ACTIVE,
          createdAt: { gte: start, lte: end },
        },
        skip,
        take: limit,
        include: {
          category: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.inventoryTransaction.count({
        where: {
          type: txType,
          status: InventoryTransactionStatus.ACTIVE,
          createdAt: { gte: start, lte: end },
        },
      }),
    ]);
    const userNameMap = await this.buildUserNameMap(
      transactions.map((tx) => tx.userId),
    );

    return {
      data: transactions.map((tx) => ({
        id: tx.id,
        createdAt: tx.createdAt.toISOString(),
        categoryId: tx.categoryId,
        categoryName: tx.category?.name ?? 'Danh mục',
        quantity: tx.quantity,
        userName: userNameMap.get(tx.userId) ?? 'NgÆ°á»i dÃ¹ng Ä‘Ã£ xÃ³a',
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getDetailOrderPlans(
    page: number = 1,
    limit: number = 20,
    startDate?: string,
    endDate?: string,
  ): Promise<PaginatedResponse<OrderPlanDetail>> {
    const { start, end } = this.getDateRange(startDate, endDate);
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      this.prisma.orderPlan.findMany({
        where: {
          createdAt: { gte: start, lte: end },
        },
        skip,
        take: limit,
        include: {
          category: true,
          creator: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.orderPlan.count({
        where: {
          createdAt: { gte: start, lte: end },
        },
      }),
    ]);

    return {
      data: rows.map((row) => ({
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        categoryName: row.category?.name ?? 'Kế hoạch đặt hàng',
        quantity: row.quantity,
        userName: row.creator.name,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }
}
