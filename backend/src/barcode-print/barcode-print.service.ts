import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BarcodePrintStatus } from '@prisma/client/index';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class BarcodePrintService {
  constructor(private readonly prisma: PrismaService) {}

  async createBatch(
    items: Array<{
      userId: string;
      userName: string;
      skuComboId?: string;
      productName: string;
      sku: string;
      salePrice: number;
      quantity: number;
      paperSize?: string;
      autoApprove?: boolean;
    }>,
  ) {
    const results = [];
    for (const item of items) {
      // autoApprove đi qua đủ các bước: PENDING → APPROVED → PRINTED
      const now = new Date();
      const status = item.autoApprove
        ? BarcodePrintStatus.PRINTED
        : BarcodePrintStatus.PENDING;
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
          status,
          ...(item.autoApprove
            ? { approvedBy: item.userId, approvedAt: now, printedAt: now }
            : {}),
        },
      });
      results.push(log);
    }
    return results;
  }

  async createCustomLog(item: {
    userId: string;
    userName: string;
    productName: string;
    quantity: number;
    paperSize?: string;
  }) {
    return this.prisma.barcodePrintLog.create({
      data: {
        userId: item.userId,
        userName: item.userName,
        productName: item.productName,
        sku: 'CUSTOM',
        salePrice: 0,
        quantity: item.quantity,
        paperSize: item.paperSize || null,
        status: BarcodePrintStatus.PRINTED,
        printedAt: new Date(),
      },
    });
  }

  async approve(id: string, approvedBy: string) {
    const log = await this.prisma.barcodePrintLog.findUnique({ where: { id } });
    if (!log) throw new NotFoundException('Phiếu in tem không tồn tại');
    if (log.status !== BarcodePrintStatus.PENDING) {
      throw new BadRequestException('Chỉ có thể duyệt phiếu đang chờ duyệt');
    }
    return this.prisma.barcodePrintLog.update({
      where: { id },
      data: {
        status: BarcodePrintStatus.APPROVED,
        approvedBy,
        approvedAt: new Date(),
      },
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

  async findAll(filters: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }) {
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

  async update(
    id: string,
    data: { salePrice?: number; quantity?: number; paperSize?: string },
  ) {
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

  // ── Custom label templates ─────────────────────────────────────────────────

  async saveTemplate(data: {
    userId: string;
    name: string;
    client?: string;
    product?: string;
    size?: string;
    material?: string;
    origin?: string;
    website?: string;
    slogan?: string;
    paperSize?: string;
    logoImageData?: string;
    extraImageData?: string;
    footerImageData?: string;
    logoLine1?: string;
    logoLine2?: string;
    logoFontFamily?: string;
    logoLine2FontFamily?: string;
    logoLine1Weight?: number;
    logoLine2Weight?: number;
    sloganWeight?: number;
    websiteFontFamily?: string;
    websiteWeight?: number;
    sloganFontFamily?: string;
  }) {
    return this.prisma.customLabelTemplate.create({
      data: {
        createdBy: data.userId,
        name: data.name,
        client: data.client || null,
        product: data.product || null,
        size: data.size || null,
        material: data.material || null,
        origin: data.origin || null,
        website: data.website || null,
        slogan: data.slogan || null,
        paperSize: data.paperSize || null,
        logoImageData: data.logoImageData || null,
        extraImageData: data.extraImageData || null,
        footerImageData: data.footerImageData || null,
        logoLine1: data.logoLine1 || null,
        logoLine2: data.logoLine2 || null,
        logoFontFamily: data.logoFontFamily || null,
        logoLine2FontFamily: data.logoLine2FontFamily || null,
        logoLine1Weight: data.logoLine1Weight ?? null,
        logoLine2Weight: data.logoLine2Weight ?? null,
        sloganWeight: data.sloganWeight ?? null,
        websiteFontFamily: data.websiteFontFamily || null,
        websiteWeight: data.websiteWeight ?? null,
        sloganFontFamily: data.sloganFontFamily || null,
      },
    });
  }

  async findTemplates(filters: {
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 30;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { client: { contains: filters.search } },
        { product: { contains: filters.search } },
        { size: { contains: filters.search } },
        { material: { contains: filters.search } },
        { origin: { contains: filters.search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.customLabelTemplate.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customLabelTemplate.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async deleteTemplate(id: string) {
    const tpl = await this.prisma.customLabelTemplate.findUnique({
      where: { id },
    });
    if (!tpl) throw new NotFoundException('Template không tồn tại');
    await this.prisma.customLabelTemplate.delete({ where: { id } });
    return { success: true };
  }
}
