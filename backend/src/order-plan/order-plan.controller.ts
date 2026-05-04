import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/index.js';
import type { UserPayload } from '../auth/interfaces/index.js';
import { OrderPlanService } from './order-plan.service.js';
import { ConfirmOrderPlanDto, CreateOrderPlanDto, OrderPlanQueryDto, UpdateOrderPlanDto } from './dto/index.js';

@Controller('order-plans')
export class OrderPlanController {
  constructor(private readonly orderPlanService: OrderPlanService) {}

  @Post()
  async create(
    @Body() dto: CreateOrderPlanDto,
    @CurrentUser() currentUser: Record<string, unknown>,
  ) {
    const user = currentUser as unknown as UserPayload;
    return this.orderPlanService.create(dto, user.userId);
  }

  @Get()
  async findAll(@Query() query: OrderPlanQueryDto) {
    return this.orderPlanService.findAll({
      status: query.status,
      type: query.type,
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.orderPlanService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOrderPlanDto,
    @CurrentUser() currentUser: Record<string, unknown>,
  ) {
    const user = currentUser as unknown as UserPayload;
    return this.orderPlanService.update(id, dto, user.role);
  }

  @Patch(':id/confirm-ordered')
  async confirmOrdered(
    @Param('id') id: string,
    @Body() dto: ConfirmOrderPlanDto,
    @CurrentUser() currentUser: Record<string, unknown>,
  ) {
    const user = currentUser as unknown as UserPayload;
    return this.orderPlanService.confirmOrdered(id, dto.expectedArrivalDate, user.role);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentUser() currentUser: Record<string, unknown>,
  ) {
    const user = currentUser as unknown as UserPayload;
    return this.orderPlanService.remove(id, user.role);
  }
}
