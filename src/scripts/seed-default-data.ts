// src/scripts/seed-default-data.ts
// Seeds default tags, segments, quick replies, drip campaigns, and automations

import { PrismaClient, DripTriggerType } from '@prisma/client';

const prisma = new PrismaClient();

interface DefaultQuickReply {
  shortcut: string;
  title: string;
  content: string;
  category: string;
}

interface DefaultTag {
  name: string;
  color: string;
}

interface DefaultSegment {
  name: string;
  criteria: any;
}

interface DefaultAutomation {
  name: string;
  trigger: string;
  actions: any;
  isActive: boolean;
}

interface DefaultDripCampaign {
  name: string;
  description: string;
  steps: Array<{
    sequence: number;
    delayHours: number;
    message: string;
  }>;
  triggerType: DripTriggerType;
  isActive: boolean;
}

// Default Quick Replies with fuzzy-matchable shortcuts
const defaultQuickReplies: DefaultQuickReply[] = [
  // Greetings
  {
    shortcut: 'hello',
    title: 'Welcome Greeting',
    content: 'Hello! 👋 Thank you for reaching out. How can I assist you today?',
    category: 'greetings',
  },
  {
    shortcut: 'hi',
    title: 'Quick Hi',
    content: 'Hi there! Thanks for your message. How may I help you?',
    category: 'greetings',
  },
  {
    shortcut: 'salam',
    title: 'Salam Greeting',
    content: 'Wa alaikum assalam! 🙏 How can I help you today?',
    category: 'greetings',
  },
  
  // Business Hours & Availability
  {
    shortcut: 'hours',
    title: 'Business Hours',
    content: 'Our business hours are:\n📅 Monday - Friday: 9 AM - 6 PM\n📅 Saturday: 10 AM - 4 PM\n📅 Sunday: Closed\n\nWe\'ll respond to your message as soon as possible!',
    category: 'info',
  },
  {
    shortcut: 'busy',
    title: 'Currently Busy',
    content: 'Thanks for your message! I\'m currently with another customer but will get back to you within 30 minutes. 🙏',
    category: 'info',
  },
  {
    shortcut: 'away',
    title: 'Away Message',
    content: 'Hi! I\'m currently away from my desk. I\'ll respond to your message as soon as I return. Thank you for your patience! 🙏',
    category: 'info',
  },
  
  // Pricing & Products
  {
    shortcut: 'price',
    title: 'Price Inquiry',
    content: 'Thank you for your interest! 💰\n\nCould you please specify which product/service you\'re asking about so I can provide accurate pricing information?',
    category: 'sales',
  },
  {
    shortcut: 'catalog',
    title: 'Product Catalog',
    content: 'Here\'s our product catalog! 📦\n\nPlease let me know which items interest you, and I\'ll provide more details including pricing and availability.',
    category: 'sales',
  },
  {
    shortcut: 'discount',
    title: 'Discount Info',
    content: '🎉 Great news! We currently have the following offers:\n\n• 10% off on first purchase\n• Free shipping on orders over $50\n• Bulk discounts available\n\nWould you like more details?',
    category: 'sales',
  },
  
  // Order & Shipping
  {
    shortcut: 'order',
    title: 'Order Status',
    content: 'To check your order status, please provide your:\n📝 Order number\n📱 Phone number used for the order\n\nI\'ll look it up right away!',
    category: 'support',
  },
  {
    shortcut: 'shipping',
    title: 'Shipping Info',
    content: '📦 Shipping Information:\n\n• Standard delivery: 3-5 business days\n• Express delivery: 1-2 business days\n• Free shipping on orders over $50\n\nWould you like to know more?',
    category: 'support',
  },
  {
    shortcut: 'track',
    title: 'Track Order',
    content: 'To track your order, please share your order number and I\'ll provide you with the tracking information right away! 📍',
    category: 'support',
  },
  
  // Payment
  {
    shortcut: 'payment',
    title: 'Payment Methods',
    content: '💳 We accept the following payment methods:\n\n• Cash on Delivery (COD)\n• Bank Transfer\n• Credit/Debit Cards\n• EasyPaisa / JazzCash\n\nWhich method works best for you?',
    category: 'payment',
  },
  {
    shortcut: 'bank',
    title: 'Bank Details',
    content: '🏦 Bank Account Details:\n\nBank: [Your Bank Name]\nAccount Title: [Your Name]\nAccount Number: [XXXX-XXXX-XXXX]\nIBAN: [PKXX-XXXX-XXXX-XXXX]\n\nPlease share the receipt after transfer.',
    category: 'payment',
  },
  {
    shortcut: 'cod',
    title: 'COD Available',
    content: '✅ Yes, Cash on Delivery (COD) is available!\n\nYou can pay when you receive your order. Would you like to proceed with your order?',
    category: 'payment',
  },
  
  // Support & Help
  {
    shortcut: 'help',
    title: 'Help Menu',
    content: '🆘 How can I help you?\n\nType one of these:\n• "price" - Product prices\n• "order" - Check order status\n• "shipping" - Delivery info\n• "payment" - Payment methods\n• "hours" - Business hours\n\nOr just tell me what you need!',
    category: 'support',
  },
  {
    shortcut: 'thanks',
    title: 'Thank You',
    content: 'You\'re welcome! 😊 Is there anything else I can help you with?',
    category: 'greetings',
  },
  {
    shortcut: 'bye',
    title: 'Goodbye',
    content: 'Thank you for contacting us! Have a great day! 👋\n\nFeel free to reach out anytime you need assistance.',
    category: 'greetings',
  },
  
  // Issues & Complaints
  {
    shortcut: 'sorry',
    title: 'Apology',
    content: 'I\'m truly sorry for the inconvenience caused. 🙏\n\nPlease share more details about the issue, and I\'ll do my best to resolve it quickly.',
    category: 'support',
  },
  {
    shortcut: 'refund',
    title: 'Refund Policy',
    content: '💰 Refund Policy:\n\n• Returns accepted within 7 days\n• Product must be unused and in original packaging\n• Refund processed within 3-5 business days\n\nWould you like to initiate a return?',
    category: 'support',
  },
  
  // Follow-up
  {
    shortcut: 'followup',
    title: 'Follow Up',
    content: 'Hi! Just following up on our previous conversation. Have you had a chance to consider our offer? Let me know if you have any questions! 😊',
    category: 'sales',
  },
  {
    shortcut: 'remind',
    title: 'Reminder',
    content: 'Hi! This is a gentle reminder about your pending order/inquiry. Would you like to proceed? I\'m here to help! 🙏',
    category: 'sales',
  },
];

