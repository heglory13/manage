-- AlterTable
ALTER TABLE `storage_zones` ADD COLUMN `warehouseTypeId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `storage_zones` ADD CONSTRAINT `storage_zones_warehouseTypeId_fkey` FOREIGN KEY (`warehouseTypeId`) REFERENCES `warehouse_types`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
