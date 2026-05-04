import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryTransaction,
  InventoryTransactionStatus,
  Prisma,
  TransactionType,
} from '@prisma/client/index';
import { PrismaService } from '../prisma/prisma.service.js';

export interface CapacityInfo {
  currentTotal: number;
  maxCapacity: number;
  ratio: number;
  isWarning: boolean;
}

export interface InventoryFilters {
  categoryId?: string;
  startDate?: string;
  endDate?: string;
  positionId?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface InventoryTransactionHistoryItem {
  id: string;
  categoryId: string | null;
  createdAt: string;
  actualStockDate: string | null;
  kind: 'ALL' | 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT';
  type: TransactionType;
  status: InventoryTransactionStatus;
  quantity: number;
  signedQuantity: number;
  purchasePrice: number | null;
  salePrice: number | null;
  categoryName: string;
  positionLabel: string | null;
  warehouseTypeName: string | null;
  storageZoneName: string | null;
  productName: string | null;
  sku: string | null;
  userName: string;
  note: string;
}

type StockInOptions = {
  purchasePrice?: number;
  salePrice?: number;
  skuComboId?: string;
  productConditionId?: string;
  storageZoneId?: string;
  warehousePositionId?: string;
  preliminaryCheckId?: string;
  actualStockDate?: string;
  notes?: string;
};

type StockInBatchItemInput = {
  categoryId: string;
  quantity: number;
  purchasePrice: number;
  salePrice?: number;
  productConditionId?: string;
  storageZoneId?: string;
  warehousePositionId?: string;
  actualStockDate?: string;
  notes?: string;
};

type CategoryInventoryRow = {
  id: string;
  name: string;
  stock: number;
  latestProductConditionName: string | null;
  latestSkuCombo: unknown | null;
  latestActualStockDate: string | null;
  latestCreatedAt: Date | null;
  latestSalePrice: number | null;
  latestPurchasePrice: number | null;
  positionLabels: string[];
};

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

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

  private toPrismaDecimal(value?: number | null) {
    if (value === undefined || value === null) return undefined;
    return new Prisma.Decimal(value);
  }

  private asNumber(value: Prisma.Decimal | number | null | undefined) {
    if (value === undefined || value === null) return null;
    return Number(value);
  }

