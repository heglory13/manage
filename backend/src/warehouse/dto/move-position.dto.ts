import { IsInt, Min } from 'class-validator';

export class MovePositionDto {
  @IsInt()
  @Min(0)
  targetRow!: number;

  @IsInt()
  @Min(0)
  targetColumn!: number;
}
