// src/services/message.service.ts
// Message business logic - Single Responsibility Principle

import { Message, Prisma, MessageType, MessageDirection, MessageStatus } from '@prisma/client';
import { MessageRepository } from '@repositories/message.repository';
import { ContactRepository } from '@repositories/contact.repository';
import { ConversationRepository } from '@repositories/conversation.repository';
import { NotFoundError, ValidationError, ExternalServiceError } from '@utils/errors';
import logger from '@utils/logger';
import { WhatsAppService } from './whatsapp.service';
import { whatsappWebService } from './whatsapp-web.service';

interface CreateMessageInput {
  phoneNumber?: string;
  contactId?: string;
  content: string;
  messageType?: MessageType;
  direction?: MessageDirection;
  status?: MessageStatus;
  mediaUrl?: string;
  mediaType?: string;
}

interface MessageFilters {
  query?: string;
  status?: string;
  messageType?: string;
  direction?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface IMessageService {
  sendMessage(userId: string, input: CreateMessageInput): Promise<Message>;
  receiveMessage(waMessageId: string, payload: unknown): Promise<Message>;
  getMessages(
    userId: string,
    conversationId: string,
    limit?: number,
    offset?: number,
  ): Promise<PaginatedResult<Message>>;
  listMessages(userId: string, filters: MessageFilters): Promise<PaginatedResult<Message>>;
  markAsRead(messageId: string): Promise<Message>;
  deleteMessage(messageId: string): Promise<void>;
}

export class MessageService implements IMessageService {
  constructor(
    private messageRepository: MessageRepository,
    private whatsAppService: WhatsAppService,
    private contactRepository: ContactRepository,
    private conversationRepository: ConversationRepository,
  ) {}

