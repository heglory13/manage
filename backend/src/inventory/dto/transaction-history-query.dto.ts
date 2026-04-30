import { IsOptional, IsString } from 'class-validator';

export class TransactionHistoryQueryDto {
  @IsOptional()
  @IsString()
  kind?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}
