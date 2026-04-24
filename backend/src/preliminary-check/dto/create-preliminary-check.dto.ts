import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreatePreliminaryCheckDto {
  @IsString()
  @IsNotEmpty()
  classificationId!: string;

  @IsInt()
  @Min(1, { message: 'Số lượng nhận phải lớn hơn 0' })
  quantity!: number;

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
