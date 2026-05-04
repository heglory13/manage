import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/index.js';
import type { UserPayload } from '../auth/interfaces/index.js';
import { BarcodePrintService } from './barcode-print.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('barcode-prints')
export class BarcodePrintController {
  constructor(
    private readonly barcodePrintService: BarcodePrintService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  async create(
    @Body() dto: {
      items: Array<{
        skuComboId?: string;
        productName: string;
        sku: string;
        salePrice: number;
        quantity: number;
        paperSize?: string;
      }>;
    },
    @CurrentUser() user: UserPayload,
  ) {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { name: true, email: true },
    });
    const userName = dbUser?.name || dbUser?.email || user.email;

    const results = await this.barcodePrintService.createBatch(
      dto.items.map((item) => ({
        userId: user.userId,
        userName,
        skuComboId: item.skuComboId,
        productName: item.productName,
        sku: item.sku,
        salePrice: item.salePrice,
        quantity: item.quantity,
        paperSize: item.paperSize,
      })),
    );
    return { success: true, count: results.length, data: results };
  }

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.barcodePrintService.findAll({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      status,
    });
  }

  @Patch(':id/approve')
  async approve(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return this.barcodePrintService.approve(id, user.userId);
  }

  @Patch(':id/reject')
  async reject(
    @Param('id') id: string,
    @Body() dto: { reason?: string },
    @CurrentUser() user: UserPayload,
  ) {
    return this.barcodePrintService.reject(id, user.userId, dto.reason);
  }

  @Patch(':id/printed')
  async markPrinted(@Param('id') id: string) {
    return this.barcodePrintService.markPrinted(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: { salePrice?: number; quantity?: number; paperSize?: string },
  ) {
    return this.barcodePrintService.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.barcodePrintService.delete(id);
  }
}
