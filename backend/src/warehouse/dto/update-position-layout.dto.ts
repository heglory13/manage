import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdatePositionLayoutDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  x?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  y?: number;

  @IsOptional()
  @IsNumber()
  @Min(60)
  width?: number;

  @IsOptional()
  @IsNumber()
  @Min(60)
  height?: number;
}
