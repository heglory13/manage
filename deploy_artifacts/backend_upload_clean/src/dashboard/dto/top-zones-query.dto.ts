import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class TopZonesQueryDto {
  @IsOptional()
  @IsIn(['highest', 'lowest'])
  type?: 'highest' | 'lowest';

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}
