// src/services/analytics.service.ts
// Analytics and reporting

import { PrismaClient } from '@prisma/client';
import logger from '@utils/logger';

export interface AnalyticsStats {
  totalMessages: number;
  sentMessages: number;
  receivedMessages: number;
  totalContacts: number;
  activeContacts: number;
  campaignsSent: number;
  messagesByDay: Array<{ date: string; count: number }>;
  messagesByType: Array<{ type: string; count: number }>;
}

export interface IAnalyticsService {
  getStats(userId: string, startDate?: Date, endDate?: Date): Promise<AnalyticsStats>;
  getMessageTrends(userId: string, days: number): Promise<Array<{ date: string; sent: number; received: number }>>;
}

export class AnalyticsService implements IAnalyticsService {
  constructor(private prisma: PrismaClient) {}

  async getStats(userId: string, startDate?: Date, endDate?: Date): Promise<AnalyticsStats> {
    const dateFilter = {
      ...(startDate && { gte: startDate }),
      ...(endDate && { lte: endDate }),
    };

    const [
      totalMessages,
      sentMessages,
      receivedMessages,
      totalContacts,
      activeContacts,
      campaignsSent,
      messagesByType,
    ] = await Promise.all([
      // Total messages
      this.prisma.message.count({
        where: { userId, ...(Object.keys(dateFilter).length && { createdAt: dateFilter }) },
      }),

      // Sent messages
      this.prisma.message.count({
        where: {
          userId,
          direction: 'OUTGOING',
          ...(Object.keys(dateFilter).length && { createdAt: dateFilter }),
        },
      }),

      // Received messages
      this.prisma.message.count({
        where: {
          userId,
          direction: 'INCOMING',
          ...(Object.keys(dateFilter).length && { createdAt: dateFilter }),
        },
      }),

      // Total contacts
      this.prisma.contact.count({ where: { userId } }),

      // Active contacts (messaged in last 30 days)
      this.prisma.contact.count({
        where: {
          userId,
          lastMessageAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),

      // Campaigns sent
      this.prisma.campaign.count({
        where: { status: 'COMPLETED', ...(Object.keys(dateFilter).length && { completedAt: dateFilter }) },
      }),

      // Messages by type
      this.prisma.message.groupBy({
        by: ['messageType'],
        where: { userId },
        _count: { id: true },
      }),
    ]);

    // Messages by day (last 7 days)
    const messagesByDay = await this.getMessagesByDay(userId, 7);

    return {
      totalMessages,
      sentMessages,
      receivedMessages,
      totalContacts,
      activeContacts,
      campaignsSent,
      messagesByDay,
      messagesByType: messagesByType.map((m) => ({
        type: m.messageType,
        count: m._count.id,
      })),
    };
  }

  async getMessageTrends(
    userId: string,
    days: number,
  ): Promise<Array<{ date: string; sent: number; received: number }>> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const messages = await this.prisma.message.findMany({
      where: {
        userId,
        createdAt: { gte: startDate },
      },
      select: {
        createdAt: true,
        direction: true,
      },
    });

    // Group by date
    const trends: Record<string, { sent: number; received: number }> = {};

    messages.forEach((msg) => {
      const date = msg.createdAt.toISOString().split('T')[0];
      if (!trends[date]) {
        trends[date] = { sent: 0, received: 0 };
      }

      if (msg.direction === 'OUTGOING') {
        trends[date].sent++;
      } else {
        trends[date].received++;
      }
    });

    return Object.entries(trends).map(([date, counts]) => ({
      date,
      ...counts,
    }));
  }

  private async getMessagesByDay(userId: string, days: number): Promise<Array<{ date: string; count: number }>> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const messages = await this.prisma.message.findMany({
      where: {
        userId,
        createdAt: { gte: startDate },
      },
      select: { createdAt: true },
    });

    const countByDay: Record<string, number> = {};

    messages.forEach((msg) => {
      const date = msg.createdAt.toISOString().split('T')[0];
      countByDay[date] = (countByDay[date] || 0) + 1;
    });

    return Object.entries(countByDay).map(([date, count]) => ({ date, count }));
  }
}
