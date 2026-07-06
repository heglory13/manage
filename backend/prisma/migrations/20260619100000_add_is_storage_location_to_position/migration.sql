-- AlterTable: Add isStorageLocation column to warehouse_positions
-- Default TRUE so all existing positions are treated as storage locations (no data loss)
ALTER TABLE `warehouse_positions`
  ADD COLUMN `isStorageLocation` BOOLEAN NOT NULL DEFAULT TRUE;
