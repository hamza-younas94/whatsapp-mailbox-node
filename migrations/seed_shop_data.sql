-- Shop System Seed Data
-- Creates sample shop, products, and customers for testing

-- Create a sample shop
INSERT INTO `Shop` (id, userId, name, type, description, currency, taxRate, address, phone, email, isActive, createdAt, updatedAt)
VALUES 
(
  'shop_demo_001',
  (SELECT id FROM User LIMIT 1),
  'Demo Electronics Store',
  'BOTH',
  'Sample electronics and gadgets store for testing',
  'PKR',
  5.0,
  '123 Main Street, Karachi, Pakistan',
  '+92-300-1234567',
  'demo@electrostore.com',
  true,
  NOW(),
  NOW()
);

-- Create product categories
INSERT INTO `ProductCategory` (id, shopId, name, description, displayOrder, isActive, createdAt, updatedAt)
VALUES
  ('cat_mobile', 'shop_demo_001', 'Mobile Phones', 'Smartphones and feature phones', 1, true, NOW(), NOW()),
  ('cat_laptop', 'shop_demo_001', 'Laptops', 'Notebooks and ultrabooks', 2, true, NOW(), NOW()),
  ('cat_accessories', 'shop_demo_001', 'Accessories', 'Phone cases, chargers, cables', 3, true, NOW(), NOW());

-- Create sample products
INSERT INTO `Product` (id, shopId, categoryId, sku, name, description, price, cost, stock, lowStockThreshold, unit, isActive, createdAt, updatedAt)
VALUES
  (
    'prod_iphone15',
    'shop_demo_001',
    'cat_mobile',
    'IP15-256-BLK',
    'iPhone 15 Pro Max 256GB',
    'Latest Apple flagship with A17 Pro chip, titanium design',
    450000,
    420000,
    15,
    5,
    'pcs',
    true,
    NOW(),
    NOW()
  ),
  (
    'prod_samsung_s24',
    'shop_demo_001',
    'cat_mobile',
    'SAM-S24-128',
    'Samsung Galaxy S24',
    'Flagship Android phone with AI features',
    280000,
    250000,
    20,
    5,
    'pcs',
    true,
    NOW(),
    NOW()
  ),
  (
    'prod_macbook',
    'shop_demo_001',
    'cat_laptop',
    'MBA-M3-512',
    'MacBook Air M3 512GB',
    'Ultra-thin laptop with M3 chip, 18hr battery',
    380000,
    355000,
    8,
    3,
    'pcs',
    true,
    NOW(),
    NOW()
  ),
  (
    'prod_airpods',
    'shop_demo_001',
    'cat_accessories',
    'APP-PRO2',
    'AirPods Pro 2nd Gen',
    'Active noise cancellation, spatial audio',
    75000,
    68000,
    30,
    10,
    'pcs',
    true,
    NOW(),
    NOW()
  ),
  (
    'prod_charger',
    'shop_demo_001',
    'cat_accessories',
    'CHG-20W-USBC',
    '20W USB-C Fast Charger',
    'Compatible with iPhone and Android',
    3500,
    2800,
    50,
    15,
    'pcs',
    true,
    NOW(),
    NOW()
  );

-- Create sample customers
INSERT INTO `Customer` (id, shopId, name, phone, email, address, city, customerGroup, loyaltyPoints, totalPurchases, totalOrders, isActive, createdAt, updatedAt)
VALUES
  (
    'cust_ahmed',
    'shop_demo_001',
    'Ahmed Khan',
    '+92-300-9876543',
    'ahmed.khan@example.com',
    'DHA Phase 5, Karachi',
    'Karachi',
    'vip',
    1500,
    520000,
    3,
    true,
    NOW(),
    NOW()
  ),
  (
    'cust_sara',
    'shop_demo_001',
    'Sara Ali',
    '+92-301-5554444',
    'sara.ali@example.com',
    'Gulberg, Lahore',
    'Lahore',
    'retail',
    500,
    280000,
    2,
    true,
    NOW(),
    NOW()
  ),
  (
    'cust_usman',
    'shop_demo_001',
    'Usman Malik',
    '+92-333-2221111',
    'usman.m@example.com',
    'F-10 Markaz, Islamabad',
    'Islamabad',
    'wholesale',
    2000,
    850000,
    5,
    true,
    NOW(),
    NOW()
  );

