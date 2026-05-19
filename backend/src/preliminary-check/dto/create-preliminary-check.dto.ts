import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreatePreliminaryCheckDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  classificationId?: string;

  @IsInt()
  @Min(1, { message: 'Số lượng nhận phải lớn hơn 0' })
  quantity!: number;

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
