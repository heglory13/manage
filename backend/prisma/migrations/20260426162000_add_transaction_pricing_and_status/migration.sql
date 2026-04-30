-- CreateEnum
CREATE TYPE "InventoryTransactionStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- AlterTable
ALTER TABLE "inventory_transactions"
ADD COLUMN "purchasePrice" DECIMAL(15,2),
ADD COLUMN "salePrice" DECIMAL(15,2),
ADD COLUMN "status" "InventoryTransactionStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX "inventory_transactions_status_createdAt_idx" ON "inventory_transactions"("status", "createdAt");
