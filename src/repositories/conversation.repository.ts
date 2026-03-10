// src/repositories/conversation.repository.ts
// Conversation data access helper

import { PrismaClient, Conversation } from '@prisma/client';

export class ConversationRepository {
  constructor(private prisma: PrismaClient) {}

  async findOrCreate(orgId: string, userId: string, contactId: string): Promise<Conversation> {
    const existing = await this.prisma.conversation.findUnique({
      where: { orgId_contactId: { orgId, contactId } },
    });

    if (existing) return existing;

    return this.prisma.conversation.create({
      data: {
        orgId,
        userId,
        contactId,
        isActive: true,
        lastMessageAt: new Date(),
      },
    });
  }
}
