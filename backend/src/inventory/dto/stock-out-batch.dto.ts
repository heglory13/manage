import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class StockOutBatchItemDto {
  @IsString()
  categoryId!: string;

  @IsInt({ message: 'So luong phai la so nguyen' })
  @Min(1, { message: 'So luong xuat kho phai lon hon 0' })
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

export class StockOutBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockOutBatchItemDto)
  items!: StockOutBatchItemDto[];
}
