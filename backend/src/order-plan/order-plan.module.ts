import { Module } from '@nestjs/common';
import { OrderPlanController } from './order-plan.controller.js';
import { OrderPlanService } from './order-plan.service.js';

@Module({
  controllers: [OrderPlanController],
  providers: [OrderPlanService],
  exports: [OrderPlanService],
})
export class OrderPlanModule {}
