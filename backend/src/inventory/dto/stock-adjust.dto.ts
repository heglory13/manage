import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class StockAdjustDto {
  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @IsOptional()
  @IsString()
  skuComboId?: string;

  @IsOptional()
  @IsString()
  warehousePositionId?: string;

  @IsOptional()
  @IsString()
  storageZoneId?: string;

  @IsInt({ message: 'So luong phai la so nguyen' })
  @Min(1, { message: 'Số lượng điều chỉnh phải lớn hơn 0' })
  quantity!: number;

  @IsString()
  @IsIn(['INCREASE', 'DECREASE'])
  type!: 'INCREASE' | 'DECREASE';

  @IsOptional()
  @IsString()
  reason?: string;
}
