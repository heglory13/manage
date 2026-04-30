import { IsInt, Min } from 'class-validator';

export class UpdateMaxThresholdDto {
  @IsInt()
  @Min(0, { message: 'Ngưỡng Max phải là số không âm' })
  maxThreshold!: number;
}
