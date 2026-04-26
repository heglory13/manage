import { Body, Controller, Delete, Get, Patch, Post, Query, Res } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import type { Response } from 'express';
import { Role } from '@prisma/client/index';
import { Roles } from '../auth/decorators/index.js';
import { CurrentUser } from '../auth/decorators/index.js';
import type { UserPayload } from '../auth/interfaces/index.js';
import { hasPermission } from '../auth/permissions.js';
import { InventoryService } from './inventory.service.js';
import {
  DeleteTransactionsDto,
  StockAdjustDto,
  StockInDto,
  StockOutDto,
  InventoryQueryDto,
  InventoryQueryV2Dto,
  TransactionHistoryQueryDto,
  TransactionStatusActionDto,
} from './dto/index.js';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('stock-in')
  async stockIn(
    @Body() dto: StockInDto,
    @CurrentUser() currentUser: Record<string, unknown>,
  ) {
    const user = currentUser as unknown as UserPayload;
    return this.inventoryService.stockIn(dto.productId, dto.quantity, user.userId, {
      purchasePrice: dto.purchasePrice,
      salePrice: dto.salePrice,
      skuComboId: dto.skuComboId,
      productConditionId: dto.productConditionId,
      storageZoneId: dto.storageZoneId,
      warehousePositionId: dto.warehousePositionId,
      preliminaryCheckId: dto.preliminaryCheckId,
      actualStockDate: dto.actualStockDate,
      notes: dto.notes,
    });
  }

  @Post('stock-out')
  async stockOut(
    @Body() dto: StockOutDto,
    @CurrentUser() currentUser: Record<string, unknown>,
  ) {
    const user = currentUser as unknown as UserPayload;
    return this.inventoryService.stockOut(
      dto.productId,
      dto.quantity,
      user.userId,
      {
        skuComboId: dto.skuComboId,
        productConditionId: dto.productConditionId,
        storageZoneId: dto.storageZoneId,
        warehousePositionId: dto.warehousePositionId,
        notes: dto.notes,
      },
    );
  }

  @Post('adjust')
  async adjustStock(
    @Body() dto: StockAdjustDto,
    @CurrentUser() currentUser: Record<string, unknown>,
  ) {
    const user = currentUser as unknown as UserPayload;
    return this.inventoryService.adjustStock(dto.productId, dto.quantity, dto.type, user.userId, {
      warehousePositionId: dto.warehousePositionId,
      reason: dto.reason,
    });
  }

  @Patch('transactions/status')
  @Roles(Role.MANAGER, Role.ADMIN)
  async updateTransactionStatus(
    @Body() dto: TransactionStatusActionDto,
    @CurrentUser() currentUser: Record<string, unknown>,
  ) {
    const user = currentUser as unknown as UserPayload;
    if (!hasPermission(user.permissions, 'transactions', 'edit')) {
      throw new ForbiddenException('Ban khong co quyen sua giao dich');
    }
    return this.inventoryService.updateTransactionStatus(dto.transactionIds, dto.status);
  }

  @Delete('transactions')
  @Roles(Role.ADMIN)
  async deleteTransactions(
    @Body() dto: DeleteTransactionsDto,
    @CurrentUser() currentUser: Record<string, unknown>,
  ) {
    const user = currentUser as unknown as UserPayload;
    if (!hasPermission(user.permissions, 'transactions', 'delete')) {
      throw new ForbiddenException('Ban khong co quyen xoa giao dich');
    }
    return this.inventoryService.deleteTransactions(dto.transactionIds);
  }

  @Get()
  async getInventory(@Query() query: InventoryQueryDto) {
    return this.inventoryService.getInventory({
      categoryId: query.categoryId,
      startDate: query.startDate,
      endDate: query.endDate,
      positionId: query.positionId,
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });
  }

  @Get('capacity')
  async getCapacity() {
    return this.inventoryService.getCapacityRatio();
  }

  @Get('v2')
  async getInventoryV2(@Query() query: InventoryQueryV2Dto) {
    return this.inventoryService.getInventoryV2({
      categoryId: query.categoryId,
      businessStatus: query.businessStatus,
      productConditionId: query.productConditionId,
      classificationId: query.classificationId,
      materialId: query.materialId,
      colorId: query.colorId,
      sizeId: query.sizeId,
      storageZoneId: query.storageZoneId,
      positionId: query.positionId,
      startDate: query.startDate,
      endDate: query.endDate,
      search: query.search,
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });
  }

  @Get('transactions')
  async getTransactionHistory(@Query() query: TransactionHistoryQueryDto) {
    return this.inventoryService.getTransactionHistory({
      kind: query.kind,
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });
  }

  @Get('export-v2')
  @Roles(Role.MANAGER, Role.ADMIN)
  async exportExcelV2(
    @Query() query: InventoryQueryV2Dto,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.inventoryService.exportExcelV2({
      categoryId: query.categoryId,
      businessStatus: query.businessStatus,
      productConditionId: query.productConditionId,
      classificationId: query.classificationId,
      materialId: query.materialId,
      colorId: query.colorId,
      sizeId: query.sizeId,
      storageZoneId: query.storageZoneId,
      search: query.search,
    });

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="ton-kho-v2-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      'Content-Length': buffer.length.toString(),
    });

    res.end(buffer);
  }
}
