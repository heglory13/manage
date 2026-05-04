import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client/index';
import { CurrentUser } from '../auth/decorators/index.js';
import { Roles } from '../auth/decorators/index.js';
import type { UserPayload } from '../auth/interfaces/index.js';
import { StocktakingService } from './stocktaking.service.js';
import { CreateStocktakingDto, SubmitStocktakingDto, StocktakingQueryDto, UpdateStocktakingItemDto } from './dto/index.js';

@Controller('stocktaking')
export class StocktakingController {
  constructor(private readonly stocktakingService: StocktakingService) {}

  @Post()
  async create(
    @Body() dto: CreateStocktakingDto,
    @CurrentUser() currentUser: Record<string, unknown>,
  ) {
    const user = currentUser as unknown as UserPayload;
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
    @Param('id') id: string,
    @Body() dto: SubmitStocktakingDto,
    @CurrentUser() currentUser: Record<string, unknown>,
  ) {
    const user = currentUser as unknown as UserPayload;
    return this.stocktakingService.submit(id, dto.items, user.userId);
  }

  @Patch(':id/approve')
  @Roles(Role.MANAGER, Role.ADMIN)
  async approve(
    @Param('id') id: string,
    @CurrentUser() currentUser: Record<string, unknown>,
  ) {
    const user = currentUser as unknown as UserPayload;
    return this.stocktakingService.approve(id, user.userId, user.role);
  }

  @Patch(':id/reject')
  @Roles(Role.MANAGER, Role.ADMIN)
  async reject(
    @Param('id') id: string,
    @CurrentUser() currentUser: Record<string, unknown>,
  ) {
    const user = currentUser as unknown as UserPayload;
    return this.stocktakingService.reject(id, user.userId, undefined, user.role);
  }

  @Get(':id/history')
  async getStatusHistory(@Param('id') id: string) {
    return this.stocktakingService.getStatusHistory(id);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  async remove(@Param('id') id: string) {
    return this.stocktakingService.remove(id);
  }

  @Post(':id/balance')
  async balanceStock(
    @Param('id') id: string,
    @CurrentUser() currentUser: Record<string, unknown>,
  ) {
    const user = currentUser as unknown as UserPayload;
    return this.stocktakingService.balanceStock(id, user.userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.stocktakingService.findOne(id);
  }

  @Patch('items/:itemId')
  async updateItem(
    @Param('itemId') itemId: string,
    @Body() dto: UpdateStocktakingItemDto,
  ) {
    return this.stocktakingService.updateItem(itemId, dto);
  }

  @Get()
  async findAll(@Query() query: StocktakingQueryDto) {
    return this.stocktakingService.findAll({
      status: query.status,
      startDate: query.startDate,
      endDate: query.endDate,
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });
  }
}