// Default Tags
const defaultTags: DefaultTag[] = [
  { name: 'VIP', color: '#FFD700' },
  { name: 'New Lead', color: '#4CAF50' },
  { name: 'Hot Lead', color: '#FF5722' },
  { name: 'Cold Lead', color: '#2196F3' },
  { name: 'Customer', color: '#9C27B0' },
  { name: 'Pending Payment', color: '#FF9800' },
  { name: 'Order Placed', color: '#00BCD4' },
  { name: 'Shipped', color: '#8BC34A' },
  { name: 'Delivered', color: '#4CAF50' },
  { name: 'Support', color: '#F44336' },
  { name: 'Resolved', color: '#607D8B' },
  { name: 'Follow Up', color: '#E91E63' },
  { name: 'Do Not Disturb', color: '#795548' },
  { name: 'Wholesale', color: '#3F51B5' },
  { name: 'Referral', color: '#009688' },
];

// Default Segments
const defaultSegments: DefaultSegment[] = [
  {
    name: 'Active Customers',
    criteria: {
      operator: 'AND',
      conditions: [
        { field: 'lastMessageAt', operator: 'within_days', value: 7 },
        { field: 'messageCount', operator: 'greater_than', value: 1 },
      ],
    },
  },
  {
    name: 'Inactive Customers',
    criteria: {
      operator: 'AND',
      conditions: [
        { field: 'lastMessageAt', operator: 'older_than_days', value: 30 },
      ],
    },
  },
  {
    name: 'VIP Customers',
    criteria: {
      operator: 'OR',
      conditions: [
        { field: 'tags', operator: 'contains', value: 'VIP' },
        { field: 'messageCount', operator: 'greater_than', value: 50 },
      ],
    },
  },
  {
    name: 'New Leads This Week',
    criteria: {
      operator: 'AND',
      conditions: [
        { field: 'createdAt', operator: 'within_days', value: 7 },
        { field: 'tags', operator: 'contains', value: 'New Lead' },
      ],
    },
  },
  {
    name: 'Pending Orders',
    criteria: {
      operator: 'AND',
      conditions: [
        { field: 'tags', operator: 'contains', value: 'Pending Payment' },
      ],
    },
  },
  {
    name: 'Wholesale Buyers',
    criteria: {
      operator: 'AND',
      conditions: [
        { field: 'tags', operator: 'contains', value: 'Wholesale' },
      ],
    },
  },
];

