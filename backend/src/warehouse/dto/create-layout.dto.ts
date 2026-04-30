import { IsString, IsInt, Min, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class CreateLayoutDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsInt()
  @Min(1)
  rows!: number;

  @IsInt()
  @Min(1)
  columns!: number;

  @IsOptional()
  @IsIn(['GRID', 'FREE'])
  layoutMode?: 'GRID' | 'FREE';
}
