import { IsOptional, IsNumberString, IsString } from 'class-validator';

export class PreliminaryCheckQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;
}
