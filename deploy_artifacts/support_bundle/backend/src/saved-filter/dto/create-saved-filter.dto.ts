import { IsNotEmpty, IsObject, IsString } from 'class-validator';

export class CreateSavedFilterDto {
  @IsString()
  @IsNotEmpty()
  pageKey!: string;

  @IsString()
  @IsNotEmpty({ message: 'Tên bộ lọc không được để trống' })
  name!: string;

  @IsObject()
  filters!: Record<string, unknown>;
}
