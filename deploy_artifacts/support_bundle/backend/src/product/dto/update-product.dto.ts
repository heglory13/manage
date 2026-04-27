import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Tên sản phẩm là bắt buộc' })
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;
}
