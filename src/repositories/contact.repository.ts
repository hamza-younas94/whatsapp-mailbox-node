// src/repositories/contact.repository.ts
// Contact data access layer

import { PrismaClient, Contact, Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository';

interface ContactFilters {
  query?: string;
  search?: string;
  tags?: string[];
  isBlocked?: boolean;
  engagement?: 'high' | 'medium' | 'low' | 'inactive';
  contactType?: 'individual' | 'business' | 'group' | 'broadcast';
  sortBy?: 'name' | 'lastMessageAt' | 'engagementScore' | 'messageCount';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface IContactRepository {
  findById(id: string): Promise<Contact | null>;
  findByPhoneNumber(userId: string, phoneNumber: string): Promise<Contact | null>;
  search(userId: string, filters: ContactFilters): Promise<PaginatedResult<Contact>>;
  create(data: Prisma.ContactCreateInput): Promise<Contact>;
  update(id: string, data: Prisma.ContactUpdateInput): Promise<Contact>;
  delete(id: string): Promise<Contact>;
  findOrCreate(
    userId: string,
    phoneNumber: string,
    data?: Partial<Contact>,
  ): Promise<Contact>;
}

export class ContactRepository extends BaseRepository<Contact> implements IContactRepository {
  protected modelName = 'contact' as const;

  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async findByPhoneNumber(userId: string, phoneNumber: string): Promise<Contact | null> {
    return this.prisma.contact.findUnique({
      where: { userId_phoneNumber: { userId, phoneNumber } },
      include: { tags: { include: { tag: true } } },
    });
  }

  async search(userId: string, filters: ContactFilters): Promise<PaginatedResult<Contact>> {
    const limit = Math.min(filters.limit || 20, 100);
    const offset = filters.offset || 0;

    const searchTerm = filters.search || filters.query;

    // Build where clause with all filter conditions
    const where: any = {
      userId,
      isBlocked: filters.isBlocked ?? false,
      ...(searchTerm && {
        OR: [
          { name: { contains: searchTerm } },
          { pushName: { contains: searchTerm } },
          { businessName: { contains: searchTerm } },
          { phoneNumber: { contains: searchTerm } },
          { email: { contains: searchTerm } },
          { company: { contains: searchTerm } },
        ],
      }),
      ...(filters.tags?.length && {
        tags: { some: { tag: { name: { in: filters.tags } } } },
      }),
      ...(filters.engagement && {
        engagementLevel: filters.engagement,
      }),
      ...(filters.contactType && {
        contactType: filters.contactType,
      }),
    };

    // Determine sort order
    const sortBy = filters.sortBy || 'lastMessageAt';
    const sortOrder = filters.sortOrder || 'desc';
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    const [contacts, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        skip: offset,
        take: limit,
        include: {
          tags: { include: { tag: true } },
          _count: { select: { messages: true } },
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              content: true,
              messageType: true,
              direction: true,
              createdAt: true,
            },
          },
        },
        orderBy: sortBy === 'lastMessageAt' 
          ? [{ lastMessageAt: sortOrder as any }, { createdAt: 'desc' }]
          : [orderBy, { createdAt: 'desc' }],
      }),
      this.prisma.contact.count({ where }),
    ]);

    return {
      data: contacts,
      total,
      page: Math.floor(offset / limit) + 1,
      limit,
    };
  }

  async findOrCreate(
    userId: string,
    phoneNumber: string,
    data?: Partial<Contact>,
  ): Promise<Contact> {
    if (!userId) {
      throw new Error('userId is required for findOrCreate');
    }

    const updateData: Record<string, any> = {};
    const createData: Record<string, any> = { userId, phoneNumber };

    // Map of data fields that should be persisted
    const persistedFields = [
      'name',
      'pushName',
      'businessName',
      'email',
      'profilePhotoUrl',
      'company',
      'department',
      'timezone',
      'isBusiness',
      'isVerified',
      'contactType',
      'lastMessageAt',
      'lastActiveAt',
      'customFields',
    ];

    // Only include non-undefined fields
    for (const field of persistedFields) {
      const value = data?.[field as keyof Contact];
      if (value !== undefined && value !== null) {
        updateData[field] = value;
        createData[field] = value;
      }
    }

    return this.prisma.contact.upsert({
      where: { userId_phoneNumber: { userId, phoneNumber } },
      update: updateData,
      create: createData as any,
    });
  }
}
