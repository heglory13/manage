-- Fix StocktakingRecord.status default from PENDING to CHECKING
-- A new record starts in CHECKING (in-progress), not PENDING (waiting for approval)
ALTER TABLE `stocktaking_records`
  MODIFY COLUMN `status` ENUM('CHECKING', 'PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'CHECKING';
