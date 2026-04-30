import { IsEnum, IsOptional, IsString } from 'class-validator';
import { OrderPlanStatus, OrderPlanType } from '@prisma/client/index';

export class OrderPlanQueryDto {
  @IsOptional()
  @IsEnum(OrderPlanStatus)
  status?: OrderPlanStatus;

  @IsOptional()
  @IsEnum(OrderPlanType)
  type?: OrderPlanType;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}
