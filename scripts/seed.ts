// scripts/seed.ts
// Seed database with initial data

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('Couple@098', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'hamza.younas94@gmail.com' },
    update: {},
    create: {
      email: 'hamza.younas94@gmail.com',
      username: 'hamza',
      passwordHash: adminPassword,
      name: 'Hamza Admin',
      role: 'ADMIN',
      isActive: true,
    },
  });
  console.log('✅ Created admin user:', admin.email);

  // Create demo user
  const demoPassword = await bcrypt.hash('Demo123!', 10);
  const demo = await prisma.user.upsert({
    where: { email: 'demo@mailbox.com' },
    update: {},
    create: {
      email: 'demo@mailbox.com',
      username: 'demo',
      passwordHash: demoPassword,
      name: 'Demo User',
      role: 'USER',
      isActive: true,
    },
  });
  console.log('✅ Created demo user:', demo.email);

  // Create sample contacts
  const contacts = await Promise.all([
    prisma.contact.upsert({
      where: { userId_phoneNumber: { userId: demo.id, phoneNumber: '+1234567890' } },
      update: {},
      create: {
        userId: demo.id,
        phoneNumber: '+1234567890',
        name: 'John Doe',
        email: 'john@example.com',
      },
    }),
    prisma.contact.upsert({
      where: { userId_phoneNumber: { userId: demo.id, phoneNumber: '+0987654321' } },
      update: {},
      create: {
        userId: demo.id,
        phoneNumber: '+0987654321',
        name: 'Jane Smith',
        email: 'jane@example.com',
      },
    }),
  ]);
  console.log('✅ Created sample contacts:', contacts.length);

  // Create sample tags
  const tags = await Promise.all([
    prisma.tag.upsert({
      where: { userId_name: { userId: demo.id, name: 'VIP' } },
      update: {},
      create: {
        userId: demo.id,
        name: 'VIP',
        color: '#FFD700',
      },
    }),
    prisma.tag.upsert({
      where: { userId_name: { userId: demo.id, name: 'Lead' } },
      update: {},
      create: {
        userId: demo.id,
        name: 'Lead',
        color: '#4CAF50',
      },
    }),
    prisma.tag.upsert({
      where: { userId_name: { userId: demo.id, name: 'Customer' } },
      update: {},
      create: {
        userId: demo.id,
        name: 'Customer',
        color: '#2196F3',
      },
    }),
  ]);
  console.log('✅ Created sample tags:', tags.length);

  // Create sample quick replies
  const quickReplies = await Promise.all([
    prisma.quickReply.create({
      data: {
        userId: demo.id,
        shortcut: '/hello',
        message: 'Hello! How can I help you today?',
        category: 'greetings',
      },
    }),
    prisma.quickReply.create({
      data: {
        userId: demo.id,
        shortcut: '/thanks',
        message: 'Thank you for your message! We will get back to you soon.',
        category: 'responses',
      },
    }),
    prisma.quickReply.create({
      data: {
        userId: demo.id,
        shortcut: '/hours',
        message: 'Our business hours are Monday-Friday, 9 AM - 5 PM EST.',
        category: 'info',
      },
    }),
  ]);
  console.log('✅ Created quick replies:', quickReplies.length);

  // Create sample segment
  const segment = await prisma.segment.create({
    data: {
      userId: demo.id,
      name: 'Active Customers',
      conditions: {
        tags: ['Customer'],
        lastMessageDays: 30,
      },
    },
  });
  console.log('✅ Created sample segment:', segment.name);

  // Create sample automation
  const automation = await prisma.automation.create({
    data: {
      userId: demo.id,
      name: 'Welcome New Customers',
      triggerType: 'TAG_ADDED',
      triggerValue: 'Customer',
      actions: [
        {
          type: 'SEND_MESSAGE',
          value: 'Welcome! Thank you for becoming our customer.',
        },
        {
          type: 'WAIT',
          delay: 3600,
        },
        {
          type: 'SEND_MESSAGE',
          value: 'Is there anything I can help you with?',
        },
      ],
      isActive: true,
    },
  });
  console.log('✅ Created sample automation:', automation.name);

  console.log('');
  console.log('🎉 Seeding completed!');
  console.log('');
  console.log('📧 Admin credentials:');
  console.log('   Email: admin@mailbox.com');
  console.log('   Password: Admin123!');
  console.log('');
  console.log('📧 Demo credentials:');
  console.log('   Email: demo@mailbox.com');
  console.log('   Password: Demo123!');
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
