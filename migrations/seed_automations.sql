-- Seed data for Automations
-- Sample automations matching the current schema

-- Sample Automation 1: Welcome New Customers
INSERT INTO `Automation` (id, userId, name, `trigger`, actions, isActive, createdAt, updatedAt)
VALUES 
(
  UUID(),
  (SELECT id FROM User LIMIT 1),
  'Welcome New Customers',
  'MESSAGE_RECEIVED',
  JSON_ARRAY(
    JSON_OBJECT('type', 'send_message', 'message', 'Welcome! 👋 Thank you for contacting us. How can we help you today?'),
    JSON_OBJECT('type', 'add_tag', 'tagName', 'New Customer')
  ),
  true,
  NOW(),
  NOW()
);

-- Sample Automation 2: Product Inquiry
INSERT INTO `Automation` (id, userId, name, `trigger`, actions, isActive, createdAt, updatedAt)
VALUES 
(
  UUID(),
  (SELECT id FROM User LIMIT 1),
  'Product Inquiry Auto-Tag',
  'MESSAGE_RECEIVED',
  JSON_ARRAY(
    JSON_OBJECT('type', 'add_tag', 'tagName', 'Product Inquiry'),
    JSON_OBJECT('type', 'send_message', 'message', '📦 Thank you! A team member will send you our catalog shortly.')
  ),
  true,
  NOW(),
  NOW()
);

-- Sample Automation 3: Support Requests
INSERT INTO `Automation` (id, userId, name, `trigger`, actions, isActive, createdAt, updatedAt)
VALUES 
(
  UUID(),
  (SELECT id FROM User LIMIT 1),
  'Support Request Handler',
  'MESSAGE_RECEIVED',
  JSON_ARRAY(
    JSON_OBJECT('type', 'add_tag', 'tagName', 'Support'),
    JSON_OBJECT('type', 'send_message', 'message', '🛠️ Support team notified. Please describe your issue.')
  ),
  true,
  NOW(),
  NOW()
);

-- Create tags (use IGNORE to skip if exists)
INSERT IGNORE INTO `Tag` (id, userId, name, color, createdAt)
VALUES
  (UUID(), (SELECT id FROM User LIMIT 1), 'New Customer', '#3B82F6', NOW()),
  (UUID(), (SELECT id FROM User LIMIT 1), 'Product Inquiry', '#8B5CF6', NOW()),
  (UUID(), (SELECT id FROM User LIMIT 1), 'Support', '#EF4444', NOW()),
  (UUID(), (SELECT id FROM User LIMIT 1), 'VIP Customer', '#F59E0B', NOW());

SELECT '✅ 4 automations and 4 tags created!' AS Status;
