import { IsNotEmpty, IsString } from 'class-validator';

export class NxtReportQueryDto {
  @IsString()
  @IsNotEmpty()
  startDate!: string;

  @IsString()
  @IsNotEmpty()
  endDate!: string;
}
