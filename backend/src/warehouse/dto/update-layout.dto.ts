import { IsString, IsInt, Min, IsOptional, IsNotEmpty } from 'class-validator';

export class UpdateLayoutDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  rows?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  columns?: number;
}
