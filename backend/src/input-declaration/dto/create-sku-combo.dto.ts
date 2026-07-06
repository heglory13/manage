import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateSkuComboDto {
  @IsString()
  @IsNotEmpty()
  classificationId!: string;

  @IsString()
  @IsNotEmpty()
  colorId!: string;

  @IsString()
  @IsNotEmpty()
  sizeId!: string;

  @IsString()
  @IsNotEmpty()
  materialId!: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  _storageZoneId?: string;

  @IsOptional()
  @IsNumber()
  _purchasePrice?: number;

  @IsOptional()
  @IsString()
  _notes?: string;
}
