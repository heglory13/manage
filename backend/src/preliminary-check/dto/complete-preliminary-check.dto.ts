import { IsEnum } from 'class-validator';

export enum PreliminaryCheckCompleteStatus {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export class CompletePreliminaryCheckDto {
  @IsEnum(PreliminaryCheckCompleteStatus)
  status!: PreliminaryCheckCompleteStatus;
}
