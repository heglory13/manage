import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export class ChartQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(['week', 'month', 'quarter'])
  period?: 'week' | 'month' | 'quarter';

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
