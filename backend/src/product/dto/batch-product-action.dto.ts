import { ArrayNotEmpty, IsArray, IsBoolean, IsString } from 'class-validator';

export class BatchProductDiscontinueDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  categoryIds!: string[];

  @IsBoolean()
  isDiscontinued!: boolean;
}
