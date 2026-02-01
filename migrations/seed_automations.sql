-- Seed data for Automations
-- This provides sample automations matching the current schema

-- Sample Automation 1: Welcome New Customers
INSERT INTO `Automation` (id, userId, name, `trigger`, actions, isActive, createdAt, updatedAt)
VALUES 
(
  UUID(),
  (SELECT id FROM User LIMIT 1),
  'Welcome New Customers',
  'MESSAGE_RECEIVED',
  JSON_ARRAY(
    JSON_OBJECT(
      'type', 'send_message',
      'message', 'Welcome! 👋 Thank you for contacting us. How can we help you today?'
    ),
    JSON_OBJECT(
      'type', 'add_tag',
      'tagName', 'New Customer'
    )
  ),
  true,
  NOW(),
  NOW()
);

-- Sample Automation 2: Product Inquiry Handler
INSERT INTO `Automation` (id, userId, name, `trigger`, actions, isActive, createdAt, updatedAt)
VALUES 
(
  UUID(),
  (SELECT id FROM User LIMIT 1),
  'Product Inquiry Auto-Tag',
  'MESSAGE_RECEIVED',
  JSON_ARRAY(
    JSON_OBJECT(
      'type', 'add_tag',
      'tagName', 'Product Inquiry'
    ),
    JSON_OBJECT(
      'type', 'send_message',
      'message', '📦 Thank you for your interest! A team member will send you our catalog shortly.'
    )
  ),
  true,
  NOW(),
  NOW()
);

-- Sample Automation 3: Support Request Handler
INSERT INTO `Automation` (id, userId, name, `trigger`, actions, isActive, createdAt, updatedAt)
VALUES 
(
  UUID(),
  (SELECT id FROM User LIMIT 1),
  'Support Request Handler',
  'MESSAGE_RECEIVED',
  JSON_ARRAY(
    JSON_OBJECT(
      'type', 'add_tag',
      'tagName', 'Support'
    ),
    JSON_OBJECT(
      'type', 'send_message',
      'message', '🛠️ Support team has been notified. Please describe your issue in detail.'
    )
  ),
  true,
  NOW(),
  NOW()
);

-- Sample Automation 4: VIP Customer Recognition
INSERT INTO `Automation` (id, userId, name, `trigger`, actions, isActive, createdAt, updatedAt)
VALUES 
(
  UUID(),
  (SELECT id FROM User LIMIT 1),
  'VIP Customer Tag',
  'MESSAGE_RECEIVED',
  JSON_ARRAY(
    JSON_OBJECT(
      'type', 'add_tag',
      'tagName', 'VIP Customer'
    ),
    JSON_OBJECT(
      'type', 'send_message',
      'message', '⭐ Welcome back, valued customer! How can we serve you today?'
    )
  ),
  true,
  NOW(),
  NOW()
);

-- Create tags if they don't exist
INSERT IGNORE INTO `Tag` (id, name, color, createdBy, createdAt, updatedAt)
VALUES
  (UUID(), 'New Customer', '#3B82F6', (SELECT id FROM User LIMIT 1), NOW(), NOW()),
  (UUID(), 'Product Inquiry', '#8B5CF6', (SELECT id FROM User LIMIT 1), NOW(), NOW()),
  (UUID(), 'Support', '#EF4444', (SELECT id FROM User LIMIT 1), NOW(), NOW()),
  (UUID(), 'VIP Customer', '#F59E0B', (SELECT id FROM User LIMIT 1), NOW(), NOW());

SELECT '✅ Automation seed data inserted successfully!' AS status;
