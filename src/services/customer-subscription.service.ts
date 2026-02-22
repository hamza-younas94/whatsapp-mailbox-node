// src/services/customer-subscription.service.ts
// Customer Subscription business logic

import { CustomerSubscription, SubscriptionStatus, BillingCycle } from '@prisma/client';
import { CustomerSubscriptionRepository } from '@repositories/customer-subscription.repository';
import { NotFoundError, ValidationError } from '@utils/errors';
import logger from '@utils/logger';

export interface CreateSubscriptionInput {
  contactId: string;
  planName: string;
  description?: string;
  billingCycle?: BillingCycle;
  amount: number;
  startDate?: string;
  endDate?: string;
  nextBillingDate?: string;
  autoRenew?: boolean;
  notes?: string;
}

export class CustomerSubscriptionService {
  constructor(private repository: CustomerSubscriptionRepository) {}

  private calculateNextBillingDate(startDate: Date, cycle: BillingCycle): Date {
    const next = new Date(startDate);
    switch (cycle) {
      case 'DAILY': next.setDate(next.getDate() + 1); break;
      case 'WEEKLY': next.setDate(next.getDate() + 7); break;
      case 'MONTHLY': next.setMonth(next.getMonth() + 1); break;
      case 'QUARTERLY': next.setMonth(next.getMonth() + 3); break;
      case 'YEARLY': next.setFullYear(next.getFullYear() + 1); break;
    }
    return next;
  }

  async createSubscription(userId: string, input: CreateSubscriptionInput): Promise<CustomerSubscription> {
    if (input.amount <= 0) throw new ValidationError('Amount must be greater than 0');

    const startDate = input.startDate ? new Date(input.startDate) : new Date();
    const billingCycle = input.billingCycle || 'MONTHLY';
    const nextBillingDate = input.nextBillingDate
      ? new Date(input.nextBillingDate)
      : this.calculateNextBillingDate(startDate, billingCycle);

    const subscription = await this.repository.create({
      userId,
      contactId: input.contactId,
      planName: input.planName,
      description: input.description,
      billingCycle,
      amount: input.amount,
      startDate,
      endDate: input.endDate ? new Date(input.endDate) : undefined,
      nextBillingDate,
      autoRenew: input.autoRenew !== undefined ? input.autoRenew : true,
      notes: input.notes,
    });

    logger.info({ id: subscription.id, planName: input.planName }, 'Subscription created');
    return subscription;
  }

  async getSubscriptions(
    userId: string,
    options: { status?: string; contactId?: string; billingCycle?: string; page?: number; limit?: number } = {}
  ) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const { items, total } = await this.repository.findByUserId(userId, {
      status: options.status as SubscriptionStatus,
      contactId: options.contactId,
      billingCycle: options.billingCycle as BillingCycle,
      skip,
      take: limit,
    });

    return { items, pagination: { total, page, perPage: limit, totalPages: Math.ceil(total / limit) } };
  }

  async getSubscription(id: string) {
    const subscription = await this.repository.findByIdWithContact(id);
    if (!subscription) throw new NotFoundError('Subscription');
    return subscription;
  }

  async updateSubscription(id: string, data: Partial<{
    planName: string; description: string; billingCycle: BillingCycle; amount: number;
    status: SubscriptionStatus; endDate: string; nextBillingDate: string; autoRenew: boolean; notes: string;
  }>): Promise<CustomerSubscription> {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError('Subscription');

    const updateData: any = { ...data };
    if (data.endDate) updateData.endDate = new Date(data.endDate);
    if (data.nextBillingDate) updateData.nextBillingDate = new Date(data.nextBillingDate);

    const subscription = await this.repository.update(id, updateData);
    logger.info({ id, status: data.status }, 'Subscription updated');
    return subscription;
  }

  async deleteSubscription(id: string): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError('Subscription');
    await this.repository.delete(id);
    logger.info({ id }, 'Subscription deleted');
  }
}
