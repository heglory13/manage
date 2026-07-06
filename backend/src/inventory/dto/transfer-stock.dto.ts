import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class TransferStockDto {
  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @IsOptional()
  @IsString()
  skuComboId?: string;

  @IsString()
  @IsNotEmpty()
  sourcePositionId!: string;

  @IsString()
  @IsNotEmpty()
  targetPositionId!: string;

  @IsInt({ message: 'So luong phai la so nguyen' })
  @Min(1, { message: 'So luong dieu chuyen phai lon hon 0' })
  quantity!: number;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}
