-- Migration: Add ON DELETE SET NULL to InventoryTransaction + PreliminaryCheck FKs
--            Add unique constraint on SavedFilter(userId, pageKey, name)

-- InventoryTransaction: product FK
ALTER TABLE `inventory_transactions` DROP FOREIGN KEY IF EXISTS `inventory_transactions_productId_fkey`;
ALTER TABLE `inventory_transactions` ADD CONSTRAINT `inventory_transactions_productId_fkey`
  FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- InventoryTransaction: category FK
ALTER TABLE `inventory_transactions` DROP FOREIGN KEY IF EXISTS `inventory_transactions_categoryId_fkey`;
ALTER TABLE `inventory_transactions` ADD CONSTRAINT `inventory_transactions_categoryId_fkey`
  FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- InventoryTransaction: skuCombo FK
ALTER TABLE `inventory_transactions` DROP FOREIGN KEY IF EXISTS `inventory_transactions_skuComboId_fkey`;
ALTER TABLE `inventory_transactions` ADD CONSTRAINT `inventory_transactions_skuComboId_fkey`
  FOREIGN KEY (`skuComboId`) REFERENCES `sku_combos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- InventoryTransaction: productCondition FK
ALTER TABLE `inventory_transactions` DROP FOREIGN KEY IF EXISTS `inventory_transactions_productConditionId_fkey`;
ALTER TABLE `inventory_transactions` ADD CONSTRAINT `inventory_transactions_productConditionId_fkey`
  FOREIGN KEY (`productConditionId`) REFERENCES `product_conditions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- InventoryTransaction: storageZone FK
ALTER TABLE `inventory_transactions` DROP FOREIGN KEY IF EXISTS `inventory_transactions_storageZoneId_fkey`;
ALTER TABLE `inventory_transactions` ADD CONSTRAINT `inventory_transactions_storageZoneId_fkey`
  FOREIGN KEY (`storageZoneId`) REFERENCES `storage_zones`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- InventoryTransaction: warehousePosition FK
ALTER TABLE `inventory_transactions` DROP FOREIGN KEY IF EXISTS `inventory_transactions_warehousePositionId_fkey`;
ALTER TABLE `inventory_transactions` ADD CONSTRAINT `inventory_transactions_warehousePositionId_fkey`
  FOREIGN KEY (`warehousePositionId`) REFERENCES `warehouse_positions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- PreliminaryCheck: category FK
ALTER TABLE `preliminary_checks` DROP FOREIGN KEY IF EXISTS `preliminary_checks_categoryId_fkey`;
ALTER TABLE `preliminary_checks` ADD CONSTRAINT `preliminary_checks_categoryId_fkey`
  FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- PreliminaryCheck: classification FK
ALTER TABLE `preliminary_checks` DROP FOREIGN KEY IF EXISTS `preliminary_checks_classificationId_fkey`;
ALTER TABLE `preliminary_checks` ADD CONSTRAINT `preliminary_checks_classificationId_fkey`
  FOREIGN KEY (`classificationId`) REFERENCES `classifications`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- PreliminaryCheck: warehouseType FK
ALTER TABLE `preliminary_checks` DROP FOREIGN KEY IF EXISTS `preliminary_checks_warehouseTypeId_fkey`;
ALTER TABLE `preliminary_checks` ADD CONSTRAINT `preliminary_checks_warehouseTypeId_fkey`
  FOREIGN KEY (`warehouseTypeId`) REFERENCES `warehouse_types`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- SavedFilter: unique constraint on (userId, pageKey, name)
ALTER TABLE `saved_filters` ADD CONSTRAINT `saved_filters_userId_pageKey_name_key`
  UNIQUE (`userId`, `pageKey`, `name`);
