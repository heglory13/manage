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

  /** When "true", only return SKU combos that have stock > 0 (for stock-out dropdown). */
  @IsOptional()
  @IsString()
  stockOut?: string;
}
