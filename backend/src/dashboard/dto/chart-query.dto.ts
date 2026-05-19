import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export class ChartQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(['week', 'month', 'quarter', 'year'])
  period?: 'week' | 'month' | 'quarter' | 'year';

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  warehouseTypeId?: string;
}
