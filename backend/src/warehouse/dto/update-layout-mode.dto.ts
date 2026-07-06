import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateLayoutModeDto {
  @IsIn(['GRID', 'FREE'])
  mode!: 'GRID' | 'FREE';

  @IsOptional()
  @IsInt()
  @Min(400)
  canvasWidth?: number;

  @IsOptional()
  @IsInt()
  @Min(300)
  canvasHeight?: number;
}
