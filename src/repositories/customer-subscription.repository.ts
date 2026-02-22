// src/repositories/customer-subscription.repository.ts
// Customer Subscription data access

import { PrismaClient, CustomerSubscription, SubscriptionStatus, BillingCycle } from '@prisma/client';
import { BaseRepository } from './base.repository';

export class CustomerSubscriptionRepository extends BaseRepository<CustomerSubscription> {
  protected modelName = 'customerSubscription' as const;

  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async findByUserId(
    userId: string,
    options: {
      status?: SubscriptionStatus;
      contactId?: string;
      billingCycle?: BillingCycle;
      skip?: number;
      take?: number;
    } = {}
  ): Promise<{ items: CustomerSubscription[]; total: number }> {
    const where: any = { userId };

    if (options.status) where.status = options.status;
    if (options.contactId) where.contactId = options.contactId;
    if (options.billingCycle) where.billingCycle = options.billingCycle;

    const [items, total] = await Promise.all([
      this.prisma.customerSubscription.findMany({
        where,
        include: {
          contact: { select: { id: true, name: true, phoneNumber: true } },
        },
        skip: options.skip || 0,
        take: Math.min(options.take || 20, 100),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customerSubscription.count({ where }),
    ]);

    return { items, total };
  }

  async findByIdWithContact(id: string) {
    return this.prisma.customerSubscription.findUnique({
      where: { id },
      include: {
        contact: { select: { id: true, name: true, phoneNumber: true, email: true } },
      },
    });
  }

  async findDueForRenewal(userId: string): Promise<CustomerSubscription[]> {
    const now = new Date();
    return this.prisma.customerSubscription.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        autoRenew: true,
        nextBillingDate: { lte: now },
      },
      include: {
        contact: { select: { id: true, name: true, phoneNumber: true } },
      },
    });
  }
}