// Default Automations (trigger is string, actions is JSON)
const defaultAutomations: DefaultAutomation[] = [
  {
    name: 'Welcome New Contact',
    trigger: 'CONTACT_ADDED',
    actions: [
      {
        type: 'send_message',
        delay: 0,
        content: 'Welcome! 👋 Thank you for reaching out. How can we assist you today?',
      },
      {
        type: 'add_tag',
        delay: 0,
        tagName: 'New Lead',
      },
    ],
    isActive: true,
  },
  {
    name: 'After Hours Auto-Reply',
    trigger: 'MESSAGE_RECEIVED',
    actions: [
      {
        type: 'send_message',
        delay: 0,
        content: 'Thank you for your message! 🌙\n\nWe\'re currently outside business hours (9 AM - 6 PM). We\'ll respond first thing tomorrow!',
        conditions: [
          { field: 'time', operator: 'outside', value: { start: '09:00', end: '18:00' } },
        ],
      },
    ],
    isActive: false,
  },
  {
    name: 'Order Confirmation',
    trigger: 'TAG_ADDED',
    actions: [
      {
        type: 'send_message',
        delay: 0,
        content: '🎉 Order Confirmed!\n\nThank you for your order. We\'re processing it now and will update you once it ships.\n\nQuestions? Just reply to this message!',
        conditions: [
          { field: 'tag', operator: 'equals', value: 'Order Placed' },
        ],
      },
    ],
    isActive: true,
  },
  {
    name: 'Shipping Notification',
    trigger: 'TAG_ADDED',
    actions: [
      {
        type: 'send_message',
        delay: 0,
        content: '📦 Your Order Has Shipped!\n\nGreat news! Your order is on its way. Expected delivery: 2-3 business days.\n\nWe\'ll share tracking details shortly!',
        conditions: [
          { field: 'tag', operator: 'equals', value: 'Shipped' },
        ],
      },
    ],
    isActive: true,
  },
  {
    name: 'Follow Up Inactive',
    trigger: 'INACTIVITY',
    actions: [
      {
        type: 'send_message',
        delay: 0,
        content: 'Hi! 👋 We haven\'t heard from you in a while. Just checking in to see if you need any assistance. We\'re here to help!',
      },
      {
        type: 'add_tag',
        delay: 0,
        tagName: 'Follow Up',
      },
    ],
    isActive: false,
  },
];

// Default Drip Campaigns
const defaultDripCampaigns: DefaultDripCampaign[] = [
  {
    name: 'New Customer Onboarding',
    description: 'Welcome series for new customers',
    triggerType: DripTriggerType.TAG_ADDED,
    steps: [
      {
        sequence: 1,
        delayHours: 0,
        message: 'Welcome aboard! 🎉\n\nWe\'re thrilled to have you. Here\'s what you can expect from us:\n\n✅ Fast responses\n✅ Quality products\n✅ Great support\n\nFeel free to ask anything!',
      },
      {
        sequence: 2,
        delayHours: 24,
        message: 'Hi again! 👋\n\nJust wanted to share some tips to get the most out of our service:\n\n1️⃣ Check our catalog for latest products\n2️⃣ Ask about ongoing promotions\n3️⃣ Refer friends for special discounts!\n\nNeed help? Just reply!',
      },
      {
        sequence: 3,
        delayHours: 72,
        message: 'Hey! 🙌\n\nHow has your experience been so far? We\'d love to hear your feedback!\n\n⭐ Great: Reply "great"\n🤔 Could be better: Reply "feedback"\n\nYour opinion helps us improve!',
      },
    ],
    isActive: true,
  },
  {
    name: 'Abandoned Cart Recovery',
    description: 'Remind customers who showed interest but didn\'t buy',
    triggerType: DripTriggerType.MANUAL,
    steps: [
      {
        sequence: 1,
        delayHours: 1,
        message: 'Hi! 🛒\n\nWe noticed you were interested in some items earlier. Need any help deciding?\n\nI\'m here to answer questions about pricing, availability, or anything else!',
      },
      {
        sequence: 2,
        delayHours: 24,
        message: 'Still thinking it over? 🤔\n\nHere\'s a special offer just for you: Use code SAVE10 for 10% off your first order!\n\nOffer expires in 48 hours. Ready to order?',
      },
      {
        sequence: 3,
        delayHours: 72,
        message: 'Last chance! ⏰\n\nYour 10% discount code SAVE10 expires today. Don\'t miss out!\n\nReply "order" to place your order now.',
      },
    ],
    isActive: false,
  },
  {
    name: 'Post-Purchase Follow Up',
    description: 'Follow up after order delivery',
    triggerType: DripTriggerType.TAG_ADDED,
    steps: [
      {
        sequence: 1,
        delayHours: 48,
        message: 'Hi! 📦\n\nHope you received your order! How is everything? We\'d love to hear your feedback.\n\n⭐⭐⭐⭐⭐ Rate your experience!',
      },
      {
        sequence: 2,
        delayHours: 168,
        message: 'Thank you for being our customer! 🙏\n\nDid you know? Refer a friend and you both get 15% off your next purchase!\n\nJust share our number and ask them to mention your name.',
      },
      {
        sequence: 3,
        delayHours: 720,
        message: 'Hey! 👋 It\'s been a month since your last order.\n\nWe have some exciting new products! Would you like to see what\'s new?\n\nReply "catalog" for our latest collection!',
      },
    ],
    isActive: true,
  },
  {
    name: 'Re-engagement Campaign',
    description: 'Win back inactive customers',
    triggerType: DripTriggerType.MANUAL,
    steps: [
      {
        sequence: 1,
        delayHours: 0,
        message: 'We miss you! 😢\n\nIt\'s been a while since we last connected. Is everything okay?\n\nWe\'d love to hear from you. Reply with "hi" and let\'s catch up!',
      },
      {
        sequence: 2,
        delayHours: 72,
        message: 'Special offer just for you! 🎁\n\nCome back and enjoy 20% off your next purchase. Use code COMEBACK20.\n\nValid for the next 7 days!',
      },
      {
        sequence: 3,
        delayHours: 168,
        message: 'Last reminder! ⏰\n\nYour exclusive 20% discount expires tomorrow. Don\'t miss this chance!\n\nReply "order" to place an order with your discount.',
      },
    ],
    isActive: false,
  },
];

