-- CreateTable: Organization
CREATE TABLE `Organization` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `timezone` VARCHAR(191) NOT NULL DEFAULT 'Asia/Karachi',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Organization_slug_key`(`slug`),
    INDEX `Organization_slug_idx`(`slug`),
    INDEX `Organization_ownerId_idx`(`ownerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create a default organization for each existing user
INSERT INTO `Organization` (`id`, `name`, `slug`, `ownerId`, `timezone`, `isActive`, `createdAt`, `updatedAt`)
SELECT
    CONCAT('org_', `id`),
    COALESCE(`name`, `username`, 'My Organization'),
    `username`,
    `id`,
    'Asia/Karachi',
    true,
    NOW(3),
    NOW(3)
FROM `User`;

-- Add orgId column to User (nullable first for migration)
ALTER TABLE `User` ADD COLUMN `orgId` VARCHAR(191) NULL;
UPDATE `User` SET `orgId` = CONCAT('org_', `id`);
ALTER TABLE `User` MODIFY COLUMN `orgId` VARCHAR(191) NOT NULL;
CREATE INDEX `User_orgId_idx` ON `User`(`orgId`);
ALTER TABLE `User` ADD CONSTRAINT `User_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Add OWNER role to UserRole enum BEFORE updating existing users
ALTER TABLE `User` MODIFY COLUMN `role` ENUM('OWNER', 'ADMIN', 'USER', 'MANAGER', 'AGENT') NOT NULL DEFAULT 'AGENT';

-- Change default role from USER to AGENT (existing users become OWNER)
UPDATE `User` SET `role` = 'OWNER';

-- Add orgId to Contact
ALTER TABLE `Contact` ADD COLUMN `orgId` VARCHAR(191) NULL;
UPDATE `Contact` c JOIN `User` u ON c.userId = u.id SET c.orgId = u.orgId;
ALTER TABLE `Contact` MODIFY COLUMN `orgId` VARCHAR(191) NOT NULL;
CREATE INDEX `Contact_orgId_idx` ON `Contact`(`orgId`);
ALTER TABLE `Contact` ADD CONSTRAINT `Contact_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
-- Change unique constraint from (userId, phoneNumber) to (orgId, phoneNumber)
ALTER TABLE `Contact` DROP INDEX `Contact_userId_phoneNumber_key`;
ALTER TABLE `Contact` ADD UNIQUE INDEX `Contact_orgId_phoneNumber_key`(`orgId`, `phoneNumber`);

-- Add orgId to Conversation
ALTER TABLE `Conversation` ADD COLUMN `orgId` VARCHAR(191) NULL;
UPDATE `Conversation` c JOIN `User` u ON c.userId = u.id SET c.orgId = u.orgId;
ALTER TABLE `Conversation` MODIFY COLUMN `orgId` VARCHAR(191) NOT NULL;
CREATE INDEX `Conversation_orgId_idx` ON `Conversation`(`orgId`);
ALTER TABLE `Conversation` ADD CONSTRAINT `Conversation_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Conversation` DROP INDEX `Conversation_userId_contactId_key`;
ALTER TABLE `Conversation` ADD UNIQUE INDEX `Conversation_orgId_contactId_key`(`orgId`, `contactId`);

