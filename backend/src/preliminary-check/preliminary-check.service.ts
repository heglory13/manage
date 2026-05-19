import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PreliminaryCheckStatus } from '@prisma/client/index';
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

function serializeImageUrls(urls?: string[]): string | null {
  if (!urls || urls.length === 0) return null;
  return JSON.stringify(urls);
}

type PreliminaryCheckPayload = {
  categoryId?: string;
  classificationId?: string;
  quantity: number;
  warehouseTypeId?: string;
  imageUrls?: string[];
  note?: string;
};

@Injectable()
export class PreliminaryCheckService {
  constructor(private readonly prisma: PrismaService) {}

  private async validateReferenceData(dto: Partial<PreliminaryCheckPayload>) {
    if (!dto.categoryId && !dto.classificationId) {
      throw new BadRequestException('Vui long chon danh muc san pham');
    }

    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });

      if (!category) {
        throw new NotFoundException('Danh muc san pham khong ton tai');
      }
    }

    if (dto.classificationId) {
      const classification = await this.prisma.classification.findUnique({
        where: { id: dto.classificationId },
      });

      if (!classification) {
        throw new NotFoundException('Phan loai hang hoa khong ton tai');
      }
    }

    if (dto.warehouseTypeId) {
      const warehouseType = await this.prisma.warehouseType.findUnique({
        where: { id: dto.warehouseTypeId },
      });

      if (!warehouseType) {
        throw new NotFoundException('Loai kho khong ton tai');
      }
    }
  }

  async create(dto: PreliminaryCheckPayload, userId: string) {
    await this.validateReferenceData(dto);

    return this.prisma.preliminaryCheck.create({
      data: {
        categoryId: dto.categoryId || null,
        classificationId: dto.classificationId || null,
        quantity: dto.quantity,
        warehouseTypeId: dto.warehouseTypeId || null,
        imageUrl: serializeImageUrls(dto.imageUrls),
        note: dto.note || null,
        status: PreliminaryCheckStatus.PENDING,
        createdBy: userId,
      },
      include: {
        category: true,
        classification: true,
        warehouseType: true,
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async findAll(
    filters: PreliminaryCheckFilters,
  ): Promise<PaginatedResponse<unknown>> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (filters.status && filters.status.trim() !== '') {
      where.status = filters.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.preliminaryCheck.findMany({
        where,
        skip,
        take: limit,
        include: {
          category: true,
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
        category: true,
        classification: true,
        warehouseType: true,
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!check) {
      throw new NotFoundException('Phieu kiem so bo khong ton tai');
    }

    return check;
  }

  async complete(
    id: string,
    status: 'APPROVED' | 'REJECTED',
    userRole?: string,
  ) {
    const check = await this.prisma.preliminaryCheck.findUnique({
      where: { id },
    });

    if (!check) {
      throw new NotFoundException('Phieu kiem so bo khong ton tai');
    }

    if (
      userRole !== 'ADMIN' &&
      check.status !== PreliminaryCheckStatus.PENDING
    ) {
      throw new NotFoundException('Phieu da duoc xu ly truoc do');
    }

    return this.prisma.preliminaryCheck.update({
      where: { id },
      data: { status: status as PreliminaryCheckStatus },
      include: {
        category: true,
        classification: true,
        warehouseType: true,
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async update(
    id: string,
    dto: Partial<PreliminaryCheckPayload>,
    userRole?: string,
  ) {
    const existing = await this.prisma.preliminaryCheck.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Phieu kiem so bo khong ton tai');
    }

    if (
      userRole !== 'ADMIN' &&
      existing.status !== PreliminaryCheckStatus.PENDING
    ) {
      throw new BadRequestException(
        'Chi co the sua phieu kiem so bo khi dang cho kiem tra chi tiet',
      );
    }

    await this.validateReferenceData({
      categoryId: dto.categoryId ?? existing.categoryId ?? undefined,
      classificationId:
        dto.classificationId ?? existing.classificationId ?? undefined,
      warehouseTypeId:
        dto.warehouseTypeId === ''
          ? undefined
          : (dto.warehouseTypeId ?? existing.warehouseTypeId ?? undefined),
    });

    return this.prisma.preliminaryCheck.update({
      where: { id },
      data: {
        categoryId: dto.categoryId,
        classificationId: dto.classificationId,
        quantity: dto.quantity,
        warehouseTypeId:
          dto.warehouseTypeId === '' ? null : dto.warehouseTypeId,
        imageUrl:
          dto.imageUrls !== undefined
            ? serializeImageUrls(dto.imageUrls)
            : undefined,
        note: dto.note,
      },
      include: {
        category: true,
        classification: true,
        warehouseType: true,
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async remove(id: string, userRole?: string) {
    const existing = await this.prisma.preliminaryCheck.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Phieu kiem so bo khong ton tai');
    }

    if (
      userRole !== 'ADMIN' &&
      existing.status !== PreliminaryCheckStatus.PENDING
    ) {
      throw new BadRequestException(
        'Chi co the xoa phieu kiem so bo khi chua duoc xu ly',
      );
    }

    await this.prisma.preliminaryCheck.delete({ where: { id } });

    return { success: true };
  }
}
