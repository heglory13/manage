import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateStocktakingItemDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsInt()
  @Min(0)
  actualQuantity!: number;

  @IsOptional()
  @IsString()
  evidenceUrl?: string;
}

export class CreateStocktakingDto {
  @IsString()
  @IsIn(['full', 'selected'])
  mode!: 'full' | 'selected';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productIds?: string[];

  @IsOptional()
  @IsDateString()
  cutoffTime?: string;
}

export class SubmitStocktakingItemDto {
  @IsString()
  @IsNotEmpty()
  itemId!: string;

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

export class SubmitStocktakingDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmitStocktakingItemDto)
  items!: SubmitStocktakingItemDto[];
}
