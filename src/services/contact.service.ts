// src/services/contact.service.ts
// Contact management business logic

import { Contact } from '@prisma/client';
import { ContactRepository } from '@repositories/contact.repository';
import { NotFoundError, ValidationError, ConflictError } from '@utils/errors';
import logger from '@utils/logger';

interface CreateContactInput {
  phoneNumber: string;
  name?: string;
  email?: string;
  tags?: string[];
}

interface ContactFilters {
  query?: string;
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

export interface IContactService {
  createContact(userId: string, input: CreateContactInput): Promise<Contact>;
  getContact(id: string): Promise<Contact>;
  searchContacts(userId: string, filters: ContactFilters): Promise<PaginatedResult<Contact>>;
  updateContact(id: string, data: Partial<Contact>): Promise<Contact>;
  deleteContact(id: string): Promise<void>;
  blockContact(id: string): Promise<Contact>;
  unblockContact(id: string): Promise<Contact>;
}

export class ContactService implements IContactService {
  constructor(
    private contactRepository: ContactRepository,
    private tagRepository?: any,
  ) {}

  async createContact(userId: string, input: CreateContactInput): Promise<Contact> {
    try {
      // Validate phone number format
      const phonePattern = /^\+?[1-9]\d{1,14}$/; // E.164 format
      if (!phonePattern.test(input.phoneNumber)) {
        throw new ValidationError('Invalid phone number format. Use E.164 format (e.g., +1234567890)');
      }

      // Check if contact already exists
      const existing = await this.contactRepository.findByPhoneNumber(userId, input.phoneNumber);
      if (existing) {
        throw new ConflictError(`Contact with phone ${input.phoneNumber} already exists`);
      }

      const contact = await this.contactRepository.create({
        userId,
        phoneNumber: input.phoneNumber,
        name: input.name,
        email: input.email,
      });

      // Add tags if provided
      if (input.tags && input.tags.length > 0 && this.tagRepository) {
        for (const tagName of input.tags) {
          let tag = await this.tagRepository.findByName(userId, tagName);
          if (!tag) {
            tag = await this.tagRepository.create({ userId, name: tagName });
          }
          await this.tagRepository.addToContact(contact.id, tag.id);
        }
      }

      logger.info({ contactId: contact.id }, 'Contact created');
      return contact;
    } catch (error) {
      logger.error({ input, error }, 'Failed to create contact');
      throw error;
    }
  }

  async getContact(id: string): Promise<Contact> {
    try {
      const contact = await this.contactRepository.findById(id);
      if (!contact) {
        throw new NotFoundError('Contact');
      }
      return contact;
    } catch (error) {
      logger.error({ id, error }, 'Failed to get contact');
      throw error;
    }
  }

  async searchContacts(userId: string, filters: ContactFilters): Promise<PaginatedResult<Contact>> {
    try {
      return await this.contactRepository.search(userId, filters);
    } catch (error) {
      logger.error({ filters, error }, 'Failed to search contacts');
      throw error;
    }
  }

  async updateContact(id: string, data: Partial<Contact>): Promise<Contact> {
    try {
      const contact = await this.contactRepository.findById(id);
      if (!contact) {
        throw new NotFoundError('Contact');
      }

      // Validate email if provided
      if (data.email) {
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(data.email)) {
          throw new ValidationError('Invalid email format');
        }
      }

      return await this.contactRepository.update(id, data);
    } catch (error) {
      logger.error({ id, data, error }, 'Failed to update contact');
      throw error;
    }
  }

  async deleteContact(id: string): Promise<void> {
    try {
      await this.contactRepository.delete(id);
      logger.info({ id }, 'Contact deleted');
    } catch (error) {
      logger.error({ id, error }, 'Failed to delete contact');
      throw error;
    }
  }

  async blockContact(id: string): Promise<Contact> {
    try {
      return await this.contactRepository.update(id, { isBlocked: true });
    } catch (error) {
      logger.error({ id, error }, 'Failed to block contact');
      throw error;
    }
  }

