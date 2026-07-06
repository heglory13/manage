import { IsInt, Min } from 'class-validator';

export class UpdateThresholdDto {
  @IsInt()
  @Min(0, { message: 'Ngưỡng Min phải là số không âm' })
  minThreshold!: number;
}