  private async ensureCategoryExists(categoryId: string) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new NotFoundException('Danh mục không tồn tại');
    }

    return category;
  }

  private async getLatestActivePurchasePrice(categoryId: string) {
    const transaction = await this.prisma.inventoryTransaction.findFirst({
      where: {
        categoryId,
        type: TransactionType.STOCK_IN,
        status: InventoryTransactionStatus.ACTIVE,
        purchasePrice: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      select: { purchasePrice: true },
    });

    return this.asNumber(transaction?.purchasePrice) ?? 0;
  }

  async getCurrentStockByCategory(categoryId: string): Promise<number> {
    await this.ensureCategoryExists(categoryId);

    const transactions = await this.prisma.inventoryTransaction.findMany({
      where: {
        categoryId,
        status: InventoryTransactionStatus.ACTIVE,
      },
      select: {
        type: true,
        quantity: true,
      },
    });

    return transactions.reduce((sum, transaction) => {
      return sum + (transaction.type === TransactionType.STOCK_IN ? transaction.quantity : -transaction.quantity);
    }, 0);
  }

  private async ensureCanApplyStockDelta(
    type: TransactionType,
    quantity: number,
    categoryId?: string | null,
    warehousePositionId?: string | null,
    storageZoneId?: string | null,
  ) {
    if (type !== TransactionType.STOCK_OUT) return;

    const [currentStock, position, zone] = await Promise.all([
      categoryId ? this.getCurrentStockByCategory(categoryId) : Promise.resolve(0),
      warehousePositionId
        ? this.prisma.warehousePosition.findUnique({
            where: { id: warehousePositionId },
            select: { currentStock: true },
          })
        : Promise.resolve(null),
      storageZoneId
        ? this.prisma.storageZone.findUnique({
            where: { id: storageZoneId },
            select: { currentStock: true },
          })
        : Promise.resolve(null),
    ]);

    if (categoryId && currentStock < quantity) {
      throw new BadRequestException('Không thể xuất quá số lượng tồn kho hiện tại');
    }

    if (position && position.currentStock < quantity) {
      throw new BadRequestException('Vị trí kho hiện tại không đủ tồn kho');
    }

    if (zone && zone.currentStock < quantity) {
      throw new BadRequestException('Khu vực hiện tại không đủ tồn kho');
    }
  }

  private async syncPreliminaryCheckStatus(preliminaryCheckId?: string | null) {
    if (!preliminaryCheckId) return;

    const activeLinkedTransactions = await this.prisma.inventoryTransaction.count({
      where: {
        preliminaryCheckId,
        status: InventoryTransactionStatus.ACTIVE,
      },
    });

    await this.prisma.preliminaryCheck.update({
      where: { id: preliminaryCheckId },
      data: {
        status: activeLinkedTransactions > 0 ? 'COMPLETED' : 'PENDING',
      },
    });
  }

  private async applyTransactionImpact(
    transaction: {
      categoryId?: string | null;
      type: TransactionType;
      quantity: number;
      warehousePositionId?: string | null;
      storageZoneId?: string | null;
      preliminaryCheckId?: string | null;
    },
    mode: 'apply' | 'reverse',
  ) {
    const effectiveType =
      mode === 'apply'
        ? transaction.type
        : transaction.type === TransactionType.STOCK_IN
          ? TransactionType.STOCK_OUT
          : TransactionType.STOCK_IN;

    await this.ensureCanApplyStockDelta(
      effectiveType,
      transaction.quantity,
      transaction.categoryId,
      transaction.warehousePositionId,
      transaction.storageZoneId,
    );

    const delta =
      effectiveType === TransactionType.STOCK_IN
        ? { increment: transaction.quantity }
        : { decrement: transaction.quantity };

    const ops: Prisma.PrismaPromise<unknown>[] = [];

    if (transaction.warehousePositionId) {
      ops.push(
        this.prisma.warehousePosition.update({
          where: { id: transaction.warehousePositionId },
          data: { currentStock: delta },
        }) as never,
      );
    }

    if (transaction.storageZoneId) {
      ops.push(
        this.prisma.storageZone.update({
          where: { id: transaction.storageZoneId },
          data: { currentStock: delta },
        }) as never,
      );
    }

    if (ops.length > 0) {
      await this.prisma.$transaction(ops);
    }
    await this.syncPreliminaryCheckStatus(transaction.preliminaryCheckId);
  }

  private computeBusinessStatus(stock: number): 'CON_HANG' | 'HET_HANG' {
    return stock > 0 ? 'CON_HANG' : 'HET_HANG';
  }

  private async buildCategoryInventoryRows(filters: {
    categoryId?: string;
    productConditionId?: string;
    classificationId?: string;
    materialId?: string;
    colorId?: string;
    sizeId?: string;
    storageZoneId?: string;
    positionId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }): Promise<CategoryInventoryRow[]> {
    const categories = await this.prisma.category.findMany({
      where: {
        ...(filters.categoryId ? { id: filters.categoryId } : {}),
        ...(filters.search ? { name: { contains: filters.search } } : {}),
      },
      orderBy: { name: 'asc' },
    });

    const transactionWhere: Prisma.InventoryTransactionWhereInput = {
      status: InventoryTransactionStatus.ACTIVE,
      ...(filters.productConditionId ? { productConditionId: filters.productConditionId } : {}),
      ...(filters.storageZoneId ? { storageZoneId: filters.storageZoneId } : {}),
      ...(filters.positionId ? { warehousePositionId: filters.positionId } : {}),
      ...((filters.startDate || filters.endDate)
        ? {
            createdAt: {
              ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
              ...(filters.endDate ? { lte: new Date(filters.endDate) } : {}),
            },
          }
        : {}),
      ...((filters.classificationId || filters.materialId || filters.colorId || filters.sizeId)
        ? {
            skuCombo: {
              ...(filters.classificationId ? { classificationId: filters.classificationId } : {}),
              ...(filters.materialId ? { materialId: filters.materialId } : {}),
              ...(filters.colorId ? { colorId: filters.colorId } : {}),
              ...(filters.sizeId ? { sizeId: filters.sizeId } : {}),
            },
          }
        : {}),
    };

    const transactions = await this.prisma.inventoryTransaction.findMany({
      where: transactionWhere,
      include: {
        category: true,
        warehousePosition: { select: { label: true } },
        productCondition: true,
        skuCombo: {
          include: {
            classification: true,
            color: true,
            size: true,
            material: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const map = new Map<string, CategoryInventoryRow>();
    for (const category of categories) {
      map.set(category.id, {
        id: category.id,
        name: category.name,
        stock: 0,
        latestProductConditionName: null,
        latestSkuCombo: null,
        latestActualStockDate: null,
        latestCreatedAt: null,
        latestSalePrice: null,
        latestPurchasePrice: null,
        positionLabels: [],
      });
    }

    for (const transaction of transactions) {
      if (!transaction.categoryId || !transaction.category) continue;
      const current =
        map.get(transaction.categoryId) ??
        {
          id: transaction.categoryId,
          name: transaction.category.name,
          stock: 0,
          latestProductConditionName: null,
          latestSkuCombo: null,
          latestActualStockDate: null,
          latestCreatedAt: null,
          latestSalePrice: null,
          latestPurchasePrice: null,
          positionLabels: [],
        };

      current.stock += transaction.type === TransactionType.STOCK_IN ? transaction.quantity : -transaction.quantity;

      if (!current.latestCreatedAt || transaction.createdAt > current.latestCreatedAt) {
        current.latestCreatedAt = transaction.createdAt;
        current.latestActualStockDate = transaction.actualStockDate?.toISOString() ?? null;
        current.latestSalePrice = this.asNumber(transaction.salePrice);
        current.latestPurchasePrice = this.asNumber(transaction.purchasePrice);
        current.latestProductConditionName = transaction.productCondition?.name ?? null;
        current.latestSkuCombo = transaction.skuCombo ?? null;
      }

      if (transaction.warehousePosition?.label && !current.positionLabels.includes(transaction.warehousePosition.label)) {
        current.positionLabels.push(transaction.warehousePosition.label);
      }

      map.set(current.id, current);
    }

    return Array.from(map.values());
  }

  async stockIn(
    categoryId: string,
    quantity: number,
    userId: string,
    options?: StockInOptions,
  ): Promise<InventoryTransaction> {
    if (quantity <= 0) {
      throw new BadRequestException('Số lượng nhập kho phải lớn hơn 0');
    }

    const normalizedCategoryId = categoryId.trim();
    await this.ensureCategoryExists(normalizedCategoryId);

    const storageZoneId = options?.storageZoneId;
    const warehousePositionId = options?.warehousePositionId;

    if (storageZoneId) {
      const zone = await this.prisma.storageZone.findUnique({
        where: { id: storageZoneId },
      });

      if (!zone) {
        throw new NotFoundException('Khu vực hàng hoá không tồn tại');
      }

      const remaining = zone.maxCapacity - zone.currentStock;
      if (remaining <= 0) {
        throw new BadRequestException('Khu vực này đã đầy, không thể nhập thêm hàng');
      }
      if (quantity > remaining) {
        throw new BadRequestException(`Chỉ được nhập tối đa ${remaining}`);
      }
    }

    if (warehousePositionId) {
      const position = await this.prisma.warehousePosition.findUnique({
        where: { id: warehousePositionId },
      });

      if (!position) {
        throw new NotFoundException('Vị trí kho không tồn tại');
      }

      if (position.maxCapacity !== null) {
        const remaining = position.maxCapacity - position.currentStock;
        if (remaining <= 0) {
          throw new BadRequestException('Vị trí này đã đầy, không thể nhập thêm hàng');
        }
        if (quantity > remaining) {
          throw new BadRequestException(`Chỉ cho phép nhập tối đa ${remaining}`);
        }
      }
    }

    const purchasePrice = options?.purchasePrice ?? 0;
    const salePrice = options?.salePrice ?? purchasePrice;

    if (purchasePrice <= 0) {
      throw new BadRequestException('Giá nhập bắt buộc và phải lớn hơn 0');
    }

    const actualStockDate = options?.actualStockDate
      ? new Date(options.actualStockDate)
      : new Date();

    const ops: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.inventoryTransaction.create({
        data: {
          categoryId: normalizedCategoryId,
          type: TransactionType.STOCK_IN,
          quantity,
          purchasePrice: this.toPrismaDecimal(purchasePrice),
          salePrice: this.toPrismaDecimal(salePrice),
          status: InventoryTransactionStatus.ACTIVE,
          userId,
          skuComboId: options?.skuComboId,
          productConditionId: options?.productConditionId,
          storageZoneId,
          warehousePositionId,
          preliminaryCheckId: options?.preliminaryCheckId,
          actualStockDate,
          notes: options?.notes,
        },
      }) as never,
    ];

    if (warehousePositionId) {
      ops.push(
        this.prisma.warehousePosition.update({
          where: { id: warehousePositionId },
          data: { currentStock: { increment: quantity } },
        }) as never,
      );
    }

    if (storageZoneId) {
      ops.push(
        this.prisma.storageZone.update({
          where: { id: storageZoneId },
          data: { currentStock: { increment: quantity } },
        }) as never,
      );
    }

    if (options?.preliminaryCheckId) {
      ops.push(
        this.prisma.preliminaryCheck.update({
          where: { id: options.preliminaryCheckId },
          data: { status: 'COMPLETED' },
        }) as never,
      );
    }

    const results = await this.prisma.$transaction(ops);
    return results[0] as InventoryTransaction;
  }

  async stockInBatch(
    items: StockInBatchItemInput[],
    userId: string,
    options?: {
      preliminaryCheckId?: string;
    },
  ) {
    if (!items.length) {
      throw new BadRequestException('Vui lòng thêm ít nhất một dòng nhập kho');
    }

    const preliminaryCheckId = options?.preliminaryCheckId;

    if (preliminaryCheckId) {
      const preliminaryCheck = await this.prisma.preliminaryCheck.findUnique({
        where: { id: preliminaryCheckId },
      });

      if (!preliminaryCheck) {
        throw new NotFoundException('Phiếu kiểm sơ bộ không tồn tại');
      }

      const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
      if (totalQuantity !== preliminaryCheck.quantity) {
        throw new BadRequestException(`Tổng số lượng chi tiết phải khớp kiểm sơ bộ: ${preliminaryCheck.quantity}`);
      }
    }

    const transactions: InventoryTransaction[] = [];
    for (const item of items) {
      const transaction = await this.stockIn(item.categoryId, item.quantity, userId, {
        purchasePrice: item.purchasePrice,
        salePrice: item.salePrice,
        skuComboId: (item as any).skuComboId,
        productConditionId: item.productConditionId,
        storageZoneId: item.storageZoneId,
        warehousePositionId: item.warehousePositionId,
        preliminaryCheckId,
        actualStockDate: item.actualStockDate,
        notes: item.notes,
      });
      transactions.push(transaction);
    }

    return {
      success: true,
      importedRows: transactions.length,
      totalQuantity: transactions.reduce((sum, item) => sum + item.quantity, 0),
      transactions,
    };
  }

  async stockOut(
    categoryId: string,
    quantity: number,
    userId: string,
    options?: {
      purchasePrice?: number;
      salePrice?: number;
      skuComboId?: string;
      productConditionId?: string;
      storageZoneId?: string;
      warehousePositionId?: string;
      notes?: string;
    },
  ): Promise<InventoryTransaction> {
    if (quantity <= 0) {
      throw new BadRequestException('Số lượng xuất kho phải lớn hơn 0');
    }

    const normalizedCategoryId = categoryId.trim();
    await this.ensureCategoryExists(normalizedCategoryId);

    const currentStock = await this.getCurrentStockByCategory(normalizedCategoryId);
    if (quantity > currentStock) {
      throw new BadRequestException('Không thể xuất quá số lượng tồn kho hiện tại');
    }

    const purchasePrice =
      options?.purchasePrice ?? (await this.getLatestActivePurchasePrice(normalizedCategoryId));
    const salePrice = options?.salePrice ?? purchasePrice;
    const storageZoneId = options?.storageZoneId;
    const warehousePositionId = options?.warehousePositionId;

    if (warehousePositionId) {
      const position = await this.prisma.warehousePosition.findUnique({
        where: { id: warehousePositionId },
      });

      if (!position) {
        throw new NotFoundException('Vị trí kho không tồn tại');
      }

      if (quantity > position.currentStock) {
        throw new BadRequestException('Không thể xuất quá số lượng hiện có tại vị trí kho đã chọn');
      }
    }

    const ops: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.inventoryTransaction.create({
        data: {
          categoryId: normalizedCategoryId,
          type: TransactionType.STOCK_OUT,
          quantity,
          purchasePrice: this.toPrismaDecimal(purchasePrice),
          salePrice: this.toPrismaDecimal(salePrice),
          status: InventoryTransactionStatus.ACTIVE,
          userId,
          skuComboId: options?.skuComboId,
          productConditionId: options?.productConditionId,
          storageZoneId,
          warehousePositionId,
          notes: options?.notes,
        },
      }) as never,
    ];

    if (storageZoneId) {
      ops.push(
        this.prisma.storageZone.update({
          where: { id: storageZoneId },
          data: { currentStock: { decrement: quantity } },
        }) as never,
      );
    }

    if (warehousePositionId) {
      ops.push(
        this.prisma.warehousePosition.update({
          where: { id: warehousePositionId },
          data: { currentStock: { decrement: quantity } },
        }) as never,
      );
    }

    const results = await this.prisma.$transaction(ops);
    return results[0] as InventoryTransaction;
  }

  async adjustStock(
    categoryId: string,
    quantity: number,
    type: 'INCREASE' | 'DECREASE',
    userId: string,
    options?: {
      warehousePositionId?: string;
      reason?: string;
    },
  ): Promise<InventoryTransaction> {
    const normalizedCategoryId = categoryId.trim();
    const adjustmentNote = options?.reason
      ? `[ADJUSTMENT] ${options.reason}`
      : '[ADJUSTMENT]';
    const latestPrice = await this.getLatestActivePurchasePrice(normalizedCategoryId);

    if (type === 'INCREASE') {
      return this.stockIn(normalizedCategoryId, quantity, userId, {
        purchasePrice: latestPrice,
        salePrice: latestPrice,
        warehousePositionId: options?.warehousePositionId,
        notes: adjustmentNote,
      });
    }

    return this.stockOut(normalizedCategoryId, quantity, userId, {
      purchasePrice: latestPrice,
      salePrice: latestPrice,
      warehousePositionId: options?.warehousePositionId,
      notes: adjustmentNote,
    });
  }

  async updateTransactionStatus(
    transactionIds: string[],
    status: InventoryTransactionStatus,
  ) {
    const transactions = await this.prisma.inventoryTransaction.findMany({
      where: { id: { in: transactionIds } },
    });

    if (transactions.length !== transactionIds.length) {
      throw new NotFoundException('Không tìm thấy một hoặc nhiều giao dịch');
    }

    for (const transaction of transactions) {
      if (transaction.status === status) continue;

      if (status === InventoryTransactionStatus.SUSPENDED) {
        await this.applyTransactionImpact(transaction, 'reverse');
      } else {
        await this.applyTransactionImpact(transaction, 'apply');
      }

      await this.prisma.inventoryTransaction.update({
        where: { id: transaction.id },
        data: { status },
      });
    }

    return { updated: transactions.length, status };
  }

  async updateTransaction(
    id: string,
    data: Record<string, unknown>,
    userId: string,
    userRole?: string,
  ) {
    const transaction = await this.prisma.inventoryTransaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      throw new NotFoundException('Giao dịch không tồn tại');
    }

    // Validate quantity
    if (data.quantity !== undefined) {
      const qty = Number(data.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        throw new BadRequestException('Số lượng phải lớn hơn 0');
      }

      // For stock-out: check if new quantity exceeds available stock
      if (transaction.type === TransactionType.STOCK_OUT) {
        const currentCategoryStock = await this.getCurrentStockByCategory(transaction.categoryId!);
        const stockAfterRevert = currentCategoryStock + transaction.quantity; // revert old qty
        if (qty > stockAfterRevert) {
          throw new BadRequestException(
            `Không thể sửa số lượng xuất thành ${qty}. Tồn kho hiện tại chỉ có ${stockAfterRevert} sau khi hoàn lại giao dịch cũ.`,
          );
        }
      }
    }

    // Validate price
    if (data.purchasePrice !== undefined) {
      const price = Number(data.purchasePrice);
      if (!Number.isFinite(price) || price < 0) {
        throw new BadRequestException('Giá nhập không hợp lệ');
      }
    }

    const updateData: Record<string, unknown> = {};

    if (data.quantity !== undefined) updateData.quantity = Number(data.quantity);
    if (data.purchasePrice !== undefined) {
      updateData.purchasePrice = this.toPrismaDecimal(Number(data.purchasePrice));
      updateData.salePrice = this.toPrismaDecimal(Number(data.purchasePrice));
    }
    if (data.notes !== undefined) updateData.notes = data.notes || null;
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
    if (data.productConditionId !== undefined) updateData.productConditionId = data.productConditionId || null;
    if (data.storageZoneId !== undefined) updateData.storageZoneId = data.storageZoneId || null;
    if (data.warehousePositionId !== undefined) updateData.warehousePositionId = data.warehousePositionId || null;
    if (data.actualStockDate !== undefined) updateData.actualStockDate = data.actualStockDate ? new Date(data.actualStockDate as string) : null;

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('Không có thông tin nào được thay đổi');
    }

    // Handle quantity change — adjust stock counts
    if (updateData.quantity !== undefined && Number(updateData.quantity) !== transaction.quantity) {
      const diff = Number(updateData.quantity) - transaction.quantity;
      const stockDiff = transaction.type === TransactionType.STOCK_IN ? diff : -diff;

      if (transaction.warehousePositionId) {
        const position = await this.prisma.warehousePosition.findUnique({
          where: { id: transaction.warehousePositionId },
        });
        if (position) {
          const newStock = position.currentStock + stockDiff;
          if (newStock < 0) {
            throw new BadRequestException(
              `Không thể sửa: vị trí ${position.label || position.id} sẽ có tồn kho âm (${newStock})`,
            );
          }
          await this.prisma.warehousePosition.update({
            where: { id: transaction.warehousePositionId },
            data: { currentStock: { increment: stockDiff } },
          });
        }
      }
      if (transaction.storageZoneId) {
        const zone = await this.prisma.storageZone.findUnique({
          where: { id: transaction.storageZoneId },
        });
        if (zone) {
          const newStock = zone.currentStock + stockDiff;
          if (newStock < 0) {
            throw new BadRequestException(
              `Không thể sửa: khu vực ${zone.name} sẽ có tồn kho âm (${newStock})`,
            );
          }
          await this.prisma.storageZone.update({
            where: { id: transaction.storageZoneId },
            data: { currentStock: { increment: stockDiff } },
          });
        }
      }
    }

    const updated = await this.prisma.inventoryTransaction.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
        skuCombo: { include: { classification: true, color: true, size: true, material: true } },
      },
    });

    return {
      success: true,
      message: 'Cập nhật giao dịch thành công',
      data: updated,
    };
  }

  async deleteTransactions(transactionIds: string[]) {
    const transactions = await this.prisma.inventoryTransaction.findMany({
      where: { id: { in: transactionIds } },
    });

    if (transactions.length !== transactionIds.length) {
      throw new NotFoundException('Không tìm thấy một hoặc nhiều giao dịch');
    }

    for (const transaction of transactions) {
      if (transaction.status === InventoryTransactionStatus.ACTIVE) {
        await this.applyTransactionImpact(transaction, 'reverse');
      }

      await this.prisma.inventoryTransaction.delete({
        where: { id: transaction.id },
      });

      await this.syncPreliminaryCheckStatus(transaction.preliminaryCheckId);
    }

    return { deleted: transactions.length };
  }

  async getTransactionHistory(filters: {
    kind?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<InventoryTransactionHistoryItem>> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const transactions = await this.prisma.inventoryTransaction.findMany({
      include: {
        category: true,
        warehousePosition: {
          select: {
            label: true,
            layout: { select: { name: true } },
          },
        },
        storageZone: {
          select: { name: true },
        },
        skuCombo: {
          include: {
            classification: true,
            color: true,
            size: true,
            material: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    const userNameMap = await this.buildUserNameMap(
      transactions.map((transaction) => transaction.userId),
    );

    const mapped = transactions.map((transaction) => {
      const isAdjustment = transaction.notes?.startsWith('[ADJUSTMENT]') ?? false;
      const note = isAdjustment
        ? transaction.notes?.replace('[ADJUSTMENT]', '').trim() || ''
        : transaction.notes || '';
      const kind = isAdjustment
        ? 'ADJUSTMENT'
        : transaction.type === TransactionType.STOCK_IN
          ? 'STOCK_IN'
          : 'STOCK_OUT';

      return {
        id: transaction.id,
        categoryId: transaction.categoryId,
        createdAt: transaction.createdAt.toISOString(),
        actualStockDate: transaction.actualStockDate?.toISOString() ?? null,
        kind,
        type: transaction.type,
        status: transaction.status,
        quantity: transaction.quantity,
        signedQuantity:
          transaction.type === TransactionType.STOCK_IN
            ? transaction.quantity
            : -transaction.quantity,
        purchasePrice: this.asNumber(transaction.purchasePrice),
        salePrice: this.asNumber(transaction.salePrice),
        categoryName: transaction.category?.name ?? 'Danh mục',
        positionLabel: transaction.warehousePosition?.label ?? null,
        warehouseTypeName: transaction.warehousePosition?.layout?.name ?? null,
        storageZoneName: transaction.storageZone?.name ?? null,
        productName: transaction.skuCombo
          ? [
              transaction.skuCombo.classification?.name,
              transaction.skuCombo.color?.name,
              transaction.skuCombo.size?.name,
              transaction.skuCombo.material?.name,
            ].filter(Boolean).join(' - ')
          : null,
        sku: transaction.skuCombo?.compositeSku ?? null,
        userName:
          userNameMap.get(transaction.userId) ?? 'NgÆ°á»i dÃ¹ng Ä‘Ã£ xÃ³a',
        note,
      } satisfies InventoryTransactionHistoryItem;
    });

    const normalizedKind = (filters.kind ?? 'ALL').toUpperCase();
    const filtered =
      normalizedKind === 'ALL'
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

  async getInventory(
    filters: InventoryFilters,
  ): Promise<PaginatedResponse<unknown>> {
    const { categoryId, startDate, endDate, positionId } = filters;
    const hasFilter = categoryId || startDate || endDate || positionId;

    if (!hasFilter) {
      throw new BadRequestException('Vui lòng chọn ít nhất một điều kiện lọc');
    }

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;

    const rows = await this.buildCategoryInventoryRows({
      categoryId,
      startDate,
      endDate,
      positionId,
    });

    const paged = rows.slice(skip, skip + limit);
    return {
      data: paged,
      total: rows.length,
      page,
      limit,
      totalPages: Math.ceil(rows.length / limit) || 1,
    };
  }

  async getCapacityRatio(): Promise<CapacityInfo> {
    const config = await this.prisma.warehouseConfig.findFirst();
    const maxCapacity = config?.maxCapacity ?? 1000;

    const transactions = await this.prisma.inventoryTransaction.findMany({
      where: { status: InventoryTransactionStatus.ACTIVE },
      select: { type: true, quantity: true },
    });

    const currentTotal = transactions.reduce((sum, transaction) => {
      return sum + (transaction.type === TransactionType.STOCK_IN ? transaction.quantity : -transaction.quantity);
    }, 0);
    const ratio = maxCapacity > 0 ? currentTotal / maxCapacity : 0;

    return {
      currentTotal,
      maxCapacity,
      ratio,
      isWarning: ratio > 0.9,
    };
  }

  async getInventoryV2(filters: {
    categoryId?: string;
    businessStatus?: string;
    productConditionId?: string;
    classificationId?: string;
    materialId?: string;
    colorId?: string;
    sizeId?: string;
    storageZoneId?: string;
    positionId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<unknown>> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;

    let rows = await this.buildCategoryInventoryRows(filters);
    const data = rows.map((row) => ({
      categoryId: row.id,
      categoryName: row.name,
      stock: row.stock,
      positionLabels: row.positionLabels,
      latestProductConditionName: row.latestProductConditionName,
      latestSkuCombo: row.latestSkuCombo,
      latestActualStockDate: row.latestActualStockDate,
      latestPurchasePrice: row.latestPurchasePrice,
      latestSalePrice: row.latestSalePrice,
      businessStatus: this.computeBusinessStatus(row.stock),
    }));

    const filtered = filters.businessStatus
      ? data.filter((item) => item.businessStatus === filters.businessStatus)
      : data;
    const paged = filtered.slice(skip, skip + limit);

    return {
      data: paged,
      total: filtered.length,
      page,
      limit,
      totalPages: Math.ceil(filtered.length / limit) || 1,
    };
  }

  /**
   * Get inventory grouped by SKU combo (product-level).
   * Each row = 1 unique product (SKU), not 1 category.
   */
  async getInventoryBySku(filters: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<unknown>> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 100;
    const skip = (page - 1) * limit;

    const transactions = await this.prisma.inventoryTransaction.findMany({
      where: { status: InventoryTransactionStatus.ACTIVE },
      include: {
        category: true,
        skuCombo: {
          include: {
            classification: true,
            color: true,
            size: true,
            material: true,
          },
        },
        productCondition: true,
        warehousePosition: { select: { label: true } },
        storageZone: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by skuComboId (or categoryId if no skuCombo)
    const map = new Map<string, {
      key: string;
      skuComboId: string | null;
      categoryId: string | null;
      categoryName: string;
      productName: string;
      sku: string;
      stock: number;
      productConditionName: string | null;
      positionLabels: string[];
      storageZoneNames: string[];
      latestPurchasePrice: number | null;
    }>();

    for (const tx of transactions) {
      const skuCombo = tx.skuCombo;
      const key = skuCombo ? `sku:${skuCombo.id}` : `cat:${tx.categoryId || tx.id}`;

      const productName = skuCombo
        ? [skuCombo.classification?.name, skuCombo.color?.name, skuCombo.size?.name, skuCombo.material?.name].filter(Boolean).join(' - ')
        : tx.category?.name || '-';

      const sku = skuCombo?.compositeSku || '-';

      const existing = map.get(key) ?? {
        key,
        skuComboId: skuCombo?.id || null,
        categoryId: tx.categoryId,
        categoryName: tx.category?.name || '-',
        productName,
        sku,
        stock: 0,
        productConditionName: null,
        positionLabels: [],
        storageZoneNames: [],
        latestPurchasePrice: null,
      };

      existing.stock += tx.type === TransactionType.STOCK_IN ? tx.quantity : -tx.quantity;

      if (!existing.productConditionName && tx.productCondition?.name) {
        existing.productConditionName = tx.productCondition.name;
      }
      if (!existing.latestPurchasePrice && tx.purchasePrice) {
        existing.latestPurchasePrice = this.asNumber(tx.purchasePrice);
      }
      if (tx.warehousePosition?.label && !existing.positionLabels.includes(tx.warehousePosition.label)) {
        existing.positionLabels.push(tx.warehousePosition.label);
      }
      if (tx.storageZone?.name && !existing.storageZoneNames.includes(tx.storageZone.name)) {
        existing.storageZoneNames.push(tx.storageZone.name);
      }

      map.set(key, existing);
    }

    let rows = Array.from(map.values()).sort((a, b) => a.productName.localeCompare(b.productName));

    // Search filter
    if (filters.search) {
      const q = filters.search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.productName.toLowerCase().includes(q) ||
          r.sku.toLowerCase().includes(q) ||
          r.categoryName.toLowerCase().includes(q),
      );
    }

    const paged = rows.slice(skip, skip + limit);

    return {
      data: paged,
      total: rows.length,
      page,
      limit,
      totalPages: Math.ceil(rows.length / limit) || 1,
    };
  }

  async exportExcelV2(filters: {
    categoryId?: string;
    businessStatus?: string;
    productConditionId?: string;
    classificationId?: string;
    materialId?: string;
    colorId?: string;
    sizeId?: string;
    storageZoneId?: string;
    search?: string;
  }): Promise<Buffer> {
    const data = await this.getInventoryV2({
      ...filters,
      page: 1,
      limit: 10000,
    });

    if (data.data.length === 0) {
      throw new NotFoundException('Không có dữ liệu để xuất báo cáo');
    }

    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Ton kho V2');

    const statusLabels: Record<string, string> = {
      CON_HANG: 'Còn hàng',
      HET_HANG: 'Hết hàng',
    };

    worksheet.columns = [
      { header: 'Danh mục', key: 'categoryName', width: 28 },
      { header: 'Số lượng', key: 'stock', width: 14 },
      { header: 'Vị trí', key: 'positionLabels', width: 24 },
      { header: 'Tình trạng hàng', key: 'latestProductConditionName', width: 20 },
      { header: 'Giá nhập gần nhất', key: 'latestPurchasePrice', width: 18 },
      { header: 'Giá bán gần nhất', key: 'latestSalePrice', width: 18 },
      { header: 'Trạng thái', key: 'businessStatus', width: 18 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: 'center' };

    for (const row of data.data as Array<Record<string, unknown>>) {
      worksheet.addRow({
        categoryName: row.categoryName,
        stock: row.stock,
        positionLabels: Array.isArray(row.positionLabels) ? row.positionLabels.join(', ') : '-',
        latestProductConditionName: row.latestProductConditionName ?? '-',
        latestPurchasePrice: row.latestPurchasePrice ?? '-',
        latestSalePrice: row.latestSalePrice ?? '-',
        businessStatus: statusLabels[String(row.businessStatus)] ?? row.businessStatus,
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