-- Add orgId to Message
ALTER TABLE `Message` ADD COLUMN `orgId` VARCHAR(191) NULL;
UPDATE `Message` m JOIN `User` u ON m.userId = u.id SET m.orgId = u.orgId;
ALTER TABLE `Message` MODIFY COLUMN `orgId` VARCHAR(191) NOT NULL;
CREATE INDEX `Message_orgId_idx` ON `Message`(`orgId`);
ALTER TABLE `Message` ADD CONSTRAINT `Message_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Add orgId to Tag
ALTER TABLE `Tag` ADD COLUMN `orgId` VARCHAR(191) NULL;
UPDATE `Tag` t JOIN `User` u ON t.userId = u.id SET t.orgId = u.orgId;
ALTER TABLE `Tag` MODIFY COLUMN `orgId` VARCHAR(191) NOT NULL;
CREATE INDEX `Tag_orgId_idx` ON `Tag`(`orgId`);
ALTER TABLE `Tag` ADD CONSTRAINT `Tag_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Tag` DROP INDEX `Tag_userId_name_key`;
ALTER TABLE `Tag` ADD UNIQUE INDEX `Tag_orgId_name_key`(`orgId`, `name`);

-- Add orgId to Segment
ALTER TABLE `Segment` ADD COLUMN `orgId` VARCHAR(191) NULL;
UPDATE `Segment` s JOIN `User` u ON s.userId = u.id SET s.orgId = u.orgId;
ALTER TABLE `Segment` MODIFY COLUMN `orgId` VARCHAR(191) NOT NULL;
CREATE INDEX `Segment_orgId_idx` ON `Segment`(`orgId`);
ALTER TABLE `Segment` ADD CONSTRAINT `Segment_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Segment` DROP INDEX `Segment_userId_name_key`;
ALTER TABLE `Segment` ADD UNIQUE INDEX `Segment_orgId_name_key`(`orgId`, `name`);

-- Add orgId to QuickReply
ALTER TABLE `QuickReply` ADD COLUMN `orgId` VARCHAR(191) NULL;
UPDATE `QuickReply` q JOIN `User` u ON q.userId = u.id SET q.orgId = u.orgId;
ALTER TABLE `QuickReply` MODIFY COLUMN `orgId` VARCHAR(191) NOT NULL;
CREATE INDEX `QuickReply_orgId_idx` ON `QuickReply`(`orgId`);
ALTER TABLE `QuickReply` ADD CONSTRAINT `QuickReply_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Add orgId to Automation
ALTER TABLE `Automation` ADD COLUMN `orgId` VARCHAR(191) NULL;
UPDATE `Automation` a JOIN `User` u ON a.userId = u.id SET a.orgId = u.orgId;
ALTER TABLE `Automation` MODIFY COLUMN `orgId` VARCHAR(191) NOT NULL;
CREATE INDEX `Automation_orgId_idx` ON `Automation`(`orgId`);
ALTER TABLE `Automation` ADD CONSTRAINT `Automation_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Add orgId to Note
ALTER TABLE `Note` ADD COLUMN `orgId` VARCHAR(191) NULL;
UPDATE `Note` n JOIN `User` u ON n.userId = u.id SET n.orgId = u.orgId;
ALTER TABLE `Note` MODIFY COLUMN `orgId` VARCHAR(191) NOT NULL;
CREATE INDEX `Note_orgId_idx` ON `Note`(`orgId`);
ALTER TABLE `Note` ADD CONSTRAINT `Note_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Add orgId to ActivityLog
ALTER TABLE `ActivityLog` ADD COLUMN `orgId` VARCHAR(191) NULL;
UPDATE `ActivityLog` a JOIN `User` u ON a.userId = u.id SET a.orgId = u.orgId;
ALTER TABLE `ActivityLog` MODIFY COLUMN `orgId` VARCHAR(191) NOT NULL;
CREATE INDEX `ActivityLog_orgId_idx` ON `ActivityLog`(`orgId`);
ALTER TABLE `ActivityLog` ADD CONSTRAINT `ActivityLog_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Add orgId to AutomationLog
ALTER TABLE `AutomationLog` ADD COLUMN `orgId` VARCHAR(191) NULL;
UPDATE `AutomationLog` a JOIN `User` u ON a.userId = u.id SET a.orgId = u.orgId;
ALTER TABLE `AutomationLog` MODIFY COLUMN `orgId` VARCHAR(191) NOT NULL;
CREATE INDEX `AutomationLog_orgId_idx` ON `AutomationLog`(`orgId`);
ALTER TABLE `AutomationLog` ADD CONSTRAINT `AutomationLog_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Add orgId to DripCampaign
ALTER TABLE `DripCampaign` ADD COLUMN `orgId` VARCHAR(191) NULL;
UPDATE `DripCampaign` d JOIN `User` u ON d.userId = u.id SET d.orgId = u.orgId;
ALTER TABLE `DripCampaign` MODIFY COLUMN `orgId` VARCHAR(191) NOT NULL;
CREATE INDEX `DripCampaign_orgId_idx` ON `DripCampaign`(`orgId`);
ALTER TABLE `DripCampaign` ADD CONSTRAINT `DripCampaign_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Add orgId to Broadcast
ALTER TABLE `Broadcast` ADD COLUMN `orgId` VARCHAR(191) NULL;
UPDATE `Broadcast` b JOIN `User` u ON b.userId = u.id SET b.orgId = u.orgId;
ALTER TABLE `Broadcast` MODIFY COLUMN `orgId` VARCHAR(191) NOT NULL;
CREATE INDEX `Broadcast_orgId_idx` ON `Broadcast`(`orgId`);
ALTER TABLE `Broadcast` ADD CONSTRAINT `Broadcast_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Add orgId to Label
ALTER TABLE `Label` ADD COLUMN `orgId` VARCHAR(191) NULL;
UPDATE `Label` l JOIN `User` u ON l.userId = u.id SET l.orgId = u.orgId;
ALTER TABLE `Label` MODIFY COLUMN `orgId` VARCHAR(191) NOT NULL;
CREATE INDEX `Label_orgId_idx` ON `Label`(`orgId`);
ALTER TABLE `Label` ADD CONSTRAINT `Label_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Label` DROP INDEX `Label_userId_name_key`;
ALTER TABLE `Label` ADD UNIQUE INDEX `Label_orgId_name_key`(`orgId`, `name`);

