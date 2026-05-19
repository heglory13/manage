import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryTransactionStatus,
  Prisma,
  StocktakingStatus,
  TransactionType,
} from '@prisma/client/index';
import { InventoryService } from '../inventory/inventory.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { SubmitStocktakingItemDto } from './dto/create-stocktaking.dto.js';
import type { UpdateStocktakingItemDto } from './dto/update-stocktaking-item.dto.js';

export interface StocktakingFilters {
  status?: string;
  startDate?: string;
  endDate?: string;
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

type StocktakingMode =
  | 'full'
  | 'selected'
  | 'category'
  | 'warehouseType'
  | 'product';

type StocktakingCategorySnapshot = {
  categoryId: string | null;
  itemCode: string;
  itemLabel: string;
  systemQuantity: number;
  actualQuantity: number;
  discrepancy: number;
};

@Injectable()
export class StocktakingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  /**
   * Get stock for a category at a specific point in time (cutoffDate).
   * If cutoffDate is not provided, returns current stock.
   */
  private buildCutoffWhere(
    cutoffDate?: Date,
  ): Prisma.InventoryTransactionWhereInput {
    if (!cutoffDate) return {};
    return {
      OR: [
        { actualStockDate: { lte: cutoffDate } },
        {
          AND: [{ actualStockDate: null }, { createdAt: { lte: cutoffDate } }],
        },
      ],
    };
  }

  calculateDiscrepancies(
    items: Array<{ systemQuantity: number; actualQuantity: number }>,
  ): Array<{
    systemQuantity: number;
    actualQuantity: number;
    discrepancy: number;
  }> {
    return items.map((item) => ({
      ...item,
      discrepancy: item.actualQuantity - item.systemQuantity,
    }));
  }

  validateDiscrepancyReasons(
    items: Array<{ discrepancy: number; discrepancyReason?: string | null }>,
  ): { valid: boolean; message?: string } {
    const missingReason = items.some(
      (item) =>
        item.discrepancy !== 0 &&
        (!item.discrepancyReason || item.discrepancyReason.trim() === ''),
    );

    if (missingReason) {
      return {
        valid: false,
        message:
          'Vui lòng điền nguyên nhân chênh lệch cho tất cả các dòng có sai lệch',
      };
    }

    return { valid: true };
  }

  validateEvidence(
    items: Array<{ discrepancy: number; evidenceUrl?: string | null }>,
  ): { valid: boolean; message?: string } {
    const missingEvidence = items.some(
      (item) => item.discrepancy !== 0 && !item.evidenceUrl,
    );

    if (missingEvidence) {
      return {
        valid: false,
        message:
          'Yêu cầu đính kèm ảnh/file minh chứng cho các dòng có sai lệch',
      };
    }

    return { valid: true };
  }

  private stocktakingItemInclude = {
    product: true,
    category: true,
  } satisfies Prisma.StocktakingItemInclude;

  private recordInclude = {
    items: {
      include: {
        product: true,
        category: true,
      },
      orderBy: {
        itemCode: 'asc',
      },
    },
    creator: {
      select: { id: true, name: true, email: true, role: true },
    },
  } satisfies Prisma.StocktakingRecordInclude;

  private detailInclude = {
    ...this.recordInclude,
    statusHistory: {
      orderBy: { changedAt: 'asc' },
    },
  } satisfies Prisma.StocktakingRecordInclude;

  private async resolveCategoryIds(
    mode: StocktakingMode,
    productIds?: string[],
    categoryIds?: string[],
    warehouseTypeIds?: string[],
    skuComboIds?: string[],
  ) {
    if (mode === 'product') {
      // Product mode uses skuComboIds — resolve categories from transactions
      if (!skuComboIds || skuComboIds.length === 0) {
        throw new BadRequestException(
          'Vui long chon it nhat mot san pham khi kiem ke theo san pham',
        );
      }
      const transactions = await this.prisma.inventoryTransaction.findMany({
        where: { skuComboId: { in: skuComboIds }, categoryId: { not: null } },
        select: { categoryId: true },
        distinct: ['categoryId'],
      });
      const ids = transactions
        .map((t) => t.categoryId)
        .filter(Boolean) as string[];
      if (ids.length === 0) {
        throw new BadRequestException(
          'Khong tim thay danh muc nao tu cac san pham da chon',
        );
      }
      return [...new Set(ids)];
    }

    if (mode === 'selected') {
      if (!productIds || productIds.length === 0) {
        throw new BadRequestException(
          'Vui lòng chọn ít nhất một sản phẩm khi kiểm kê theo danh sách',
        );
      }

      const products = await this.prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { categoryId: true },
      });

