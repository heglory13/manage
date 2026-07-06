import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class StockOutDto {
  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @IsInt({ message: 'So luong phai la so nguyen' })
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
