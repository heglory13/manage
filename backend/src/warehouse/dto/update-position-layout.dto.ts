import { IsInt, IsOptional, Min } from 'class-validator';

export class UpdatePositionLayoutDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  x?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  y?: number;

  @IsOptional()
  @IsInt()
  @Min(60)
  width?: number;

  @IsOptional()
  @IsInt()
  @Min(60)
  height?: number;
}
