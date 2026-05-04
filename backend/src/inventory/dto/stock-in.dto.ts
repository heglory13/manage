import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class StockInDto {
  @IsString()
  categoryId!: string;

  @IsNumber()
  @Min(1, { message: 'So luong nhap kho phai lon hon 0' })
  quantity!: number;

  @IsNumber()
  @Min(1, { message: 'Gia nhap phai lon hon 0' })
  purchasePrice!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  salePrice?: number;

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
