-- AlterTable: add websiteFontFamily, websiteWeight, sloganFontFamily to custom_label_templates
ALTER TABLE `custom_label_templates`
  ADD COLUMN `websiteFontFamily` VARCHAR(191) NULL,
  ADD COLUMN `websiteWeight`     INT          NULL,
  ADD COLUMN `sloganFontFamily`  VARCHAR(191) NULL;