-- Add orgId to ScheduledMessage
ALTER TABLE `ScheduledMessage` ADD COLUMN `orgId` VARCHAR(191) NULL;
UPDATE `ScheduledMessage` s JOIN `User` u ON s.userId = u.id SET s.orgId = u.orgId;
ALTER TABLE `ScheduledMessage` MODIFY COLUMN `orgId` VARCHAR(191) NOT NULL;
CREATE INDEX `ScheduledMessage_orgId_idx` ON `ScheduledMessage`(`orgId`);
ALTER TABLE `ScheduledMessage` ADD CONSTRAINT `ScheduledMessage_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Add orgId to ImportJob
ALTER TABLE `ImportJob` ADD COLUMN `orgId` VARCHAR(191) NULL;
UPDATE `ImportJob` i JOIN `User` u ON i.userId = u.id SET i.orgId = u.orgId;
ALTER TABLE `ImportJob` MODIFY COLUMN `orgId` VARCHAR(191) NOT NULL;
CREATE INDEX `ImportJob_orgId_idx` ON `ImportJob`(`orgId`);
ALTER TABLE `ImportJob` ADD CONSTRAINT `ImportJob_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Add orgId to Product
ALTER TABLE `Product` ADD COLUMN `orgId` VARCHAR(191) NULL;
UPDATE `Product` p JOIN `User` u ON p.userId = u.id SET p.orgId = u.orgId;
ALTER TABLE `Product` MODIFY COLUMN `orgId` VARCHAR(191) NOT NULL;
CREATE INDEX `Product_orgId_idx` ON `Product`(`orgId`);
ALTER TABLE `Product` ADD CONSTRAINT `Product_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Product` DROP INDEX `Product_userId_sku_key`;
ALTER TABLE `Product` ADD UNIQUE INDEX `Product_orgId_sku_key`(`orgId`, `sku`);

