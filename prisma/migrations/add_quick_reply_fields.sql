-- Add isActive, usageCount, and usageTodayCount fields to QuickReply table
ALTER TABLE `QuickReply` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE `QuickReply` ADD COLUMN `usageCount` INT NOT NULL DEFAULT 0;
ALTER TABLE `QuickReply` ADD COLUMN `usageTodayCount` INT NOT NULL DEFAULT 0;

-- Add index on isActive for faster filtering
CREATE INDEX `QuickReply_isActive_idx` ON `QuickReply`(`isActive`);
