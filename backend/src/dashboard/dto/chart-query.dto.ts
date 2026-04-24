import { IsIn, IsOptional, IsString } from 'class-validator';

export class ChartQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(['week', 'month'])
  period?: 'week' | 'month';
}
