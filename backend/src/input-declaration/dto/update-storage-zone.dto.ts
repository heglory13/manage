import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class UpdateStorageZoneDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên không được để trống' })
  name!: string;

  @IsInt()
  @Min(1, { message: 'Sức chứa tối đa phải lớn hơn 0' })
  maxCapacity!: number;

  @IsOptional()
  @IsString()
  warehouseTypeId?: string;
}
