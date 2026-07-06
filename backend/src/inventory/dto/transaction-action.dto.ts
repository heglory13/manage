import { ArrayNotEmpty, IsArray, IsEnum, IsString } from 'class-validator';
import { InventoryTransactionStatus } from '@prisma/client/index';

export class TransactionStatusActionDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  transactionIds!: string[];

  @IsEnum(InventoryTransactionStatus)
  status!: InventoryTransactionStatus;
}

export class DeleteTransactionsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  transactionIds!: string[];
}
