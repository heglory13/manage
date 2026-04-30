import { IsBoolean, IsOptional } from 'class-validator';

export class DeletePositionDto {
  @IsOptional()
  @IsBoolean()
  force?: boolean; // force delete even if has stock/product
}
