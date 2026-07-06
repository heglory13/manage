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
import { WarehouseService } from '../warehouse/warehouse.service.js';
import { ActivityLogService } from '../activity-log/activity-log.service.js';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly warehouseService: WarehouseService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  private async logActivity(
    userId: string,
    action: string,
    tableName: string,
    recordId: string,
    newData: Record<string, unknown> | null,
    oldData?: Record<string, unknown> | null,
  ) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });
      await this.activityLogService.create({
        userId,
        userName: user?.name ?? '',
        action,
        tableName,
        recordId,
        oldData: oldData ?? null,
        newData,
      });
      console.log('[ActivityLog] Created:', { action, tableName, recordId, userId });
    } catch (e) {
      console.error('[ActivityLog] Failed:', { action, tableName, recordId, error: e instanceof Error ? e.message : e });
    }
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

    return this.asNumber(transaction?.purchasePrice) ?? null;
  }

  /**
   * FIFO lot calculator.
   *
   * Returns a list of { lotTxId, purchasePrice, salePrice, quantity } slices
   * that together satisfy the requested `quantityNeeded`, taken from the
   * oldest STOCK_IN transactions first.
   *
   * Algorithm:
   *  1. Fetch every ACTIVE STOCK_IN for the category (+ optional skuComboId /
   *     storageZoneId filter), oldest first.
   *  2. For each inbound lot, subtract the quantity already consumed by
   *     prior STOCK_OUT rows that reference that lot via [FIFO_LOT:<id>] tag.
   *  3. Consume from the remaining capacity until `quantityNeeded` is satisfied.
   */
  private async getFifoLots(
    categoryId: string,
    quantityNeeded: number,
    opts?: { skuComboId?: string; storageZoneId?: string },
  ): Promise<
    Array<{
      lotTxId: string;
      purchasePrice: number | null;
      salePrice: number | null;
      quantity: number;
    }>
  > {
    // 1. Fetch inbound lots (oldest first = FIFO order)
    const inboundLots = await this.prisma.inventoryTransaction.findMany({
      where: {
        categoryId,
        type: TransactionType.STOCK_IN,
        status: InventoryTransactionStatus.ACTIVE,
        ...(opts?.skuComboId ? { skuComboId: opts.skuComboId } : {}),
        ...(opts?.storageZoneId ? { storageZoneId: opts.storageZoneId } : {}),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        quantity: true,
        purchasePrice: true,
        salePrice: true,
      },
    });

    if (inboundLots.length === 0) return [];

    // 2. Count how much has already been consumed from each lot
    //    by looking for [FIFO_LOT:<id>] tags in existing STOCK_OUT notes.
    const lotIds = inboundLots.map((l) => l.id);
    const outboundRefs = await this.prisma.inventoryTransaction.findMany({
      where: {
        categoryId,
        type: TransactionType.STOCK_OUT,
        status: InventoryTransactionStatus.ACTIVE,
        notes: { contains: '[FIFO_LOT:' },
      },
      select: { quantity: true, notes: true },
    });

    // Build consumed-per-lot map
    const consumed = new Map<string, number>();
    for (const outTx of outboundRefs) {
      const match = (outTx.notes ?? '').match(/\[FIFO_LOT:([^\]]+)\]/);
      if (match) {
        const lotId = match[1];
        if (lotIds.includes(lotId)) {
          consumed.set(lotId, (consumed.get(lotId) ?? 0) + outTx.quantity);
        }
      }
    }

    // 3. Walk lots in FIFO order and fill up the requested quantity
    const result: Array<{
      lotTxId: string;
      purchasePrice: number | null;
      salePrice: number | null;
      quantity: number;
    }> = [];
    let remaining = quantityNeeded;

    for (const lot of inboundLots) {
      if (remaining <= 0) break;
      const alreadyConsumed = consumed.get(lot.id) ?? 0;
      const available = lot.quantity - alreadyConsumed;
      if (available <= 0) continue;

      const take = Math.min(available, remaining);
      result.push({
        lotTxId: lot.id,
        purchasePrice: this.asNumber(lot.purchasePrice),
        salePrice: this.asNumber(lot.salePrice),
        quantity: take,
      });
      remaining -= take;
    }

    return result;
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
 *
 * The response also includes totalStockInZone — the canonical
 * currentStock of the zone (sum of ALL products, not just the
 * picked skuComboId) — and fillPercent derived from it. This is
 * what the dashboard's "Đã chứa" widget shows, so the values
 * stay consistent across screens.
 */
 async getStockBySkuComboPerZone(skuComboId: string): Promise<
 Array<{
 storageZoneId: string;
 storageZoneName: string;
 stock: number;
 warehouseType: string | null;
 maxCapacity: number | null;
 // Total stock of EVERY product currently sitting in this thùng
 // (not just the picked skuComboId). Used to compute fillPercent.
 totalStockInZone: number;
 // 0..100, rounded to 1 decimal. null when maxCapacity is missing
 // or zero.
 fillPercent: number | null;
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
 storageZone: {
 select: {
 id: true,
 name: true,
 maxCapacity: true,
 warehouseType: { select: { name: true } },
 },
 },
 },
 });

 const zoneMap = new Map<
 string,
 {
 storageZoneId: string;
 storageZoneName: string;
 stock: number;
 warehouseType: string | null;
 maxCapacity: number | null;
 }
 >();

 for (const tx of transactions) {
 if (!tx.storageZoneId || !tx.storageZone) continue;
 const existing = zoneMap.get(tx.storageZoneId) ?? {
 storageZoneId: tx.storageZone.id,
 storageZoneName: tx.storageZone.name,
 stock: 0,
 warehouseType: tx.storageZone.warehouseType?.name ?? null,
 maxCapacity: tx.storageZone.maxCapacity,
 };
 existing.stock +=
 tx.type === TransactionType.STOCK_IN ? tx.quantity : -tx.quantity;
 zoneMap.set(tx.storageZoneId, existing);
 }

 // Fetch the canonical currentStock of every storage zone that
 // appears in our map. This is the AUTHORITATIVE total of all
 // products sitting in each thùng — not just the picked
 // skuComboId's contribution. The "fill percent" is computed
 // against this number so the dashboard's "Đã chứa" matches the
 // real warehouse state.
 const zoneIds = Array.from(zoneMap.keys());
 const zones = zoneIds.length
 ? await this.prisma.storageZone.findMany({
 where: { id: { in: zoneIds } },
 select: { id: true, currentStock: true },
 })
 : [];
 const currentStockByZone = new Map(
 zones.map((z) => [z.id, z.currentStock]),
 );

 return Array.from(zoneMap.values())
 .filter((z) => z.stock > 0)
 .map((z) => {
 const totalStockInZone = currentStockByZone.get(z.storageZoneId) ?? z.stock;
 const fillPercent =
 z.maxCapacity && z.maxCapacity > 0
 ? Math.min(
 100,
 Math.round((totalStockInZone / z.maxCapacity) * 1000) / 10,
 )
 : null;
 return { ...z, totalStockInZone, fillPercent };
 });
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

  private async executeStockIn(
    tx: Prisma.TransactionClient,
    categoryId: string,
    quantity: number,
    userId: string,
    options?: StockInOptions & { skipPreliminaryCheckUpdate?: boolean },
  ): Promise<InventoryTransaction> {
    if (quantity <= 0) {
      throw new BadRequestException('Số lượng nhập kho phải lớn hơn 0');
    }

    const normalizedCategoryId = categoryId.trim();
    await this.ensureCategoryExists(normalizedCategoryId);

    const storageZoneId = options?.storageZoneId;
    const warehousePositionId = options?.warehousePositionId;
    const warehouseTypeId = options?.warehouseTypeId;

    let shouldAutoAssignZoneType = false;
    if (storageZoneId) {
      const zone = await tx.storageZone.findUnique({
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
      const position = await tx.warehousePosition.findUnique({
        where: { id: warehousePositionId },
      });
      if (!position) throw new NotFoundException('Vị trí kho không tồn tại');
      if (!position.isActive)
        throw new BadRequestException('Vị trí kho này đã bị xóa khỏi sơ đồ');
      if (!position.isStorageLocation)
        throw new BadRequestException('Vị trí này được gán là không chứa hàng, không thể nhập hàng vào đây');
    }

    const purchasePrice = options?.purchasePrice ?? 0;
    const salePrice = options?.salePrice ?? purchasePrice;

    if (purchasePrice < 0) {
      throw new BadRequestException('Giá nhập không được âm');
    }

    const actualStockDate = options?.actualStockDate
      ? new Date(options.actualStockDate)
      : new Date();

    if (storageZoneId) {
      const freshZone = await tx.storageZone.findUnique({
        where: { id: storageZoneId },
      });
      if (!freshZone)
        throw new NotFoundException('Khu vực hàng hoá không tồn tại');
      // Only enforce capacity if zone has a positive maxCapacity set.
      // A zone with maxCapacity = 0 is treated as "no limit" so legacy data
      // and freshly created zones do not block imports.
      if (freshZone.maxCapacity > 0) {
        const remaining = freshZone.maxCapacity - freshZone.currentStock;
        if (remaining <= 0)
          throw new BadRequestException(
            `Khu vực "${freshZone.name}" đã đầy (tồn ${freshZone.currentStock}/${freshZone.maxCapacity}), không thể nhập thêm hàng`,
          );
        if (quantity > remaining)
          throw new BadRequestException(
            `Khu vực "${freshZone.name}" chỉ còn ${remaining} chỗ trống (tồn ${freshZone.currentStock}/${freshZone.maxCapacity}), không thể nhập ${quantity} sản phẩm`,
          );
      }
    }

    if (warehousePositionId) {
      const freshPos = await tx.warehousePosition.findUnique({
        where: { id: warehousePositionId },
      });
      if (!freshPos) throw new NotFoundException('Vị trí kho không tồn tại');
      if (!freshPos.isActive)
        throw new BadRequestException('Vị trí kho này đã bị xóa khỏi sơ đồ');
      if (!freshPos.isStorageLocation)
        throw new BadRequestException('Vị trí này được gán là không chứa hàng, không thể nhập hàng vào đây');

      // If position has no maxCapacity but its matching storage zone does,
      // sync the value. This protects against legacy positions created before
      // the zone's capacity was set, and prevents spurious "remaining = -N" errors.
      let effectiveMaxCapacity = freshPos.maxCapacity;
      if (effectiveMaxCapacity === null && storageZoneId) {
        const syncedZone = await tx.storageZone.findUnique({
          where: { id: storageZoneId },
          select: { maxCapacity: true },
        });
        if (syncedZone && syncedZone.maxCapacity > 0) {
          effectiveMaxCapacity = syncedZone.maxCapacity;
          await tx.warehousePosition.update({
            where: { id: warehousePositionId },
            data: { maxCapacity: syncedZone.maxCapacity },
          });
        }
      }

      if (effectiveMaxCapacity !== null && effectiveMaxCapacity > 0) {
        const remaining = effectiveMaxCapacity - freshPos.currentStock;
        if (remaining <= 0)
          throw new BadRequestException(
            `Vị trí "${freshPos.label}" đã đầy (tồn ${freshPos.currentStock}/${effectiveMaxCapacity}), không thể nhập thêm hàng`,
          );
        if (quantity > remaining)
          throw new BadRequestException(
            `Vị trí "${freshPos.label}" chỉ còn ${remaining} chỗ trống (tồn ${freshPos.currentStock}/${effectiveMaxCapacity}), không thể nhập ${quantity} sản phẩm`,
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
      await this.warehouseService.syncWarehouseLayoutPosition(warehousePositionId, tx);
    }

    if (storageZoneId) {
      await tx.storageZone.update({
        where: { id: storageZoneId },
        data: { currentStock: { increment: quantity } },
      });

      const zone = await tx.storageZone.findUnique({ where: { id: storageZoneId } });
      if (zone) {
        await this.warehouseService.syncLayoutPositionStock(zone.name, tx);
      }

      if (shouldAutoAssignZoneType && warehouseTypeId) {
        await tx.storageZone.updateMany({
          where: { id: storageZoneId, warehouseTypeId: null },
          data: { warehouseTypeId },
        });
      }
    }

    if (options?.preliminaryCheckId && !options.skipPreliminaryCheckUpdate) {
      await tx.preliminaryCheck.update({
        where: { id: options.preliminaryCheckId },
        data: { status: PreliminaryCheckStatus.APPROVED },
      });
    }

    return transaction;
  }

  async stockIn(
    categoryId: string,
    quantity: number,
    userId: string,
    options?: StockInOptions,
  ): Promise<InventoryTransaction> {
    const effectiveOptions: StockInOptions = {
      ...options,
      receiptGroupId: options?.receiptGroupId || `stk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
    return this.prisma.$transaction((tx) =>
      this.executeStockIn(tx, categoryId, quantity, userId, effectiveOptions),
    );
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

      if (items.length > 500) {
        throw new BadRequestException(
          `Phiếu kiểm sơ bộ chỉ hỗ trợ tối đa 500 dòng nhập kho trong một lần`,
        );
      }
    }

    const CHUNK_SIZE = 500;
    const batchGroupId = `stk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const allTransactions: InventoryTransaction[] = [];
    let checkLocked = false;

    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      const chunk = items.slice(i, i + CHUNK_SIZE);

      const result = await this.prisma.$transaction(async (tx) => {
        if (preliminaryCheckId && !checkLocked) {
          const lockResult = await tx.preliminaryCheck.updateMany({
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
          checkLocked = true;
        }

        const chunkTransactions: InventoryTransaction[] = [];
        for (const item of chunk) {
          const transaction = await this.executeStockIn(
            tx,
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
              receiptGroupId: batchGroupId,
              imageUrls: item.imageUrls,
              skipPreliminaryCheckUpdate: true,
            },
          );
          chunkTransactions.push(transaction);
        }

        return chunkTransactions;
      });

      allTransactions.push(...result);
    }

    return {
      success: true,
      importedRows: allTransactions.length,
      totalQuantity: allTransactions.reduce((sum, item) => sum + item.quantity, 0),
      transactions: allTransactions,
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
  ): Promise<InventoryTransaction[]> {
    const effectiveOptions = {
      ...options,
      receiptGroupId: options?.receiptGroupId || `stkout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
    if (quantity <= 0) {
      throw new BadRequestException('Số lượng xuất kho phải lớn hơn 0');
    }

    const normalizedCategoryId = categoryId.trim();
    await this.ensureCategoryExists(normalizedCategoryId);
    if (!effectiveOptions.bypassCategoryActiveCheck) {
      await this.ensureCategoryIsActive(normalizedCategoryId);
    }

    const currentStock = effectiveOptions.skuComboId
      ? await this.getCurrentStockBySkuCombo(effectiveOptions.skuComboId)
      : await this.getCurrentStockByCategory(normalizedCategoryId);
    if (quantity > currentStock) {
      throw new BadRequestException(
        'Không thể xuất quá số lượng tồn kho hiện tại',
      );
    }

    const storageZoneId = effectiveOptions.storageZoneId;
    const warehousePositionId = effectiveOptions.warehousePositionId;

    const latestInboundContext =
      !effectiveOptions.productConditionId &&
      (effectiveOptions.skuComboId || warehousePositionId || storageZoneId)
        ? await this.getLatestInboundContext({
            categoryId: normalizedCategoryId,
            skuComboId: effectiveOptions.skuComboId,
            warehousePositionId,
            storageZoneId,
          })
        : null;
    const productConditionId =
      effectiveOptions.productConditionId ??
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
    if (storageZoneId && effectiveOptions.skuComboId) {
      const zoneStock = await this.getStockBySkuComboPerZone(
        effectiveOptions.skuComboId,
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

    // ── FIFO price resolution ──────────────────────────────────────────────
    // If the caller already supplies an explicit purchasePrice (e.g. transfer
    // or adjustment), skip FIFO and use that price for the whole quantity.
    // Otherwise resolve prices from oldest inbound lots first (FIFO).
    let fifoLots: Array<{
      lotTxId: string;
      purchasePrice: number | null;
      salePrice: number | null;
      quantity: number;
    }>;

    if (
      effectiveOptions.purchasePrice !== undefined &&
      effectiveOptions.purchasePrice !== null
    ) {
      // Explicit price supplied — treat as a single "virtual" lot
      fifoLots = [
        {
          lotTxId: '',
          purchasePrice: effectiveOptions.purchasePrice,
          salePrice: effectiveOptions.salePrice ?? effectiveOptions.purchasePrice,
          quantity,
        },
      ];
    } else {
      fifoLots = await this.getFifoLots(normalizedCategoryId, quantity, {
        skuComboId: effectiveOptions.skuComboId,
        storageZoneId,
      });

      // Fallback: if FIFO couldn't resolve lots (no tagged history yet, e.g.
      // legacy data), fall back to latest price for the whole quantity.
      if (fifoLots.length === 0 || fifoLots.reduce((s, l) => s + l.quantity, 0) < quantity) {
        const fallbackPrice = await this.getLatestActivePurchasePrice(normalizedCategoryId);
        fifoLots = [
          {
            lotTxId: '',
            purchasePrice: fallbackPrice,
            salePrice: effectiveOptions.salePrice ?? fallbackPrice,
            quantity,
          },
        ];
      }
    }
    // ──────────────────────────────────────────────────────────────────────

    // Create one STOCK_OUT transaction per FIFO lot slice inside a single DB transaction
    const createdTransactions = await this.prisma.$transaction(async (tx) => {
      const results: InventoryTransaction[] = [];

      for (const lot of fifoLots) {
        // Build note: embed FIFO lot reference tag so future calls can track consumption
        const fifoTag = lot.lotTxId ? `[FIFO_LOT:${lot.lotTxId}]` : '';
        const noteWithFifo = fifoTag
          ? [fifoTag, effectiveOptions.notes].filter(Boolean).join(' ')
          : effectiveOptions.notes;

        const createdTx = await tx.inventoryTransaction.create({
          data: {
            categoryId: normalizedCategoryId,
            type: TransactionType.STOCK_OUT,
            quantity: lot.quantity,
            purchasePrice: this.toPrismaDecimal(lot.purchasePrice),
            salePrice: this.toPrismaDecimal(lot.salePrice),
            status: InventoryTransactionStatus.ACTIVE,
            userId,
            skuComboId: effectiveOptions.skuComboId,
            productConditionId,
            storageZoneId,
            warehousePositionId: effectiveWarehousePositionId,
            actualStockDate: new Date(),
            notes: this.appendReceiptGroupTag(
              noteWithFifo,
              effectiveOptions.receiptGroupId,
            ),
          },
        });
        results.push(createdTx);
      }

      // Zone & position stock update (once for the full quantity)
      if (storageZoneId) {
        await tx.storageZone.update({
          where: { id: storageZoneId },
          data: { currentStock: { decrement: quantity } },
        });

        const zone = await tx.storageZone.findUnique({ where: { id: storageZoneId } });
        if (zone) {
          await this.warehouseService.syncLayoutPositionStock(zone.name, tx);
        }
      }

      if (effectiveWarehousePositionId) {
        await this.warehouseService.syncWarehouseLayoutPosition(effectiveWarehousePositionId, tx);
      }

      return results;
    });

    // Log activity for each created transaction
    for (const transaction of createdTransactions) {
      this.logActivity(
        userId,
        'CREATE',
        'InventoryTransaction',
        transaction.id,
        {
          type: TransactionType.STOCK_OUT,
          quantity: transaction.quantity,
          categoryId: normalizedCategoryId,
          skuComboId: effectiveOptions.skuComboId,
          warehousePositionId: effectiveWarehousePositionId,
          storageZoneId,
          purchasePrice: this.asNumber(transaction.purchasePrice),
          salePrice: this.asNumber(transaction.salePrice),
          notes: effectiveOptions.notes,
          receiptGroupId: effectiveOptions.receiptGroupId,
          actualStockDate: transaction.actualStockDate?.toISOString?.() ?? null,
        },
      );
    }

    return createdTransactions;
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
    const allTransactions: InventoryTransaction[] = [];

    for (const item of items) {
      // stockOut() now returns InventoryTransaction[] (one row per FIFO lot)
      const lotTransactions = await this.stockOut(
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
      allTransactions.push(...lotTransactions);
    }

    return {
      success: true,
      exportedRows: items.length,
      totalQuantity: allTransactions.reduce((sum, t) => sum + t.quantity, 0),
      transactions: allTransactions,
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
    if (!targetPosition.isStorageLocation) {
      throw new BadRequestException('Vị trí đích được gán là không chứa hàng, không thể chuyển hàng vào đây');
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

    const stockOutTxs = await this.stockOut(
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
        purchasePrice: latestPurchasePrice || undefined,
        salePrice: latestPurchasePrice || undefined,
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
      transactions: [...stockOutTxs, stockInTx],
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
  ): Promise<InventoryTransaction[]> {
    const normalizedCategoryId = categoryId.trim();
    const adjustmentNote = options?.reason
      ? `[ADJUSTMENT] ${options.reason}`
      : '[ADJUSTMENT]';
    const latestPrice =
      await this.getLatestActivePurchasePrice(normalizedCategoryId);

    if (type === 'INCREASE') {
      // INCREASE goes through stockIn — wrap in array for consistent return type
      const tx = await this.stockIn(normalizedCategoryId, quantity, userId, {
        purchasePrice: latestPrice ?? undefined,
        salePrice: latestPrice ?? undefined,
        skuComboId: options?.skuComboId,
        warehousePositionId: options?.warehousePositionId,
        storageZoneId: options?.storageZoneId,
        notes: adjustmentNote,
      });
      return [tx];
    }

    // DECREASE uses FIFO-aware stockOut
    return this.stockOut(normalizedCategoryId, quantity, userId, {
      purchasePrice: latestPrice ?? undefined,
      salePrice: latestPrice ?? undefined,
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
  ): Promise<InventoryTransaction[]> {
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

        if (transaction.warehousePositionId) {
          await this.warehouseService.syncWarehouseLayoutPosition(transaction.warehousePositionId, tx);
        }

        if (transaction.storageZoneId) {
          const zone = await tx.storageZone.findUnique({ where: { id: transaction.storageZoneId } });
          if (zone) {
            await this.warehouseService.syncLayoutPositionStock(zone.name, tx);
          }
        }
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
    const nextWarehouseTypeId =
      data.warehouseTypeId !== undefined
        ? data.warehouseTypeId
          ? String(data.warehouseTypeId)
          : null
        : transaction.warehouseTypeId;
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
    if (data.warehouseTypeId !== undefined)
      updateData.warehouseTypeId = nextWarehouseTypeId;
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

    if (transaction.warehousePositionId) {
      await this.warehouseService.syncWarehouseLayoutPosition(transaction.warehousePositionId);
    }
    if (nextWarehousePositionId && nextWarehousePositionId !== transaction.warehousePositionId) {
      await this.warehouseService.syncWarehouseLayoutPosition(nextWarehousePositionId);
    }
    if (transaction.storageZoneId) {
      const zone = await this.prisma.storageZone.findUnique({ where: { id: transaction.storageZoneId } });
      if (zone) {
        await this.warehouseService.syncLayoutPositionStock(zone.name);
      }
    }
    if (nextStorageZoneId && nextStorageZoneId !== transaction.storageZoneId) {
      const zone = await this.prisma.storageZone.findUnique({ where: { id: nextStorageZoneId } });
      if (zone) {
        await this.warehouseService.syncLayoutPositionStock(zone.name);
      }
    }

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

        if (transaction.warehousePositionId) {
          await this.warehouseService.syncWarehouseLayoutPosition(transaction.warehousePositionId, tx);
        }

        if (transaction.storageZoneId) {
          const zone = await tx.storageZone.findUnique({ where: { id: transaction.storageZoneId } });
          if (zone) {
            await this.warehouseService.syncLayoutPositionStock(zone.name, tx);
          }
        }
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
    skuComboIds?: string;
    sku?: string;
    receiptCode?: string;
    positionLabel?: string;
    warehouseInfo?: string;
    userName?: string;
    userId?: string;
    purchasePrice?: number;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<InventoryTransactionHistoryItem>> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.InventoryTransactionWhereInput = {};
    // productName is matched in application code (after rows are mapped to
    // their composed productName) because the composed string cannot be
    // matched reliably with a Prisma `contains` on individual sub-fields.
    let productNameFilters: string[] = [];

    if (filters.status) {
      const statuses = filters.status.split(',').map((s) => s.trim()).filter(Boolean);
      if (statuses.length === 1) {
        where.status = statuses[0] as InventoryTransactionStatus;
      } else {
        where.status = { in: statuses } as any;
      }
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
    if (filters.purchasePrice !== undefined) {
      where.purchasePrice = this.toPrismaDecimal(filters.purchasePrice);
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
      const names = filters.categoryName.split(',').map((s) => s.trim()).filter(Boolean);
      if (names.length === 1) {
        where.category = { name: { contains: names[0] } };
      } else {
        where.category = { name: { in: names } };
      }
    }
    if (filters.sku) {
      const skus = filters.sku.split(',').map((s) => s.trim()).filter(Boolean);
      if (skus.length === 1) {
        where.skuCombo = { compositeSku: { contains: skus[0] } };
      } else {
        where.skuCombo = { compositeSku: { in: skus } };
      }
    }
    if (filters.receiptCode?.trim()) {
      const raw = filters.receiptCode.trim();
      const code = raw.replace(/^(PNK-|PXK-)/i, '').toLowerCase();
      if (code) {
        const receiptCondition: Prisma.InventoryTransactionWhereInput = {
          notes: { contains: code },
        };
        if (where.notes) {
          where.AND = [...(Array.isArray(where.AND) ? where.AND : []), receiptCondition];
        } else {
          Object.assign(where, receiptCondition);
        }
      }
    }
    if (filters.productName) {
      // The frontend sends the composed product name (e.g.
      // "Ví ngắn Venus2 - ĐEN - Size M - Da") which is built from
      // classification + color + size + material joined with " - ".
      // A `contains` on individual sub-fields would never match, so we
      // capture the names here and apply the filter in application code
      // after the rows are mapped to their composed productName.
      productNameFilters = filters.productName
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (filters.skuComboIds) {
      // Authoritative filter: exact match on skuComboId. This is the
      // most precise filter — only transactions belonging to the
      // specific SKU combo(s) the user picked will be returned.
      const ids = filters.skuComboIds
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (ids.length > 0) {
        where.skuComboId = { in: ids };
        // If skuComboIds filter is set, the legacy productName filter
        // is not needed and can be cleared to avoid double-filtering.
        productNameFilters = [];
      }
    }
    if (filters.warehouseInfo) {
      const infos = filters.warehouseInfo.split(',').map((s) => s.trim()).filter(Boolean);
      const warehouseOR = infos.flatMap((info) => [
        { warehousePosition: { label: { contains: info } } },
        { warehousePosition: { layout: { name: { contains: info } } } },
        { storageZone: { name: { contains: info } } },
        { storageZone: { warehouseType: { name: { contains: info } } } },
        { warehouseType: { name: { contains: info } } },
      ]);
      if (warehouseOR.length > 0) {
        where.OR = [...(where.OR ?? []), ...warehouseOR];
      }
    }
    if (filters.positionLabel?.trim()) {
      where.OR = [
        ...(where.OR ?? []),
        { warehousePosition: { label: { contains: filters.positionLabel.trim() } } },
      ];
    }
    if (filters.userName?.trim()) {
      const names = filters.userName.split(',').map((s) => s.trim()).filter(Boolean);
      const userQueryWhere: Prisma.UserWhereInput = {};
      if (names.length === 1) {
        userQueryWhere.name = { contains: names[0] };
      } else {
        userQueryWhere.OR = names.map((n) => ({ name: { contains: n } }));
      }
      const users = await this.prisma.user.findMany({
        where: userQueryWhere,
        select: { id: true },
      });
      const userIds = users.map((user) => user.id);
      if (userIds.length === 0) {
        return {
          data: [],
          total: 0,
          page,
          limit,
          totalPages: 1,
        };
      }
      where.userId = filters.userId
        ? filters.userId
        : { in: userIds };
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

    // Apply productName filter in application code. Match strategy in order:
    //   1) Exact match on composed productName or SKU (after diacritic removal).
    //   2) All non-empty " - "-separated parts of the selected name match the
    //      row's individual sub-fields (full sub-field match).
    //   3) ANY single part of the selected name matches the row's
    //      classificationName (loose sub-field match). This covers cases
    //      where a transaction has no full SKU combo but does have the
    //      classification — e.g. the row's productName is just the
    //      category, but a user picks a specific composed name to filter.
    let filteredData = mapped;
    let filteredTotal = total;
    if (productNameFilters.length > 0) {
      const targets = productNameFilters.map((s) => this.removeDiacritics(s.trim().toLowerCase()));
      filteredData = mapped.filter((row) => {
        const rowName = this.removeDiacritics(String(row.productName || '').toLowerCase());
        const rowSku = this.removeDiacritics(String(row.sku || '').toLowerCase());
        const rowClassification = this.removeDiacritics(
          String(row.classificationName || '').toLowerCase(),
        );
        for (const target of targets) {
          if (rowName === target) return true;
          if (rowSku === target) return true;
          const parts = target.split(' - ').filter(Boolean);
          if (parts.length === 0) continue;
          // Step 2: every part must match one of the row's sub-fields
          const subFields = [
            this.removeDiacritics(String(row.classificationName || '').toLowerCase()),
            this.removeDiacritics(String(row.colorName || '').toLowerCase()),
            this.removeDiacritics(String(row.sizeName || '').toLowerCase()),
            this.removeDiacritics(String(row.materialName || '').toLowerCase()),
          ];
          const allMatch = parts.every((part) =>
            subFields.some((field) => field !== '' && field === this.removeDiacritics(part)),
          );
          if (allMatch) return true;
          // Step 3: classification-only fallback — if the row has the same
          // classification as the selected name, count it as a match. This
          // is the loosest tier and prevents the case where picking
          // "Thắt lưng Class8-LE" returns zero rows just because the row's
          // productName was built from the category only.
          if (rowClassification !== '') {
            const classificationMatches = parts.some(
              (part) => this.removeDiacritics(part) === rowClassification,
            );
            if (classificationMatches) return true;
          }
        }
        return false;
      });
      filteredTotal = filteredData.length;
    }

    return {
      data: filteredData,
      total: filteredTotal,
      page,
      limit,
      totalPages: Math.ceil(filteredTotal / limit) || 1,
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
    productName?: string;
    skuComboIds?: string;
    sku?: string;
    categoryName?: string;
    stock?: string;
    isDiscontinued?: string;
    productConditionName?: string;
    storageZone?: string;
    warehouseType?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<unknown>> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 100;
    const skip = (page - 1) * limit;

    // Build Prisma WHERE clause for DB-level filtering
    const where: Prisma.InventoryTransactionWhereInput = {
      status: InventoryTransactionStatus.ACTIVE,
    };

    const addNameFilter = (
      field: string,
      val?: string,
    ): Prisma.InventoryTransactionWhereInput | null => {
      if (!val) return null;
      const names = val.split(',').map((s) => s.trim()).filter(Boolean);
      if (names.length === 0) return null;
      if (names.length === 1) return { [field]: { name: { contains: names[0] } } };
      return { [field]: { name: { in: names } } };
    };

    if (filters.categoryName) {
      const f = addNameFilter('category', filters.categoryName);
      if (f) Object.assign(where, f);
    }
    if (filters.sku) {
      const skus = filters.sku.split(',').map((s) => s.trim()).filter(Boolean);
      if (skus.length === 1) {
        Object.assign(where, { skuCombo: { compositeSku: { contains: skus[0] } } });
      } else if (skus.length > 1) {
        Object.assign(where, { skuCombo: { compositeSku: { in: skus } } });
      }
    }
    if (filters.skuComboIds) {
      // Authoritative filter on inventory-by-sku: exact match on skuComboId.
      const ids = filters.skuComboIds
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (ids.length > 0) {
        Object.assign(where, { skuComboId: { in: ids } });
      }
    }
    if (filters.productConditionName) {
      const f = addNameFilter('productCondition', filters.productConditionName);
      if (f) Object.assign(where, f);
    }
    if (filters.storageZone) {
      const f = addNameFilter('storageZone', filters.storageZone);
      if (f) Object.assign(where, f);
    }
    if (filters.search) {
      const keywords = filters.search
        .split(/\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (keywords.length > 0) {
        Object.assign(where, {
          AND: keywords.map((kw) => ({
            OR: [
              { category: { name: { contains: kw } } },
              { skuCombo: { compositeSku: { contains: kw } } },
              { skuCombo: { classification: { name: { contains: kw } } } },
              { skuCombo: { color: { name: { contains: kw } } } },
              { skuCombo: { size: { name: { contains: kw } } } },
              { skuCombo: { material: { name: { contains: kw } } } },
            ],
          })),
        });
      }
    }

    const transactions = await this.prisma.inventoryTransaction.findMany({
      where,
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
          include: { layout: true },
        },
        storageZone: {
          include: { warehouseType: true },
        },
        warehouseType: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const products = await this.prisma.product.findMany({
      select: { id: true, categoryId: true, isDiscontinued: true },
    });
    const productMap = new Map(products.map((item) => [item.categoryId, item]));

    // Group by skuComboId (or categoryId if no skuCombo)
    const map = new Map<string, Record<string, unknown>>();

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
        // Sub-fields used for accurate filtering: when a composed productName
        // fails to match (e.g. legacy transactions with categoryName instead
        // of composed name), the backend can still match by checking these
        // individual fields against the split parts of the user's selection.
        classificationName: skuCombo?.classification?.name ?? null,
        colorName: skuCombo?.color?.name ?? null,
        sizeName: skuCombo?.size?.name ?? null,
        materialName: skuCombo?.material?.name ?? null,
        stock: 0,
        productConditionName: null,
        positionLabels: [] as string[],
        warehouseTypeNames: [] as string[],
        storageZoneNames: [] as string[],
        latestPurchasePrice: null as number | null,
        transactionIds: [] as string[],
        positions: [] as Array<{
          id: string;
          label: string;
          currentStock: number;
          warehouseTypeName: string | null;
        }>,
      };

      existing.stock =
        (existing.stock as number) +
        (tx.type === TransactionType.STOCK_IN ? tx.quantity : -tx.quantity);
      (existing.transactionIds as string[]).push(tx.id);

      if (!existing.productConditionName && tx.productCondition?.name) {
        existing.productConditionName = tx.productCondition.name;
      }
      if (!existing.latestPurchasePrice && tx.purchasePrice) {
        existing.latestPurchasePrice = this.asNumber(tx.purchasePrice);
      }
      if (
        tx.warehousePosition?.label &&
        !(existing.positionLabels as string[]).includes(tx.warehousePosition.label)
      ) {
        (existing.positionLabels as string[]).push(tx.warehousePosition.label);
      }

      const resolvedWarehouseTypeName =
        (tx as any).warehouseType?.name ??
        tx.warehousePosition?.layout?.name ??
        (tx.storageZone as any)?.warehouseType?.name ??
        null;
      if (
        resolvedWarehouseTypeName &&
        !(existing.warehouseTypeNames as string[]).includes(resolvedWarehouseTypeName)
      ) {
        (existing.warehouseTypeNames as string[]).push(resolvedWarehouseTypeName);
      }

      if (
        tx.storageZone?.name &&
        !(existing.storageZoneNames as string[]).includes(tx.storageZone.name)
      ) {
        (existing.storageZoneNames as string[]).push(tx.storageZone.name);
      }
      if (
        tx.warehousePosition?.id &&
        !(existing.positions as Array<{ id: string }>).some(
          (p) => p.id === tx.warehousePosition?.id,
        )
      ) {
        (existing.positions as Array<Record<string, unknown>>).push({
          id: tx.warehousePosition.id,
          label: tx.warehousePosition.label || tx.warehousePosition.id,
          currentStock: 0,
          warehouseTypeName: resolvedWarehouseTypeName,
        });
      }

      map.set(key, existing);
    }

    // Compute currentStock per position from transactions
    const positionStockMap = new Map<string, number>();
    for (const tx of transactions) {
      if (!tx.warehousePositionId) continue;
      const delta =
        tx.type === TransactionType.STOCK_IN ? tx.quantity : -tx.quantity;
      positionStockMap.set(
        tx.warehousePositionId,
        (positionStockMap.get(tx.warehousePositionId) ?? 0) + delta,
      );
    }

    let rows = Array.from(map.values()).sort((a, b) =>
      (a.productName as string).localeCompare(b.productName as string),
    );

    // Enrich positions with computed currentStock
    for (const row of rows) {
      for (const pos of row.positions as Array<Record<string, unknown>>) {
        pos.currentStock = positionStockMap.get(pos.id as string) ?? 0;
      }
    }

    // Enrich with threshold data from SkuCombo
    const skuComboIds = rows
      .map((r) => r.skuComboId as string | null)
      .filter(Boolean) as string[];
    const thresholdMap = new Map(
      skuComboIds.length > 0
        ? (await this.prisma.skuCombo.findMany({
            where: { id: { in: skuComboIds } },
            select: { id: true, minThreshold: true, maxThreshold: true, isDiscontinued: true },
          })).map((s) => [s.id, s])
        : [],
    );

    const enrichedRows: Record<string, unknown>[] = rows.map((r) => {
      const skuData = r.skuComboId ? thresholdMap.get(r.skuComboId as string) : null;
      return {
        ...r,
        isDiscontinued: skuData?.isDiscontinued ?? r.isDiscontinued,
        minThreshold: skuData?.minThreshold ?? 0,
        maxThreshold: skuData?.maxThreshold ?? 0,
      };
    }) as Record<string, unknown>[];

    // In-memory filters for computed/grouped fields
    let filteredRows = enrichedRows;
    if (filters.productName) {
      // productName is a comma-separated list of composed names the user
      // picked. For each name we use a three-step match (in order):
      //   1) Exact match on row.productName (the composed string).
      //   2) All non-empty " - "-separated parts match the row's sub-fields.
      //   3) Any single part matches the row's classificationName (loose
      //      fallback). This catches legacy rows whose productName is the
      //      category only — picking "Thắt lưng Class8-LE" still returns
      //      those rows because their classification matches.
      const targets = filters.productName
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => this.removeDiacritics(s.toLowerCase()));
      if (targets.length > 0) {
        filteredRows = filteredRows.filter((r) => {
          const rowName = this.removeDiacritics(
            String((r as Record<string, unknown>).productName || '').toLowerCase(),
          );
          const rowClassification = this.removeDiacritics(
            String((r as Record<string, unknown>).classificationName || '').toLowerCase(),
          );
          for (const target of targets) {
            // 1) exact match on composed productName
            if (rowName === target) return true;
            // 2) every " - "-separated part matches one of the sub-fields
            const parts = target.split(' - ').filter(Boolean);
            if (parts.length === 0) continue;
            const subFields = [
              this.removeDiacritics(
                String((r as Record<string, unknown>).classificationName || '').toLowerCase(),
              ),
              this.removeDiacritics(String((r as Record<string, unknown>).colorName || '').toLowerCase()),
              this.removeDiacritics(String((r as Record<string, unknown>).sizeName || '').toLowerCase()),
              this.removeDiacritics(String((r as Record<string, unknown>).materialName || '').toLowerCase()),
            ];
            const allMatch = parts.every((part) =>
              subFields.some((field) => field !== '' && field === this.removeDiacritics(part)),
            );
            if (allMatch) return true;
            // 3) classification-only fallback
            if (rowClassification !== '') {
              const clsMatch = parts.some(
                (part) => this.removeDiacritics(part) === rowClassification,
              );
              if (clsMatch) return true;
            }
          }
          return false;
        });
      }
    }
    if (filters.stock) {
      filteredRows = filteredRows.filter(
        (r) => String(r.stock) === String(filters.stock),
      );
    }
    if (filters.isDiscontinued === 'true' || filters.isDiscontinued === 'false') {
      const val = filters.isDiscontinued === 'true';
      filteredRows = filteredRows.filter((r) => Boolean(r.isDiscontinued) === val);
    }
    if (filters.warehouseType) {
      const kw = this.removeDiacritics(filters.warehouseType.toLowerCase().trim());
      filteredRows = filteredRows.filter((r) =>
        ((r.warehouseTypeNames as unknown) as string[]).some((n) =>
          this.removeDiacritics(n.toLowerCase()).includes(kw),
        ),
      );
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
