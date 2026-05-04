-- DropForeignKey
ALTER TABLE `stocktaking_items` DROP FOREIGN KEY `stocktaking_items_productId_fkey`;

-- AddForeignKey
ALTER TABLE `stocktaking_items` ADD CONSTRAINT `stocktaking_items_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
