import { IsNotEmpty, IsString } from 'class-validator';

export class CreateAttributeDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên không được để trống' })
  name!: string;
}
