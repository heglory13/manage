import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SavedFilter } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class SavedFilterService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, pageKey: string): Promise<SavedFilter[]> {
    return this.prisma.savedFilter.findMany({
      where: { userId, pageKey },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    userId: string,
    dto: { pageKey: string; name: string; filters: Record<string, unknown> },
  ): Promise<SavedFilter> {
    const trimmedName = dto.name?.trim();
    if (!trimmedName) {
      throw new BadRequestException('Tên bộ lọc không được để trống');
    }

    // Check limit: 20 per user per pageKey
    const count = await this.prisma.savedFilter.count({
      where: { userId, pageKey: dto.pageKey },
    });

    if (count >= 20) {
      throw new BadRequestException(
        'Đã đạt giới hạn tối đa 20 bộ lọc cho trang này',
      );
    }

    return this.prisma.savedFilter.create({
      data: {
        userId,
        pageKey: dto.pageKey,
        name: trimmedName,
        filters: dto.filters as object,
      },
    });
  }

  async delete(id: string, userId: string): Promise<void> {
    const filter = await this.prisma.savedFilter.findUnique({
      where: { id },
    });

    if (!filter) {
      throw new NotFoundException('Bộ lọc không tồn tại');
    }

    if (filter.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền xóa bộ lọc này');
    }

    await this.prisma.savedFilter.delete({ where: { id } });
  }
}