-- Create sample sales transactions
INSERT INTO `SalesTransaction` (id, transactionNumber, shopId, customerId, status, totalAmount, discountAmount, taxAmount, finalAmount, paidAmount, paymentStatus, paymentMethod, notes, createdBy, createdAt, updatedAt)
VALUES
  (
    'txn_001',
    'TXN-000001',
    'shop_demo_001',
    'cust_ahmed',
    'COMPLETED',
    450000,
    0,
    22500,
    472500,
    472500,
    'paid',
    'cash',
    'iPhone 15 Pro Max - Black - Walk-in customer',
    (SELECT id FROM User LIMIT 1),
    DATE_SUB(NOW(), INTERVAL 5 DAY),
    DATE_SUB(NOW(), INTERVAL 5 DAY)
  ),
  (
    'txn_002',
    'TXN-000002',
    'shop_demo_001',
    'cust_sara',
    'COMPLETED',
    280000,
    10000,
    13500,
    283500,
    283500,
    'paid',
    'bank_transfer',
    'Samsung S24 - VIP discount applied',
    (SELECT id FROM User LIMIT 1),
    DATE_SUB(NOW(), INTERVAL 3 DAY),
    DATE_SUB(NOW(), INTERVAL 3 DAY)
  ),
  (
    'txn_003',
    'TXN-000003',
    'shop_demo_001',
    'cust_usman',
    'PROCESSING',
    390000,
    5000,
    19250,
    404250,
    200000,
    'partial',
    'cash',
    'MacBook Air + AirPods bundle - Partial payment received',
    (SELECT id FROM User LIMIT 1),
    DATE_SUB(NOW(), INTERVAL 1 DAY),
    DATE_SUB(NOW(), INTERVAL 1 DAY)
  );

-- Create transaction items
INSERT INTO `TransactionItem` (id, transactionId, productId, quantity, unitPrice, discount, taxRate, totalPrice, createdAt, updatedAt)
VALUES
  ('item_001', 'txn_001', 'prod_iphone15', 1, 450000, 0, 5.0, 450000, DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_SUB(NOW(), INTERVAL 5 DAY)),
  ('item_002', 'txn_002', 'prod_samsung_s24', 1, 280000, 10000, 5.0, 270000, DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_SUB(NOW(), INTERVAL 3 DAY)),
  ('item_003', 'txn_003', 'prod_macbook', 1, 380000, 5000, 5.0, 375000, DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY)),
  ('item_004', 'txn_003', 'prod_airpods', 1, 75000, 0, 5.0, 75000, DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY));

-- Create stock movements
INSERT INTO `StockMovement` (id, productId, type, quantity, reason, reference, createdBy, createdAt, updatedAt)
VALUES
  ('mov_001', 'prod_iphone15', 'SALE', -1, 'Sale to Ahmed Khan', 'TXN-000001', (SELECT id FROM User LIMIT 1), DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_SUB(NOW(), INTERVAL 5 DAY)),
  ('mov_002', 'prod_samsung_s24', 'SALE', -1, 'Sale to Sara Ali', 'TXN-000002', (SELECT id FROM User LIMIT 1), DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_SUB(NOW(), INTERVAL 3 DAY)),
  ('mov_003', 'prod_macbook', 'SALE', -1, 'Sale to Usman Malik', 'TXN-000003', (SELECT id FROM User LIMIT 1), DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY)),
  ('mov_004', 'prod_airpods', 'SALE', -1, 'Bundle with MacBook', 'TXN-000003', (SELECT id FROM User LIMIT 1), DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY));

SELECT '✅ Shop system seed data loaded successfully!' AS Status;
SELECT 'Shop: Demo Electronics Store' AS Result;
SELECT '5 Products created (iPhones, Samsung, MacBook, AirPods, Charger)' AS Products;
SELECT '3 Customers created (Ahmed, Sara, Usman)' AS Customers;
SELECT '3 Transactions created (2 completed, 1 processing)' AS Transactions;
