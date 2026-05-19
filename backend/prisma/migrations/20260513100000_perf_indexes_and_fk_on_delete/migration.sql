-- Fix FK: allow SET NULL when PreliminaryCheck is deleted
ALTER TABLE `inventory_transactions` DROP FOREIGN KEY `inventory_transactions_preliminaryCheckId_fkey`;
ALTER TABLE `inventory_transactions` ADD CONSTRAINT `inventory_transactions_preliminaryCheckId_fkey`
  FOREIGN KEY (`preliminaryCheckId`) REFERENCES `preliminary_checks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Add composite indexes for high-frequency stock queries
CREATE INDEX `inventory_transactions_categoryId_status_idx` ON `inventory_transactions`(`categoryId`, `status`);
CREATE INDEX `inventory_transactions_skuComboId_status_idx` ON `inventory_transactions`(`skuComboId`, `status`);
CREATE INDEX `inventory_transactions_storageZoneId_status_idx` ON `inventory_transactions`(`storageZoneId`, `status`);
