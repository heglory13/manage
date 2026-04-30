import { IsDateString } from 'class-validator';

export class ConfirmOrderPlanDto {
  @IsDateString({}, { message: 'Ngay du kien co hang khong hop le' })
  expectedArrivalDate!: string;
}