  async unblockContact(id: string): Promise<Contact> {
    try {
      return await this.contactRepository.update(id, { isBlocked: false });
    } catch (error) {
      logger.error({ id, error }, 'Failed to unblock contact');
      throw error;
    }
  }

  // ============================================
  // BULK OPERATIONS
  // ============================================

  async bulkTag(userId: string, contactIds: string[], tagId: string): Promise<{ taggedCount: number }> {
    let taggedCount = 0;
    for (const contactId of contactIds) {
      try {
        if (this.tagRepository) {
          await this.tagRepository.addToContact(contactId, tagId);
          taggedCount++;
        }
      } catch {
        // Already tagged, skip
      }
    }
    logger.info({ userId, tagId, taggedCount }, 'Bulk tag applied');
    return { taggedCount };
  }

  async bulkUpdateStage(userId: string, contactIds: string[], stage: string): Promise<{ updatedCount: number }> {
    let updatedCount = 0;
    for (const contactId of contactIds) {
      try {
        const contact = await this.contactRepository.findById(contactId);
        if (contact) {
          const customFields = typeof (contact as any).customFields === 'object'
            ? (contact as any).customFields
            : {};
          await this.contactRepository.update(contactId, {
            customFields: { ...customFields, stage },
          } as any);
          updatedCount++;
        }
      } catch (error) {
        logger.error({ contactId, error }, 'Failed to update contact stage');
      }
    }
    logger.info({ userId, stage, updatedCount }, 'Bulk stage update applied');
    return { updatedCount };
  }

  async bulkDelete(userId: string, contactIds: string[]): Promise<{ deletedCount: number }> {
    let deletedCount = 0;
    for (const contactId of contactIds) {
      try {
        await this.contactRepository.delete(contactId);
        deletedCount++;
      } catch (error) {
        logger.error({ contactId, error }, 'Failed to delete contact in bulk');
      }
    }
    logger.info({ userId, deletedCount }, 'Bulk delete completed');
    return { deletedCount };
  }

  async findDuplicates(userId: string): Promise<any[]> {
    const allContacts = await this.contactRepository.search(userId, { limit: 1000, offset: 0 });
    const phoneMap = new Map<string, any[]>();

    for (const contact of allContacts.data) {
      const phone = contact.phoneNumber;
      if (!phoneMap.has(phone)) {
        phoneMap.set(phone, []);
      }
      phoneMap.get(phone)!.push(contact);
    }

    const duplicates: any[] = [];
    for (const [phone, contacts] of phoneMap.entries()) {
      if (contacts.length > 1) {
        duplicates.push({ phoneNumber: phone, contacts });
      }
    }

    return duplicates;
  }

  async mergeContacts(userId: string, primaryId: string, secondaryId: string): Promise<Contact> {
    const primary = await this.contactRepository.findById(primaryId);
    if (!primary) throw new NotFoundError('Primary contact');

    const secondary = await this.contactRepository.findById(secondaryId);
    if (!secondary) throw new NotFoundError('Secondary contact');

    // Merge data: keep primary's data, fill in from secondary where primary is empty
    const mergeData: any = {};
    const fields = ['name', 'email', 'company', 'department', 'timezone', 'businessName'] as const;
    for (const field of fields) {
      if (!(primary as any)[field] && (secondary as any)[field]) {
        mergeData[field] = (secondary as any)[field];
      }
    }

    // Combine engagement metrics
    mergeData.messageCount = ((primary as any).messageCount || 0) + ((secondary as any).messageCount || 0);
    mergeData.totalInteractions = ((primary as any).totalInteractions || 0) + ((secondary as any).totalInteractions || 0);

    // Update primary with merged data
    if (Object.keys(mergeData).length > 0) {
      await this.contactRepository.update(primaryId, mergeData);
    }

    // Delete secondary contact (cascade will handle related records)
    await this.contactRepository.delete(secondaryId);

    logger.info({ primaryId, secondaryId }, 'Contacts merged');
    return this.contactRepository.findById(primaryId) as Promise<Contact>;
  }
}
