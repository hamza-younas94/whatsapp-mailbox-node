-- Seed data for Automations
-- This provides sample automations to demonstrate the system

-- Sample Automation 1: Welcome Message for New Contacts
INSERT INTO `Automation` (id, name, description, trigger, conditions, actions, isActive, priority, createdBy, createdAt, updatedAt)
VALUES 
(
  UUID(),
  'Welcome New Customers',
  'Send a welcome message to new contacts when they first message us',
  'message_received',
  JSON_OBJECT(
    'matchType', 'first_message',
    'fromNewContact', true
  ),
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
  1,
  (SELECT id FROM User LIMIT 1),
  NOW(),
  NOW()
);

-- Sample Automation 2: Auto-reply for Business Hours
INSERT INTO `Automation` (id, name, description, trigger, conditions, actions, isActive, priority, createdBy, createdAt, updatedAt)
VALUES 
(
  UUID(),
  'After Hours Auto-Reply',
  'Send automatic reply when messages arrive outside business hours',
  'message_received',
  JSON_OBJECT(
    'timeCondition', JSON_OBJECT(
      'type', 'outside_hours',
      'businessHours', JSON_OBJECT(
        'start', '09:00',
        'end', '18:00',
        'days', JSON_ARRAY('monday', 'tuesday', 'wednesday', 'thursday', 'friday')
      )
    )
  ),
  JSON_ARRAY(
    JSON_OBJECT(
      'type', 'send_message',
      'message', '⏰ Thank you for your message. Our business hours are 9 AM - 6 PM, Monday to Friday. We will respond when we are back!'
    )
  ),
  true,
  2,
  (SELECT id FROM User LIMIT 1),
  NOW(),
  NOW()
);

-- Sample Automation 3: Product Inquiry Handler
INSERT INTO `Automation` (id, name, description, trigger, conditions, actions, isActive, priority, createdBy, createdAt, updatedAt)
VALUES 
(
  UUID(),
  'Product Inquiry - Auto Tag',
  'Tag contacts who ask about products or pricing',
  'message_received',
  JSON_OBJECT(
    'messageContains', JSON_ARRAY('price', 'product', 'buy', 'order', 'purchase', 'cost', 'how much')
  ),
  JSON_ARRAY(
    JSON_OBJECT(
      'type', 'add_tag',
      'tagName', 'Product Inquiry'
    ),
    JSON_OBJECT(
      'type', 'send_message',
      'message', '📦 Thank you for your interest in our products! A team member will send you our catalog and pricing shortly.'
    )
  ),
  true,
  3,
  (SELECT id FROM User LIMIT 1),
  NOW(),
  NOW()
);

-- Sample Automation 4: Support Request Handler
INSERT INTO `Automation` (id, name, description, trigger, conditions, actions, isActive, priority, createdBy, createdAt, updatedAt)
VALUES 
(
  UUID(),
  'Support Request Handler',
  'Tag and acknowledge support requests',
  'message_received',
  JSON_OBJECT(
    'messageContains', JSON_ARRAY('help', 'support', 'issue', 'problem', 'not working', 'error', 'broken')
  ),
  JSON_ARRAY(
    JSON_OBJECT(
      'type', 'add_tag',
      'tagName', 'Support'
    ),
    JSON_OBJECT(
      'type', 'send_message',
      'message', '🛠️ We are here to help! Our support team has been notified and will assist you shortly. Please describe your issue in detail.'
    )
  ),
  true,
  4,
  (SELECT id FROM User LIMIT 1),
  NOW(),
  NOW()
);

-- Sample Automation 5: Thank You for Orders
INSERT INTO `Automation` (id, name, description, trigger, conditions, actions, isActive, priority, createdBy, createdAt, updatedAt)
VALUES 
(
  UUID(),
  'Order Confirmation',
  'Send thank you message when order keywords detected',
  'message_received',
  JSON_OBJECT(
    'messageContains', JSON_ARRAY('order confirmed', 'i want to order', 'place order', 'confirm order')
  ),
  JSON_ARRAY(
    JSON_OBJECT(
      'type', 'add_tag',
      'tagName', 'Order Placed'
    ),
    JSON_OBJECT(
      'type', 'send_message',
      'message', '✅ Thank you for your order! We will process it and send you tracking details soon. Order confirmation will be sent shortly.'
    )
  ),
  true,
  5,
  (SELECT id FROM User LIMIT 1),
  NOW(),
  NOW()
);

-- Sample Automation 6: VIP Customer Auto-Tag
INSERT INTO `Automation` (id, name, description, trigger, conditions, actions, isActive, priority, createdBy, createdAt, updatedAt)
VALUES 
(
  UUID(),
  'VIP Customer Recognition',
  'Tag contacts who mention they are returning customers',
  'message_received',
  JSON_OBJECT(
    'messageContains', JSON_ARRAY('regular customer', 'bought before', 'previous order', 'last time', 'vip')
  ),
  JSON_ARRAY(
    JSON_OBJECT(
      'type', 'add_tag',
      'tagName', 'VIP Customer'
    ),
    JSON_OBJECT(
      'type', 'send_message',
      'message', '⭐ Welcome back, valued customer! We appreciate your continued support. How can we serve you today?'
    )
  ),
  true,
  6,
  (SELECT id FROM User LIMIT 1),
  NOW(),
  NOW()
);

-- Create tags if they don't exist
INSERT IGNORE INTO `Tag` (id, name, color, createdBy, createdAt, updatedAt)
VALUES
  (UUID(), 'New Customer', '#3B82F6', (SELECT id FROM User LIMIT 1), NOW(), NOW()),
  (UUID(), 'Product Inquiry', '#8B5CF6', (SELECT id FROM User LIMIT 1), NOW(), NOW()),
  (UUID(), 'Support', '#EF4444', (SELECT id FROM User LIMIT 1), NOW(), NOW()),
  (UUID(), 'Order Placed', '#10B981', (SELECT id FROM User LIMIT 1), NOW(), NOW()),
  (UUID(), 'VIP Customer', '#F59E0B', (SELECT id FROM User LIMIT 1), NOW(), NOW());

SELECT 'Automation seed data inserted successfully!' AS status;