  async sendMessage(userId: string, input: CreateMessageInput): Promise<Message> {
    try {
      const withTimeout = async <T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> => {
        let timer: NodeJS.Timeout;
        try {
          return await Promise.race([
            promise,
            new Promise<T>((_, reject) => {
              timer = setTimeout(() => reject(new Error(errorMsg)), ms);
            }),
          ]);
        } finally {
          clearTimeout(timer!);
        }
      };

      const sanitizePhone = (raw: string): string => {
        if (!raw) return '';
        // Remove @domain if present (WhatsApp format)
        const base = raw.split('@')[0];
        // Remove all non-digit characters
        const digits = base.replace(/\D/g, '');
        
        // If number starts with 0, remove it (local format like 03462115115)
        // WhatsApp expects international format without leading 0
        if (digits.startsWith('0') && digits.length > 1) {
          return digits.substring(1);
        }
        
        // Return last 20 digits (max phone number length)
        return digits.slice(-20);
      };

      // Validate userId is present
      if (!userId) {
        throw new ValidationError('User ID is required - authentication failed');
      }

      // Validate input
      if (!input.content && !input.mediaUrl) {
        throw new ValidationError('Message must have content or media');
      }

      if (input.content && input.content.length > 4096) {
        throw new ValidationError('Message content exceeds 4096 characters');
      }

      // Resolve contactId (create if phoneNumber provided)
      let contactId = input.contactId;
      if (!contactId && input.phoneNumber) {
        const sanitizedPhone = sanitizePhone(input.phoneNumber);
        if (!sanitizedPhone) {
          throw new ValidationError('Phone number is invalid after sanitization');
        }
        const contact = await this.contactRepository.findOrCreate(userId, sanitizedPhone, { name: sanitizedPhone });
        contactId = contact.id;
      }

      if (!contactId) {
        throw new ValidationError('contactId or phoneNumber is required');
      }

      // Ensure conversation exists
      const conversation = await this.conversationRepository.findOrCreate(userId, contactId);

      // Create message in database (PENDING status)
      // Truncate mediaUrl if too long (max 1000 chars to match database column)
      const mediaUrl = input.mediaUrl ? (input.mediaUrl.length > 1000 ? input.mediaUrl.substring(0, 1000) : input.mediaUrl) : null;
      
      const message = await this.messageRepository.create({
        user: { connect: { id: userId } },
        contact: { connect: { id: contactId } },
        conversation: { connect: { id: conversation.id } },
        content: input.content,
        messageType: (input.messageType || MessageType.TEXT) as any,
        direction: MessageDirection.OUTGOING as any,
        status: MessageStatus.PENDING as any,
        mediaUrl: mediaUrl,
        mediaType: input.mediaType?.toString(),
      } as Prisma.MessageCreateInput);

      // Send via WhatsApp Web
      try {
        // Get user's active WhatsApp Web session
        const sessions = whatsappWebService.getUserSessions(userId);
        
        logger.info({ 
          userId, 
          totalSessions: sessions.length,
          sessionStatuses: sessions.map(s => ({ id: s.id, status: s.status }))
        }, 'Checking WhatsApp Web sessions');

        const activeSession = sessions.find((s) => s.status === 'READY' || s.status === 'AUTHENTICATED');

        if (!activeSession) {
          const statusList = sessions.map(s => s.status).join(', ') || 'none';
          throw new ValidationError(`WhatsApp is not connected (statuses: ${statusList}). Please scan the QR code to connect.`);
        }

        // Check if client is actually ready
        const state = await activeSession.client.getState();
        logger.info({ state, sessionId: activeSession.id }, 'WhatsApp Web client state');

        if (state !== 'CONNECTED') {
          throw new ValidationError(`WhatsApp client is ${state}. Please reconnect.`);
        }

        // Get phone number and chatId - either from input or from contact
        let phoneNumberToUse = input.phoneNumber;
        let chatIdToUse: string | null = null;
        
        if (!phoneNumberToUse && contactId) {
          const contact = await this.contactRepository.findById(contactId);
          if (!contact) {
            throw new ValidationError('Contact not found');
          }
          phoneNumberToUse = contact.phoneNumber;
          chatIdToUse = contact.chatId || null; // Use stored chatId if available
        }

        if (!phoneNumberToUse) {
          throw new ValidationError('Phone number is required to send message');
        }

        // Use stored chatId if available (handles @c.us, @newsletter, @g.us, etc.)
        // Otherwise fall back to phoneNumber@c.us for regular contacts
        const sanitizedPhone = sanitizePhone(phoneNumberToUse);
        if (!sanitizedPhone) {
          throw new ValidationError('Phone number is invalid after sanitization');
        }
        const chatId = chatIdToUse || `${sanitizedPhone}@c.us`;

        logger.info({ chatId, content: input.content.substring(0, 50) }, 'Sending WhatsApp message');

        // Verify number is registered and get numberId
        const numberId = await withTimeout(
          activeSession.client.getNumberId(sanitizedPhone),
          30000,
          'WhatsApp getNumberId timed out',
        );
        
        if (!numberId) {
          throw new ValidationError('Phone number is not registered on WhatsApp');
        }

        // Log NumberId structure for debugging
        logger.info({ 
          numberIdString: typeof numberId === 'string' ? numberId : numberId._serialized,
          type: typeof numberId,
          isObject: typeof numberId === 'object'
        }, 'Number verified, sending message');

        // Normalize target chat id for sendMessage
        const targetChatId = typeof numberId === 'object' ? numberId._serialized : numberId;
        
        // Send message (removed sendSeen: false option as it may not be supported)
        let waMessage;
        try {
          waMessage = await withTimeout(
            activeSession.client.sendMessage(targetChatId as any, input.content),
            30000,
            'WhatsApp send timed out',
          );
          
          if (!waMessage || !waMessage.id) {
            throw new Error('WhatsApp returned invalid message response');
          }
          
          logger.info({ messageId: waMessage.id.id || waMessage.id._serialized }, 'WhatsApp message sent successfully');
        } catch (sendError: any) {
          // Handle detached frame errors - mark session as disconnected
          if (sendError.message?.includes('detached Frame') || sendError.message?.includes('Execution context')) {
            logger.warn({ 
              sessionId: activeSession.id, 
              error: sendError.message 
            }, 'Detached frame/context detected - session needs reconnection');
            activeSession.status = 'DISCONNECTED';
            throw new ExternalServiceError('WhatsApp Web', 'Session disconnected. Please scan QR code to reconnect.');
          }
          throw sendError;
        }

        // Update message with WhatsApp message ID
        const messageId = waMessage.id.id || waMessage.id._serialized || waMessage.id;
        return await this.messageRepository.update(message.id, {
          waMessageId: messageId,
          status: MessageStatus.SENT,
        });
      } catch (error) {
        // Mark message as failed if WhatsApp Web fails
        await this.messageRepository.update(message.id, {
          status: MessageStatus.FAILED,
        });

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error({ error, phoneNumber: input.phoneNumber, errorMessage }, 'WhatsApp Web send failed');
        throw new ExternalServiceError('WhatsApp Web', errorMessage);
      }
    } catch (error) {
      logger.error({ input, error }, 'Failed to send message');
      throw error;
    }
  }

