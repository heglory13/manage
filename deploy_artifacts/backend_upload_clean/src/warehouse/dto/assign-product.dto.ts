import { IsString, IsOptional } from 'class-validator';

export class AssignProductDto {
  @IsOptional()
  @IsString()
  productId?: string | null;
}
