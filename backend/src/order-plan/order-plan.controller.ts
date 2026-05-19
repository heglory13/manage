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
import { CurrentUser } from '../auth/decorators/index.js';
import { RolesGuard } from '../auth/guards/index.js';
import { hasPermission } from '../auth/permissions.js';
import type { UserPayload } from '../auth/interfaces/index.js';
import { OrderPlanService } from './order-plan.service.js';
import {
  ConfirmOrderPlanDto,
  CreateOrderPlanDto,
  OrderPlanQueryDto,
  UpdateOrderPlanDto,
} from './dto/index.js';

@Controller('order-plans')
@UseGuards(RolesGuard)
export class OrderPlanController {
  constructor(private readonly orderPlanService: OrderPlanService) {}

  private checkPermission(
    user: UserPayload,
    action: 'view' | 'create' | 'edit' | 'delete',
  ) {
    if (!hasPermission(user.permissions, 'orderPlans', action)) {
      throw new ForbiddenException(
        `Ban khong co quyen thuc hien thao tac nay tren ke hoach dat hang`,
      );
    }
  }

  @Post()
  async create(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Body() dto: CreateOrderPlanDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'create');
    return this.orderPlanService.create(dto, user.userId);
  }

  @Get()
  async findAll(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Query() query: OrderPlanQueryDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'view');
    return this.orderPlanService.findAll({
      status: query.status,
      type: query.type,
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });
  }

  @Get(':id')
  async findOne(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'view');
    return this.orderPlanService.findOne(id);
  }

  @Patch(':id')
  async update(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
    @Body() dto: UpdateOrderPlanDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'edit');
    return this.orderPlanService.update(id, dto, user.role);
  }

  @Patch(':id/confirm-ordered')
  async confirmOrdered(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
    @Body() dto: ConfirmOrderPlanDto,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'edit');
    return this.orderPlanService.confirmOrdered(
      id,
      dto.expectedArrivalDate,
      user.role,
    );
  }

  @Delete(':id')
  async remove(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
  ) {
    const user = currentUser as unknown as UserPayload;
    this.checkPermission(user, 'delete');
    return this.orderPlanService.remove(id, user.role);
  }
}
