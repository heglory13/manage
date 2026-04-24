import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StocktakingStatus } from '@prisma/client';
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

@Injectable()
export class StocktakingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate discrepancy for each item: discrepancy = actualQuantity - systemQuantity
   */
  calculateDiscrepancies(
    items: Array<{ systemQuantity: number; actualQuantity: number }>,
  ): Array<{ systemQuantity: number; actualQuantity: number; discrepancy: number }> {
    return items.map((item) => ({
      ...item,
      discrepancy: item.actualQuantity - item.systemQuantity,
    }));
  }

  /**
   * Validate that items with discrepancy != 0 have discrepancyReason
   */
  validateDiscrepancyReasons(
    items: Array<{ discrepancy: number; discrepancyReason?: string | null }>,
  ): { valid: boolean; message?: string } {
    const missingReason = items.some(
      (item) => item.discrepancy !== 0 && (!item.discrepancyReason || item.discrepancyReason.trim() === ''),
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

  /**
   * Validate that items with discrepancy != 0 have evidence
   */
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
          'Yêu cầu đính kèm ảnh/file minh chứng cho các sản phẩm có sai lệch',
      };
    }

    return { valid: true };
  }

  /**
   * Create a new stocktaking record with mode support.
   * mode='full': creates items for ALL products in the system
   * mode='selected': creates items for specified productIds only
   * Status starts at CHECKING, cutoffTime is recorded.
   */
  async create(
    mode: 'full' | 'selected',
    userId: string,
    productIds?: string[],
  ) {
    if (mode === 'selected' && (!productIds || productIds.length === 0)) {
      throw new BadRequestException(
        'Vui lòng chọn ít nhất một sản phẩm khi kiểm kê theo danh sách',
      );
    }

    // Fetch products based on mode
    const where = mode === 'selected' ? { id: { in: productIds } } : {};
    const products = await this.prisma.product.findMany({ where });

    if (products.length === 0) {
      throw new BadRequestException('Không tìm thấy sản phẩm nào');
    }

    const cutoffTime = new Date();

    // Create the stocktaking record with items (actualQuantity=0, discrepancy=0 initially)
    const record = await this.prisma.stocktakingRecord.create({
      data: {
        createdBy: userId,
        status: StocktakingStatus.CHECKING,
        mode,
        cutoffTime,
        items: {
          create: products.map((product) => ({
            productId: product.id,
            systemQuantity: product.stock,
            actualQuantity: 0,
            discrepancy: 0,
          })),
        },
      },
      include: {
        items: {
          include: { product: true },
        },
        creator: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    // Record initial status history
    await this.recordStatusChange(record.id, StocktakingStatus.CHECKING, userId);

    return record;
  }

  /**
   * Submit a stocktaking record: fill in actual quantities and reasons.
   * Transitions CHECKING → PENDING.
   */
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

    // Build a map of submitted items
    const submittedMap = new Map(items.map((i) => [i.itemId, i]));

    // Calculate discrepancies and validate reasons
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

    // Validate discrepancy reasons
    const validation = this.validateDiscrepancyReasons(updatedItems);
    if (!validation.valid) {
      throw new BadRequestException(validation.message);
    }

    // Update all items and transition status
    const updateOps = updatedItems.map((item) => {
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
    }).filter(Boolean);

    const submittedAt = new Date();

    await this.prisma.$transaction([
      ...updateOps as any[],
      this.prisma.stocktakingRecord.update({
        where: { id },
        data: {
          status: StocktakingStatus.PENDING,
          submittedAt,
        },
      }),
    ]);

    // Record status history
    await this.recordStatusChange(id, StocktakingStatus.PENDING, userId);

    return this.prisma.stocktakingRecord.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        creator: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });
  }

  async approve(id: string, userId?: string) {
    const record = await this.prisma.stocktakingRecord.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!record) {
      throw new NotFoundException('Biên bản kiểm kê không tồn tại');
    }

    if (record.status !== StocktakingStatus.PENDING) {
      throw new BadRequestException('Chỉ có thể phê duyệt biên bản ở trạng thái Chờ duyệt');
    }

    // Update record status and adjust stock for each product
    const updateOperations = record.items.map((item) =>
      this.prisma.product.update({
        where: { id: item.productId },
        data: { stock: item.actualQuantity },
      }),
    );

    const [updatedRecord] = await this.prisma.$transaction([
      this.prisma.stocktakingRecord.update({
        where: { id },
        data: { status: StocktakingStatus.APPROVED },
        include: {
          items: { include: { product: true } },
          creator: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      }),
      ...updateOperations,
    ]);

    // Record status history
    await this.recordStatusChange(id, StocktakingStatus.APPROVED, userId);

    return updatedRecord;
  }

  async reject(id: string, userId?: string, note?: string) {
    const record = await this.prisma.stocktakingRecord.findUnique({
      where: { id },
    });

    if (!record) {
      throw new NotFoundException('Biên bản kiểm kê không tồn tại');
    }

    if (record.status !== StocktakingStatus.PENDING) {
      throw new BadRequestException('Chỉ có thể từ chối biên bản ở trạng thái Chờ duyệt');
    }

    const updatedRecord = await this.prisma.stocktakingRecord.update({
      where: { id },
      data: { status: StocktakingStatus.REJECTED },
      include: {
        items: { include: { product: true } },
        creator: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    // Record status history
    await this.recordStatusChange(id, StocktakingStatus.REJECTED, userId, note);

    return updatedRecord;
  }

  /**
   * Record a status change in StocktakingStatusHistory
   */
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

  /**
   * Get status history for a stocktaking record
   */
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

  async findOne(id: string) {
    const record = await this.prisma.stocktakingRecord.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
          orderBy: {
            product: {
              sku: 'asc',
            },
          },
        },
        creator: {
          select: { id: true, name: true, email: true, role: true },
        },
        statusHistory: {
          orderBy: { changedAt: 'asc' },
        },
      },
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
      throw new BadRequestException('Chỉ có thể cập nhật khi biên bản đang ở trạng thái kiểm kê');
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
      include: {
        product: true,
      },
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
        include: {
          items: { include: { product: true } },
          creator: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
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
