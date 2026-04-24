import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PreliminaryCheckStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

export interface PreliminaryCheckFilters {
  status?: string;
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
export class PreliminaryCheckService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    dto: {
      classificationId: string;
      quantity: number;
      warehouseTypeId?: string;
      imageUrl?: string;
      note?: string;
    },
    userId: string,
  ) {
    // Validate classification exists
    const classification = await this.prisma.classification.findUnique({
      where: { id: dto.classificationId },
    });

    if (!classification) {
      throw new NotFoundException('Phân loại hàng hoá không tồn tại');
    }

    // Validate warehouseType if provided
    if (dto.warehouseTypeId) {
      const warehouseType = await this.prisma.warehouseType.findUnique({
        where: { id: dto.warehouseTypeId },
      });
      if (!warehouseType) {
        throw new NotFoundException('Loại kho không tồn tại');
      }
    }

    return this.prisma.preliminaryCheck.create({
      data: {
        classificationId: dto.classificationId,
        quantity: dto.quantity,
        warehouseTypeId: dto.warehouseTypeId || null,
        imageUrl: dto.imageUrl || null,
        note: dto.note || null,
        status: PreliminaryCheckStatus.PENDING,
        createdBy: userId,
      },
      include: {
        classification: true,
        warehouseType: true,
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async findAll(filters: PreliminaryCheckFilters): Promise<PaginatedResponse<unknown>> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (filters.status) {
      where.status = filters.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.preliminaryCheck.findMany({
        where,
        skip,
        take: limit,
        include: {
          classification: true,
          warehouseType: true,
          creator: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.preliminaryCheck.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const check = await this.prisma.preliminaryCheck.findUnique({
      where: { id },
      include: {
        classification: true,
        warehouseType: true,
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!check) {
      throw new NotFoundException('Phiếu kiểm sơ bộ không tồn tại');
    }

    return check;
  }

  async complete(id: string, status: 'APPROVED' | 'REJECTED') {
    const check = await this.prisma.preliminaryCheck.findUnique({
      where: { id },
    });

    if (!check) {
      throw new NotFoundException('Phiếu kiểm sơ bộ không tồn tại');
    }

    if (check.status !== PreliminaryCheckStatus.PENDING) {
      throw new NotFoundException('Phiếu đã được xử lý trước đó');
    }

    return this.prisma.preliminaryCheck.update({
      where: { id },
      data: { status: status as PreliminaryCheckStatus },
      include: {
        classification: true,
        warehouseType: true,
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }
}
