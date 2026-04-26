import { IsDateString, IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class DetailTransactionsQueryDto {
  @IsOptional()
  @IsIn(['stock_in', 'stock_out'])
  type?: 'stock_in' | 'stock_out';

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
