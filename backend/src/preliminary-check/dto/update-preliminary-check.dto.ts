import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';

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
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];

  @IsOptional()
  @IsString()
  note?: string;
}