async function seedDefaultData(userId: string) {
  console.log(`Seeding default data for user: ${userId}`);

  // Seed Quick Replies
  console.log('\n📝 Seeding Quick Replies...');
  for (const qr of defaultQuickReplies) {
    const existing = await prisma.quickReply.findFirst({
      where: { userId, shortcut: qr.shortcut },
    });
    if (!existing) {
      await prisma.quickReply.create({
        data: {
          userId,
          shortcut: qr.shortcut,
          title: qr.title,
          content: qr.content,
          category: qr.category,
          usageCount: 0,
        },
      });
      console.log(`  ✅ Created quick reply: ${qr.shortcut}`);
    } else {
      console.log(`  ⏭️  Quick reply exists: ${qr.shortcut}`);
    }
  }

  // Seed Tags
  console.log('\n🏷️  Seeding Tags...');
  for (const tag of defaultTags) {
    const existing = await prisma.tag.findFirst({
      where: { userId, name: tag.name },
    });
    if (!existing) {
      await prisma.tag.create({
        data: {
          userId,
          name: tag.name,
          color: tag.color,
        },
      });
      console.log(`  ✅ Created tag: ${tag.name}`);
    } else {
      console.log(`  ⏭️  Tag exists: ${tag.name}`);
    }
  }

  // Seed Segments
  console.log('\n📊 Seeding Segments...');
  for (const segment of defaultSegments) {
    const existing = await prisma.segment.findFirst({
      where: { userId, name: segment.name },
    });
    if (!existing) {
      await prisma.segment.create({
        data: {
          userId,
          name: segment.name,
          criteria: segment.criteria,
        },
      });
      console.log(`  ✅ Created segment: ${segment.name}`);
    } else {
      console.log(`  ⏭️  Segment exists: ${segment.name}`);
    }
  }

  // Seed Automations
  console.log('\n🤖 Seeding Automations...');
  for (const automation of defaultAutomations) {
    const existing = await prisma.automation.findFirst({
      where: { userId, name: automation.name },
    });
    if (!existing) {
      await prisma.automation.create({
        data: {
          userId,
          name: automation.name,
          trigger: automation.trigger,
          actions: automation.actions,
          isActive: automation.isActive,
        },
      });
      console.log(`  ✅ Created automation: ${automation.name}`);
    } else {
      console.log(`  ⏭️  Automation exists: ${automation.name}`);
    }
  }

  // Seed Drip Campaigns
  console.log('\n💧 Seeding Drip Campaigns...');
  for (const campaign of defaultDripCampaigns) {
    const existing = await prisma.dripCampaign.findFirst({
      where: { userId, name: campaign.name },
    });
    if (!existing) {
      const createdCampaign = await prisma.dripCampaign.create({
        data: {
          userId,
          name: campaign.name,
          description: campaign.description,
          triggerType: campaign.triggerType,
          isActive: campaign.isActive,
        },
      });
      
      // Create steps for the campaign
      for (const step of campaign.steps) {
        await prisma.dripCampaignStep.create({
          data: {
            campaignId: createdCampaign.id,
            sequence: step.sequence,
            delayHours: step.delayHours,
            message: step.message,
          },
        });
      }
      
      console.log(`  ✅ Created drip campaign: ${campaign.name} with ${campaign.steps.length} steps`);
    } else {
      console.log(`  ⏭️  Drip campaign exists: ${campaign.name}`);
    }
  }

  console.log('\n✨ Default data seeding complete!');
}

// Main execution
async function main() {
  try {
    // Get user ID from command line or find the first user
    let userId = process.argv[2];
    
    if (!userId) {
      const user = await prisma.user.findFirst();
      if (!user) {
        console.error('❌ No users found. Please create a user first.');
        process.exit(1);
      }
      userId = user.id;
      console.log(`Using first user: ${user.email} (${userId})`);
    }

    await seedDefaultData(userId);
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
