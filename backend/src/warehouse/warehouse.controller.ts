import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client/index';
import { Roles } from '../auth/decorators/index.js';
import { CurrentUser } from '../auth/decorators/index.js';
import { RolesGuard } from '../auth/guards/index.js';
import { hasPermission } from '../auth/permissions.js';
import type { UserPayload } from '../auth/interfaces/index.js';
import { WarehouseService } from './warehouse.service.js';
import {
  CreateLayoutDto,
  UpdateLayoutDto,
  MovePositionDto,
  UpdateLabelDto,
  UpdateCapacityDto,
  UpdatePositionLayoutDto,
  UpdateLayoutModeDto,
  CreatePositionDto,
  DeletePositionDto,
} from './dto/index.js';

@Controller('warehouse')
@UseGuards(RolesGuard)
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  private checkPermission(
    user: UserPayload,
    action: 'view' | 'create' | 'edit' | 'delete',
  ) {
    if (!hasPermission(user.permissions, 'warehouse', action)) {
      throw new ForbiddenException(
        `Ban khong co quyen thuc hien thao tac nay tren so do kho hang`,
      );
    }
  }

  @Post('layout')
  async createLayout(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Body() dto: CreateLayoutDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'create');
    return this.warehouseService.createLayout(dto);
  }

  @Patch('layout/:id')
  async updateLayout(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
    @Body() dto: UpdateLayoutDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'edit');
    return this.warehouseService.updateLayout(id, dto);
  }

  @Patch('layout/:id/mode')
  async updateLayoutMode(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
    @Body() dto: UpdateLayoutModeDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'edit');
    return this.warehouseService.updateLayoutMode(
      id,
      dto.mode,
      dto.canvasWidth,
      dto.canvasHeight,
    );
  }

  @Delete('layout/:id')
  @Roles(Role.ADMIN)
  async deleteLayout(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'delete');
    return this.warehouseService.deleteLayout(id);
  }

  @Get('layout')
  async getLayout(@CurrentUser() currentUser: Record<string, unknown>) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'view');
    return this.warehouseService.getLayout();
  }

  @Get('layout/with-skus')
  async getLayoutWithSkus(@CurrentUser() currentUser: Record<string, unknown>) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'view');
    return this.warehouseService.getSingleLayoutWithSkus();
  }

  @Get('layouts/with-skus')
  async getLayoutsWithSkus(
    @CurrentUser() currentUser: Record<string, unknown>,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'view');
    return this.warehouseService.getLayoutWithSkus();
  }

  @Patch('positions/:id/move')
  async movePosition(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
    @Body() dto: MovePositionDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'edit');
    return this.warehouseService.movePosition(
      id,
      dto.targetRow,
      dto.targetColumn,
    );
  }

  @Patch('positions/:id/label')
  async updateLabel(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
    @Body() dto: UpdateLabelDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'edit');
    return this.warehouseService.updateLabel(id, dto.label);
  }

  @Patch('positions/:id/toggle-active')
  async toggleActive(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'edit');
    return this.warehouseService.toggleActive(id);
  }

  @Patch('positions/:id/capacity')
  async updateCapacity(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
    @Body() dto: UpdateCapacityDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'edit');
    return this.warehouseService.updateCapacity(id, dto.maxCapacity);
  }

  @Patch('positions/:id/layout')
  async updatePositionLayout(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
    @Body() dto: UpdatePositionLayoutDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'edit');
    return this.warehouseService.updatePositionLayout(id, dto);
  }

  @Get('positions/:id/skus')
  async getPositionSkus(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'view');
    return this.warehouseService.getPositionSkus(id);
  }

  @Post('positions')
  async createPosition(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Body() dto: CreatePositionDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'create');
    return this.warehouseService.createPosition(dto);
  }

  @Delete('positions/:id')
  @Roles(Role.ADMIN)
  async deletePosition(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
    @Body() dto: DeletePositionDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'delete');
    return this.warehouseService.deletePosition(id, dto.force);
  }
}
