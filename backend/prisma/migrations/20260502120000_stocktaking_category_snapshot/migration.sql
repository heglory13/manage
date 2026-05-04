ALTER TABLE `stocktaking_items`
  MODIFY `productId` VARCHAR(191) NULL,
  ADD COLUMN `categoryId` VARCHAR(191) NULL AFTER `productId`,
  ADD COLUMN `itemCode` VARCHAR(191) NULL AFTER `categoryId`,
  ADD COLUMN `itemLabel` VARCHAR(191) NULL AFTER `itemCode`;

UPDATE `stocktaking_items` si
INNER JOIN `products` p ON p.`id` = si.`productId`
INNER JOIN `categories` c ON c.`id` = p.`categoryId`
SET
  si.`categoryId` = p.`categoryId`,
  si.`itemCode` = c.`code`,
  si.`itemLabel` = c.`name`
WHERE si.`itemCode` IS NULL OR si.`itemLabel` IS NULL OR si.`categoryId` IS NULL;

ALTER TABLE `stocktaking_items`
  MODIFY `itemCode` VARCHAR(191) NOT NULL,
  MODIFY `itemLabel` VARCHAR(191) NOT NULL;

ALTER TABLE `stocktaking_items`
  ADD CONSTRAINT `stocktaking_items_categoryId_fkey`
    FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX `stocktaking_items_productId_idx` ON `stocktaking_items`(`productId`);
CREATE INDEX `stocktaking_items_categoryId_idx` ON `stocktaking_items`(`categoryId`);
