// Seed database with initial data

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Ensure a default organization exists
  let org = await prisma.organization.findFirst({ where: { slug: 'default' } });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: 'Default Organization',
        slug: 'default',
        ownerId: 'placeholder', // updated below after admin user is created
        isActive: true,
      },
    });
  }

  // Default admin
  const adminPassword = await bcrypt.hash('Couple@098', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'hamza.younas94@gmail.com' },
    update: {},
    create: {
      orgId: org.id,
      email: 'hamza.younas94@gmail.com',
      username: 'hamza',
      passwordHash: adminPassword,
      name: 'Hamza Admin',
      role: 'OWNER',
      isActive: true,
    },
  });
  console.log('✅ Created admin user:', admin.email);

  // Update org ownerId to the real admin user id
  await prisma.organization.update({ where: { id: org.id }, data: { ownerId: admin.id } });

  // Demo user
  const demoPassword = await bcrypt.hash('Demo123!', 10);
  const demo = await prisma.user.upsert({
    where: { email: 'demo@mailbox.com' },
    update: {},
    create: {
      orgId: org.id,
      email: 'demo@mailbox.com',
      username: 'demo',
      passwordHash: demoPassword,
      name: 'Demo User',
      role: 'AGENT',
      isActive: true,
    },
  });
  console.log('✅ Created demo user:', demo.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
