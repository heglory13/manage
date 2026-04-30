import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { OrderPlanType } from '@prisma/client/index';

export class CreateOrderPlanDto {
  @IsEnum(OrderPlanType)
  type!: OrderPlanType;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  categoryId?: string;

  @IsOptional()
  @IsString()
  warehouseTypeId?: string;

  @IsInt()
  @Min(1, { message: 'So luong can dat phai lon hon 0' })
  quantity!: number;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
