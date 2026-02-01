# Automation System - Complete Guide

## What Are Automations?

Automations are **smart workflows** that automatically respond to events in your WhatsApp business. They save time by handling repetitive tasks without human intervention.

## How It Works

### 1. **Triggers** (When to run)
The event that starts the automation:
- `message_received` - When you receive a message
- `contact_created` - When a new contact is added
- `message_sent` - After you send a message
- `tag_added` - When a tag is added to a contact

### 2. **Conditions** (Filter criteria)
Rules that must match for the automation to run:
- Message contains specific keywords
- Time of day (business hours vs after hours)
- Contact has specific tags
- First message from a new contact

### 3. **Actions** (What to do)
Tasks to perform automatically:
- Send a message
- Add tags to contact
- Send to a segment
- Create a note
- Trigger another automation

## Sample Automations Included

We've created **6 ready-to-use automations** for you:

### 1. **Welcome New Customers**
- **Trigger**: First message from new contact
- **Action**: Send welcome message + tag as "New Customer"
- **Use**: Makes great first impression

### 2. **After Hours Auto-Reply**
- **Trigger**: Message received outside 9 AM - 6 PM
- **Action**: Send "We'll respond during business hours" message
- **Use**: Set customer expectations

### 3. **Product Inquiry Handler**
- **Trigger**: Message contains "price", "product", "buy", etc.
- **Action**: Tag as "Product Inquiry" + send catalog info
- **Use**: Quickly identify sales opportunities

### 4. **Support Request Handler**
- **Trigger**: Message contains "help", "support", "issue", etc.
- **Action**: Tag as "Support" + acknowledge the request
- **Use**: Prioritize support tickets

### 5. **Order Confirmation**
- **Trigger**: Message contains "order confirmed", "place order", etc.
- **Action**: Tag as "Order Placed" + send thank you
- **Use**: Track orders automatically

### 6. **VIP Customer Recognition**
- **Trigger**: Message contains "regular customer", "bought before", etc.
- **Action**: Tag as "VIP Customer" + send appreciation message
- **Use**: Give special treatment to loyal customers

## How to Access

1. **Web UI**: http://152.42.216.141:3000/automation.html
2. **Navigation**: Click "Automations" in the main menu
3. **API**: `/api/v1/automations` endpoint

## Load Sample Data

To add the 6 sample automations to your database:

```bash
# On your server
cd /root/whatsapp-mailbox-node
mysql -h 127.0.0.1 -u root -p whatsapp_mailbox < migrations/seed_automations.sql
```

Or run this quick command:
```bash
ssh -i ~/.ssh/do root@152.42.216.141 'cd /root/whatsapp-mailbox-node && mysql -h 127.0.0.1 -u root -p$(grep DATABASE_PASSWORD .env | cut -d= -f2) whatsapp_mailbox < migrations/seed_automations.sql'
```

## Create Your Own Automation

### Via Web UI
1. Click "New Automation"
2. Give it a name and description
3. Choose a trigger (when to run)
4. Add conditions (filters)
5. Define actions (what to do)
6. Save and activate

### Via API
```bash
curl -X POST http://152.42.216.141:3000/api/v1/automations \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Discount Code Request",
    "description": "Send discount code when requested",
    "trigger": "message_received",
    "conditions": {
      "messageContains": ["discount", "coupon", "promo code"]
    },
    "actions": [
      {
        "type": "send_message",
        "message": "Use code SAVE20 for 20% off your next order!"
      },
      {
        "type": "add_tag",
        "tagName": "Discount Seeker"
      }
    ],
    "isActive": true,
    "priority": 10
  }'
```

## Automation Examples

### Example 1: Auto-respond to Specific Keywords
```json
{
  "trigger": "message_received",
  "conditions": {
    "messageContains": ["shipping", "delivery", "track order"]
  },
  "actions": [
    {
      "type": "send_message",
      "message": "Track your order at: https://yourstore.com/track"
    }
  ]
}
```

### Example 2: Business Hours Responder
```json
{
  "trigger": "message_received",
  "conditions": {
    "timeCondition": {
      "type": "outside_hours",
      "businessHours": {
        "start": "09:00",
        "end": "18:00",
        "days": ["monday", "tuesday", "wednesday", "thursday", "friday"]
      }
    }
  },
  "actions": [
    {
      "type": "send_message",
      "message": "We're closed. Business hours: 9 AM - 6 PM, Mon-Fri"
    }
  ]
}
```

