-- Shop System Migration
-- Complete system for hardware, computer, online shops

-- Product Categories (nested support)
CREATE TABLE IF NOT EXISTS `ProductCategory` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `parentId` VARCHAR(191) NULL,
  `imageUrl` VARCHAR(500) NULL,
  `displayOrder` INT NOT NULL DEFAULT 0,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `shopId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `ProductCategory_shopId_idx`(`shopId`),
  INDEX `ProductCategory_parentId_idx`(`parentId`),
  CONSTRAINT `ProductCategory_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `Shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ProductCategory_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `ProductCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Product Variants (sizes, colors, etc)
CREATE TABLE IF NOT EXISTS `ProductVariant` (
  `id` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `sku` VARCHAR(191) NULL UNIQUE,
  `price` DECIMAL(10,2) NOT NULL,
  `stock` INT NOT NULL DEFAULT 0,
  `attributes` JSON NULL,
  `imageUrl` VARCHAR(500) NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `ProductVariant_productId_idx`(`productId`),
  INDEX `ProductVariant_sku_idx`(`sku`),
  CONSTRAINT `ProductVariant_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Product Images
CREATE TABLE IF NOT EXISTS `ProductImage` (
  `id` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NOT NULL,
  `url` VARCHAR(500) NOT NULL,
  `altText` VARCHAR(191) NULL,
  `isPrimary` BOOLEAN NOT NULL DEFAULT false,
  `displayOrder` INT NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `ProductImage_productId_idx`(`productId`),
  CONSTRAINT `ProductImage_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Customers (linked to WhatsApp contacts)
CREATE TABLE IF NOT EXISTS `Customer` (
  `id` VARCHAR(191) NOT NULL,
  `shopId` VARCHAR(191) NOT NULL,
  `contactId` VARCHAR(191) NULL,
  `name` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(20) NOT NULL,
  `email` VARCHAR(191) NULL,
  `address` TEXT NULL,
  `city` VARCHAR(191) NULL,
  `notes` TEXT NULL,
  `customerGroup` VARCHAR(50) NOT NULL DEFAULT 'retail',
  `loyaltyPoints` INT NOT NULL DEFAULT 0,
  `totalPurchases` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `totalOrders` INT NOT NULL DEFAULT 0,
  `lastPurchaseAt` DATETIME(3) NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `tags` JSON NULL,
  `metadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `Customer_shopId_idx`(`shopId`),
  INDEX `Customer_contactId_idx`(`contactId`),
  INDEX `Customer_phone_idx`(`phone`),
  CONSTRAINT `Customer_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `Shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `Customer_contactId_fkey` FOREIGN KEY (`contactId`) REFERENCES `Contact`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sales Transactions (Simple orders)
CREATE TABLE IF NOT EXISTS `SalesTransaction` (
  `id` VARCHAR(191) NOT NULL,
  `transactionNumber` VARCHAR(50) NOT NULL UNIQUE,
  `shopId` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NOT NULL,
  `status` ENUM('DRAFT', 'CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `totalAmount` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `discountAmount` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `taxAmount` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `finalAmount` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `paidAmount` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `paymentStatus` ENUM('UNPAID', 'PARTIAL', 'PAID') NOT NULL DEFAULT 'UNPAID',
  `paymentMethod` VARCHAR(50) NULL,
  `notes` TEXT NULL,
  `deliveryAddress` TEXT NULL,
  `deliveryDate` DATETIME(3) NULL,
  `createdBy` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `SalesTransaction_shopId_idx`(`shopId`),
  INDEX `SalesTransaction_customerId_idx`(`customerId`),
  INDEX `SalesTransaction_status_idx`(`status`),
  INDEX `SalesTransaction_createdAt_idx`(`createdAt`),
  CONSTRAINT `SalesTransaction_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `Shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `SalesTransaction_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `SalesTransaction_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Transaction Items
CREATE TABLE IF NOT EXISTS `TransactionItem` (
  `id` VARCHAR(191) NOT NULL,
  `transactionId` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NOT NULL,
  `variantId` VARCHAR(191) NULL,
  `quantity` INT NOT NULL,
  `unitPrice` DECIMAL(10,2) NOT NULL,
  `discount` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `taxRate` DECIMAL(5,2) NOT NULL DEFAULT 0,
  `totalPrice` DECIMAL(10,2) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `TransactionItem_transactionId_idx`(`transactionId`),
  INDEX `TransactionItem_productId_idx`(`productId`),
  CONSTRAINT `TransactionItem_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `SalesTransaction`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `TransactionItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `TransactionItem_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `ProductVariant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Stock Movements
CREATE TABLE IF NOT EXISTS `StockMovement` (
  `id` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NOT NULL,
  `variantId` VARCHAR(191) NULL,
  `type` ENUM('IN', 'OUT', 'ADJUSTMENT', 'TRANSFER', 'SALE', 'RETURN') NOT NULL,
  `quantity` INT NOT NULL,
  `reason` VARCHAR(191) NULL,
  `reference` VARCHAR(191) NULL,
  `location` VARCHAR(191) NULL,
  `createdBy` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `StockMovement_productId_idx`(`productId`),
  INDEX `StockMovement_createdAt_idx`(`createdAt`),
  CONSTRAINT `StockMovement_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `StockMovement_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `ProductVariant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `StockMovement_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Update Product table to add category
ALTER TABLE `Product` ADD COLUMN IF NOT EXISTS `categoryId` VARCHAR(191) NULL AFTER `shopId`;
ALTER TABLE `Product` ADD INDEX IF NOT EXISTS `Product_categoryId_idx`(`categoryId`);
ALTER TABLE `Product` ADD CONSTRAINT `Product_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ProductCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Update Product table for better inventory
ALTER TABLE `Product` MODIFY COLUMN `stock` INT NOT NULL DEFAULT 0;
ALTER TABLE `Product` ADD COLUMN IF NOT EXISTS `lowStockThreshold` INT NULL AFTER `stock`;
ALTER TABLE `Product` ADD COLUMN IF NOT EXISTS `unit` VARCHAR(50) NULL AFTER `lowStockThreshold`;
