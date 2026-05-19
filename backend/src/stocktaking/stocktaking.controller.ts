import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client/index';
import { CurrentUser } from '../auth/decorators/index.js';
import { Roles } from '../auth/decorators/index.js';
import { RolesGuard } from '../auth/guards/index.js';
import { hasPermission } from '../auth/permissions.js';
import type { UserPayload } from '../auth/interfaces/index.js';
import { StocktakingService } from './stocktaking.service.js';
import {
  CreateStocktakingDto,
  SubmitStocktakingDto,
  StocktakingQueryDto,
  UpdateStocktakingItemDto,
} from './dto/index.js';

@Controller('stocktaking')
@UseGuards(RolesGuard)
export class StocktakingController {
  constructor(private readonly stocktakingService: StocktakingService) {}

  private checkPermission(
    user: UserPayload,
    action: 'view' | 'create' | 'edit' | 'delete',
  ) {
    if (!hasPermission(user.permissions, 'audit', action)) {
      throw new ForbiddenException(
        `Ban khong co quyen thuc hien thao tac nay tren kiem ke dinh ky`,
      );
    }
  }

  @Post()
  async create(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Body() dto: CreateStocktakingDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'create');
    return this.stocktakingService.create(
      dto.mode,
      user.userId,
      dto.productIds,
      dto.cutoffTime,
      dto.categoryIds,
      dto.warehouseTypeIds,
      dto.skuComboIds,
    );
  }

  @Patch(':id/submit')
  async submit(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
    @Body() dto: SubmitStocktakingDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'edit');
    return this.stocktakingService.submit(id, dto.items, user.userId);
  }

  @Patch(':id/approve')
  async approve(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'edit');
    return this.stocktakingService.approve(id, user.userId, user.role);
  }

  @Patch(':id/reject')
  async reject(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'edit');
    return this.stocktakingService.reject(
      id,
      user.userId,
      undefined,
      user.role,
    );
  }

  @Get(':id/history')
  async getStatusHistory(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'view');
    return this.stocktakingService.getStatusHistory(id);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  async remove(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'delete');
    return this.stocktakingService.remove(id);
  }

  @Post(':id/balance')
  async balanceStock(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'edit');
    return this.stocktakingService.balanceStock(id, user.userId);
  }

  @Post('items/:itemId/balance')
  async balanceStockItem(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('itemId') itemId: string,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'edit');
    return this.stocktakingService.balanceStockItem(itemId, user.userId);
  }

  @Get(':id')
  async findOne(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'view');
    return this.stocktakingService.findOne(id);
  }

  @Patch('items/:itemId')
  async updateItem(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateStocktakingItemDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'edit');
    return this.stocktakingService.updateItem(itemId, dto);
  }

  @Get()
  async findAll(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Query() query: StocktakingQueryDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'view');
    return this.stocktakingService.findAll({
      status: query.status,
      startDate: query.startDate,
      endDate: query.endDate,
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });
  }
}
