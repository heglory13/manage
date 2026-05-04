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

type StocktakingMode = 'full' | 'selected' | 'category' | 'warehouseType' | 'product';

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

  calculateDiscrepancies(
    items: Array<{ systemQuantity: number; actualQuantity: number }>,
  ): Array<{ systemQuantity: number; actualQuantity: number; discrepancy: number }> {
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
          'Vui lÃ²ng Ä‘iá»n nguyÃªn nhÃ¢n chÃªnh lá»‡ch cho táº¥t cáº£ cÃ¡c dÃ²ng cÃ³ sai lá»‡ch',
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
          'YÃªu cáº§u Ä‘Ã­nh kÃ¨m áº£nh/file minh chá»©ng cho cÃ¡c dÃ²ng cÃ³ sai lá»‡ch',
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
        throw new BadRequestException('Vui long chon it nhat mot san pham khi kiem ke theo san pham');
      }
      const transactions = await this.prisma.inventoryTransaction.findMany({
        where: { skuComboId: { in: skuComboIds }, categoryId: { not: null } },
        select: { categoryId: true },
        distinct: ['categoryId'],
      });
      const ids = transactions.map((t) => t.categoryId).filter(Boolean) as string[];
      if (ids.length === 0) {
        throw new BadRequestException('Khong tim thay danh muc nao tu cac san pham da chon');
      }
      return [...new Set(ids)];
    }

    if (mode === 'selected') {
      if (!productIds || productIds.length === 0) {
        throw new BadRequestException(
          'Vui lÃ²ng chá»n Ã­t nháº¥t má»™t sáº£n pháº©m khi kiá»ƒm kÃª theo danh sÃ¡ch',
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

      return [...new Set(checks.map((check) => check.categoryId).filter(Boolean))] as string[];
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
  ): Promise<StocktakingCategorySnapshot[]> {
    // For product mode: create snapshots per SKU combo
    if (mode === 'product' && skuComboIds && skuComboIds.length > 0) {
      const combos = await this.prisma.skuCombo.findMany({
        where: { id: { in: skuComboIds } },
        include: { classification: true, color: true, size: true, material: true },
      });

      return Promise.all(
        combos.map(async (combo) => {
          const productName = [combo.classification?.name, combo.color?.name, combo.size?.name, combo.material?.name].filter(Boolean).join(' - ');
          // Get stock for this specific SKU combo
          const transactions = await this.prisma.inventoryTransaction.findMany({
            where: { skuComboId: combo.id, status: InventoryTransactionStatus.ACTIVE },
            select: { type: true, quantity: true, categoryId: true },
          });
          const stock = transactions.reduce((sum, t) =>
            sum + (t.type === TransactionType.STOCK_IN ? t.quantity : -t.quantity), 0);
          const categoryId = transactions[0]?.categoryId || null;

          return {
            categoryId,
            itemCode: combo.compositeSku,
            itemLabel: productName,
            systemQuantity: Math.max(stock, 0),
            actualQuantity: 0,
            discrepancy: 0,
          };
        }),
      );
    }

    const resolvedCategoryIds = await this.resolveCategoryIds(
      mode,
      productIds,
      categoryIds,
      warehouseTypeIds,
      skuComboIds,
    );

    if (resolvedCategoryIds.length === 0) {
      throw new BadRequestException('KhÃ´ng tÃ¬m tháº¥y danh má»¥c nÃ o Ä‘á»ƒ kiá»ƒm kÃª');
    }

    const categories = await this.prisma.category.findMany({
      where: { id: { in: resolvedCategoryIds } },
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    });

    if (categories.length === 0) {
      throw new BadRequestException('KhÃ´ng tÃ¬m tháº¥y danh má»¥c nÃ o Ä‘á»ƒ kiá»ƒm kÃª');
    }

    return Promise.all(
      categories.map(async (category) => ({
        categoryId: category.id,
        itemCode: category.code,
        itemLabel: category.name,
        systemQuantity: await this.inventoryService.getCurrentStockByCategory(
          category.id,
        ),
        actualQuantity: 0,
        discrepancy: 0,
      })),
    );
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

    const purchasePrice = latestTransaction?.purchasePrice ?? new Prisma.Decimal(0);
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
    const snapshots = await this.buildCategorySnapshots(
      mode,
      productIds,
      categoryIds,
      warehouseTypeIds,
      skuComboIds,
    );

    const cutoffDate = cutoffTime ? new Date(cutoffTime) : new Date();

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

    await this.recordStatusChange(record.id, StocktakingStatus.CHECKING, userId);

    return record;
  }

  async submit(id: string, items: SubmitStocktakingItemDto[], userId?: string) {
    const record = await this.prisma.stocktakingRecord.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!record) {
      throw new NotFoundException('BiÃªn báº£n kiá»ƒm kÃª khÃ´ng tá»“n táº¡i');
    }

    if (record.status !== StocktakingStatus.CHECKING) {
      throw new BadRequestException(
        'Chá»‰ cÃ³ thá»ƒ submit biÃªn báº£n á»Ÿ tráº¡ng thÃ¡i Äang kiá»ƒm kÃª',
      );
    }

    const submittedMap = new Map(items.map((item) => [item.itemId, item]));

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
            evidenceUrl: submitted.evidenceUrl || undefined,
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
      throw new NotFoundException('BiÃªn báº£n kiá»ƒm kÃª khÃ´ng tá»“n táº¡i');
    }

    if (userRole !== 'ADMIN' && record.status !== StocktakingStatus.PENDING) {
      throw new BadRequestException(
        'Chá»‰ cÃ³ thá»ƒ phÃª duyá»‡t biÃªn báº£n á»Ÿ tráº¡ng thÃ¡i Chá» duyá»‡t',
      );
    }

    const actorId = userId || record.createdBy;
    const adjustmentOps: Prisma.PrismaPromise<unknown>[] = [];

    for (const item of record.items) {
      if (!item.categoryId || item.discrepancy === 0) {
        continue;
      }

      if (item.discrepancy < 0) {
        const currentStock = await this.inventoryService.getCurrentStockByCategory(
          item.categoryId,
        );
        if (currentStock < Math.abs(item.discrepancy)) {
          throw new BadRequestException(
            `KhÃ´ng thá»ƒ duyá»‡t kiá»ƒm kÃª cho ${item.itemLabel} vÃ¬ tá»“n hiá»‡n táº¡i khÃ´ng Ä‘á»§ Ä‘á»ƒ giáº£m`,
          );
        }
      }

      const latestPrice = await this.getLatestAdjustmentPrice(item.categoryId);
      adjustmentOps.push(
        this.prisma.inventoryTransaction.create({
          data: {
            categoryId: item.categoryId,
            type:
              item.discrepancy > 0
                ? TransactionType.STOCK_IN
                : TransactionType.STOCK_OUT,
            quantity: Math.abs(item.discrepancy),
            purchasePrice: latestPrice.purchasePrice,
            salePrice: latestPrice.salePrice,
            status: InventoryTransactionStatus.ACTIVE,
            userId: actorId,
            notes: `[ADJUSTMENT] Stocktaking approval ${record.id} - ${item.itemCode} ${item.itemLabel}`,
          },
        }),
      );
    }

    const [updatedRecord] = await this.prisma.$transaction([
      this.prisma.stocktakingRecord.update({
        where: { id },
        data: { status: StocktakingStatus.APPROVED },
        include: this.recordInclude,
      }),
      ...adjustmentOps,
    ]);

    await this.recordStatusChange(id, StocktakingStatus.APPROVED, actorId);

    return updatedRecord;
  }

  async reject(id: string, userId?: string, note?: string, userRole?: string) {
    const record = await this.prisma.stocktakingRecord.findUnique({
      where: { id },
    });

    if (!record) {
      throw new NotFoundException('BiÃªn báº£n kiá»ƒm kÃª khÃ´ng tá»“n táº¡i');
    }

    if (userRole !== 'ADMIN' && record.status !== StocktakingStatus.PENDING) {
      throw new BadRequestException(
        'Chá»‰ cÃ³ thá»ƒ tá»« chá»‘i biÃªn báº£n á»Ÿ tráº¡ng thÃ¡i Chá» duyá»‡t',
      );
    }

    const updatedRecord = await this.prisma.stocktakingRecord.update({
      where: { id },
      data: { status: StocktakingStatus.REJECTED },
      include: this.recordInclude,
    });

    await this.recordStatusChange(
      id,
      StocktakingStatus.REJECTED,
      userId,
      note,
    );

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

    if (record.status !== StocktakingStatus.PENDING && record.status !== StocktakingStatus.APPROVED) {
      throw new BadRequestException('Chi co the can bang kho khi bien ban o trang thai Cho duyet hoac Da duyet');
    }

    const adjustmentOps: Prisma.PrismaPromise<unknown>[] = [];
    let adjustedCount = 0;

    for (const item of record.items) {
      if (!item.categoryId || item.discrepancy === 0) continue;

      const latestPrice = await this.getLatestAdjustmentPrice(item.categoryId);

      adjustmentOps.push(
        this.prisma.inventoryTransaction.create({
          data: {
            categoryId: item.categoryId,
            type: item.discrepancy > 0 ? TransactionType.STOCK_IN : TransactionType.STOCK_OUT,
            quantity: Math.abs(item.discrepancy),
            purchasePrice: latestPrice.purchasePrice,
            salePrice: latestPrice.salePrice,
            status: InventoryTransactionStatus.ACTIVE,
            userId,
            notes: `[ADJUSTMENT] Dieu chinh can bang kho theo Bien ban kiem ke ${record.id} - ${item.itemCode} ${item.itemLabel}`,
          },
        }),
      );
      adjustedCount++;
    }

    if (adjustedCount === 0) {
      return { success: true, message: 'Khong co chenh lech nao can dieu chinh', adjustedCount: 0 };
    }

    // Update record status to APPROVED if still PENDING
    if (record.status === StocktakingStatus.PENDING) {
      adjustmentOps.push(
        this.prisma.stocktakingRecord.update({
          where: { id },
          data: { status: StocktakingStatus.APPROVED, submittedAt: new Date() },
        }),
      );
      await this.recordStatusChange(id, StocktakingStatus.APPROVED, userId);
    }

    await this.prisma.$transaction(adjustmentOps);

    return {
      success: true,
      message: `Da can bang kho thanh cong: ${adjustedCount} dieu chinh`,
      adjustedCount,
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
      throw new NotFoundException('BiÃªn báº£n kiá»ƒm kÃª khÃ´ng tá»“n táº¡i');
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
    // Delete related items and history first
    await this.prisma.$transaction([
      this.prisma.stocktakingStatusHistory.deleteMany({ where: { recordId: id } }),
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
      throw new NotFoundException('BiÃªn báº£n kiá»ƒm kÃª khÃ´ng tá»“n táº¡i');
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
      throw new NotFoundException('DÃ²ng kiá»ƒm kÃª khÃ´ng tá»“n táº¡i');
    }

    if (item.record.status !== StocktakingStatus.CHECKING) {
      throw new BadRequestException(
        'Chá»‰ cÃ³ thá»ƒ cáº­p nháº­t khi biÃªn báº£n Ä‘ang á»Ÿ tráº¡ng thÃ¡i kiá»ƒm kÃª',
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

  async findAll(filters: StocktakingFilters): Promise<PaginatedResponse<unknown>> {
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
