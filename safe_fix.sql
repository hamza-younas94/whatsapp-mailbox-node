-- =====================================================
-- SAFE DATABASE SCHEMA FIX (Handles existing columns)
-- Run: mysql -u mailbox -p whatsapp_mailbox < safe_fix.sql
-- Note: Some errors are expected if columns already exist - that's OK!
-- =====================================================

-- Drop any existing procedure
DROP PROCEDURE IF EXISTS AddColumnIfNotExists;

DELIMITER $$

CREATE PROCEDURE AddColumnIfNotExists(
    IN tableName VARCHAR(128),
    IN columnName VARCHAR(128),
    IN columnDefinition VARCHAR(255)
)
BEGIN
    DECLARE columnExists INT;
    
    SELECT COUNT(*) INTO columnExists
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = tableName
        AND COLUMN_NAME = columnName;
    
    IF columnExists = 0 THEN
        SET @sql = CONCAT('ALTER TABLE `', tableName, '` ADD COLUMN `', columnName, '` ', columnDefinition);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$

DELIMITER ;

-- 1. Fix QuickReply table
CALL AddColumnIfNotExists('QuickReply', 'isActive', 'BOOLEAN NOT NULL DEFAULT true');
CALL AddColumnIfNotExists('QuickReply', 'usageCount', 'INT NOT NULL DEFAULT 0');
CALL AddColumnIfNotExists('QuickReply', 'usageTodayCount', 'INT NOT NULL DEFAULT 0');

-- 2. Fix Contact table
ALTER TABLE `Contact` MODIFY COLUMN `avatarUrl` TEXT;
ALTER TABLE `Contact` MODIFY COLUMN `profilePhotoUrl` TEXT;

-- 3. Fix Message table
ALTER TABLE `Message` MODIFY COLUMN `mediaUrl` TEXT;

-- Add group and channel support
CALL AddColumnIfNotExists('Message', 'quotedMessageId', 'VARCHAR(191)');
CALL AddColumnIfNotExists('Message', 'isGroupMessage', 'BOOLEAN NOT NULL DEFAULT false');
CALL AddColumnIfNotExists('Message', 'groupId', 'VARCHAR(191)');
CALL AddColumnIfNotExists('Message', 'groupName', 'VARCHAR(255)');
CALL AddColumnIfNotExists('Message', 'isStatusUpdate', 'BOOLEAN NOT NULL DEFAULT false');
CALL AddColumnIfNotExists('Message', 'isChannelMessage', 'BOOLEAN NOT NULL DEFAULT false');
CALL AddColumnIfNotExists('Message', 'channelId', 'VARCHAR(191)');
CALL AddColumnIfNotExists('Message', 'senderName', 'VARCHAR(255)');

-- 4. Add indexes (ignore errors if they exist)
CREATE INDEX `QuickReply_isActive_idx` ON `QuickReply`(`isActive`);
CREATE INDEX `Message_isGroupMessage_idx` ON `Message`(`isGroupMessage`);
CREATE INDEX `Message_groupId_idx` ON `Message`(`groupId`);
CREATE INDEX `Message_isChannelMessage_idx` ON `Message`(`isChannelMessage`);
CREATE INDEX `Message_channelId_idx` ON `Message`(`channelId`);
CREATE INDEX `Message_isStatusUpdate_idx` ON `Message`(`isStatusUpdate`);

-- 5. Update MessageType enum
ALTER TABLE `Message` 
  MODIFY COLUMN `messageType` 
  ENUM('TEXT','IMAGE','VIDEO','AUDIO','DOCUMENT','BUTTON','LIST','INTERACTIVE','LOCATION','CONTACT','TEMPLATE','REACTION','STICKER','POLL','GROUP_INVITE','STATUS','CHANNEL_POST') 
  NOT NULL DEFAULT 'TEXT';

-- Cleanup
DROP PROCEDURE IF EXISTS AddColumnIfNotExists;

-- Done!
SELECT 'Database schema updated successfully!' AS Status;
