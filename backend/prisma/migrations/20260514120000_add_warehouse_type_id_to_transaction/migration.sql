-- Add warehouseTypeId to inventory_transactions
ALTER TABLE `inventory_transactions` ADD COLUMN `warehouseTypeId` VARCHAR(191) NULL;

-- Backfill from zone's current warehouseTypeId for existing records
UPDATE `inventory_transactions` it
INNER JOIN `storage_zones` sz ON it.storageZoneId = sz.id
SET it.warehouseTypeId = sz.warehouseTypeId
WHERE it.warehouseTypeId IS NULL AND sz.warehouseTypeId IS NOT NULL;

-- Backfill from warehouse_types via position layout name for records without zone but with position
UPDATE `inventory_transactions` it
INNER JOIN `warehouse_positions` wp ON it.warehousePositionId = wp.id
INNER JOIN `warehouse_layouts` wl ON wp.layoutId = wl.id
INNER JOIN `warehouse_types` wt ON LOWER(wt.name) = LOWER(wl.name)
SET it.warehouseTypeId = wt.id
WHERE it.warehouseTypeId IS NULL AND it.warehousePositionId IS NOT NULL;

-- Foreign key constraint
ALTER TABLE `inventory_transactions` ADD CONSTRAINT `inventory_transactions_warehouseTypeId_fkey`
  FOREIGN KEY (`warehouseTypeId`) REFERENCES `warehouse_types`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
