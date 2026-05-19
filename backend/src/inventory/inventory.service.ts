import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryTransaction,
  InventoryTransactionStatus,
  PreliminaryCheckStatus,
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
  kind: 'ALL' | 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT' | 'TRANSFER';
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
  storageZoneId: string | null;
  warehousePositionId: string | null;
  productName: string | null;
  sku: string | null;
  skuComboId: string | null;
  receiptGroupId: string | null;
  classificationId: string | null;
  classificationName: string | null;
  colorId: string | null;
  colorName: string | null;
  sizeId: string | null;
  sizeName: string | null;
  materialId: string | null;
  materialName: string | null;
  productConditionId: string | null;
  productConditionName: string | null;
  warehouseTypeId: string | null;
  userName: string;
  note: string;
  imageUrls: string[];
}

type StockInOptions = {
  purchasePrice?: number;
  salePrice?: number;
  skuComboId?: string;
  productConditionId?: string;
  storageZoneId?: string;
  warehouseTypeId?: string;
  warehousePositionId?: string;
  preliminaryCheckId?: string;
  actualStockDate?: string;
  notes?: string;
  receiptGroupId?: string;
  imageUrls?: string[];
};

type StockInBatchItemInput = {
  categoryId: string;
  quantity: number;
  purchasePrice: number;
  salePrice?: number;
  skuComboId?: string;
  productConditionId?: string;
  storageZoneId?: string;
  warehouseTypeId?: string;
  warehousePositionId?: string;
  actualStockDate?: string;
  notes?: string;
  imageUrls?: string[];
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

type TransferStockParams = {
  categoryId: string;
  skuComboId?: string;
  quantity: number;
  sourcePositionId: string;
  targetPositionId: string;
  reason: string;
  userId: string;
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

  private removeDiacritics(str: string): string {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  }

  private appendReceiptGroupTag(
    notes?: string | null,
    receiptGroupId?: string,
  ) {
    const cleanNotes = (notes || '').trim();
    if (!receiptGroupId) {
      return cleanNotes || null;
    }

    const withoutExistingTag = cleanNotes
      .replace(/\[RECEIPT_GROUP:[^\]]+\]/g, '')
      .trim();
    const prefix = `[RECEIPT_GROUP:${receiptGroupId}]`;
    return withoutExistingTag ? `${prefix} ${withoutExistingTag}` : prefix;
  }

  private parseTransactionNotes(notes?: string | null) {
    const raw = notes || '';
    const receiptGroupMatch = raw.match(/\[RECEIPT_GROUP:([^\]]+)\]/);
    const transferGroupMatch = raw.match(/\[TRANSFER_GROUP:([^\]]+)\]/);
    const transferFromMatch = raw.match(/\[TRANSFER_FROM:([^\]]+)\]/);
    const transferToMatch = raw.match(/\[TRANSFER_TO:([^\]]+)\]/);
    const receiptGroupId = receiptGroupMatch?.[1] || null;
    const isAdjustment = raw.includes('[ADJUSTMENT]');
    const isTransfer = raw.includes('[TRANSFER]');
    const cleanNote = raw
      .replace(/\[RECEIPT_GROUP:[^\]]+\]/g, '')
      .replace(/\[TRANSFER_GROUP:[^\]]+\]/g, '')
      .replace(/\[TRANSFER_FROM:[^\]]+\]/g, '')
      .replace(/\[TRANSFER_TO:[^\]]+\]/g, '')
      .replace(/\[TRANSFER\]/g, '')
      .replace(/\[ADJUSTMENT\]/g, '')
      .trim();

    return {
      receiptGroupId,
      isAdjustment,
      isTransfer,
      transferGroupId: transferGroupMatch?.[1] || null,
      transferFrom: transferFromMatch?.[1] || null,
      transferTo: transferToMatch?.[1] || null,
      note: cleanNote,
    };
  }

  private async ensureCategoryIsActive(categoryId: string) {
    const product = await this.prisma.product.findFirst({
      where: { categoryId },
      select: { isDiscontinued: true },
    });

    if (product?.isDiscontinued) {
      throw new BadRequestException(
        'San pham nay da ngung san xuat, khong the xuat kho',
      );
    }
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

  private async getLatestInboundContext(params: {
    categoryId: string;
    skuComboId?: string;
    warehousePositionId?: string;
    storageZoneId?: string;
  }) {
    return this.prisma.inventoryTransaction.findFirst({
      where: {
        categoryId: params.categoryId,
        type: TransactionType.STOCK_IN,
        status: InventoryTransactionStatus.ACTIVE,
        ...(params.skuComboId ? { skuComboId: params.skuComboId } : {}),
        ...(params.warehousePositionId
          ? { warehousePositionId: params.warehousePositionId }
          : {}),
        ...(params.storageZoneId
          ? { storageZoneId: params.storageZoneId }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        productConditionId: true,
      },
    });
  }

  /**
   * Get stock per storage zone for a given SKU combo.
   * Returns only zones that have stock > 0.
   */
  async getStockBySkuComboPerZone(skuComboId: string): Promise<
    Array<{
      storageZoneId: string;
      storageZoneName: string;
      stock: number;
    }>
  > {
    const transactions = await this.prisma.inventoryTransaction.findMany({
      where: {
        skuComboId,
        storageZoneId: { not: null },
        status: InventoryTransactionStatus.ACTIVE,
      },
      select: {
        type: true,
        quantity: true,
        storageZoneId: true,
        storageZone: { select: { id: true, name: true } },
      },
    });

    const zoneMap = new Map<
      string,
      { storageZoneId: string; storageZoneName: string; stock: number }
    >();

    for (const tx of transactions) {
      if (!tx.storageZoneId || !tx.storageZone) continue;
      const existing = zoneMap.get(tx.storageZoneId) ?? {
        storageZoneId: tx.storageZone.id,
        storageZoneName: tx.storageZone.name,
        stock: 0,
      };
      existing.stock +=
        tx.type === TransactionType.STOCK_IN ? tx.quantity : -tx.quantity;
      zoneMap.set(tx.storageZoneId, existing);
    }

    return Array.from(zoneMap.values()).filter((z) => z.stock > 0);
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
      return (
        sum +
        (transaction.type === TransactionType.STOCK_IN
          ? transaction.quantity
          : -transaction.quantity)
      );
    }, 0);
  }

  async getCurrentStockBySkuCombo(skuComboId: string): Promise<number> {
    const transactions = await this.prisma.inventoryTransaction.findMany({
      where: {
        skuComboId,
        status: InventoryTransactionStatus.ACTIVE,
      },
      select: {
        type: true,
        quantity: true,
      },
    });

    return transactions.reduce((sum, transaction) => {
      return (
        sum +
        (transaction.type === TransactionType.STOCK_IN
          ? transaction.quantity
          : -transaction.quantity)
      );
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
      categoryId
        ? this.getCurrentStockByCategory(categoryId)
        : Promise.resolve(0),
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
      throw new BadRequestException(
        'Không thể xuất quá số lượng tồn kho hiện tại',
      );
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

    const activeLinkedTransactions =
      await this.prisma.inventoryTransaction.count({
        where: {
          preliminaryCheckId,
          status: InventoryTransactionStatus.ACTIVE,
        },
      });

    await this.prisma.preliminaryCheck.update({
      where: { id: preliminaryCheckId },
      data: {
        status:
          activeLinkedTransactions > 0
            ? PreliminaryCheckStatus.APPROVED
            : PreliminaryCheckStatus.PENDING,
      },
    });
  }

  private computeBusinessStatus(stock: number): 'CON_HANG' | 'HET_HANG' {
    return stock > 0 ? 'CON_HANG' : 'HET_HANG';
  }

  private async applyLocationDeltaForEdit(params: {
    type: TransactionType;
    oldQuantity: number;
    newQuantity: number;
    oldWarehousePositionId?: string | null;
    newWarehousePositionId?: string | null;
    oldStorageZoneId?: string | null;
    newStorageZoneId?: string | null;
  }) {
    const sign = params.type === TransactionType.STOCK_IN ? 1 : -1;

    const positionDeltaMap = new Map<string, number>();
    const zoneDeltaMap = new Map<string, number>();

    const addDelta = (
      map: Map<string, number>,
      key: string | null | undefined,
      delta: number,
    ) => {
      if (!key || delta === 0) return;
      map.set(key, (map.get(key) || 0) + delta);
    };

    addDelta(
      positionDeltaMap,
      params.oldWarehousePositionId,
      -sign * params.oldQuantity,
    );
    addDelta(
      positionDeltaMap,
      params.newWarehousePositionId,
      sign * params.newQuantity,
    );
    addDelta(zoneDeltaMap, params.oldStorageZoneId, -sign * params.oldQuantity);
    addDelta(zoneDeltaMap, params.newStorageZoneId, sign * params.newQuantity);

    for (const [positionId, delta] of positionDeltaMap.entries()) {
      const position = await this.prisma.warehousePosition.findUnique({
        where: { id: positionId },
      });

      if (!position) {
        throw new NotFoundException('Vị trí kho không tồn tại');
      }

      const nextStock = position.currentStock + delta;
      if (nextStock < 0) {
        throw new BadRequestException(
          `Không thể cập nhật giao dịch vì vị trí ${position.label || position.id} sẽ âm tồn (${nextStock})`,
        );
      }
      if (position.maxCapacity !== null && nextStock > position.maxCapacity) {
        throw new BadRequestException(
          `Không thể cập nhật giao dịch vì vị trí ${position.label || position.id} vượt sức chứa ${position.maxCapacity}`,
        );
      }
    }

    for (const [zoneId, delta] of zoneDeltaMap.entries()) {
      const zone = await this.prisma.storageZone.findUnique({
        where: { id: zoneId },
      });

      if (!zone) {
        throw new NotFoundException('Khu vực hàng hóa không tồn tại');
      }

      const nextStock = zone.currentStock + delta;
      if (nextStock < 0) {
        throw new BadRequestException(
          `Không thể cập nhật giao dịch vì khu vực ${zone.name} sẽ âm tồn (${nextStock})`,
        );
      }
      if (nextStock > zone.maxCapacity) {
        throw new BadRequestException(
          `Không thể cập nhật giao dịch vì khu vực ${zone.name} vượt sức chứa ${zone.maxCapacity}`,
        );
      }
    }

    const ops: Prisma.PrismaPromise<unknown>[] = [];
    for (const [positionId, delta] of positionDeltaMap.entries()) {
      ops.push(
        this.prisma.warehousePosition.update({
          where: { id: positionId },
          data: { currentStock: { increment: delta } },
        }) as never,
      );
    }

    for (const [zoneId, delta] of zoneDeltaMap.entries()) {
      ops.push(
        this.prisma.storageZone.update({
          where: { id: zoneId },
          data: { currentStock: { increment: delta } },
        }) as never,
      );
    }

    if (ops.length > 0) {
      await this.prisma.$transaction(ops);
    }
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
      ...(filters.productConditionId
        ? { productConditionId: filters.productConditionId }
        : {}),
      ...(filters.storageZoneId
        ? { storageZoneId: filters.storageZoneId }
        : {}),
      ...(filters.positionId
        ? { warehousePositionId: filters.positionId }
        : {}),
      ...(filters.startDate || filters.endDate
        ? {
            createdAt: {
              ...(filters.startDate
                ? { gte: new Date(filters.startDate) }
                : {}),
              ...(filters.endDate ? { lte: new Date(filters.endDate) } : {}),
            },
          }
        : {}),
      ...(filters.classificationId ||
      filters.materialId ||
      filters.colorId ||
      filters.sizeId
        ? {
            skuCombo: {
              ...(filters.classificationId
                ? { classificationId: filters.classificationId }
                : {}),
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
      const current = map.get(transaction.categoryId) ?? {
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

      current.stock +=
        transaction.type === TransactionType.STOCK_IN
          ? transaction.quantity
          : -transaction.quantity;

      if (
        !current.latestCreatedAt ||
        transaction.createdAt > current.latestCreatedAt
      ) {
        current.latestCreatedAt = transaction.createdAt;
        current.latestActualStockDate =
          transaction.actualStockDate?.toISOString() ?? null;
        current.latestSalePrice = this.asNumber(transaction.salePrice);
        current.latestPurchasePrice = this.asNumber(transaction.purchasePrice);
        current.latestProductConditionName =
          transaction.productCondition?.name ?? null;
        current.latestSkuCombo = transaction.skuCombo ?? null;
      }

      if (
        transaction.warehousePosition?.label &&
        !current.positionLabels.includes(transaction.warehousePosition.label)
      ) {
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
    const warehouseTypeId = options?.warehouseTypeId;

    // Pre-transaction: validate zone/type compatibility (non-stock checks)
    let shouldAutoAssignZoneType = false;
    if (storageZoneId) {
      const zone = await this.prisma.storageZone.findUnique({
        where: { id: storageZoneId },
        include: { warehouseType: true },
      });
      if (!zone) throw new NotFoundException('Khu vực hàng hoá không tồn tại');
      if (
        warehouseTypeId &&
        zone.warehouseTypeId &&
        zone.warehouseTypeId !== warehouseTypeId
      ) {
        throw new BadRequestException(
          `Khu vực "${zone.name}" đang được gán vào loại kho "${zone.warehouseType?.name ?? zone.warehouseTypeId}". Vui lòng chọn khu vực thuộc đúng loại kho hoặc thay đổi loại kho.`,
        );
      }
      if (warehouseTypeId && !zone.warehouseTypeId) {
        shouldAutoAssignZoneType = true;
      }
    }

    if (warehousePositionId) {
      const position = await this.prisma.warehousePosition.findUnique({
        where: { id: warehousePositionId },
      });
      if (!position) throw new NotFoundException('Vị trí kho không tồn tại');
      if (!position.isActive)
        throw new BadRequestException('Vị trí kho này đã bị xóa khỏi sơ đồ');
    }

    const purchasePrice = options?.purchasePrice ?? 0;
    const salePrice = options?.salePrice ?? purchasePrice;

    if (purchasePrice < 0) {
      throw new BadRequestException('Giá nhập không được âm');
    }

    const actualStockDate = options?.actualStockDate
      ? new Date(options.actualStockDate)
      : new Date();

    // Interactive transaction: capacity check and writes are atomic, eliminating TOCTOU race
    return this.prisma.$transaction(async (tx) => {
      if (storageZoneId) {
        const freshZone = await tx.storageZone.findUnique({
          where: { id: storageZoneId },
        });
        if (!freshZone)
          throw new NotFoundException('Khu vực hàng hoá không tồn tại');
        const remaining = freshZone.maxCapacity - freshZone.currentStock;
        if (remaining <= 0)
          throw new BadRequestException(
            'Khu vực này đã đầy, không thể nhập thêm hàng',
          );
        if (quantity > remaining)
          throw new BadRequestException(`Chỉ được nhập tối đa ${remaining}`);
      }

      if (warehousePositionId) {
        const freshPos = await tx.warehousePosition.findUnique({
          where: { id: warehousePositionId },
        });
        if (!freshPos) throw new NotFoundException('Vị trí kho không tồn tại');
        if (!freshPos.isActive)
          throw new BadRequestException('Vị trí kho này đã bị xóa khỏi sơ đồ');
        if (freshPos.maxCapacity !== null) {
          const remaining = freshPos.maxCapacity - freshPos.currentStock;
          if (remaining <= 0)
            throw new BadRequestException(
              'Vị trí này đã đầy, không thể nhập thêm hàng',
            );
          if (quantity > remaining)
            throw new BadRequestException(
              `Chỉ cho phép nhập tối đa ${remaining}`,
            );
        }
      }

      const transaction = await tx.inventoryTransaction.create({
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
          warehouseTypeId: warehouseTypeId ?? null,
          warehousePositionId,
          preliminaryCheckId: options?.preliminaryCheckId,
          actualStockDate,
          notes: this.appendReceiptGroupTag(
            options?.notes,
            options?.receiptGroupId,
          ),
          imageUrls: options?.imageUrls?.length
            ? JSON.stringify(options.imageUrls)
            : null,
        },
      });

      if (warehousePositionId) {
        await tx.warehousePosition.update({
          where: { id: warehousePositionId },
          data: { currentStock: { increment: quantity } },
        });
      }

      if (storageZoneId) {
        await tx.storageZone.update({
          where: { id: storageZoneId },
          data: { currentStock: { increment: quantity } },
        });
        // Auto-assign zone type using updateMany with null guard to avoid race condition
        if (shouldAutoAssignZoneType && warehouseTypeId) {
          await tx.storageZone.updateMany({
            where: { id: storageZoneId, warehouseTypeId: null },
            data: { warehouseTypeId },
          });
        }
      }

      if (options?.preliminaryCheckId) {
        await tx.preliminaryCheck.update({
          where: { id: options.preliminaryCheckId },
          data: { status: PreliminaryCheckStatus.APPROVED },
        });
      }

      return transaction;
    });
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

      if (preliminaryCheck.status === PreliminaryCheckStatus.APPROVED) {
        throw new BadRequestException(
          'Phiếu kiểm sơ bộ này đã được nhập kho rồi, không thể nhập lại',
        );
      }

      const totalQuantity = items.reduce(
        (sum, item) => sum + Number(item.quantity || 0),
        0,
      );
      if (totalQuantity !== preliminaryCheck.quantity) {
        throw new BadRequestException(
          `Tổng số lượng chi tiết phải khớp kiểm sơ bộ: ${preliminaryCheck.quantity}`,
        );
      }

      // Atomic optimistic lock: only the first concurrent request succeeds at DB level.
      // MySQL serializes the UPDATE so exactly one request gets count=1, the other gets 0.
      const lockResult = await this.prisma.preliminaryCheck.updateMany({
        where: {
          id: preliminaryCheckId,
          status: { not: PreliminaryCheckStatus.APPROVED },
        },
        data: { status: PreliminaryCheckStatus.APPROVED },
      });
      if (lockResult.count === 0) {
        throw new BadRequestException(
          'Phiếu kiểm sơ bộ này đã được nhập kho rồi, không thể nhập lại',
        );
      }
    }

    const transactions: InventoryTransaction[] = [];
    const receiptGroupId = `stk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    for (const item of items) {
      const transaction = await this.stockIn(
        item.categoryId,
        item.quantity,
        userId,
        {
          purchasePrice: item.purchasePrice,
          salePrice: item.salePrice,
          skuComboId: item.skuComboId,
          productConditionId: item.productConditionId,
          storageZoneId: item.storageZoneId,
          warehouseTypeId: item.warehouseTypeId,
          warehousePositionId: item.warehousePositionId,
          preliminaryCheckId,
          actualStockDate: item.actualStockDate,
          notes: item.notes,
          receiptGroupId,
          imageUrls: item.imageUrls,
        },
      );
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
      receiptGroupId?: string;
      bypassCategoryActiveCheck?: boolean;
    },
  ): Promise<InventoryTransaction> {
    if (quantity <= 0) {
      throw new BadRequestException('Số lượng xuất kho phải lớn hơn 0');
    }

    const normalizedCategoryId = categoryId.trim();
    await this.ensureCategoryExists(normalizedCategoryId);
    if (!options?.bypassCategoryActiveCheck) {
      await this.ensureCategoryIsActive(normalizedCategoryId);
    }

    const currentStock = options?.skuComboId
      ? await this.getCurrentStockBySkuCombo(options.skuComboId)
      : await this.getCurrentStockByCategory(normalizedCategoryId);
    if (quantity > currentStock) {
      throw new BadRequestException(
        'Không thể xuất quá số lượng tồn kho hiện tại',
      );
    }

    const purchasePrice =
      options?.purchasePrice ??
      (await this.getLatestActivePurchasePrice(normalizedCategoryId));
    const salePrice = options?.salePrice ?? purchasePrice;
    const storageZoneId = options?.storageZoneId;
    const warehousePositionId = options?.warehousePositionId;
    const latestInboundContext =
      !options?.productConditionId &&
      (options?.skuComboId || warehousePositionId || storageZoneId)
        ? await this.getLatestInboundContext({
            categoryId: normalizedCategoryId,
            skuComboId: options?.skuComboId,
            warehousePositionId,
            storageZoneId,
          })
        : null;
    const productConditionId =
      options?.productConditionId ??
      latestInboundContext?.productConditionId ??
      undefined;
    let effectiveWarehousePositionId = warehousePositionId;
    if (!effectiveWarehousePositionId && storageZoneId) {
      const latestInbound = await this.prisma.inventoryTransaction.findFirst({
        where: {
          categoryId: normalizedCategoryId,
          type: TransactionType.STOCK_IN,
          status: InventoryTransactionStatus.ACTIVE,
          storageZoneId,
          warehousePositionId: { not: null },
          warehousePosition: { isActive: true },
        },
        orderBy: { createdAt: 'desc' },
        select: { warehousePositionId: true },
      });
      effectiveWarehousePositionId =
        latestInbound?.warehousePositionId ?? undefined;
    }

    if (effectiveWarehousePositionId) {
      const position = await this.prisma.warehousePosition.findUnique({
        where: { id: effectiveWarehousePositionId },
      });

      if (!position) {
        throw new NotFoundException('Vị trí kho không tồn tại');
      }

      if (!position.isActive) {
        throw new BadRequestException('Vị trí kho này đã bị xóa khỏi sơ đồ');
      }

      if (quantity > position.currentStock) {
        throw new BadRequestException(
          'Không thể xuất quá số lượng hiện có tại vị trí kho đã chọn',
        );
      }
    }

    // Validate stock at storage zone for this SKU combo
    if (storageZoneId && options?.skuComboId) {
      const zoneStock = await this.getStockBySkuComboPerZone(
        options.skuComboId,
      );
      const zoneEntry = zoneStock.find(
        (z) => z.storageZoneId === storageZoneId,
      );
      const availableInZone = zoneEntry?.stock ?? 0;
      if (quantity > availableInZone) {
        const zone = await this.prisma.storageZone.findUnique({
          where: { id: storageZoneId },
        });
        throw new BadRequestException(
          `Không thể xuất ${quantity} sản phẩm từ ${zone?.name || 'khu vực này'}. Tồn kho tại đây chỉ có ${availableInZone}.`,
        );
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
          productConditionId,
          storageZoneId,
          warehousePositionId: effectiveWarehousePositionId,
          actualStockDate: new Date(),
          notes: this.appendReceiptGroupTag(
            options?.notes,
            options?.receiptGroupId,
          ),
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

    if (effectiveWarehousePositionId) {
      ops.push(
        this.prisma.warehousePosition.update({
          where: { id: effectiveWarehousePositionId },
          data: { currentStock: { decrement: quantity } },
        }) as never,
      );
    }

    const results = await this.prisma.$transaction(ops);
    return results[0] as InventoryTransaction;
  }

  async stockOutBatch(
    items: Array<{
      categoryId: string;
      quantity: number;
      skuComboId?: string;
      productConditionId?: string;
      storageZoneId?: string;
      warehousePositionId?: string;
      notes?: string;
    }>,
    userId: string,
  ) {
    if (!items.length) {
      throw new BadRequestException('Vui lòng thêm ít nhất một dòng xuất kho');
    }

    // Pre-validate cross-item: accumulate consumed stock per key to catch batch-level over-export
    const consumedMap = new Map<string, number>();
    for (const item of items) {
      const key = item.skuComboId ?? item.categoryId;
      const alreadyConsumed = consumedMap.get(key) ?? 0;
      const totalStock = item.skuComboId
        ? await this.getCurrentStockBySkuCombo(item.skuComboId)
        : await this.getCurrentStockByCategory(item.categoryId);
      const available = totalStock - alreadyConsumed;
      if (item.quantity > available) {
        throw new BadRequestException(
          `Số lượng xuất vượt tồn kho khả dụng cho sản phẩm trong dòng ${items.indexOf(item) + 1} (còn lại: ${available})`,
        );
      }
      consumedMap.set(key, alreadyConsumed + item.quantity);
    }

    const receiptGroupId = `stkout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const transactions: InventoryTransaction[] = [];

    for (const item of items) {
      const transaction = await this.stockOut(
        item.categoryId,
        item.quantity,
        userId,
        {
          skuComboId: item.skuComboId,
          productConditionId: item.productConditionId,
          storageZoneId: item.storageZoneId,
          warehousePositionId: item.warehousePositionId,
          notes: item.notes,
          receiptGroupId,
        },
      );
      transactions.push(transaction);
    }

    return {
      success: true,
      exportedRows: transactions.length,
      totalQuantity: transactions.reduce((sum, item) => sum + item.quantity, 0),
      transactions,
    };
  }

  async transferStock(params: TransferStockParams) {
    const normalizedCategoryId = params.categoryId.trim();
    const reason = params.reason.trim();

    if (!reason) {
      throw new BadRequestException('Vui long nhap ly do dieu chuyen cu the');
    }
    if (params.sourcePositionId === params.targetPositionId) {
      throw new BadRequestException(
        'Vi tri nguon va dich khong duoc trung nhau',
      );
    }

    await this.ensureCategoryExists(normalizedCategoryId);
    await this.ensureCategoryIsActive(normalizedCategoryId);

    const [sourcePosition, targetPosition] = await Promise.all([
      this.prisma.warehousePosition.findUnique({
        where: { id: params.sourcePositionId },
        include: { layout: true },
      }),
      this.prisma.warehousePosition.findUnique({
        where: { id: params.targetPositionId },
        include: { layout: true },
      }),
    ]);

    if (!sourcePosition) {
      throw new NotFoundException('Vi tri nguon khong ton tai');
    }
    if (!sourcePosition.isActive) {
      throw new BadRequestException('Vị trí nguồn đã bị xóa khỏi sơ đồ kho');
    }
    if (!targetPosition) {
      throw new NotFoundException('Vi tri dich khong ton tai');
    }
    if (!targetPosition.isActive) {
      throw new BadRequestException('Vị trí đích đã bị xóa khỏi sơ đồ kho');
    }
    if (params.quantity > sourcePosition.currentStock) {
      throw new BadRequestException(
        'So luong dieu chuyen vuot qua ton kho dang co tai vi tri nguon',
      );
    }
    if (
      targetPosition.maxCapacity !== null &&
      targetPosition.currentStock + params.quantity > targetPosition.maxCapacity
    ) {
      throw new BadRequestException(
        'Vi tri dich khong du suc chua de nhan them hang',
      );
    }

    // Look up zones from existing transactions at each position — more reliable than name-matching
    const [sourceZoneTx, targetZoneTx, latestInboundContext, latestPurchasePrice] =
      await Promise.all([
        this.prisma.inventoryTransaction.findFirst({
          where: {
            type: TransactionType.STOCK_IN,
            status: InventoryTransactionStatus.ACTIVE,
            warehousePositionId: params.sourcePositionId,
            storageZoneId: { not: null },
          },
          orderBy: { createdAt: 'desc' },
          select: { storageZoneId: true },
        }),
        this.prisma.inventoryTransaction.findFirst({
          where: {
            type: TransactionType.STOCK_IN,
            status: InventoryTransactionStatus.ACTIVE,
            warehousePositionId: params.targetPositionId,
            storageZoneId: { not: null },
          },
          orderBy: { createdAt: 'desc' },
          select: { storageZoneId: true },
        }),
        this.getLatestInboundContext({
          categoryId: normalizedCategoryId,
          skuComboId: params.skuComboId,
          warehousePositionId: params.sourcePositionId,
        }),
        this.getLatestActivePurchasePrice(normalizedCategoryId),
      ]);
    const sourceZoneId = sourceZoneTx?.storageZoneId ?? null;
    const targetZoneId = targetZoneTx?.storageZoneId ?? null;

    const transferGroupId = `trf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const transferMeta = `[TRANSFER] [TRANSFER_GROUP:${transferGroupId}] [TRANSFER_FROM:${sourcePosition.label || sourcePosition.id}] [TRANSFER_TO:${targetPosition.label || targetPosition.id}]`;

    const stockOutTx = await this.stockOut(
      normalizedCategoryId,
      params.quantity,
      params.userId,
      {
        skuComboId: params.skuComboId,
        productConditionId:
          latestInboundContext?.productConditionId ?? undefined,
        storageZoneId: sourceZoneId ?? undefined,
        warehousePositionId: params.sourcePositionId,
        notes: `${transferMeta} ${reason}`.trim(),
        bypassCategoryActiveCheck: true,
      },
    );

    const stockInTx = await this.stockIn(
      normalizedCategoryId,
      params.quantity,
      params.userId,
      {
        purchasePrice: latestPurchasePrice || 1,
        salePrice: latestPurchasePrice || 1,
        skuComboId: params.skuComboId,
        productConditionId:
          latestInboundContext?.productConditionId ?? undefined,
        storageZoneId: targetZoneId ?? undefined,
        warehousePositionId: params.targetPositionId,
        actualStockDate: new Date().toISOString(),
        notes: `${transferMeta} ${reason}`.trim(),
      },
    );

    return {
      success: true,
      message: 'Dieu chuyen kho thanh cong',
      transferGroupId,
      transactions: [stockOutTx, stockInTx],
    };
  }

  async adjustStock(
    categoryId: string,
    quantity: number,
    type: 'INCREASE' | 'DECREASE',
    userId: string,
    options?: {
      skuComboId?: string;
      warehousePositionId?: string;
      storageZoneId?: string;
      reason?: string;
    },
  ): Promise<InventoryTransaction> {
    const normalizedCategoryId = categoryId.trim();
    const adjustmentNote = options?.reason
      ? `[ADJUSTMENT] ${options.reason}`
      : '[ADJUSTMENT]';
    const latestPrice =
      await this.getLatestActivePurchasePrice(normalizedCategoryId);

    if (type === 'INCREASE') {
      return this.stockIn(normalizedCategoryId, quantity, userId, {
        purchasePrice: latestPrice,
        salePrice: latestPrice,
        skuComboId: options?.skuComboId,
        warehousePositionId: options?.warehousePositionId,
        storageZoneId: options?.storageZoneId,
        notes: adjustmentNote,
      });
    }

    return this.stockOut(normalizedCategoryId, quantity, userId, {
      purchasePrice: latestPrice,
      salePrice: latestPrice,
      skuComboId: options?.skuComboId,
      warehousePositionId: options?.warehousePositionId,
      storageZoneId: options?.storageZoneId,
      notes: adjustmentNote,
    });
  }

  /**
   * Balance stock for stocktaking: creates STOCK_IN/STOCK_OUT transactions
   * and syncs warehousePosition + storageZone currentStock automatically.
   * The adjustment always goes through the inventoryService so the cached
   * stock fields on position/zone stay in sync.
   */
  async balanceStockByCategory(
    categoryId: string,
    quantity: number,
    type: 'INCREASE' | 'DECREASE',
    userId: string,
    reason?: string,
    options?: {
      skuComboId?: string;
      storageZoneId?: string;
      warehousePositionId?: string;
    },
  ): Promise<InventoryTransaction> {
    return this.adjustStock(categoryId, quantity, type, userId, {
      skuComboId: options?.skuComboId,
      storageZoneId: options?.storageZoneId,
      warehousePositionId: options?.warehousePositionId,
      reason: reason ?? '[STOCKTAKING] Can bang kho theo bien ban kiem ke',
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

    // Pre-validate category-level stock (outside tx — acceptable since it reads from transactions)
    for (const transaction of transactions) {
      if (transaction.status === status) continue;
      if (
        status === InventoryTransactionStatus.SUSPENDED &&
        transaction.type === TransactionType.STOCK_IN &&
        transaction.categoryId
      ) {
        const catStock = await this.getCurrentStockByCategory(
          transaction.categoryId,
        );
        if (catStock < transaction.quantity) {
          throw new BadRequestException(
            'Không thể tạm dừng giao dịch vì tồn kho danh mục không đủ để hoàn tác.',
          );
        }
      }
    }

    // Apply each status change atomically: position/zone delta + status update in one transaction
    for (const transaction of transactions) {
      if (transaction.status === status) continue;

      const isSuspending = status === InventoryTransactionStatus.SUSPENDED;
      const effectiveType = isSuspending
        ? transaction.type === TransactionType.STOCK_IN
          ? TransactionType.STOCK_OUT
          : TransactionType.STOCK_IN
        : transaction.type;
      const delta =
        effectiveType === TransactionType.STOCK_IN
          ? { increment: transaction.quantity }
          : { decrement: transaction.quantity };

      await this.prisma.$transaction(async (tx) => {
        // Re-validate position/zone inside tx to eliminate TOCTOU race
        if (effectiveType === TransactionType.STOCK_OUT) {
          if (transaction.warehousePositionId) {
            const pos = await tx.warehousePosition.findUnique({
              where: { id: transaction.warehousePositionId },
              select: { currentStock: true },
            });
            if (pos && pos.currentStock < transaction.quantity) {
              throw new BadRequestException(
                'Không thể thực hiện vì tồn kho tại vị trí không đủ để hoàn tác.',
              );
            }
          }
          if (transaction.storageZoneId) {
            const zone = await tx.storageZone.findUnique({
              where: { id: transaction.storageZoneId },
              select: { currentStock: true },
            });
            if (zone && zone.currentStock < transaction.quantity) {
              throw new BadRequestException(
                'Không thể thực hiện vì tồn kho khu vực không đủ để hoàn tác.',
              );
            }
          }
        }

        if (transaction.warehousePositionId) {
          await tx.warehousePosition.update({
            where: { id: transaction.warehousePositionId },
            data: { currentStock: delta },
          });
        }
        if (transaction.storageZoneId) {
          await tx.storageZone.update({
            where: { id: transaction.storageZoneId },
            data: { currentStock: delta },
          });
        }
        await tx.inventoryTransaction.update({
          where: { id: transaction.id },
          data: { status },
        });
      });

      await this.syncPreliminaryCheckStatus(transaction.preliminaryCheckId);
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
        const currentStock = transaction.skuComboId
          ? await this.getCurrentStockBySkuCombo(transaction.skuComboId)
          : await this.getCurrentStockByCategory(transaction.categoryId!);
        const stockAfterRevert = currentStock + transaction.quantity; // revert old qty
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

    const nextQuantity =
      data.quantity !== undefined
        ? Number(data.quantity)
        : transaction.quantity;
    const nextCategoryId =
      data.categoryId !== undefined
        ? String(data.categoryId || '').trim()
        : transaction.categoryId;
    const nextProductConditionId =
      data.productConditionId !== undefined
        ? data.productConditionId
          ? String(data.productConditionId)
          : null
        : transaction.productConditionId;
    const nextStorageZoneId =
      data.storageZoneId !== undefined
        ? data.storageZoneId
          ? String(data.storageZoneId)
          : null
        : transaction.storageZoneId;
    const nextWarehousePositionId =
      data.warehousePositionId !== undefined
        ? data.warehousePositionId
          ? String(data.warehousePositionId)
          : null
        : transaction.warehousePositionId;
    const nextSkuComboId =
      data.skuComboId !== undefined
        ? data.skuComboId
          ? String(data.skuComboId)
          : null
        : transaction.skuComboId;

    if (nextCategoryId) {
      await this.ensureCategoryExists(nextCategoryId);
    }

    // Validate zone conflict when storageZoneId changes on a STOCK_IN transaction
    if (
      transaction.type === TransactionType.STOCK_IN &&
      nextStorageZoneId &&
      nextStorageZoneId !== transaction.storageZoneId
    ) {
      const newZone = await this.prisma.storageZone.findUnique({
        where: { id: nextStorageZoneId },
        include: { warehouseType: true },
      });
      if (!newZone) {
        throw new BadRequestException('Khu vực không tồn tại');
      }
      const incomingWarehouseTypeId = data.warehouseTypeId
        ? String(data.warehouseTypeId)
        : null;
      if (
        incomingWarehouseTypeId &&
        newZone.warehouseTypeId &&
        newZone.warehouseTypeId !== incomingWarehouseTypeId
      ) {
        throw new BadRequestException(
          `Khu vực "${newZone.name}" đang được gán vào loại kho "${newZone.warehouseType?.name ?? newZone.warehouseTypeId}". Vui lòng chọn khu vực thuộc đúng loại kho.`,
        );
      }
    }

    if (
      nextWarehousePositionId &&
      nextWarehousePositionId !== transaction.warehousePositionId
    ) {
      const pos = await this.prisma.warehousePosition.findUnique({
        where: { id: nextWarehousePositionId },
        select: { isActive: true },
      });
      if (!pos || !pos.isActive) {
        throw new BadRequestException(
          'Vị trí kho được chọn không tồn tại hoặc đã bị xóa khỏi sơ đồ',
        );
      }
    }

    const updateData: Record<string, unknown> = {};

    if (data.quantity !== undefined) updateData.quantity = nextQuantity;
    if (data.purchasePrice !== undefined) {
      updateData.purchasePrice = this.toPrismaDecimal(
        Number(data.purchasePrice),
      );
      updateData.salePrice = this.toPrismaDecimal(Number(data.purchasePrice));
    }
    if (data.notes !== undefined) updateData.notes = data.notes || null;
    if (data.categoryId !== undefined)
      updateData.categoryId = nextCategoryId || null;
    if (data.productConditionId !== undefined)
      updateData.productConditionId = nextProductConditionId;
    if (data.storageZoneId !== undefined)
      updateData.storageZoneId = nextStorageZoneId;
    if (data.warehousePositionId !== undefined)
      updateData.warehousePositionId = nextWarehousePositionId;
    if (data.skuComboId !== undefined) updateData.skuComboId = nextSkuComboId;
    if (data.actualStockDate !== undefined)
      updateData.actualStockDate = data.actualStockDate
        ? new Date(data.actualStockDate as string)
        : null;
    if (data.imageUrls !== undefined)
      updateData.imageUrls = JSON.stringify(
        Array.isArray(data.imageUrls) ? data.imageUrls : [],
      );

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('Không có thông tin nào được thay đổi');
    }

    // Handle quantity change — adjust stock counts
    const hasLocationOrQuantityChange =
      nextQuantity !== transaction.quantity ||
      nextStorageZoneId !== transaction.storageZoneId ||
      nextWarehousePositionId !== transaction.warehousePositionId;

    if (hasLocationOrQuantityChange) {
      await this.applyLocationDeltaForEdit({
        type: transaction.type,
        oldQuantity: transaction.quantity,
        newQuantity: nextQuantity,
        oldWarehousePositionId: transaction.warehousePositionId,
        newWarehousePositionId: nextWarehousePositionId,
        oldStorageZoneId: transaction.storageZoneId,
        newStorageZoneId: nextStorageZoneId,
      });
    }

    /*
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
    */

    const updated = await this.prisma.inventoryTransaction.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
        productCondition: true,
        storageZone: true,
        warehousePosition: true,
        skuCombo: {
          include: {
            classification: true,
            color: true,
            size: true,
            material: true,
          },
        },
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

    // Pre-validate all active transactions can be reversed before touching DB
    for (const transaction of transactions) {
      if (transaction.status === InventoryTransactionStatus.ACTIVE) {
        const isStockIn = transaction.type === TransactionType.STOCK_IN;
        try {
          await this.ensureCanApplyStockDelta(
            isStockIn ? TransactionType.STOCK_OUT : TransactionType.STOCK_IN,
            transaction.quantity,
            transaction.categoryId,
            transaction.warehousePositionId,
            transaction.storageZoneId,
          );
        } catch {
          throw new BadRequestException(
            isStockIn
              ? 'Không thể xóa phiếu nhập này vì hàng đã được xuất hoặc điều chỉnh ra khỏi khu vực — tồn kho trong khu vực không đủ để hoàn tác. Hãy kiểm tra lại các phiếu xuất liên quan trước khi xóa.'
              : 'Không thể xóa giao dịch này do tồn kho không đủ để hoàn tác.',
          );
        }
      }
    }

    for (const transaction of transactions) {
      // Wrap stock reversal + delete in one atomic transaction to prevent stock desync on crash
      await this.prisma.$transaction(async (tx) => {
        if (transaction.status === InventoryTransactionStatus.ACTIVE) {
          const effectiveType =
            transaction.type === TransactionType.STOCK_IN
              ? TransactionType.STOCK_OUT
              : TransactionType.STOCK_IN;
          const delta =
            effectiveType === TransactionType.STOCK_IN
              ? { increment: transaction.quantity }
              : { decrement: transaction.quantity };

          if (transaction.warehousePositionId) {
            await tx.warehousePosition.update({
              where: { id: transaction.warehousePositionId },
              data: { currentStock: delta },
            });
          }
          if (transaction.storageZoneId) {
            await tx.storageZone.update({
              where: { id: transaction.storageZoneId },
              data: { currentStock: delta },
            });
          }
        }

        await tx.inventoryTransaction.delete({
          where: { id: transaction.id },
        });
      });

      await this.syncPreliminaryCheckStatus(transaction.preliminaryCheckId);
    }

    return { deleted: transactions.length };
  }

  async getTransactionHistory(filters: {
    kind?: string;
    status?: string;
    categoryName?: string;
    productName?: string;
    sku?: string;
    positionLabel?: string;
    userName?: string;
    userId?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<InventoryTransactionHistoryItem>> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.InventoryTransactionWhereInput = {};

    if (filters.status) {
      where.status = filters.status as InventoryTransactionStatus;
    }
    if (filters.kind === 'STOCK_IN') {
      where.type = TransactionType.STOCK_IN;
    } else if (filters.kind === 'STOCK_OUT') {
      where.type = TransactionType.STOCK_OUT;
    } else if (filters.kind === 'ADJUSTMENT') {
      where.notes = { contains: '[ADJUSTMENT]' };
    } else if (filters.kind === 'TRANSFER') {
      where.notes = { contains: '[TRANSFER]' };
    }
    if (filters.userId) {
      where.userId = filters.userId;
    }
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) {
        // Parse with local timezone offset (Vietnam = UTC+7)
        const d = new Date(filters.dateFrom);
        d.setHours(0, 0, 0, 0);
        where.createdAt.gte = d;
      }
      if (filters.dateTo) {
        const d = new Date(filters.dateTo);
        d.setHours(23, 59, 59, 999);
        where.createdAt.lte = d;
      }
    }
    if (filters.categoryName) {
      where.category = { name: { contains: filters.categoryName } };
    }
    if (filters.sku) {
      where.skuCombo = { compositeSku: { contains: filters.sku } };
    }
    if (filters.productName) {
      where.skuCombo = {
        ...((where.skuCombo as object) ?? {}),
        OR: [
          { classification: { name: { contains: filters.productName } } },
          { color: { name: { contains: filters.productName } } },
          { size: { name: { contains: filters.productName } } },
          { material: { name: { contains: filters.productName } } },
        ],
      };
    }

    const includeBlock = {
      category: true,
      warehousePosition: {
        select: {
          label: true,
          layout: { select: { id: true, name: true } },
        },
      },
      storageZone: {
        select: {
          name: true,
          warehouseTypeId: true,
          warehouseType: { select: { name: true } },
        },
      },
      warehouseType: {
        select: { id: true, name: true },
      },
      productCondition: {
        select: { id: true, name: true },
      },
      skuCombo: {
        include: {
          classification: true,
          color: true,
          size: true,
          material: true,
        },
      },
    } as const;

    const [transactions, total, allWarehouseTypes] = await Promise.all([
      this.prisma.inventoryTransaction.findMany({
        where,
        include: includeBlock,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.inventoryTransaction.count({ where }),
      this.prisma.warehouseType.findMany({ select: { id: true, name: true } }),
    ]);
    const warehouseTypeNameToId = new Map(
      allWarehouseTypes.map((wt) => [wt.name.toLowerCase(), wt.id]),
    );
    const userNameMap = await this.buildUserNameMap(
      transactions.map((transaction) => transaction.userId),
    );

    const conditionKeyMap = new Map<string, string>();
    const conditionNameMap = new Map<string, string>();
    const effectiveConditionByTransactionId = new Map<
      string,
      { id: string | null; name: string | null }
    >();

    [...transactions].reverse().forEach((transaction) => {
      const conditionKey =
        transaction.skuComboId || transaction.categoryId || transaction.id;
      const effectiveConditionId =
        transaction.productConditionId ||
        conditionKeyMap.get(conditionKey) ||
        null;
      const effectiveConditionName =
        transaction.productCondition?.name ||
        conditionNameMap.get(conditionKey) ||
        null;

      effectiveConditionByTransactionId.set(transaction.id, {
        id: effectiveConditionId,
        name: effectiveConditionName,
      });

      if (
        transaction.productConditionId &&
        transaction.productCondition?.name
      ) {
        conditionKeyMap.set(conditionKey, transaction.productConditionId);
        conditionNameMap.set(conditionKey, transaction.productCondition.name);
      }
    });

    const mapped = transactions.map((transaction) => {
      const parsedNotes = this.parseTransactionNotes(transaction.notes);
      const kind = parsedNotes.isTransfer
        ? 'TRANSFER'
        : parsedNotes.isAdjustment
          ? 'ADJUSTMENT'
          : transaction.type === TransactionType.STOCK_IN
            ? 'STOCK_IN'
            : 'STOCK_OUT';
      const effectiveCondition = effectiveConditionByTransactionId.get(
        transaction.id,
      );

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
        warehouseTypeName:
          transaction.warehouseType?.name ??
          transaction.warehousePosition?.layout?.name ??
          transaction.storageZone?.warehouseType?.name ??
          null,
        storageZoneName: transaction.storageZone?.name ?? null,
        storageZoneId: transaction.storageZoneId,
        warehousePositionId: transaction.warehousePositionId,
        productName: transaction.skuCombo
          ? [
              transaction.skuCombo.classification?.name,
              transaction.skuCombo.color?.name,
              transaction.skuCombo.size?.name,
              transaction.skuCombo.material?.name,
            ]
              .filter(Boolean)
              .join(' - ')
          : null,
        sku: transaction.skuCombo?.compositeSku ?? null,
        skuComboId: transaction.skuComboId,
        receiptGroupId: parsedNotes.receiptGroupId,
        classificationId: transaction.skuCombo?.classification?.id ?? null,
        classificationName: transaction.skuCombo?.classification?.name ?? null,
        colorId: transaction.skuCombo?.color?.id ?? null,
        colorName: transaction.skuCombo?.color?.name ?? null,
        sizeId: transaction.skuCombo?.size?.id ?? null,
        sizeName: transaction.skuCombo?.size?.name ?? null,
        materialId: transaction.skuCombo?.material?.id ?? null,
        materialName: transaction.skuCombo?.material?.name ?? null,
        productConditionId: effectiveCondition?.id ?? null,
        productConditionName: effectiveCondition?.name ?? null,
        warehouseTypeId:
          transaction.warehouseTypeId ??
          transaction.storageZone?.warehouseTypeId ??
          (transaction.warehousePosition?.layout?.name
            ? (warehouseTypeNameToId.get(
                transaction.warehousePosition.layout.name.toLowerCase(),
              ) ?? null)
            : null),
        userName: userNameMap.get(transaction.userId) ?? 'Người dùng đã xóa',
        note: parsedNotes.note,
        imageUrls: transaction.imageUrls
          ? (JSON.parse(transaction.imageUrls) as string[])
          : [],
      } satisfies InventoryTransactionHistoryItem;
    });

    return {
      data: mapped,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
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
      return (
        sum +
        (transaction.type === TransactionType.STOCK_IN
          ? transaction.quantity
          : -transaction.quantity)
      );
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

    const rows = await this.buildCategoryInventoryRows(filters);
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
        warehousePosition: {
          include: {
            layout: true,
          },
        },
        storageZone: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const products = await this.prisma.product.findMany({
      select: {
        id: true,
        categoryId: true,
        isDiscontinued: true,
      },
    });
    const productMap = new Map(products.map((item) => [item.categoryId, item]));

    // Group by skuComboId (or categoryId if no skuCombo)
    const map = new Map<
      string,
      {
        key: string;
        productId: string | null;
        isDiscontinued: boolean;
        skuComboId: string | null;
        categoryId: string | null;
        categoryName: string;
        productName: string;
        sku: string;
        stock: number;
        productConditionName: string | null;
        positionLabels: string[];
        warehouseTypeNames: string[];
        storageZoneNames: string[];
        latestPurchasePrice: number | null;
        transactionIds: string[];
        positions: Array<{
          id: string;
          label: string;
          currentStock: number;
          warehouseTypeName: string | null;
        }>;
      }
    >();

    for (const tx of transactions) {
      const skuCombo = tx.skuCombo;
      const key = skuCombo
        ? `sku:${skuCombo.id}`
        : `cat:${tx.categoryId || tx.id}`;

      const productName = skuCombo
        ? [
            skuCombo.classification?.name,
            skuCombo.color?.name,
            skuCombo.size?.name,
            skuCombo.material?.name,
          ]
            .filter(Boolean)
            .join(' - ')
        : tx.category?.name || '-';

      const sku = skuCombo?.compositeSku || '-';

      const product = tx.categoryId ? productMap.get(tx.categoryId) : null;
      const existing = map.get(key) ?? {
        key,
        productId: product?.id || null,
        isDiscontinued: product?.isDiscontinued ?? false,
        skuComboId: skuCombo?.id || null,
        categoryId: tx.categoryId,
        categoryName: tx.category?.name || '-',
        productName,
        sku,
        stock: 0,
        productConditionName: null,
        positionLabels: [],
        warehouseTypeNames: [],
        storageZoneNames: [],
        latestPurchasePrice: null,
        transactionIds: [],
        positions: [],
      };

      existing.stock +=
        tx.type === TransactionType.STOCK_IN ? tx.quantity : -tx.quantity;
      existing.transactionIds.push(tx.id);

      if (!existing.productConditionName && tx.productCondition?.name) {
        existing.productConditionName = tx.productCondition.name;
      }
      if (!existing.latestPurchasePrice && tx.purchasePrice) {
        existing.latestPurchasePrice = this.asNumber(tx.purchasePrice);
      }
      if (
        tx.warehousePosition?.label &&
        !existing.positionLabels.includes(tx.warehousePosition.label)
      ) {
        existing.positionLabels.push(tx.warehousePosition.label);
      }
      if (
        tx.warehousePosition?.layout?.name &&
        !existing.warehouseTypeNames.includes(tx.warehousePosition.layout.name)
      ) {
        existing.warehouseTypeNames.push(tx.warehousePosition.layout.name);
      }
      if (
        tx.storageZone?.name &&
        !existing.storageZoneNames.includes(tx.storageZone.name)
      ) {
        existing.storageZoneNames.push(tx.storageZone.name);
      }
      if (
        tx.warehousePosition?.id &&
        !existing.positions.some(
          (position) => position.id === tx.warehousePosition?.id,
        )
      ) {
        existing.positions.push({
          id: tx.warehousePosition.id,
          label: tx.warehousePosition.label || tx.warehousePosition.id,
          currentStock: 0, // Will be computed below
          warehouseTypeName: tx.warehousePosition.layout?.name ?? null,
        });
      }

      map.set(key, existing);
    }

    // Compute currentStock per position from transactions
    const positionStockMap = new Map<string, number>();
    for (const tx of transactions) {
      if (!tx.warehousePositionId) continue;
      const posId = tx.warehousePositionId;
      const delta =
        tx.type === TransactionType.STOCK_IN ? tx.quantity : -tx.quantity;
      positionStockMap.set(posId, (positionStockMap.get(posId) ?? 0) + delta);
    }

    const rows = Array.from(map.values()).sort((a, b) =>
      a.productName.localeCompare(b.productName),
    );

    // Enrich positions with computed currentStock
    for (const row of rows) {
      for (const pos of row.positions) {
        pos.currentStock = positionStockMap.get(pos.id) ?? 0;
      }
    }

    // Enrich with threshold data from SkuCombo
    const skuComboIds = rows
      .map((r) => r.skuComboId)
      .filter(Boolean) as string[];
    const skuCombosWithThreshold =
      skuComboIds.length > 0
        ? await this.prisma.skuCombo.findMany({
            where: { id: { in: skuComboIds } },
            select: {
              id: true,
              minThreshold: true,
              maxThreshold: true,
              isDiscontinued: true,
            },
          })
        : [];
    const thresholdMap = new Map(skuCombosWithThreshold.map((s) => [s.id, s]));

    const enrichedRows = rows.map((r) => {
      const skuData = r.skuComboId ? thresholdMap.get(r.skuComboId) : null;
      return {
        ...r,
        isDiscontinued: skuData?.isDiscontinued ?? r.isDiscontinued,
        minThreshold: skuData?.minThreshold ?? 0,
        maxThreshold: skuData?.maxThreshold ?? 0,
      };
    });

    // Search filter (broad match: each keyword must appear in at least one field)
    let filteredRows = enrichedRows;
    if (filters.search) {
      const keywords = this.removeDiacritics(
        filters.search.toLowerCase().trim(),
      )
        .split(/\s+/)
        .filter(Boolean);
      if (keywords.length > 0) {
        filteredRows = filteredRows.filter((r) => {
          const searchableText = this.removeDiacritics(
            [r.productName, r.sku, r.categoryName].join(' ').toLowerCase(),
          );
          return keywords.every((kw) => searchableText.includes(kw));
        });
      }
    }

    const paged = filteredRows.slice(skip, skip + limit);

    return {
      data: paged,
      total: filteredRows.length,
      page,
      limit,
      totalPages: Math.ceil(filteredRows.length / limit) || 1,
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
      limit: 5000,
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
      {
        header: 'Tình trạng hàng',
        key: 'latestProductConditionName',
        width: 20,
      },
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
        positionLabels: Array.isArray(row.positionLabels)
          ? row.positionLabels.join(', ')
          : '-',
        latestProductConditionName: row.latestProductConditionName ?? '-',
        latestPurchasePrice: row.latestPurchasePrice ?? '-',
        latestSalePrice: row.latestSalePrice ?? '-',
        businessStatus:
          statusLabels[String(row.businessStatus)] ?? row.businessStatus,
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
