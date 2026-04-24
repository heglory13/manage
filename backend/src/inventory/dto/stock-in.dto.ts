import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class StockInDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsNumber()
  @Min(1, { message: 'Số lượng nhập kho phải lớn hơn 0' })
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
  preliminaryCheckId?: string;

  @IsOptional()
  @IsString()
  actualStockDate?: string;

  @IsOptional()
  @IsString()
  warehousePositionId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
