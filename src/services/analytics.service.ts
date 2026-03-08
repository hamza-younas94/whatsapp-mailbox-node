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
  responseRate: number;
  avgResponseTime: number;
  messagesChange: number;
  responseChange: number;
  timeChange: number;
  contactsChange: number;
  messagesByDay: Array<{ date: string; count: number }>;
  messagesByType: Array<{ type: string; count: number }>;
}

export interface IAnalyticsService {
  getStats(userId: string, days?: number): Promise<AnalyticsStats>;
  getMessageTrends(userId: string, days: number): Promise<Array<{ date: string; sent: number; received: number }>>;
  getTopContacts(userId: string, limit?: number): Promise<Array<{ name: string; phoneNumber: string; messageCount: number }>>;
  getCampaigns(userId: string): Promise<Array<{ name: string; sentCount: number; deliveredCount: number; readCount: number }>>;
  exportReport(userId: string, days: number): Promise<string>;
}

export class AnalyticsService implements IAnalyticsService {
  constructor(private prisma: PrismaClient) {}

  async getStats(userId: string, days: number = 7): Promise<AnalyticsStats> {
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const previousStartDate = new Date(startDate.getTime() - days * 24 * 60 * 60 * 1000);

    // Current period queries
    const [
      totalMessages,
      sentMessages,
      receivedMessages,
      totalContacts,
      activeContacts,
      campaignsSent,
      messagesByType,
      // Previous period for comparison
      prevTotalMessages,
      prevActiveContacts,
    ] = await Promise.all([
      // Total messages in period
      this.prisma.message.count({
        where: { userId, createdAt: { gte: startDate } },
      }),

      // Sent messages in period
      this.prisma.message.count({
        where: { userId, direction: 'OUTGOING', createdAt: { gte: startDate } },
      }),

      // Received messages in period
      this.prisma.message.count({
        where: { userId, direction: 'INCOMING', createdAt: { gte: startDate } },
      }),

      // Total contacts
      this.prisma.contact.count({ where: { userId } }),

      // Active contacts (messaged in this period)
      this.prisma.contact.count({
        where: { userId, lastMessageAt: { gte: startDate } },
      }),

      // Campaigns sent
      this.prisma.campaign.count({
        where: { status: 'COMPLETED', completedAt: { gte: startDate } },
      }).catch(() => 0),

      // Messages by type
      this.prisma.message.groupBy({
        by: ['messageType'],
        where: { userId, createdAt: { gte: startDate } },
        _count: { id: true },
      }),

      // Previous period: total messages
      this.prisma.message.count({
        where: { userId, createdAt: { gte: previousStartDate, lt: startDate } },
      }),

      // Previous period: active contacts
      this.prisma.contact.count({
        where: { userId, lastMessageAt: { gte: previousStartDate, lt: startDate } },
      }),
    ]);

    // Calculate response rate: % of incoming messages that got a reply
    // Approximate: sent / received * 100 (capped at 100)
    const responseRate = receivedMessages > 0
      ? Math.min(Math.round((sentMessages / receivedMessages) * 100), 100)
      : 0;

    // Calculate avg response time (in seconds)
    // Get pairs of incoming messages followed by outgoing messages
    const avgResponseTime = await this.calculateAvgResponseTime(userId, startDate);

    // Previous period response rate for comparison
    const prevSent = await this.prisma.message.count({
      where: { userId, direction: 'OUTGOING', createdAt: { gte: previousStartDate, lt: startDate } },
    });
    const prevReceived = await this.prisma.message.count({
      where: { userId, direction: 'INCOMING', createdAt: { gte: previousStartDate, lt: startDate } },
    });
    const prevResponseRate = prevReceived > 0
      ? Math.min(Math.round((prevSent / prevReceived) * 100), 100)
      : 0;

    // Calculate period-over-period changes (%)
    const messagesChange = prevTotalMessages > 0
      ? Math.round(((totalMessages - prevTotalMessages) / prevTotalMessages) * 100)
      : (totalMessages > 0 ? 100 : 0);
    const responseChange = prevResponseRate > 0
      ? Math.round(responseRate - prevResponseRate)
      : (responseRate > 0 ? responseRate : 0);
    const contactsChange = prevActiveContacts > 0
      ? Math.round(((activeContacts - prevActiveContacts) / prevActiveContacts) * 100)
      : (activeContacts > 0 ? 100 : 0);

    // Messages by day
    const messagesByDay = await this.getMessagesByDay(userId, days);

    return {
      totalMessages,
      sentMessages,
      receivedMessages,
      totalContacts,
      activeContacts,
      campaignsSent,
      responseRate,
      avgResponseTime,
      messagesChange,
      responseChange,
      timeChange: 0,
      contactsChange,
      messagesByDay,
      messagesByType: messagesByType.map((m) => ({
        type: m.messageType,
        count: m._count.id,
      })),
    };
  }

