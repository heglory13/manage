import {
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

import { Type } from 'class-transformer';

export class StockInBatchItemDto {
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
  productConditionId?: string;

  @IsOptional()
  @IsString()
  storageZoneId?: string;

  @IsOptional()
  @IsString()
  warehouseTypeId?: string;

  @IsOptional()
  @IsString()
  warehousePositionId?: string;

  @IsOptional()
  @IsDateString()
  actualStockDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  skuComboId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];
}

export class StockInBatchDto {
  @IsOptional()
  @IsString()
  preliminaryCheckId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockInBatchItemDto)
  items!: StockInBatchItemDto[];
}
