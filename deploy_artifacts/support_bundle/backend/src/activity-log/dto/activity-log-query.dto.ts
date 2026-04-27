import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ActivityLogQueryDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsIn(['CREATE', 'UPDATE', 'DELETE'])
  action?: string;

  @IsOptional()
  @IsString()
  tableName?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}