      return [...new Set(products.map((product) => product.categoryId))];
    }

    if (mode === 'category') {
      if (!categoryIds || categoryIds.length === 0) {
        throw new BadRequestException(
          'Vui long chon it nhat mot danh muc khi kiem ke theo danh muc',
        );
      }

      return [...new Set(categoryIds)];
    }

    if (mode === 'warehouseType') {
      if (!warehouseTypeIds || warehouseTypeIds.length === 0) {
        throw new BadRequestException(
          'Vui long chon it nhat mot loai kho khi kiem ke theo loai kho',
        );
      }

      const checks = await this.prisma.preliminaryCheck.findMany({
        where: {
          warehouseTypeId: { in: warehouseTypeIds },
          categoryId: { not: null },
        },
        select: { categoryId: true },
      });

      return [
        ...new Set(checks.map((check) => check.categoryId).filter(Boolean)),
      ] as string[];
    }

    const categories = await this.prisma.category.findMany({
      select: { id: true },
      orderBy: { name: 'asc' },
    });

    return categories.map((category) => category.id);
  }

  private async buildCategorySnapshots(
    mode: StocktakingMode,
    productIds?: string[],
    categoryIds?: string[],
    warehouseTypeIds?: string[],
    skuComboIds?: string[],
    cutoffDate?: Date,
  ): Promise<StocktakingCategorySnapshot[]> {
    const cutoffWhere = this.buildCutoffWhere(cutoffDate);

    // Product mode: create one snapshot per selected SKU combo
    if (mode === 'product' && skuComboIds && skuComboIds.length > 0) {
      const combos = await this.prisma.skuCombo.findMany({
        where: { id: { in: skuComboIds } },
        include: {
          classification: true,
          color: true,
          size: true,
          material: true,
        },
      });

      return Promise.all(
        combos.map(async (combo) => {
          const productName = [
            combo.classification?.name,
            combo.color?.name,
            combo.size?.name,
            combo.material?.name,
          ]
            .filter(Boolean)
            .join(' - ');
          const transactions = await this.prisma.inventoryTransaction.findMany({
            where: {
              skuComboId: combo.id,
              status: InventoryTransactionStatus.ACTIVE,
              ...cutoffWhere,
            },
            select: { type: true, quantity: true, categoryId: true },
            orderBy: { createdAt: 'desc' },
          });
          const stock = transactions.reduce(
            (sum, t) =>
              sum +
              (t.type === TransactionType.STOCK_IN ? t.quantity : -t.quantity),
            0,
          );
          // Use the most recent transaction's categoryId as it's most likely correct
          const categoryId =
            transactions.find((t) => t.categoryId)?.categoryId ?? null;

          return {
            categoryId,
            itemCode: combo.compositeSku,
            itemLabel: productName || combo.compositeSku,
            systemQuantity: Math.max(stock, 0),
            actualQuantity: 0,
            discrepancy: 0,
          };
        }),
      );
    }

    // Full / category / warehouseType: one snapshot per SKU combo found in those categories
    const resolvedCategoryIds = await this.resolveCategoryIds(
      mode,
      productIds,
      categoryIds,
      warehouseTypeIds,
      skuComboIds,
    );

    if (resolvedCategoryIds.length === 0) {
      throw new BadRequestException('Không tìm thấy danh mục nào để kiểm kê');
    }

    const transactions = await this.prisma.inventoryTransaction.findMany({
      where: {
        categoryId: { in: resolvedCategoryIds },
        status: InventoryTransactionStatus.ACTIVE,
        ...cutoffWhere,
      },
      include: {
        skuCombo: {
          include: {
            classification: true,
            color: true,
            size: true,
            material: true,
          },
        },
        category: { select: { id: true, code: true, name: true } },
      },
    });

    if (transactions.length === 0) {
      throw new BadRequestException(
        'Không tìm thấy giao dịch nào để kiểm kê trong phạm vi đã chọn',
      );
    }

    // Group by skuComboId → per-SKU snapshot; fallback per-category for legacy transactions
    const map = new Map<string, StocktakingCategorySnapshot>();
    for (const tx of transactions) {
      const key = tx.skuComboId
        ? `sku:${tx.skuComboId}`
        : `cat:${tx.categoryId}`;
      const delta =
        tx.type === TransactionType.STOCK_IN ? tx.quantity : -tx.quantity;

      if (!map.has(key)) {
        let itemCode: string;
        let itemLabel: string;
        if (tx.skuComboId && tx.skuCombo) {
          itemCode = tx.skuCombo.compositeSku;
          itemLabel =
            [
              tx.skuCombo.classification?.name,
              tx.skuCombo.color?.name,
              tx.skuCombo.size?.name,
              tx.skuCombo.material?.name,
            ]
              .filter(Boolean)
              .join(' - ') || tx.skuCombo.compositeSku;
        } else {
          itemCode = tx.category?.code ?? '-';
          itemLabel = tx.category?.name ?? '-';
        }
        map.set(key, {
          categoryId: tx.categoryId,
          itemCode,
          itemLabel,
          systemQuantity: delta,
          actualQuantity: 0,
          discrepancy: 0,
        });
      } else {
        map.get(key)!.systemQuantity += delta;
      }
    }

    return Array.from(map.values()).map((item) => ({
      ...item,
      systemQuantity: Math.max(item.systemQuantity, 0),
    }));
  }

  private async getLatestAdjustmentPrice(categoryId: string) {
    const latestTransaction = await this.prisma.inventoryTransaction.findFirst({
      where: {
        categoryId,
        status: InventoryTransactionStatus.ACTIVE,
        purchasePrice: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      select: { purchasePrice: true, salePrice: true },
    });

    const purchasePrice =
      latestTransaction?.purchasePrice ?? new Prisma.Decimal(0);
    const salePrice = latestTransaction?.salePrice ?? purchasePrice;

    return {
      purchasePrice,
      salePrice,
    };
  }

  async create(
    mode: StocktakingMode,
    userId: string,
    productIds?: string[],
    cutoffTime?: string,
    categoryIds?: string[],
    warehouseTypeIds?: string[],
    skuComboIds?: string[],
  ) {
    const cutoffDate = cutoffTime ? new Date(cutoffTime) : new Date();

    const snapshots = await this.buildCategorySnapshots(
      mode,
      productIds,
      categoryIds,
      warehouseTypeIds,
      skuComboIds,
      cutoffDate,
    );

    const record = await this.prisma.stocktakingRecord.create({
      data: {
        createdBy: userId,
        status: StocktakingStatus.CHECKING,
        mode,
        cutoffTime: cutoffDate,
        items: {
          create: snapshots,
        },
      },
      include: this.recordInclude,
    });

    await this.recordStatusChange(
      record.id,
      StocktakingStatus.CHECKING,
      userId,
    );

    return record;
  }

  async submit(id: string, items: SubmitStocktakingItemDto[], userId?: string) {
    const record = await this.prisma.stocktakingRecord.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!record) {
      throw new NotFoundException('Biên bản kiểm kê không tồn tại');
    }

    if (record.status !== StocktakingStatus.CHECKING) {
      throw new BadRequestException(
        'Chỉ có thể submit biên bản ở trạng thái Đang kiểm kê',
      );
    }

    const recordItemIds = new Set(record.items.map((i) => i.id));
    const submittedIds = new Set(items.map((i) => i.itemId));
    const missing = [...recordItemIds].filter(
      (itemId) => !submittedIds.has(itemId),
    );
    if (missing.length > 0) {
      throw new BadRequestException(
        `Vui lòng nhập số lượng cho tất cả ${record.items.length} mặt hàng trong biên bản kiểm kê.`,
      );
    }

    const submittedMap = new Map(items.map((item) => [item.itemId, item]));

    const updatedItems = record.items.map((existingItem) => {
      const submitted = submittedMap.get(existingItem.id);
      if (!submitted) {
        return existingItem;
      }

      const discrepancy =
        submitted.actualQuantity - existingItem.systemQuantity;
      return {
        ...existingItem,
        actualQuantity: submitted.actualQuantity,
        discrepancy,
        discrepancyReason: submitted.discrepancyReason || null,
        evidenceUrl: submitted.evidenceUrls?.length
          ? JSON.stringify(submitted.evidenceUrls)
          : existingItem.evidenceUrl,
      };
    });

    const validation = this.validateDiscrepancyReasons(updatedItems);
    if (!validation.valid) {
      throw new BadRequestException(validation.message);
    }

    const updateOps = updatedItems
      .map((item) => {
        const submitted = submittedMap.get(item.id);
        if (!submitted) return null;

        return this.prisma.stocktakingItem.update({
          where: { id: item.id },
          data: {
            actualQuantity: submitted.actualQuantity,
            discrepancy: submitted.actualQuantity - item.systemQuantity,
            discrepancyReason: submitted.discrepancyReason || null,
            evidenceUrl: submitted.evidenceUrls?.length
              ? JSON.stringify(submitted.evidenceUrls)
              : undefined,
          },
        });
      })
      .filter(Boolean);

    const submittedAt = new Date();

    await this.prisma.$transaction([
      ...(updateOps as Prisma.PrismaPromise<unknown>[]),
      this.prisma.stocktakingRecord.update({
        where: { id },
        data: {
          status: StocktakingStatus.PENDING,
          submittedAt,
        },
      }),
    ]);

    await this.recordStatusChange(id, StocktakingStatus.PENDING, userId);

    return this.prisma.stocktakingRecord.findUnique({
      where: { id },
      include: this.recordInclude,
    });
  }

  async approve(id: string, userId?: string, userRole?: string) {
    const record = await this.prisma.stocktakingRecord.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!record) {
      throw new NotFoundException('Biên bản kiểm kê không tồn tại');
    }

    if (record.status !== StocktakingStatus.PENDING) {
      throw new BadRequestException(
        'Chỉ có thể phê duyệt biên bản ở trạng thái Chờ duyệt',
      );
    }

    const actorId = userId || record.createdBy;

    // Step 1: Pre-validate ALL items with negative discrepancy before applying any adjustments
    for (const item of record.items) {
      if (!item.categoryId || item.discrepancy >= 0 || item.isBalanced) {
        continue;
      }

      // Resolve skuComboId from itemCode (SKU)
      let skuComboId: string | undefined;
      if (item.itemCode) {
        const skuCombo = await this.prisma.skuCombo.findFirst({
          where: { compositeSku: item.itemCode },
        });
        skuComboId = skuCombo?.id;
      }

      const currentStock = skuComboId
        ? await this.inventoryService.getCurrentStockBySkuCombo(skuComboId)
        : await this.inventoryService.getCurrentStockByCategory(
            item.categoryId,
          );

      if (currentStock < Math.abs(item.discrepancy)) {
        throw new BadRequestException(
          `Tồn kho không đủ để thực hiện điều chỉnh giảm cho mục "${item.itemLabel}"`,
        );
      }
    }

    // Step 2: All validations passed, now apply adjustments
    for (const item of record.items) {
      if (!item.categoryId || item.discrepancy === 0 || item.isBalanced) {
        continue;
      }

      // Resolve skuComboId from itemCode (SKU)
      let skuComboId: string | undefined;
      if (item.itemCode) {
        const skuCombo = await this.prisma.skuCombo.findFirst({
          where: { compositeSku: item.itemCode },
        });
        skuComboId = skuCombo?.id;
      }

      await this.inventoryService.balanceStockByCategory(
        item.categoryId,
        Math.abs(item.discrepancy),
        item.discrepancy > 0 ? 'INCREASE' : 'DECREASE',
        actorId,
        `[STOCKTAKING] Phe duyet bien ban ${record.id} - ${item.itemCode} ${item.itemLabel}`,
        { skuComboId },
      );

      await this.prisma.stocktakingItem.update({
        where: { id: item.id },
        data: { isBalanced: true, balancedAt: new Date() },
      });
    }

    const [updatedRecord] = await this.prisma.$transaction([
      this.prisma.stocktakingRecord.update({
        where: { id },
        data: { status: StocktakingStatus.APPROVED },
        include: this.recordInclude,
      }),
    ]);

    await this.recordStatusChange(id, StocktakingStatus.APPROVED, actorId);

    return updatedRecord;
  }

  async reject(id: string, userId?: string, note?: string, userRole?: string) {
    const record = await this.prisma.stocktakingRecord.findUnique({
      where: { id },
    });

    if (!record) {
      throw new NotFoundException('Biên bản kiểm kê không tồn tại');
    }

    if (record.status !== StocktakingStatus.PENDING) {
      throw new BadRequestException(
        'Chỉ có thể từ chối biên bản ở trạng thái Chờ duyệt',
      );
    }

    const updatedRecord = await this.prisma.stocktakingRecord.update({
      where: { id },
      data: { status: StocktakingStatus.REJECTED },
      include: this.recordInclude,
    });

    await this.recordStatusChange(id, StocktakingStatus.REJECTED, userId, note);

    return updatedRecord;
  }

  async balanceStock(id: string, userId: string) {
    const record = await this.prisma.stocktakingRecord.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!record) {
      throw new NotFoundException('Bien ban kiem ke khong ton tai');
    }

    if (
      record.status !== StocktakingStatus.PENDING &&
      record.status !== StocktakingStatus.APPROVED
    ) {
      throw new BadRequestException(
        'Chi co the can bang kho khi bien ban o trang thai Cho duyet hoac Da duyet',
      );
    }

    let adjustedCount = 0;

    for (const item of record.items) {
      if (!item.categoryId || item.discrepancy === 0 || item.isBalanced)
        continue;

      let skuComboId: string | undefined;
      if (item.itemCode) {
        const skuCombo = await this.prisma.skuCombo.findFirst({
          where: { compositeSku: item.itemCode },
        });
        skuComboId = skuCombo?.id;
      }

      await this.inventoryService.balanceStockByCategory(
        item.categoryId,
        Math.abs(item.discrepancy),
        item.discrepancy > 0 ? 'INCREASE' : 'DECREASE',
        userId,
        `Can bang kho theo Bien ban kiem ke ${record.id} - ${item.itemCode} ${item.itemLabel}`,
        { skuComboId },
      );

      await this.prisma.stocktakingItem.update({
        where: { id: item.id },
        data: { isBalanced: true, balancedAt: new Date() },
      });

      adjustedCount++;
    }

    if (adjustedCount === 0) {
      return {
        success: true,
        message:
          'Khong co chenh lech nao can dieu chinh (co the da can bang het roi)',
        adjustedCount: 0,
      };
    }

    // Update record status to APPROVED if still PENDING
    if (record.status === StocktakingStatus.PENDING) {
      await this.prisma.stocktakingRecord.update({
        where: { id },
        data: { status: StocktakingStatus.APPROVED, submittedAt: new Date() },
      });
      await this.recordStatusChange(id, StocktakingStatus.APPROVED, userId);
    }

    return {
      success: true,
      message: `Da can bang kho thanh cong: ${adjustedCount} dieu chinh`,
      adjustedCount,
    };
  }

  async balanceStockItem(itemId: string, userId: string) {
    const item = await this.prisma.stocktakingItem.findUnique({
      where: { id: itemId },
      include: { record: true },
    });

    if (!item) {
      throw new NotFoundException('Dong kiem ke khong ton tai');
    }

    if (item.discrepancy === 0) {
      throw new BadRequestException(
        'Dong nay khong co chenh lech, khong can can bang',
      );
    }

    if (item.isBalanced) {
      throw new BadRequestException('Dong nay da duoc can bang kho roi');
    }

    if (
      item.record.status !== StocktakingStatus.PENDING &&
      item.record.status !== StocktakingStatus.APPROVED
    ) {
      throw new BadRequestException(
        'Chi co the can bang kho khi bien ban o trang thai Cho duyet hoac Da duyet',
      );
    }

    if (!item.categoryId) {
      throw new BadRequestException(
        'Dong nay khong co danh muc, khong the can bang',
      );
    }

    let skuComboId: string | undefined;
    if (item.itemCode) {
      const skuCombo = await this.prisma.skuCombo.findFirst({
        where: { compositeSku: item.itemCode },
      });
      skuComboId = skuCombo?.id;
    }

    await this.inventoryService.balanceStockByCategory(
      item.categoryId,
      Math.abs(item.discrepancy),
      item.discrepancy > 0 ? 'INCREASE' : 'DECREASE',
      userId,
      `Can bang kho theo Bien ban kiem ke ${item.recordId} - ${item.itemCode} ${item.itemLabel}`,
      { skuComboId },
    );

    await this.prisma.stocktakingItem.update({
      where: { id: itemId },
      data: { isBalanced: true, balancedAt: new Date() },
    });

    // If all discrepancy items are now balanced, move record to APPROVED
    const unbalancedCount = await this.prisma.stocktakingItem.count({
      where: {
        recordId: item.recordId,
        discrepancy: { not: 0 },
        isBalanced: false,
      },
    });

    if (
      unbalancedCount === 0 &&
      item.record.status === StocktakingStatus.PENDING
    ) {
      await this.prisma.stocktakingRecord.update({
        where: { id: item.recordId },
        data: { status: StocktakingStatus.APPROVED, submittedAt: new Date() },
      });
      await this.recordStatusChange(
        item.recordId,
        StocktakingStatus.APPROVED,
        userId,
      );
    }

    return {
      success: true,
      message: `Da can bang kho cho dong: ${item.itemLabel}`,
      remainingUnbalanced: unbalancedCount,
    };
  }

  async recordStatusChange(
    recordId: string,
    status: StocktakingStatus,
    changedBy?: string,
    note?: string,
  ) {
    return this.prisma.stocktakingStatusHistory.create({
      data: {
        recordId,
        status,
        changedBy: changedBy || null,
        note: note || null,
      },
    });
  }

  async getStatusHistory(recordId: string) {
    const record = await this.prisma.stocktakingRecord.findUnique({
      where: { id: recordId },
    });

    if (!record) {
      throw new NotFoundException('Biên bản kiểm kê không tồn tại');
    }

    return this.prisma.stocktakingStatusHistory.findMany({
      where: { recordId },
      orderBy: { changedAt: 'asc' },
    });
  }

  async remove(id: string) {
    const record = await this.prisma.stocktakingRecord.findUnique({
      where: { id },
    });
    if (!record) {
      throw new NotFoundException('Biên bản kiểm kê không tồn tại');
    }
    if (
      record.status === StocktakingStatus.APPROVED ||
      record.status === StocktakingStatus.PENDING
    ) {
      throw new BadRequestException(
        'Không thể xóa biên bản kiểm kê đã nộp hoặc đã duyệt.',
      );
    }
    // Delete related items and history first
    await this.prisma.$transaction([
      this.prisma.stocktakingStatusHistory.deleteMany({
        where: { recordId: id },
      }),
      this.prisma.stocktakingItem.deleteMany({ where: { recordId: id } }),
      this.prisma.stocktakingRecord.delete({ where: { id } }),
    ]);
    return { success: true };
  }

  async findOne(id: string) {
    const record = await this.prisma.stocktakingRecord.findUnique({
      where: { id },
      include: this.detailInclude,
    });

    if (!record) {
      throw new NotFoundException('Biên bản kiểm kê không tồn tại');
    }

    return record;
  }

  async updateItem(itemId: string, dto: UpdateStocktakingItemDto) {
    const item = await this.prisma.stocktakingItem.findUnique({
      where: { id: itemId },
      include: {
        record: true,
      },
    });

    if (!item) {
      throw new NotFoundException('Dòng kiểm kê không tồn tại');
    }

    if (item.record.status !== StocktakingStatus.CHECKING) {
      throw new BadRequestException(
        'Chỉ có thể cập nhật khi biên bản đang ở trạng thái kiểm kê',
      );
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
      include: this.stocktakingItemInclude,
    });
  }

  async findAll(
    filters: StocktakingFilters,
  ): Promise<PaginatedResponse<unknown>> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.startDate || filters.endDate) {
      const createdAt: Record<string, Date> = {};
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
        include: this.recordInclude,
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
}
