import { IsNotEmpty, IsString } from 'class-validator';

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
}
