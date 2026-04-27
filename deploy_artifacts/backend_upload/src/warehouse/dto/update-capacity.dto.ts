import { IsInt, Min } from 'class-validator';

export class UpdateCapacityDto {
  @IsInt()
  @Min(1, { message: 'Sức chứa tối đa phải lớn hơn 0' })
  maxCapacity!: number;
}
