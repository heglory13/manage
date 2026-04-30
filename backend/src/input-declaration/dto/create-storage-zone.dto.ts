import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class CreateStorageZoneDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên không được để trống' })
  name!: string;

  @IsInt()
  @Min(1, { message: 'Sức chứa tối đa phải lớn hơn 0' })
  maxCapacity!: number;
}
