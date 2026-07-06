import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderPlanStatus, OrderPlanType } from '@prisma/client/index';
import { PrismaService } from '../prisma/prisma.service.js';

type OrderPlanPayload = {
  type: OrderPlanType;
  categoryId?: string;
  warehouseTypeId?: string;
  quantity: number;
  customerName?: string;
  customerPhone?: string;
  note?: string;
};

type OrderPlanFilters = {
  status?: OrderPlanStatus;
  type?: OrderPlanType;
  category?: string;
  customerName?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
};

@Injectable()
export class OrderPlanService {
  constructor(private readonly prisma: PrismaService) {}

  private async validateReferenceData(dto: Partial<OrderPlanPayload>) {
    if (!dto.categoryId) {
      throw new BadRequestException('Vui long chon danh muc san pham');
    }

    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) {
      throw new NotFoundException('Danh muc san pham khong ton tai');
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

  private validateCustomerInfo(dto: Partial<OrderPlanPayload>) {
    if (dto.type !== OrderPlanType.PREORDER) {
      return;
    }

    if (!dto.customerName?.trim()) {
      throw new BadRequestException(
        'Vui long nhap ten khach hang cho don pre-order',
      );
    }

    if (!dto.customerPhone?.trim()) {
      throw new BadRequestException(
        'Vui long nhap so dien thoai khach hang cho don pre-order',
      );
    }
  }

  private buildInclude() {
    return {
      category: true,
      warehouseType: true,
      creator: {
        select: { id: true, name: true, email: true },
      },
    } as const;
  }

  async create(dto: OrderPlanPayload, userId: string) {
    await this.validateReferenceData(dto);
    this.validateCustomerInfo(dto);

    return this.prisma.orderPlan.create({
      data: {
        type: dto.type,
        status: OrderPlanStatus.PLANNED,
        categoryId: dto.categoryId,
        warehouseTypeId: dto.warehouseTypeId || null,
        quantity: dto.quantity,
        customerName:
          dto.type === OrderPlanType.PREORDER
            ? dto.customerName?.trim() || null
            : null,
        customerPhone:
          dto.type === OrderPlanType.PREORDER
            ? dto.customerPhone?.trim() || null
            : null,
        note: dto.note?.trim() || null,
        createdBy: userId,
      },
      include: this.buildInclude(),
    });
  }

  async findAll(filters: OrderPlanFilters) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (filters.status) {
      const statuses = filters.status.split(',').map((s) => s.trim()).filter(Boolean);
      if (statuses.length === 1) {
        where.status = statuses[0];
      } else {
        where.status = { in: statuses };
      }
    }
    if (filters.type) {
      const types = filters.type.split(',').map((s) => s.trim()).filter(Boolean);
      if (types.length === 1) {
        where.type = types[0];
      } else {
        where.type = { in: types };
      }
    }
    if (filters.category?.trim()) {
      const cats = filters.category.split(',').map((s) => s.trim()).filter(Boolean);
      if (cats.length === 1) {
        where.categoryId = cats[0];
      } else {
        where.categoryId = { in: cats };
      }
    }
    if (filters.customerName?.trim()) {
      const names = filters.customerName.split(',').map((s) => s.trim()).filter(Boolean);
      if (names.length === 1) {
        where.customerName = { contains: names[0] };
      } else {
        where.customerName = { OR: names.map((n) => ({ contains: n })) };
      }
    }
    if (filters.dateFrom || filters.dateTo) {
      const createdAt: Record<string, Date> = {};
      if (filters.dateFrom) {
        const from = new Date(filters.dateFrom);
        from.setHours(0, 0, 0, 0);
        createdAt.gte = from;
      }
      if (filters.dateTo) {
        const to = new Date(filters.dateTo);
        to.setHours(23, 59, 59, 999);
        createdAt.lte = to;
      }
      where.createdAt = createdAt;
    }

    const [data, total] = await Promise.all([
      this.prisma.orderPlan.findMany({
        where,
        skip,
        take: limit,
        include: this.buildInclude(),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.orderPlan.count({ where }),
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
    const item = await this.prisma.orderPlan.findUnique({
      where: { id },
      include: this.buildInclude(),
    });

    if (!item) {
      throw new NotFoundException('Ke hoach dat hang khong ton tai');
    }

    return item;
  }

  async update(id: string, dto: Partial<OrderPlanPayload>, userRole?: string) {
    const existing = await this.prisma.orderPlan.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Ke hoach dat hang khong ton tai');
    }

    if (userRole !== 'ADMIN' && existing.status !== OrderPlanStatus.PLANNED) {
      throw new BadRequestException(
        'Chi co the sua ke hoach khi chua xac nhan dat hang',
      );
    }

    const nextType = dto.type ?? existing.type;
    const nextCategoryId = dto.categoryId ?? existing.categoryId ?? undefined;
    const nextWarehouseTypeId =
      dto.warehouseTypeId === ''
        ? undefined
        : (dto.warehouseTypeId ?? existing.warehouseTypeId ?? undefined);
    const nextCustomerName =
      dto.customerName ?? existing.customerName ?? undefined;
    const nextCustomerPhone =
      dto.customerPhone ?? existing.customerPhone ?? undefined;

    await this.validateReferenceData({
      type: nextType,
      categoryId: nextCategoryId,
      warehouseTypeId: nextWarehouseTypeId,
      quantity: dto.quantity ?? existing.quantity,
    });
    this.validateCustomerInfo({
      type: nextType,
      customerName: nextCustomerName,
      customerPhone: nextCustomerPhone,
    });

    return this.prisma.orderPlan.update({
      where: { id },
      data: {
        type: nextType,
        categoryId: nextCategoryId,
        warehouseTypeId:
          dto.warehouseTypeId === '' ? null : (nextWarehouseTypeId ?? null),
        quantity: dto.quantity ?? existing.quantity,
        customerName:
          nextType === OrderPlanType.PREORDER
            ? nextCustomerName?.trim() || null
            : null,
        customerPhone:
          nextType === OrderPlanType.PREORDER
            ? nextCustomerPhone?.trim() || null
            : null,
        note: dto.note !== undefined ? dto.note.trim() || null : existing.note,
      },
      include: this.buildInclude(),
    });
  }

  async confirmOrdered(
    id: string,
    expectedArrivalDate: string,
    userRole?: string,
  ) {
    const existing = await this.prisma.orderPlan.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Ke hoach dat hang khong ton tai');
    }

    if (userRole !== 'ADMIN' && existing.status !== OrderPlanStatus.PLANNED) {
      throw new BadRequestException(
        'Ke hoach nay da duoc xac nhan dat hang truoc do',
      );
    }

    return this.prisma.orderPlan.update({
      where: { id },
      data: {
        status: OrderPlanStatus.ORDERED,
        expectedArrivalDate: new Date(`${expectedArrivalDate}T00:00:00`),
      },
      include: this.buildInclude(),
    });
  }

  async remove(id: string, userRole?: string) {
    const existing = await this.prisma.orderPlan.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Ke hoach dat hang khong ton tai');
    }

    if (userRole !== 'ADMIN' && existing.status !== OrderPlanStatus.PLANNED) {
      throw new BadRequestException(
        'Chi co the xoa ke hoach khi chua xac nhan dat hang',
      );
    }

    await this.prisma.orderPlan.delete({ where: { id } });
    return { success: true };
  }
}
