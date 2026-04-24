import { IsInt, IsOptional, IsString, IsNotEmpty, Min, IsUUID } from 'class-validator';

export class CreatePositionDto {
  @IsUUID()
  layoutId!: string;

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

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  label?: string;
}
