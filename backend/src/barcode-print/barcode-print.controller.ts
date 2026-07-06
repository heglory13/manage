import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client/index';
import { CurrentUser, Roles } from '../auth/decorators/index.js';
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
    @Body()
    dto: {
      items: Array<{
        skuComboId?: string;
        productName: string;
        sku: string;
        salePrice: number;
        quantity: number;
        paperSize?: string;
        autoApprove?: boolean;
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
        autoApprove: item.autoApprove,
      })),
    );
    return { success: true, count: results.length, data: results };
  }

  @Post('custom')
  async createCustom(
    @Body()
    dto: {
      client?: string;
      product?: string;
      quantity: number;
      paperSize?: string;
    },
    @CurrentUser() user: UserPayload,
  ) {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { name: true, email: true },
    });
    const userName = dbUser?.name || dbUser?.email || user.email;

    const productNameParts = [
      'Tem tùy chỉnh',
      dto.client?.trim() ? `KH: ${dto.client.trim()}` : null,
      dto.product?.trim() ? `SP: ${dto.product.trim()}` : null,
    ].filter(Boolean);

    const log = await this.barcodePrintService.createCustomLog({
      userId: user.userId,
      userName,
      productName: productNameParts.join(' | '),
      quantity: dto.quantity,
      paperSize: dto.paperSize,
    });

    return { success: true, data: log };
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

  @Roles(Role.ADMIN, Role.MANAGER)
  @Patch(':id/approve')
  async approve(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return this.barcodePrintService.approve(id, user.userId);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Patch(':id/reject')
  async reject(
    @Param('id') id: string,
    @Body() dto: { reason?: string },
    @CurrentUser() user: UserPayload,
  ) {
    return this.barcodePrintService.reject(id, user.userId, dto.reason);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Patch(':id/printed')
  async markPrinted(@Param('id') id: string) {
    return this.barcodePrintService.markPrinted(id);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: { salePrice?: number; quantity?: number; paperSize?: string },
  ) {
    return this.barcodePrintService.update(id, dto);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.barcodePrintService.delete(id);
  }

  // ── Custom label templates ────────────────────────────────────────────────

  @Post('templates')
  async saveTemplate(
    @Body()
    dto: {
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
    },
    @CurrentUser() user: UserPayload,
  ) {
    const tpl = await this.barcodePrintService.saveTemplate({
      userId: user.userId,
      ...dto,
    });
    return { success: true, data: tpl };
  }

  @Get('templates')
  async findTemplates(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.barcodePrintService.findTemplates({
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Delete('templates/:id')
  async deleteTemplate(@Param('id') id: string) {
    return this.barcodePrintService.deleteTemplate(id);
  }
}
