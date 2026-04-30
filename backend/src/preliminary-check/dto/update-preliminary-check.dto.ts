import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdatePreliminaryCheckDto {
  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  classificationId?: string;

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'So luong nhan phai lon hon 0' })
  quantity?: number;

  @IsOptional()
  @IsString()
  warehouseTypeId?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
