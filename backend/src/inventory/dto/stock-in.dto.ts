import {
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';

export class StockInDto {
  @IsString()
  categoryId!: string;

  @IsInt({ message: 'So luong phai la so nguyen' })
  @Min(1, { message: 'So luong nhap kho phai lon hon 0' })
  quantity!: number;

  @IsNumber()
  @Min(0, { message: 'Gia nhap khong duoc am' })
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
  warehouseTypeId?: string;

  @IsOptional()
  @IsString()
  preliminaryCheckId?: string;

  @IsOptional()
  @IsDateString()
  actualStockDate?: string;

  @IsOptional()
  @IsString()
  warehousePositionId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];
}
