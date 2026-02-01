-- AlterTable
ALTER TABLE `Contact` ADD COLUMN `pushName` VARCHAR(255),
ADD COLUMN `businessName` VARCHAR(255),
ADD COLUMN `profilePhotoUrl` LONGTEXT,
ADD COLUMN `company` VARCHAR(255),
ADD COLUMN `department` VARCHAR(255),
ADD COLUMN `contactType` VARCHAR(50) NOT NULL DEFAULT 'individual',
ADD COLUMN `lastActiveAt` DATETIME(3),
ADD COLUMN `engagementScore` DOUBLE NOT NULL DEFAULT 0,
ADD COLUMN `engagementLevel` VARCHAR(20) NOT NULL DEFAULT 'inactive',
ADD COLUMN `messageCount` INT NOT NULL DEFAULT 0,
ADD COLUMN `totalInteractions` INT NOT NULL DEFAULT 0,
ADD COLUMN `isBusiness` BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN `isVerified` BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN `customFields` JSON;

-- Add indexes for new fields
CREATE INDEX `Contact_engagementLevel_idx` ON `Contact`(`engagementLevel`);
CREATE INDEX `Contact_engagementScore_idx` ON `Contact`(`engagementScore`);

-- Update fulltext index to include new fields
ALTER TABLE `Contact` ADD FULLTEXT INDEX `Contact_phoneNumber_name_pushName_businessName_idx`(`phoneNumber`, `name`, `pushName`, `businessName`);