### Example 3: Tag VIP Customers
```json
{
  "trigger": "message_received",
  "conditions": {
    "messageContains": ["vip", "premium", "gold member"]
  },
  "actions": [
    {
      "type": "add_tag",
      "tagName": "VIP"
    },
    {
      "type": "send_message",
      "message": "Welcome, valued VIP customer! Priority support activated."
    }
  ]
}
```

## Integration with Shop System

Use automations with your shop:

### Low Stock Alert
```javascript
// Automatically trigger when product stock is low
{
  "trigger": "stock_low",
  "conditions": {
    "productStock": { "lessThan": 5 }
  },
  "actions": [
    {
      "type": "send_message",
      "to": "shop_owner",
      "message": "⚠️ Low stock alert for Product XYZ"
    }
  ]
}
```

### Order Confirmation to Customer
```javascript
// After sales transaction is created
{
  "trigger": "transaction_created",
  "actions": [
    {
      "type": "send_message",
      "to": "customer",
      "message": "✅ Order #{{transactionNumber}} confirmed! Total: PKR {{amount}}"
    }
  ]
}
```

### Payment Reminder
```javascript
// When payment is pending
{
  "trigger": "transaction_pending",
  "conditions": {
    "paymentStatus": "unpaid",
    "hoursSince": 24
  },
  "actions": [
    {
      "type": "send_message",
      "message": "Gentle reminder: Your order #{{orderNumber}} is awaiting payment"
    }
  ]
}
```

## Best Practices

1. **Start Simple**: Use the sample automations first
2. **Test Before Activating**: Create with `isActive: false`, test, then activate
3. **Set Priority**: Lower numbers run first (1 = highest priority)
4. **Use Specific Keywords**: More specific = fewer false triggers
5. **Monitor Executions**: Check the "Total Executions" counter
6. **Don't Overlap**: Avoid multiple automations with same trigger/conditions

## API Endpoints

```bash
# Get all automations
GET /api/v1/automations

# Create automation
POST /api/v1/automations

# Update automation
PUT /api/v1/automations/:id

# Delete automation
DELETE /api/v1/automations/:id

# Toggle active status
PATCH /api/v1/automations/:id/toggle

# Get execution history
GET /api/v1/automations/:id/executions
```

## Database Schema

```sql
Automation
├── id (UUID)
├── name (string)
├── description (text)
├── trigger (enum: message_received, contact_created, etc.)
├── conditions (JSON: filters and rules)
├── actions (JSON: array of actions to perform)
├── isActive (boolean)
├── priority (integer: lower = higher priority)
├── executionCount (integer: how many times it ran)
└── lastExecutedAt (datetime)
```

## Troubleshooting

### Automation Not Firing
- Check if `isActive` is true
- Verify conditions match your test case
- Check priority (higher priority automations may block lower ones)
- Look for execution errors in logs

### Wrong Message Sent
- Review your conditions - they may be too broad
- Check keyword matching (case-insensitive)
- Test with exact message text

### Too Many Triggers
- Make conditions more specific
- Increase priority number (lower priority)
- Add time delays between executions

## Advanced Features

### Chained Automations
Trigger one automation from another:
```json
{
  "actions": [
    {
      "type": "trigger_automation",
      "automationId": "other-automation-id"
    }
  ]
}
```

### Conditional Actions
Run different actions based on conditions:
```json
{
  "actions": [
    {
      "type": "conditional",
      "if": { "contactTag": "VIP" },
      "then": { "type": "send_message", "message": "VIP response" },
      "else": { "type": "send_message", "message": "Regular response" }
    }
  ]
}
```

### Scheduled Delays
Wait before executing action:
```json
{
  "actions": [
    {
      "type": "delay",
      "minutes": 5
    },
    {
      "type": "send_message",
      "message": "Follow-up message after 5 minutes"
    }
  ]
}
```

## Real-World Use Cases

### E-commerce Store
1. Welcome message to new customers
2. Abandoned cart reminder (24 hours later)
3. Order confirmation
4. Shipping update
5. Delivery confirmation
6. Review request (7 days after delivery)

### Support System
1. Auto-acknowledge support tickets
2. Tag by issue type (billing, technical, general)
3. Escalate urgent issues
4. Send knowledge base articles
5. Follow-up after resolution

### Lead Generation
1. Qualify leads with questions
2. Tag by interest (product A, product B)
3. Send relevant information
4. Schedule follow-up
5. Handoff to sales team

---

**Ready to automate?** Load the sample data and start testing! The system learns your patterns and makes your WhatsApp business smarter every day. 🤖
