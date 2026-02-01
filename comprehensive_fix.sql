-- =====================================================
-- COMPREHENSIVE DATABASE SCHEMA FIX
-- Run: mysql -u mailbox -p whatsapp_mailbox < comprehensive_fix.sql
-- =====================================================

-- 1. Fix QuickReply table - Add missing columns (ignore errors if columns exist)
ALTER TABLE `QuickReply` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE `QuickReply` ADD COLUMN `usageCount` INT NOT NULL DEFAULT 0;
ALTER TABLE `QuickReply` ADD COLUMN `usageTodayCount` INT NOT NULL DEFAULT 0;

-- Add index for QuickReply filtering
CREATE INDEX `QuickReply_isActive_idx` ON `QuickReply`(`isActive`);

-- 2. Fix Contact table - Change URL columns to TEXT for long URLs
ALTER TABLE `Contact` MODIFY COLUMN `avatarUrl` TEXT;
ALTER TABLE `Contact` MODIFY COLUMN `profilePhotoUrl` TEXT;

-- 3. Fix Message table - Change mediaUrl to TEXT and add group/channel support
ALTER TABLE `Message` MODIFY COLUMN `mediaUrl` TEXT;

-- Add group and channel message support
ALTER TABLE `Message` ADD COLUMN `quotedMessageId` VARCHAR(191);
ALTER TABLE `Message` ADD COLUMN `isGroupMessage` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `Message` ADD COLUMN `groupId` VARCHAR(191);
ALTER TABLE `Message` ADD COLUMN `groupName` VARCHAR(255);
ALTER TABLE `Message` ADD COLUMN `isStatusUpdate` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `Message` ADD COLUMN `isChannelMessage` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `Message` ADD COLUMN `channelId` VARCHAR(191);
ALTER TABLE `Message` ADD COLUMN `senderName` VARCHAR(255);

-- Add indexes for better group/channel filtering
CREATE INDEX `Message_isGroupMessage_idx` ON `Message`(`isGroupMessage`);
CREATE INDEX `Message_groupId_idx` ON `Message`(`groupId`);
CREATE INDEX `Message_isChannelMessage_idx` ON `Message`(`isChannelMessage`);
CREATE INDEX `Message_channelId_idx` ON `Message`(`channelId`);
CREATE INDEX `Message_isStatusUpdate_idx` ON `Message`(`isStatusUpdate`);

-- 4. Update MessageType enum to support new types
ALTER TABLE `Message` 
  MODIFY COLUMN `messageType` 
  ENUM('TEXT','IMAGE','VIDEO','AUDIO','DOCUMENT','BUTTON','LIST','INTERACTIVE','LOCATION','CONTACT','TEMPLATE','REACTION','STICKER','POLL','GROUP_INVITE','STATUS','CHANNEL_POST') 
  NOT NULL DEFAULT 'TEXT';

-- =====================================================
-- VERIFICATION QUERIES (Run these to verify)
-- =====================================================
-- SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'QuickReply' AND COLUMN_NAME IN ('isActive', 'usageCount', 'usageTodayCount');
-- SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Contact' AND COLUMN_NAME IN ('avatarUrl', 'profilePhotoUrl');
-- SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Message' AND COLUMN_NAME IN ('mediaUrl', 'isGroupMessage', 'groupId', 'isChannelMessage');
-- SHOW COLUMNS FROM Message LIKE 'messageType';
