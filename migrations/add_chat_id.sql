-- Add chatId field to Contact table to store full WhatsApp identifiers
-- This supports all WhatsApp contact types: @c.us (regular), @newsletter (channels), @g.us (groups)

-- Add chatId column if it doesn't exist
SET @dbname = DATABASE();
SET @tablename = 'Contact';
SET @columnname = 'chatId';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  'SELECT 1', -- Column exists, do nothing
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' VARCHAR(50) NULL AFTER phoneNumber')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Populate chatId from phoneNumber for existing contacts (assume @c.us for backwards compatibility)
UPDATE Contact 
SET chatId = CONCAT(phoneNumber, '@c.us') 
WHERE chatId IS NULL AND phoneNumber IS NOT NULL;

-- Add index on chatId for faster lookups
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (INDEX_NAME = 'Contact_chatId_idx')
  ) > 0,
  'SELECT 1', -- Index exists
  CONCAT('CREATE INDEX Contact_chatId_idx ON ', @tablename, ' (chatId)')
));
PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SELECT 'Migration complete: chatId field added to Contact table' AS status;
