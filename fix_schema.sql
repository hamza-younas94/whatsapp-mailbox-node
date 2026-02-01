-- Fix database schema issues
-- Run this file: mysql -u mailbox -p whatsapp_mailbox < fix_schema.sql

-- Add missing QuickReply columns
ALTER TABLE `QuickReply` ADD COLUMN IF NOT EXISTS `isActive` BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE `QuickReply` ADD COLUMN IF NOT EXISTS `usageCount` INT NOT NULL DEFAULT 0;
ALTER TABLE `QuickReply` ADD COLUMN IF NOT EXISTS `usageTodayCount` INT NOT NULL DEFAULT 0;

-- Fix Contact table profilePhotoUrl length issue
ALTER TABLE `Contact` MODIFY COLUMN `profilePhotoUrl` TEXT;

-- Add index on isActive for faster filtering
CREATE INDEX IF NOT EXISTS `QuickReply_isActive_idx` ON `QuickReply`(`isActive`);
