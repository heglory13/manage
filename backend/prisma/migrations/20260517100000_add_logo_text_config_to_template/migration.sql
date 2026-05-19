-- Add logo text configuration fields to CustomLabelTemplate
-- Replaces image upload approach with text + font style configuration
ALTER TABLE `custom_label_templates`
  ADD COLUMN `logoLine1` VARCHAR(191) NULL,
  ADD COLUMN `logoLine2` VARCHAR(191) NULL,
  ADD COLUMN `logoFontFamily` VARCHAR(100) NULL,
  ADD COLUMN `logoLine1Weight` INT NULL,
  ADD COLUMN `logoLine2Weight` INT NULL,
  ADD COLUMN `sloganWeight` INT NULL;
