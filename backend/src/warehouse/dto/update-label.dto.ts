import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateLabelDto {
  @IsString()
  @IsNotEmpty()
  label!: string;
}
