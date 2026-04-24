import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class StockOutDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsNumber()
  @Min(1, { message: 'Số lượng xuất kho phải lớn hơn 0' })
  quantity!: number;

  @IsOptional()
  @IsString()
  skuComboId?: string;

  @IsOptional()
  @IsString()
  productConditionId?: string;

  @IsOptional()
  @IsString()
  storageZoneId?: string;

  @IsOptional()
  @IsString()
  warehousePositionId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
