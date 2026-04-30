import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class StockInBatchItemDto {
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
  productConditionId?: string;

  @IsOptional()
  @IsString()
  storageZoneId?: string;

  @IsOptional()
  @IsString()
  warehousePositionId?: string;

  @IsOptional()
  @IsDateString()
  actualStockDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
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
