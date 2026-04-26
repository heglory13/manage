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
  productId: string;
  createdAt: string;
  actualStockDate: string | null;
  kind: 'ALL' | 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT';
  type: TransactionType;
  status: InventoryTransactionStatus;
  quantity: number;
  signedQuantity: number;
  purchasePrice: number | null;
  salePrice: number | null;
  productName: string;
  productSku: string;
  positionLabel: string | null;
  userName: string;
  note: string;
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  private toPrismaDecimal(value?: number | null) {
    if (value === undefined || value === null) return undefined;
    return new Prisma.Decimal(value);
  }

  private asNumber(value: Prisma.Decimal | number | null | undefined) {
    if (value === undefined || value === null) return null;
    return Number(value);
  }

  private async getLatestActivePurchasePrice(productId: string) {
    const transaction = await this.prisma.inventoryTransaction.findFirst({
      where: {
        productId,
        type: TransactionType.STOCK_IN,
        status: InventoryTransactionStatus.ACTIVE,
        purchasePrice: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      select: { purchasePrice: true },
    });

    return this.asNumber(transaction?.purchasePrice) ?? 0;
  }

  private async ensureCanApplyStockDelta(
    type: TransactionType,
    quantity: number,
    productId: string,
    warehousePositionId?: string | null,
    storageZoneId?: string | null,
  ) {
    if (type !== TransactionType.STOCK_OUT) return;

    const [product, position, zone] = await Promise.all([
      this.prisma.product.findUnique({
        where: { id: productId },
        select: { stock: true },
      }),
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

    if (!product || product.stock < quantity) {
      throw new BadRequestException('Khong du ton kho de thuc hien thao tac nay');
    }

    if (position && position.currentStock < quantity) {
      throw new BadRequestException('Vi tri kho hien tai khong du ton kho');
    }

    if (zone && zone.currentStock < quantity) {
      throw new BadRequestException('Khu vuc hien tai khong du ton kho');
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
      productId: string;
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
      transaction.productId,
      transaction.warehousePositionId,
      transaction.storageZoneId,
    );

    const delta =
      effectiveType === TransactionType.STOCK_IN
        ? { increment: transaction.quantity }
        : { decrement: transaction.quantity };

    const ops: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.product.update({
        where: { id: transaction.productId },
        data: { stock: delta },
      }),
    ];

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

    await this.prisma.$transaction(ops);
    await this.syncPreliminaryCheckStatus(transaction.preliminaryCheckId);
  }

  computeBusinessStatus(product: {
    stock: number;
    minThreshold: number;
    isDiscontinued: boolean;
  }): 'CON_HANG' | 'HET_HANG' | 'SAP_HET' | 'NGUNG_KD' {
    if (product.isDiscontinued) return 'NGUNG_KD';
    if (product.stock === 0) return 'HET_HANG';
    if (product.stock < product.minThreshold) return 'SAP_HET';
    return 'CON_HANG';
  }

  async stockIn(
    productId: string,
    quantity: number,
    userId: string,
    options?: {
      purchasePrice?: number;
      salePrice?: number;
      skuComboId?: string;
      productConditionId?: string;
      storageZoneId?: string;
      warehousePositionId?: string;
      preliminaryCheckId?: string;
      actualStockDate?: string;
      notes?: string;
    },
  ): Promise<InventoryTransaction> {
    if (quantity <= 0) {
      throw new BadRequestException('Số lượng nhập kho phải lớn hơn 0');
    }

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Sản phẩm không tồn tại');
    }

    const storageZoneId = options?.storageZoneId;

    // Check storage zone capacity if provided
    if (storageZoneId) {
      const zone = await this.prisma.storageZone.findUnique({
        where: { id: storageZoneId },
      });

      if (!zone) {
        throw new NotFoundException('Khu vực hàng hoá không tồn tại');
      }

      const remaining = zone.maxCapacity - zone.currentStock;

      if (remaining <= 0) {
        throw new BadRequestException(
          'Khu vực này đã đầy, không thể nhập thêm hàng',
        );
      }

      if (quantity > remaining) {
        throw new BadRequestException(
          `Chỉ được nhập tối đa ${remaining}`,
        );
      }
    }

    // Determine actualStockDate
    const actualStockDate = options?.actualStockDate
      ? new Date(options.actualStockDate)
      : new Date();
    const purchasePrice = options?.purchasePrice ?? 0;
    const salePrice = options?.salePrice ?? this.asNumber(product.price) ?? 0;

    if (purchasePrice <= 0) {
      throw new BadRequestException('Gia nhap bat buoc va phai lon hon 0');
    }

    if (salePrice <= 0) {
      throw new BadRequestException('Gia ban bat buoc va phai lon hon 0');
    }

    const transactionOps = [
      this.prisma.product.update({
        where: { id: productId },
        data: {
          stock: { increment: quantity },
          price: this.toPrismaDecimal(salePrice),
        },
      }),
      this.prisma.inventoryTransaction.create({
        data: {
          productId,
          type: TransactionType.STOCK_IN,
          quantity,
          purchasePrice: this.toPrismaDecimal(purchasePrice),
          salePrice: this.toPrismaDecimal(salePrice),
          status: InventoryTransactionStatus.ACTIVE,
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

    // Check warehouse position capacity if provided
    const warehousePositionId = options?.warehousePositionId;
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
          throw new BadRequestException(
            'Vị trí này đã đầy, không thể nhập thêm hàng',
          );
        }

        if (quantity > remaining) {
          throw new BadRequestException(
            `Chỉ cho phép nhập tối đa ${remaining}`,
          );
        }
      }

      transactionOps.push(
        this.prisma.warehousePosition.update({
          where: { id: warehousePositionId },
          data: { currentStock: { increment: quantity } },
        }) as never,
      );
    }

    if (storageZoneId) {
      transactionOps.push(
        this.prisma.storageZone.update({
          where: { id: storageZoneId },
          data: { currentStock: { increment: quantity } },
        }) as never,
      );
    }

    // If linked to a preliminary check, mark it as COMPLETED
    if (options?.preliminaryCheckId) {
      transactionOps.push(
        this.prisma.preliminaryCheck.update({
          where: { id: options.preliminaryCheckId },
          data: { status: 'COMPLETED' },
        }) as never,
      );
    }

    const results = await this.prisma.$transaction(transactionOps);

    return results[1] as InventoryTransaction;
  }

  async stockOut(
    productId: string,
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

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Sản phẩm không tồn tại');
    }

    if (quantity > product.stock) {
      throw new BadRequestException(
        'Không thể xuất quá số lượng tồn kho hiện tại',
      );
    }

    const purchasePrice =
      options?.purchasePrice ?? (await this.getLatestActivePurchasePrice(productId));
    const salePrice = options?.salePrice ?? this.asNumber(product.price) ?? 0;
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
        throw new BadRequestException(
          'Không thể xuất quá số lượng hiện có tại vị trí kho đã chọn',
        );
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
      }),
    ];

    if (storageZoneId) {
      transactionOps.push(
        this.prisma.storageZone.update({
          where: { id: storageZoneId },
          data: { currentStock: { decrement: quantity } },
        }) as never,
      );
    }

    if (warehousePositionId) {
      transactionOps.push(
        this.prisma.warehousePosition.update({
          where: { id: warehousePositionId },
          data: { currentStock: { decrement: quantity } },
        }) as never,
      );
    }

    const results = await this.prisma.$transaction(transactionOps);

    return results[1] as InventoryTransaction;
  }

  async adjustStock(
    productId: string,
    quantity: number,
    type: 'INCREASE' | 'DECREASE',
    userId: string,
    options?: {
      warehousePositionId?: string;
      reason?: string;
    },
  ): Promise<InventoryTransaction> {
    const adjustmentNote = options?.reason
      ? `[ADJUSTMENT] ${options.reason}`
      : '[ADJUSTMENT]';
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { price: true },
    });

    if (type === 'INCREASE') {
      return this.stockIn(productId, quantity, userId, {
        purchasePrice: await this.getLatestActivePurchasePrice(productId),
        salePrice: this.asNumber(product?.price) ?? 0,
        warehousePositionId: options?.warehousePositionId,
        notes: adjustmentNote,
      });
    }

    return this.stockOut(productId, quantity, userId, {
      purchasePrice: await this.getLatestActivePurchasePrice(productId),
      salePrice: this.asNumber(product?.price) ?? 0,
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
      throw new NotFoundException('Khong tim thay mot hoac nhieu giao dich');
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

  async deleteTransactions(transactionIds: string[]) {
    const transactions = await this.prisma.inventoryTransaction.findMany({
      where: { id: { in: transactionIds } },
    });

    if (transactions.length !== transactionIds.length) {
      throw new NotFoundException('Khong tim thay mot hoac nhieu giao dich');
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
        : transaction.type === TransactionType.STOCK_IN
          ? 'STOCK_IN'
          : 'STOCK_OUT';

      return {
        id: transaction.id,
        productId: transaction.productId,
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
        productName: transaction.product.name,
        productSku: transaction.product.sku,
        positionLabel: transaction.warehousePosition?.label ?? null,
        userName: transaction.user.name,
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

    // Require at least one filter condition
    const hasFilter =
      categoryId || startDate || endDate || positionId;

    if (!hasFilter) {
      throw new BadRequestException(
        'Vui lòng chọn ít nhất một điều kiện lọc',
      );
    }

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (startDate || endDate) {
      const createdAt: Record<string, Date> = {};
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

  async getCapacityRatio(): Promise<CapacityInfo> {
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

  async getCurrentStock(productId: string): Promise<number> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Sản phẩm không tồn tại');
    }

    return product.stock;
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

    const where: Record<string, unknown> = {};

    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
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

    const transactionSome: Record<string, unknown> = {};
    if (filters.productConditionId) transactionSome.productConditionId = filters.productConditionId;
    if (filters.storageZoneId) transactionSome.storageZoneId = filters.storageZoneId;
    if (filters.classificationId || filters.materialId || filters.colorId || filters.sizeId) {
      transactionSome.skuCombo = {
        ...(filters.classificationId ? { classificationId: filters.classificationId } : {}),
        ...(filters.materialId ? { materialId: filters.materialId } : {}),
        ...(filters.colorId ? { colorId: filters.colorId } : {}),
        ...(filters.sizeId ? { sizeId: filters.sizeId } : {}),
      };
    }
    transactionSome.status = InventoryTransactionStatus.ACTIVE;
    if (Object.keys(transactionSome).length > 0) {
      where.transactions = { some: transactionSome };
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
            where: { status: InventoryTransactionStatus.ACTIVE },
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
        positionLabels:
          product.warehousePositions
            ?.map((position) => position.label)
            .filter(Boolean) ?? [],
        businessStatus: this.computeBusinessStatus({
          stock: product.stock,
          minThreshold: product.minThreshold,
          isDiscontinued: product.isDiscontinued,
        }),
      };
    });

    // Filter by businessStatus if specified (post-query filter)
    const filtered = filters.businessStatus
      ? data.filter((p) => p.businessStatus === filters.businessStatus)
      : data;

    return {
      data: filtered,
      total: filters.businessStatus ? filtered.length : total,
      page,
      limit,
      totalPages: Math.ceil(
        (filters.businessStatus ? filtered.length : total) / limit,
      ),
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
    const where: Record<string, unknown> = {};

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

    const transactionSome: Record<string, unknown> = {};
    if (filters.productConditionId) transactionSome.productConditionId = filters.productConditionId;
    if (filters.storageZoneId) transactionSome.storageZoneId = filters.storageZoneId;
    if (filters.classificationId || filters.materialId || filters.colorId || filters.sizeId) {
      transactionSome.skuCombo = {
        ...(filters.classificationId ? { classificationId: filters.classificationId } : {}),
        ...(filters.materialId ? { materialId: filters.materialId } : {}),
        ...(filters.colorId ? { colorId: filters.colorId } : {}),
        ...(filters.sizeId ? { sizeId: filters.sizeId } : {}),
      };
    }
    transactionSome.status = InventoryTransactionStatus.ACTIVE;
    if (Object.keys(transactionSome).length > 0) {
      where.transactions = { some: transactionSome };
    }

    const products = await this.prisma.product.findMany({
      where,
      include: {
        category: true,
        warehousePositions: true,
        transactions: {
          take: 1,
          where: { status: InventoryTransactionStatus.ACTIVE },
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
        positionLabels:
          product.warehousePositions
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
      throw new NotFoundException('Không có dữ liệu để xuất báo cáo');
    }

    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Tồn kho V2');

    const statusLabels: Record<string, string> = {
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
}
