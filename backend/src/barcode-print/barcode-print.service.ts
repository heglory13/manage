import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BarcodePrintStatus } from '@prisma/client/index';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class BarcodePrintService {
  constructor(private readonly prisma: PrismaService) {}

  async createBatch(items: Array<{
    userId: string;
    userName: string;
    skuComboId?: string;
    productName: string;
    sku: string;
    salePrice: number;
    quantity: number;
    paperSize?: string;
  }>) {
    const results = [];
    for (const item of items) {
      const log = await this.prisma.barcodePrintLog.create({
        data: {
          userId: item.userId,
          userName: item.userName,
          skuComboId: item.skuComboId || null,
          productName: item.productName,
          sku: item.sku,
          salePrice: item.salePrice,
          quantity: item.quantity,
          paperSize: item.paperSize || null,
          status: BarcodePrintStatus.PENDING,
        },
      });
      results.push(log);
    }
    return results;
  }

  async approve(id: string, approvedBy: string) {
    const log = await this.prisma.barcodePrintLog.findUnique({ where: { id } });
    if (!log) throw new NotFoundException('Phiếu in tem không tồn tại');
    if (log.status !== BarcodePrintStatus.PENDING) {
      throw new BadRequestException('Chỉ có thể duyệt phiếu đang chờ duyệt');
    }
    return this.prisma.barcodePrintLog.update({
      where: { id },
      data: { status: BarcodePrintStatus.APPROVED, approvedBy, approvedAt: new Date() },
    });
  }

  async reject(id: string, approvedBy: string, reason?: string) {
    const log = await this.prisma.barcodePrintLog.findUnique({ where: { id } });
    if (!log) throw new NotFoundException('Phiếu in tem không tồn tại');
    if (log.status !== BarcodePrintStatus.PENDING) {
      throw new BadRequestException('Chỉ có thể từ chối phiếu đang chờ duyệt');
    }
    return this.prisma.barcodePrintLog.update({
      where: { id },
      data: {
        status: BarcodePrintStatus.REJECTED,
        approvedBy,
        rejectedAt: new Date(),
        rejectReason: reason || null,
      },
    });
  }

  async markPrinted(id: string) {
    const log = await this.prisma.barcodePrintLog.findUnique({ where: { id } });
    if (!log) throw new NotFoundException('Phiếu in tem không tồn tại');
    if (log.status !== BarcodePrintStatus.APPROVED) {
      throw new BadRequestException('Chỉ có thể in phiếu đã được duyệt');
    }
    return this.prisma.barcodePrintLog.update({
      where: { id },
      data: { status: BarcodePrintStatus.PRINTED, printedAt: new Date() },
    });
  }

  async findAll(filters: { page?: number; limit?: number; search?: string; status?: string }) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.search) {
      where.OR = [
        { productName: { contains: filters.search } },
        { sku: { contains: filters.search } },
        { userName: { contains: filters.search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.barcodePrintLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.barcodePrintLog.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async delete(id: string) {
    const log = await this.prisma.barcodePrintLog.findUnique({ where: { id } });
    if (!log) throw new NotFoundException('Phiếu in tem không tồn tại');
    await this.prisma.barcodePrintLog.delete({ where: { id } });
    return { success: true };
  }

  async update(id: string, data: { salePrice?: number; quantity?: number; paperSize?: string }) {
    const log = await this.prisma.barcodePrintLog.findUnique({ where: { id } });
    if (!log) throw new NotFoundException('Phiếu in tem không tồn tại');
    if (log.status !== BarcodePrintStatus.PENDING) {
      throw new BadRequestException('Chỉ có thể sửa phiếu đang chờ duyệt');
    }

    const updateData: Record<string, unknown> = {};
    if (data.salePrice !== undefined) updateData.salePrice = data.salePrice;
    if (data.quantity !== undefined) updateData.quantity = data.quantity;
    if (data.paperSize !== undefined) updateData.paperSize = data.paperSize;

    return this.prisma.barcodePrintLog.update({
      where: { id },
      data: updateData,
    });
  }
}
