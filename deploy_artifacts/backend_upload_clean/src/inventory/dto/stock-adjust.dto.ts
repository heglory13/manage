import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class StockAdjustDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsOptional()
  @IsString()
  warehousePositionId?: string;

  @IsNumber()
  @Min(1, { message: 'Số lượng điều chỉnh phải lớn hơn 0' })
  quantity!: number;

  @IsString()
  @IsIn(['INCREASE', 'DECREASE'])
  type!: 'INCREASE' | 'DECREASE';

  @IsOptional()
  @IsString()
  reason?: string;
}