  async receiveMessage(waMessageId: string, payload: any): Promise<Message> {
    try {
      // Check if message already exists
      const existing = await this.messageRepository.findByWaMessageId(waMessageId);
      if (existing) {
        return existing;
      }

      // Create new message
      const message = await this.messageRepository.create({
        waMessageId,
        user: { connect: { id: payload.userId } },
        contact: { connect: { id: payload.contactId } },
        conversation: { connect: { id: payload.conversationId } },
        content: payload.content,
        messageType: MessageType.TEXT,
        direction: MessageDirection.INCOMING,
        status: MessageStatus.RECEIVED,
      } as any);

      logger.info({ messageId: message.id }, 'Message received');
      return message;
    } catch (error) {
      logger.error({ waMessageId, payload, error }, 'Failed to receive message');
      throw error;
    }
  }

  async getMessagesByContact(
    userId: string,
    contactId: string,
    limit?: number,
    offset?: number,
  ): Promise<PaginatedResult<Message>> {
    try {
      const contact = await this.contactRepository.findById(contactId);
      if (!contact || contact.userId !== userId) {
        throw new NotFoundError('Contact');
      }

      const conversation = await this.conversationRepository.findOrCreate(userId, contactId);

      return await this.messageRepository.findByConversation(conversation.id, {
        limit,
        offset,
      });
    } catch (error) {
      logger.error({ contactId, error }, 'Failed to get messages by contact');
      throw error;
    }
  }

  async getMessages(
    userId: string,
    conversationId: string,
    limit?: number,
    offset?: number,
  ): Promise<PaginatedResult<Message>> {
    try {
      // Verify user owns conversation (authorization)
      // ... additional check needed

      return await this.messageRepository.findByConversation(conversationId, {
        limit,
        offset,
      });
    } catch (error) {
      logger.error({ conversationId, error }, 'Failed to get messages');
      throw error;
    }
  }

  async markAsRead(messageId: string): Promise<Message> {
    try {
      const message = await this.messageRepository.findById(messageId);
      if (!message) {
        throw new NotFoundError('Message');
      }

      return await this.messageRepository.update(messageId, {
        status: MessageStatus.READ,
        readAt: new Date(),
      });
    } catch (error) {
      logger.error({ messageId, error }, 'Failed to mark message as read');
      throw error;
    }
  }

  async sendReaction(userId: string, messageId: string, emoji: string): Promise<void> {
    try {
      const message = await this.messageRepository.findById(messageId);
      if (!message) {
        throw new NotFoundError('Message');
      }

      // Get user's active WhatsApp Web session
      const { whatsappWebService } = await import('./whatsapp-web.service');
      const sessions = whatsappWebService.getUserSessions(userId);
      const activeSession = sessions.find((s) => s.status === 'READY');

      if (!activeSession) {
        throw new ValidationError('WhatsApp is not connected. Please scan the QR code.');
      }

      // Send reaction using waMessageId
      if (!message.waMessageId) {
        throw new ValidationError('Cannot react to message without WhatsApp ID');
      }

      const normalizedEmoji = typeof emoji === 'string' ? emoji : '';
      await whatsappWebService.sendReaction(activeSession.id, message.waMessageId, normalizedEmoji);

      // Update message metadata with reaction
      await this.messageRepository.update(messageId, {
        metadata: {
          ...(typeof message.metadata === 'object' ? message.metadata : {}),
          reaction: normalizedEmoji ? normalizedEmoji : null,
        } as any,
      });

      logger.info({ messageId, emoji: normalizedEmoji }, 'Reaction sent successfully');
    } catch (error) {
      logger.error({ messageId, emoji, error }, 'Failed to send reaction');
      throw error;
    }
  }

  async deleteMessage(messageId: string): Promise<void> {
    try {
      const message = await this.messageRepository.findById(messageId);
      if (!message) {
        throw new NotFoundError('Message');
      }

      // Can only delete outgoing messages
      if (message.direction !== 'OUTGOING') {
        throw new ValidationError('Can only delete outgoing messages');
      }

      await this.messageRepository.delete(messageId);
      logger.info({ messageId }, 'Message deleted');
    } catch (error) {
      logger.error({ messageId, error }, 'Failed to delete message');
      throw error;
    }
  }

  async listMessages(userId: string, filters: MessageFilters): Promise<PaginatedResult<Message>> {
    try {
      return await this.messageRepository.findByUser(userId, filters);
    } catch (error) {
      logger.error({ userId, filters, error }, 'Failed to list messages');
      throw error;
    }
  }
}
