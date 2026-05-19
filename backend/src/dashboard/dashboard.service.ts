import { Injectable } from '@nestjs/common';
import {
  InventoryTransactionStatus,
  Prisma,
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
  period: 'week' | 'month' | 'quarter' | 'year';
}

export interface ChartDataV2 {
  labels: string[];
  stockIn: number[];
  stockOut: number[];
  inventory: number[];
  period: 'week' | 'month' | 'quarter' | 'year';
}

export interface AlertCategory {
  categoryId: string;
  categoryName: string;
  stock: number;
  groupName?: string | null;
}

export interface TopCategory {
  rank: number;
  categoryId: string;
  categoryName: string;
  stock: number;
  groupName?: string | null;
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
  sku?: string | null;
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
        : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
    };
  }

  private async getWarehouseTypeContext(warehouseTypeId?: string) {
    if (!warehouseTypeId) {
      return null;
    }

    return this.prisma.warehouseType.findUnique({
      where: { id: warehouseTypeId },
      select: { id: true, name: true },
    });
  }

  private buildTransactionWhere(
    warehouseTypeName?: string | null,
    extraWhere: Prisma.InventoryTransactionWhereInput = {},
  ): Prisma.InventoryTransactionWhereInput {
    return {
      status: InventoryTransactionStatus.ACTIVE,
      ...extraWhere,
      ...(warehouseTypeName
        ? {
            warehousePosition: {
              is: {
                isActive: true,
                layout: {
                  is: {
                    name: warehouseTypeName,
                  },
                },
              },
            },
          }
        : {}),
    };
  }

  private buildPositionWhere(
    warehouseTypeName?: string | null,
  ): Prisma.WarehousePositionWhereInput {
    return {
      isActive: true,
      ...(warehouseTypeName ? { layout: { name: warehouseTypeName } } : {}),
    };
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
      return (
        sum +
        (transaction.type === TransactionType.STOCK_IN
          ? transaction.quantity
          : -transaction.quantity)
      );
    }, 0);
  }

  private async getCategoryStockMap(warehouseTypeId?: string) {
    const warehouseType = await this.getWarehouseTypeContext(warehouseTypeId);
    const [categories, transactions] = await Promise.all([
      this.prisma.category.findMany({
        orderBy: { name: 'asc' },
      }),
      this.prisma.inventoryTransaction.findMany({
        where: this.buildTransactionWhere(warehouseType?.name),
        select: { categoryId: true, type: true, quantity: true },
      }),
    ]);

    const stockMap = new Map<string, number>();
    for (const category of categories) {
      stockMap.set(category.id, 0);
    }

    for (const transaction of transactions) {
      if (!transaction.categoryId) continue;
      const current = stockMap.get(transaction.categoryId) ?? 0;
      stockMap.set(
        transaction.categoryId,
        current +
          (transaction.type === TransactionType.STOCK_IN
            ? transaction.quantity
            : -transaction.quantity),
      );
    }

    return { categories, stockMap, warehouseType };
  }

  private async getAllSkuComboStockRows(warehouseTypeId?: string) {
    const warehouseType = await this.getWarehouseTypeContext(warehouseTypeId);

    const [allCombos, transactions] = await Promise.all([
      (this.prisma.skuCombo as any).findMany({
        include: {
          classification: true,
          color: true,
          size: true,
          material: true,
        },
        orderBy: { compositeSku: 'asc' },
      }),
      this.prisma.inventoryTransaction.findMany({
        where: {
          ...this.buildTransactionWhere(warehouseType?.name),
          skuComboId: { not: null },
          categoryId: { not: null },
        },
        select: {
          skuComboId: true,
          categoryId: true,
          type: true,
          quantity: true,
          purchasePrice: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const stockMap = new Map<string, number>();
    const categoryIdMap = new Map<string, string>();
    const purchasePriceMap = new Map<string, number>();
    for (const tx of transactions) {
      if (!tx.skuComboId) continue;
      const cur = stockMap.get(tx.skuComboId) ?? 0;
      stockMap.set(
        tx.skuComboId,
        cur +
          (tx.type === TransactionType.STOCK_IN ? tx.quantity : -tx.quantity),
      );
      if (tx.categoryId && !categoryIdMap.has(tx.skuComboId)) {
        categoryIdMap.set(tx.skuComboId, tx.categoryId);
      }
      if (tx.type === TransactionType.STOCK_IN && tx.purchasePrice != null) {
        purchasePriceMap.set(tx.skuComboId, Number(tx.purchasePrice));
      }
    }

    const categoryIds = [...new Set(categoryIdMap.values())];
    const categories = categoryIds.length
      ? await this.prisma.category.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true },
        })
      : [];
    const catNameMap = new Map(categories.map((c) => [c.id, c.name]));

    return allCombos.map((combo: any) => {
      const name = [
        combo.classification?.name,
        combo.color?.name,
        combo.size?.name,
        combo.material?.name,
      ]
        .filter(Boolean)
        .join(' - ');
      const catId = categoryIdMap.get(combo.id);
      const stock = stockMap.get(combo.id) ?? 0;
      const purchasePrice = purchasePriceMap.get(combo.id) ?? 0;
      return {
        categoryId: combo.id,
        categoryName: name || combo.compositeSku,
        sku: combo.compositeSku,
        groupName: catId ? (catNameMap.get(catId) ?? null) : null,
        stock,
        purchasePrice,
        totalValue: purchasePrice * Math.max(stock, 0),
        minThreshold: combo.minThreshold,
        maxThreshold: combo.maxThreshold,
      };
    });
  }

  private async getInventoryValueAt(
    endDate?: string,
    warehouseTypeId?: string,
  ) {
    const warehouseType = await this.getWarehouseTypeContext(warehouseTypeId);
    const cutoff = endDate ? new Date(`${endDate}T23:59:59.999`) : new Date();

    const transactions = await this.prisma.inventoryTransaction.findMany({
      where: this.buildTransactionWhere(warehouseType?.name, {
        createdAt: { lte: cutoff },
      }),
      select: {
        type: true,
        quantity: true,
        purchasePrice: true,
      },
    });

    let totalValue = 0;
    for (const transaction of transactions) {
      const value =
        Number(transaction.purchasePrice ?? 0) * transaction.quantity;
      totalValue +=
        transaction.type === TransactionType.STOCK_IN ? value : -value;
    }

    return Math.max(totalValue, 0);
  }

  private async getCapacityRatio(
    totalStock: number,
    warehouseTypeName?: string | null,
  ) {
    if (warehouseTypeName) {
      const positions = await this.prisma.warehousePosition.findMany({
        where: this.buildPositionWhere(warehouseTypeName),
        select: { maxCapacity: true },
      });
      const maxCapacity = positions.reduce((sum, position) => {
        return sum + Math.max(position.maxCapacity ?? 0, 0);
      }, 0);

      return maxCapacity > 0 ? totalStock / maxCapacity : 0;
    }

    const config = await this.prisma.warehouseConfig.findFirst();
    const maxCapacity = config?.maxCapacity ?? 1000;
    return maxCapacity > 0 ? totalStock / maxCapacity : 0;
  }

  async getSummary(
    startDate?: string,
    endDate?: string,
    warehouseTypeId?: string,
  ): Promise<DashboardSummary> {
    const { categories, stockMap, warehouseType } =
      await this.getCategoryStockMap(warehouseTypeId);
    const totalCategories = categories.length;
    const totalStock = Array.from(stockMap.values()).reduce(
      (sum, value) => sum + value,
      0,
    );

    const { start: startOfMonth, end: endOfMonth } = this.getDateRange(
      startDate,
      endDate,
    );

    const monthlyTransactions = await this.prisma.inventoryTransaction.groupBy({
      by: ['type'],
      where: this.buildTransactionWhere(warehouseType?.name, {
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      }),
      _sum: { quantity: true },
    });

    const monthlyStockIn =
      monthlyTransactions.find((t) => t.type === TransactionType.STOCK_IN)?._sum
        .quantity ?? 0;
    const monthlyStockOut =
      monthlyTransactions.find((t) => t.type === TransactionType.STOCK_OUT)
        ?._sum.quantity ?? 0;

    const orderPlanAggregate = await this.prisma.orderPlan.aggregate({
      where: {
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
        ...(warehouseTypeId ? { warehouseTypeId } : {}),
      },
      _sum: { quantity: true },
    });

    const capacityRatio = await this.getCapacityRatio(
      totalStock,
      warehouseType?.name,
    );
    const totalInventoryValue = await this.getInventoryValueAt(
      endDate,
      warehouseTypeId,
    );

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

  async getChartData(
    period: 'week' | 'month' | 'quarter' | 'year' = 'month',
    warehouseTypeId?: string,
  ): Promise<ChartData> {
    const warehouseType = await this.getWarehouseTypeContext(warehouseTypeId);
    const now = new Date();
    const labels: string[] = [];
    const stockIn: number[] = [];
    const stockOut: number[] = [];

    // Build all slot boundaries first, then do ONE query covering the full range
    type Slot = { label: string; start: Date; end: Date };
    const slots: Slot[] = [];

    if (period === 'week') {
      for (let i = 11; i >= 0; i--) {
        const weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() - i * 7);
        weekEnd.setHours(23, 59, 59, 999);

        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekStart.getDate() - 6);
        weekStart.setHours(0, 0, 0, 0);

        slots.push({
          label: `${weekStart.getDate().toString().padStart(2, '0')}/${(weekStart.getMonth() + 1).toString().padStart(2, '0')}`,
          start: weekStart,
          end: weekEnd,
        });
      }
    } else if (period === 'year') {
      for (let i = 4; i >= 0; i--) {
        const year = now.getFullYear() - i;
        slots.push({
          label: `${year}`,
          start: new Date(year, 0, 1, 0, 0, 0, 0),
          end: new Date(year, 11, 31, 23, 59, 59, 999),
        });
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
        slots.push({
          label:
            period === 'quarter'
              ? `Q${Math.floor(monthDate.getMonth() / 3) + 1}/${monthDate.getFullYear()}`
              : `${(monthDate.getMonth() + 1).toString().padStart(2, '0')}/${monthDate.getFullYear()}`,
          start: monthDate,
          end: monthEnd,
        });
      }
    }

    // Single query fetching all transactions in the full date range
    const rangeStart = slots[0].start;
    const rangeEnd = slots[slots.length - 1].end;
    const allTransactions = await this.prisma.inventoryTransaction.findMany({
      where: this.buildTransactionWhere(warehouseType?.name, {
        createdAt: { gte: rangeStart, lte: rangeEnd },
      }),
      select: { type: true, quantity: true, createdAt: true },
    });

    // Bin transactions into slots in memory
    for (const slot of slots) {
      labels.push(slot.label);
      const slotTxs = allTransactions.filter(
        (tx) => tx.createdAt >= slot.start && tx.createdAt <= slot.end,
      );
      stockIn.push(
        slotTxs
          .filter((tx) => tx.type === TransactionType.STOCK_IN)
          .reduce((sum, tx) => sum + tx.quantity, 0),
      );
      stockOut.push(
        slotTxs
          .filter((tx) => tx.type === TransactionType.STOCK_OUT)
          .reduce((sum, tx) => sum + tx.quantity, 0),
      );
    }

    return { labels, stockIn, stockOut, period };
  }

  private async getSkuComboStockAlerts(
    type: 'below-min' | 'above-max',
    warehouseTypeId?: string,
  ): Promise<AlertCategory[]> {
    const warehouseType = await this.getWarehouseTypeContext(warehouseTypeId);

    const field = type === 'below-min' ? 'minThreshold' : 'maxThreshold';
    const skuCombos = await (this.prisma.skuCombo as any).findMany({
      where: { [field]: { gt: 0 } },
      include: {
        classification: true,
        color: true,
        size: true,
        material: true,
        inventoryTransactions: {
          where: this.buildTransactionWhere(warehouseType?.name),
          select: { type: true, quantity: true },
        },
      },
    });

    const results: AlertCategory[] = [];
    for (const combo of skuCombos) {
      const stock: number = combo.inventoryTransactions.reduce(
        (sum: number, tx: { type: TransactionType; quantity: number }) =>
          sum +
          (tx.type === TransactionType.STOCK_IN ? tx.quantity : -tx.quantity),
        0,
      );
      const threshold: number = combo[field];
      const triggered =
        type === 'below-min' ? stock < threshold : stock > threshold;
      if (triggered) {
        const name = [
          combo.classification?.name,
          combo.color?.name,
          combo.size?.name,
          combo.material?.name,
        ]
          .filter(Boolean)
          .join(' - ');
        results.push({
          categoryId: combo.id,
          categoryName: name || combo.compositeSku,
          stock,
          groupName: combo.compositeSku,
        });
      }
    }
    return results;
  }

  async getAlertsBelowMin(warehouseTypeId?: string): Promise<AlertCategory[]> {
    return this.getSkuComboStockAlerts('below-min', warehouseTypeId);
  }

  async getAlertsAboveMax(warehouseTypeId?: string): Promise<AlertCategory[]> {
    return this.getSkuComboStockAlerts('above-max', warehouseTypeId);
  }

  private async getSkuComboStockMap(warehouseTypeId?: string) {
    const warehouseType = await this.getWarehouseTypeContext(warehouseTypeId);

    const transactions = await this.prisma.inventoryTransaction.findMany({
      where: {
        ...this.buildTransactionWhere(warehouseType?.name),
        skuComboId: { not: null },
      },
      select: {
        skuComboId: true,
        categoryId: true,
        type: true,
        quantity: true,
      },
    });

    const skuComboIds = [
      ...new Set(transactions.map((t) => t.skuComboId).filter(Boolean)),
    ] as string[];
    const categoryIds = [
      ...new Set(transactions.map((t) => t.categoryId).filter(Boolean)),
    ] as string[];

    const [skuCombos, categories] = await Promise.all([
      this.prisma.skuCombo.findMany({
        where: { id: { in: skuComboIds } },
        include: {
          classification: true,
          color: true,
          size: true,
          material: true,
        },
      }),
      this.prisma.category.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true },
      }),
    ]);

    const categoryNameMap = new Map(categories.map((c) => [c.id, c.name]));
    const stockMap = new Map<string, number>();
    const categoryMap = new Map<string, string>();

    for (const tx of transactions) {
      if (!tx.skuComboId) continue;
      const current = stockMap.get(tx.skuComboId) ?? 0;
      stockMap.set(
        tx.skuComboId,
        current +
          (tx.type === TransactionType.STOCK_IN ? tx.quantity : -tx.quantity),
      );
      if (tx.categoryId && !categoryMap.has(tx.skuComboId)) {
        categoryMap.set(
          tx.skuComboId,
          categoryNameMap.get(tx.categoryId) ?? '',
        );
      }
    }

    return { skuCombos, stockMap, categoryMap };
  }

  async getTopCategories(
    type: 'highest' | 'lowest',
    limit: number = 20,
    warehouseTypeId?: string,
  ): Promise<TopCategory[]> {
    const { skuCombos, stockMap, categoryMap } =
      await this.getSkuComboStockMap(warehouseTypeId);

    const rows = skuCombos
      .map((combo) => {
        const name = [
          combo.classification.name,
          combo.color.name,
          combo.size.name,
          combo.material.name,
        ]
          .filter(Boolean)
          .join(' - ');
        const stock = stockMap.get(combo.id) ?? 0;
        return {
          categoryId: combo.id,
          categoryName: name,
          stock,
          groupName: categoryMap.get(combo.id) ?? null,
        };
      })
      .filter((item) => item.stock > 0);

    return rows
      .sort((a, b) => {
        const diff = type === 'highest' ? b.stock - a.stock : a.stock - b.stock;
        return diff !== 0
          ? diff
          : a.categoryName.localeCompare(b.categoryName, 'vi');
      })
      .slice(0, limit)
      .map((item, index) => ({
        rank: index + 1,
        ...item,
      }));
  }

  async getTopZones(
    type: 'highest' | 'lowest',
    limit: number = 10,
    warehouseTypeId?: string,
  ): Promise<TopZone[]> {
    const warehouseType = await this.getWarehouseTypeContext(warehouseTypeId);
    const positions = await this.prisma.warehousePosition.findMany({
      where: this.buildPositionWhere(warehouseType?.name),
      select: { id: true, label: true, maxCapacity: true },
      orderBy: { label: 'asc' },
    });

    if (positions.length === 0) return [];

    const positionIds = positions.map((p) => p.id);
    const txs = await this.prisma.inventoryTransaction.findMany({
      where: {
        warehousePositionId: { in: positionIds },
        status: InventoryTransactionStatus.ACTIVE,
      },
      select: { warehousePositionId: true, type: true, quantity: true },
    });

    const stockMap = new Map<string, number>();
    for (const tx of txs) {
      if (!tx.warehousePositionId) continue;
      const curr = stockMap.get(tx.warehousePositionId) ?? 0;
      stockMap.set(
        tx.warehousePositionId,
        curr +
          (tx.type === TransactionType.STOCK_IN ? tx.quantity : -tx.quantity),
      );
    }

    return positions
      .map((z) => {
        const currentStock = Math.max(stockMap.get(z.id) ?? 0, 0);
        const cap = z.maxCapacity ?? 0;
        return {
          id: z.id,
          name: z.label ?? z.id,
          maxCapacity: cap,
          currentStock,
          usagePercent:
            cap > 0 ? Math.round((currentStock / cap) * 10000) / 100 : 0,
        };
      })
      .sort((a, b) => {
        const usageDiff =
          type === 'highest'
            ? b.usagePercent - a.usagePercent
            : a.usagePercent - b.usagePercent;
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

  async getChartDataV2(
    period: 'week' | 'month' | 'quarter' | 'year' = 'month',
    warehouseTypeId?: string,
  ): Promise<ChartDataV2> {
    const warehouseType = await this.getWarehouseTypeContext(warehouseTypeId);
    const chart = await this.getChartData(period, warehouseTypeId);
    const inventory: number[] = [];
    const now = new Date();

    if (period === 'week') {
      const currentCutoff = DashboardService.getWeekCutoff(now);
      for (let i = 11; i >= 0; i--) {
        const cutoff = new Date(currentCutoff);
        cutoff.setUTCDate(cutoff.getUTCDate() - i * 7);

        const transactions = await this.prisma.inventoryTransaction.findMany({
          where: this.buildTransactionWhere(warehouseType?.name, {
            createdAt: { lte: cutoff },
          }),
          select: { type: true, quantity: true },
        });
        inventory.push(this.computeNetStock(transactions));
      }
    } else if (period === 'year') {
      for (let i = 4; i >= 0; i--) {
        const year = now.getFullYear() - i;
        const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

        const transactions = await this.prisma.inventoryTransaction.findMany({
          where: this.buildTransactionWhere(warehouseType?.name, {
            createdAt: { lte: yearEnd },
          }),
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
          where: this.buildTransactionWhere(warehouseType?.name, {
            createdAt: { lte: monthEnd },
          }),
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
    warehouseTypeId?: string,
  ): Promise<PaginatedResponse<unknown>> {
    const { categories, stockMap } =
      await this.getCategoryStockMap(warehouseTypeId);
    const rows = categories.map((cat) => ({
      categoryId: cat.id,
      categoryName: cat.name,
      sku: (cat as any).code ?? null,
      groupName: null,
      stock: stockMap.get(cat.id) ?? 0,
      minThreshold: null,
      maxThreshold: null,
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
    warehouseTypeId?: string,
  ): Promise<PaginatedResponse<unknown>> {
    const rows = await this.getAllSkuComboStockRows(warehouseTypeId);
    const skip = (page - 1) * limit;
    return {
      data: rows.slice(skip, skip + limit),
      total: rows.length,
      page,
      limit,
      totalPages: Math.ceil(rows.length / limit) || 1,
    };
  }

  async getDetailTransactions(
    type: 'stock_in' | 'stock_out',
    page: number = 1,
    limit: number = 20,
    startDate?: string,
    endDate?: string,
    warehouseTypeId?: string,
  ): Promise<PaginatedResponse<TransactionDetail>> {
    const warehouseType = await this.getWarehouseTypeContext(warehouseTypeId);
    const { start, end } = this.getDateRange(startDate, endDate);
    const txType =
      type === 'stock_in'
        ? TransactionType.STOCK_IN
        : TransactionType.STOCK_OUT;
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      this.prisma.inventoryTransaction.findMany({
        where: this.buildTransactionWhere(warehouseType?.name, {
          type: txType,
          createdAt: { gte: start, lte: end },
        }),
        skip,
        take: limit,
        include: {
          category: true,
          product: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.inventoryTransaction.count({
        where: this.buildTransactionWhere(warehouseType?.name, {
          type: txType,
          createdAt: { gte: start, lte: end },
        }),
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
        userName: userNameMap.get(tx.userId) ?? 'Người dùng đã xóa',
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
    warehouseTypeId?: string,
  ): Promise<PaginatedResponse<OrderPlanDetail>> {
    const { start, end } = this.getDateRange(startDate, endDate);
    const skip = (page - 1) * limit;
    const where = {
      createdAt: { gte: start, lte: end },
      ...(warehouseTypeId ? { warehouseTypeId } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.orderPlan.findMany({
        where,
        skip,
        take: limit,
        include: {
          category: true,
          creator: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.orderPlan.count({
        where,
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
