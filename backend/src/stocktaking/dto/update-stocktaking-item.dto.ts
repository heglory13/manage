import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateStocktakingItemDto {
  @IsInt()
  @Min(0)
  actualQuantity!: number;

  @IsOptional()
  @IsString()
  discrepancyReason?: string;

  @IsOptional()
  @IsString()
  evidenceUrl?: string;
}
