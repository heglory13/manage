import { IsNumberString, IsOptional, IsString } from 'class-validator';

export class SkuComboQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;
}
