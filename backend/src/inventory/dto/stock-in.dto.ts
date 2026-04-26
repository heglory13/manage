import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class StockInDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsNumber()
  @Min(1, { message: 'So luong nhap kho phai lon hon 0' })
  quantity!: number;

  @IsNumber()
  @Min(1, { message: 'Gia nhap phai lon hon 0' })
  purchasePrice!: number;

  @IsNumber()
  @Min(1, { message: 'Gia ban phai lon hon 0' })
  salePrice!: number;

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
