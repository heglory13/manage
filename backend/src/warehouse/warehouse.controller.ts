import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/index.js';
import { WarehouseService } from './warehouse.service.js';
import {
  CreateLayoutDto,
  UpdateLayoutDto,
  AssignProductDto,
  MovePositionDto,
  UpdateLabelDto,
  UpdateCapacityDto,
  UpdatePositionLayoutDto,
  UpdateLayoutModeDto,
  CreatePositionDto,
  DeletePositionDto,
} from './dto/index.js';

@Controller('warehouse')
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Post('layout')
  @Roles(Role.ADMIN)
  async createLayout(@Body() dto: CreateLayoutDto) {
    return this.warehouseService.createLayout(dto);
  }

  @Patch('layout/:id')
  @Roles(Role.ADMIN)
  async updateLayout(@Param('id') id: string, @Body() dto: UpdateLayoutDto) {
    return this.warehouseService.updateLayout(id, dto);
  }

  @Patch('layout/:id/mode')
  @Roles(Role.ADMIN)
  async updateLayoutMode(
    @Param('id') id: string,
    @Body() dto: UpdateLayoutModeDto,
  ) {
    return this.warehouseService.updateLayoutMode(
      id,
      dto.mode,
      dto.canvasWidth,
      dto.canvasHeight,
    );
  }

  @Delete('layout/:id')
  @Roles(Role.ADMIN)
  async deleteLayout(@Param('id') id: string) {
    return this.warehouseService.deleteLayout(id);
  }

  @Get('layout')
  async getLayout() {
    return this.warehouseService.getLayout();
  }

  @Get('layout/with-skus')
  async getLayoutWithSkus() {
    return this.warehouseService.getSingleLayoutWithSkus();
  }

  @Get('layouts/with-skus')
  async getLayoutsWithSkus() {
    return this.warehouseService.getLayoutWithSkus();
  }

  @Patch('positions/:positionId/product')
  async assignProduct(
    @Param('positionId') positionId: string,
    @Body() dto: AssignProductDto,
  ) {
    return this.warehouseService.assignProductToPosition(
      positionId,
      dto.productId ?? null,
    );
  }

  @Patch('positions/:id/move')
  @Roles(Role.ADMIN)
  async movePosition(
    @Param('id') id: string,
    @Body() dto: MovePositionDto,
  ) {
    return this.warehouseService.movePosition(id, dto.targetRow, dto.targetColumn);
  }

  @Patch('positions/:id/label')
  @Roles(Role.ADMIN)
  async updateLabel(
    @Param('id') id: string,
    @Body() dto: UpdateLabelDto,
  ) {
    return this.warehouseService.updateLabel(id, dto.label);
  }

  @Patch('positions/:id/toggle-active')
  @Roles(Role.ADMIN)
  async toggleActive(@Param('id') id: string) {
    return this.warehouseService.toggleActive(id);
  }

  @Patch('positions/:id/capacity')
  @Roles(Role.ADMIN)
  async updateCapacity(
    @Param('id') id: string,
    @Body() dto: UpdateCapacityDto,
  ) {
    return this.warehouseService.updateCapacity(id, dto.maxCapacity);
  }

  @Patch('positions/:id/layout')
  @Roles(Role.ADMIN)
  async updatePositionLayout(
    @Param('id') id: string,
    @Body() dto: UpdatePositionLayoutDto,
  ) {
    return this.warehouseService.updatePositionLayout(id, dto);
  }

  @Get('positions/:id/skus')
  async getPositionSkus(@Param('id') id: string) {
    return this.warehouseService.getPositionSkus(id);
  }

  @Post('positions')
  @Roles(Role.ADMIN)
  async createPosition(@Body() dto: CreatePositionDto) {
    return this.warehouseService.createPosition(dto);
  }

  @Delete('positions/:id')
  @Roles(Role.ADMIN)
  async deletePosition(
    @Param('id') id: string,
    @Body() dto: DeletePositionDto,
  ) {
    return this.warehouseService.deletePosition(id, dto.force);
  }
}