  private async calculateAvgResponseTime(userId: string, since: Date): Promise<number> {
    try {
      // Get recent incoming messages and their first outgoing reply
      const result = await this.prisma.$queryRaw<Array<{ avg_seconds: number | null }>>`
        SELECT AVG(reply_time) as avg_seconds FROM (
          SELECT TIMESTAMPDIFF(SECOND, inc.createdAt, MIN(rpl.createdAt)) as reply_time
          FROM Message inc
          INNER JOIN Message rpl ON rpl.userId = inc.userId
            AND rpl.contactId = inc.contactId
            AND rpl.direction = 'OUTGOING'
            AND rpl.createdAt > inc.createdAt
            AND rpl.createdAt < DATE_ADD(inc.createdAt, INTERVAL 24 HOUR)
          WHERE inc.userId = ${userId}
            AND inc.direction = 'INCOMING'
            AND inc.createdAt >= ${since}
          GROUP BY inc.id
          LIMIT 100
        ) as reply_times
      `;
      return Math.round(result[0]?.avg_seconds || 0);
    } catch (error) {
      logger.debug({ error }, 'Failed to calculate avg response time');
      return 0;
    }
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

  async getTopContacts(userId: string, limit: number = 10): Promise<Array<{ name: string; phoneNumber: string; messageCount: number }>> {
    try {
      const contacts = await this.prisma.contact.findMany({
        where: { userId },
        select: {
          name: true,
          pushName: true,
          businessName: true,
          phoneNumber: true,
          _count: { select: { messages: true } },
        },
        orderBy: { messages: { _count: 'desc' } },
        take: limit,
      });

      return contacts
        .filter(c => c._count.messages > 0)
        .map(c => ({
          name: c.businessName || c.name || c.pushName || c.phoneNumber,
          phoneNumber: c.phoneNumber,
          messageCount: c._count.messages,
        }));
    } catch (error) {
      logger.error({ error }, 'Failed to get top contacts');
      return [];
    }
  }

  async getCampaigns(userId: string): Promise<Array<{ name: string; sentCount: number; deliveredCount: number; readCount: number }>> {
    try {
      const campaigns = await this.prisma.campaign.findMany({
        where: { status: 'COMPLETED' },
        select: {
          name: true,
          sentCount: true,
          failedCount: true,
          recipientCount: true,
        },
        orderBy: { completedAt: 'desc' },
        take: 20,
      });

      return campaigns.map(c => ({
        name: c.name,
        sentCount: c.sentCount || 0,
        deliveredCount: Math.max((c.sentCount || 0) - (c.failedCount || 0), 0),
        readCount: 0,
      }));
    } catch (error) {
      logger.debug({ error }, 'No campaigns table or failed to query');
      return [];
    }
  }

  async exportReport(userId: string, days: number): Promise<string> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const messages = await this.prisma.message.findMany({
      where: { userId, createdAt: { gte: startDate } },
      select: { createdAt: true, direction: true },
      orderBy: { createdAt: 'asc' },
    });

    // Group by date
    const byDay: Record<string, { sent: number; received: number }> = {};
    messages.forEach(msg => {
      const date = msg.createdAt.toISOString().split('T')[0];
      if (!byDay[date]) byDay[date] = { sent: 0, received: 0 };
      if (msg.direction === 'OUTGOING') byDay[date].sent++;
      else byDay[date].received++;
    });

    let csv = 'Date,Sent,Received,Total\n';
    for (const [date, counts] of Object.entries(byDay).sort()) {
      csv += `${date},${counts.sent},${counts.received},${counts.sent + counts.received}\n`;
    }
    return csv;
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