-- Add orgId to Invoice
ALTER TABLE `Invoice` ADD COLUMN `orgId` VARCHAR(191) NULL;
UPDATE `Invoice` i JOIN `User` u ON i.userId = u.id SET i.orgId = u.orgId;
ALTER TABLE `Invoice` MODIFY COLUMN `orgId` VARCHAR(191) NOT NULL;
CREATE INDEX `Invoice_orgId_idx` ON `Invoice`(`orgId`);
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Add orgId to Order
ALTER TABLE `Order` ADD COLUMN `orgId` VARCHAR(191) NULL;
UPDATE `Order` o JOIN `User` u ON o.userId = u.id SET o.orgId = u.orgId;
ALTER TABLE `Order` MODIFY COLUMN `orgId` VARCHAR(191) NOT NULL;
CREATE INDEX `Order_orgId_idx` ON `Order`(`orgId`);
ALTER TABLE `Order` ADD CONSTRAINT `Order_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Add orgId to ServiceTicket
ALTER TABLE `ServiceTicket` ADD COLUMN `orgId` VARCHAR(191) NULL;
UPDATE `ServiceTicket` s JOIN `User` u ON s.userId = u.id SET s.orgId = u.orgId;
ALTER TABLE `ServiceTicket` MODIFY COLUMN `orgId` VARCHAR(191) NOT NULL;
CREATE INDEX `ServiceTicket_orgId_idx` ON `ServiceTicket`(`orgId`);
ALTER TABLE `ServiceTicket` ADD CONSTRAINT `ServiceTicket_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Add orgId to Appointment
ALTER TABLE `Appointment` ADD COLUMN `orgId` VARCHAR(191) NULL;
UPDATE `Appointment` a JOIN `User` u ON a.userId = u.id SET a.orgId = u.orgId;
ALTER TABLE `Appointment` MODIFY COLUMN `orgId` VARCHAR(191) NOT NULL;
CREATE INDEX `Appointment_orgId_idx` ON `Appointment`(`orgId`);
ALTER TABLE `Appointment` ADD CONSTRAINT `Appointment_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Add orgId to Expense
ALTER TABLE `Expense` ADD COLUMN `orgId` VARCHAR(191) NULL;
UPDATE `Expense` e JOIN `User` u ON e.userId = u.id SET e.orgId = u.orgId;
ALTER TABLE `Expense` MODIFY COLUMN `orgId` VARCHAR(191) NOT NULL;
CREATE INDEX `Expense_orgId_idx` ON `Expense`(`orgId`);
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Add orgId to CustomerSubscription
ALTER TABLE `CustomerSubscription` ADD COLUMN `orgId` VARCHAR(191) NULL;
UPDATE `CustomerSubscription` cs JOIN `User` u ON cs.userId = u.id SET cs.orgId = u.orgId;
ALTER TABLE `CustomerSubscription` MODIFY COLUMN `orgId` VARCHAR(191) NOT NULL;
CREATE INDEX `CustomerSubscription_orgId_idx` ON `CustomerSubscription`(`orgId`);
ALTER TABLE `CustomerSubscription` ADD CONSTRAINT `CustomerSubscription_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Add orgId to AutoTagRule
ALTER TABLE `AutoTagRule` ADD COLUMN `orgId` VARCHAR(191) NULL;
UPDATE `AutoTagRule` a JOIN `User` u ON a.userId = u.id SET a.orgId = u.orgId;
ALTER TABLE `AutoTagRule` MODIFY COLUMN `orgId` VARCHAR(191) NOT NULL;
CREATE INDEX `AutoTagRule_orgId_idx` ON `AutoTagRule`(`orgId`);
ALTER TABLE `AutoTagRule` ADD CONSTRAINT `AutoTagRule_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Add orgId to Task
ALTER TABLE `Task` ADD COLUMN `orgId` VARCHAR(191) NULL;
UPDATE `Task` t JOIN `User` u ON t.userId = u.id SET t.orgId = u.orgId;
ALTER TABLE `Task` MODIFY COLUMN `orgId` VARCHAR(191) NOT NULL;
CREATE INDEX `Task_orgId_idx` ON `Task`(`orgId`);
ALTER TABLE `Task` ADD CONSTRAINT `Task_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Add orgId to QuickReplyCategory
ALTER TABLE `QuickReplyCategory` ADD COLUMN `orgId` VARCHAR(191) NULL;
UPDATE `QuickReplyCategory` q JOIN `User` u ON q.userId = u.id SET q.orgId = u.orgId;
ALTER TABLE `QuickReplyCategory` MODIFY COLUMN `orgId` VARCHAR(191) NOT NULL;
CREATE INDEX `QuickReplyCategory_orgId_idx` ON `QuickReplyCategory`(`orgId`);
ALTER TABLE `QuickReplyCategory` ADD CONSTRAINT `QuickReplyCategory_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `QuickReplyCategory` DROP INDEX `QuickReplyCategory_userId_name_key`;
ALTER TABLE `QuickReplyCategory` ADD UNIQUE INDEX `QuickReplyCategory_orgId_name_key`(`orgId`, `name`);

-- Add new ActivityType enum values
ALTER TABLE `ActivityLog` MODIFY COLUMN `action` ENUM(
  'LOGIN', 'LOGOUT',
  'MESSAGE_SENT', 'MESSAGE_RECEIVED', 'BROADCAST_SENT',
  'CONTACT_CREATED', 'CONTACT_UPDATED', 'CONTACT_DELETED', 'CONTACT_IMPORTED',
  'TAG_CREATED', 'TAG_DELETED', 'TAG_ASSIGNED', 'TAG_REMOVED',
  'ORDER_CREATED', 'ORDER_UPDATED', 'ORDER_CANCELLED',
  'INVOICE_CREATED', 'INVOICE_UPDATED', 'INVOICE_SENT', 'PAYMENT_RECEIVED',
  'TASK_CREATED', 'TASK_UPDATED', 'TASK_COMPLETED', 'TASK_ASSIGNED',
  'TICKET_CREATED', 'TICKET_UPDATED', 'TICKET_COMPLETED',
  'AUTOMATION_TRIGGERED', 'AUTOMATION_CREATED', 'AUTOMATION_UPDATED',
  'CAMPAIGN_STARTED', 'CAMPAIGN_COMPLETED',
  'NOTE_ADDED',
  'PRODUCT_CREATED', 'PRODUCT_UPDATED',
  'APPOINTMENT_CREATED', 'APPOINTMENT_UPDATED',
  'QUICK_REPLY_CREATED', 'QUICK_REPLY_USED',
  'USER_INVITED', 'USER_ROLE_CHANGED', 'SETTINGS_UPDATED'
) NOT NULL;

-- Final role enum cleanup (remove USER, keep only valid roles)
ALTER TABLE `User` MODIFY COLUMN `role` ENUM('OWNER', 'ADMIN', 'MANAGER', 'AGENT') NOT NULL DEFAULT 'AGENT';
