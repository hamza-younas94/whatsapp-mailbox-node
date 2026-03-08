// src/server.ts
// Express application setup

import dotenv from 'dotenv';
dotenv.config();

import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import jwt from 'jsonwebtoken';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { getEnv } from '@config/env';
import { connectDatabase, disconnectDatabase } from '@config/database';
import { setupErrorMiddleware } from '@middleware/error.middleware';
import { createMessageRoutes } from '@routes/messages';
import { createContactRoutes } from '@routes/contacts';
import authRoutes from '@routes/auth';
import quickReplyRoutes from '@routes/quick-replies';
import tagRoutes from '@routes/tags';
import segmentRoutes from '@routes/segments';
import broadcastRoutes from '@routes/broadcasts';
import automationRoutes from '@routes/automations';
import analyticsRoutes from '@routes/analytics';
import crmRoutes from '@routes/crm';
import noteRoutes from '@routes/notes';
import whatsappWebRoutes from '@routes/whatsapp-web';
import mediaRoutes from '@routes/media';
import dripCampaignRoutes from '@routes/drip-campaigns';
import productRoutes from '@routes/products';
import invoiceRoutes from '@routes/invoices';
import orderRoutes from '@routes/orders';
import serviceTicketRoutes from '@routes/service-tickets';
import appointmentRoutes from '@routes/appointments';
import expenseRoutes from '@routes/expenses';
import customerSubscriptionRoutes from '@routes/customer-subscriptions';
import autoTagRuleRoutes from '@routes/auto-tag-rules';
import taskRoutes from '@routes/tasks';
import activityLogRoutes from '@routes/activity-logs';
import scheduledMessageRoutes from '@routes/scheduled-messages';
import messageTemplateRoutes from '@routes/message-templates';
import labelRoutes from '@routes/labels';
import appConfigRoutes from '@routes/app-config';
import { globalLimiter } from '@middleware/rate-limit.middleware';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from '@config/swagger';
import { whatsappWebService } from '@services/whatsapp-web.service';
import { autoReplyService } from '@services/auto-reply.service';
import { getContactType } from '@utils/contact-type';
import { downloadAvatar } from '@utils/avatar';
import { formatDateTime, formatDate } from '@utils/timezone';
import { MessageType } from '@prisma/client';
import { MessageRepository } from '@repositories/message.repository';
import { ContactRepository } from '@repositories/contact.repository';
import { ConversationRepository } from '@repositories/conversation.repository';
import { getPrismaClient } from '@config/database';
import logger from '@utils/logger';

// Global Socket.IO instance for broadcasting events
export let io: SocketIOServer | null = null;

export function createApp(): Express {
  const app = express();
  const env = getEnv();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'", 'https:', 'data:'],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          'https://cdn.tailwindcss.com',
          'https://cdnjs.cloudflare.com',
          'https://cdn.jsdelivr.net',
          'https://static.cloudflareinsights.com',
        ],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com', 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'data:', 'https://cdnjs.cloudflare.com', 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'http://whatshub.nexofydigital.com:3000', 'https://whatshub.nexofydigital.com:3000'],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));
  app.use(cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  }));

  // Trust proxy (behind reverse proxy / load balancer)
  app.set('trust proxy', 1);

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // Serve static files (QR test page and uploaded media)
  app.use(express.static(path.join(__dirname, '../public')));
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Rate limiting
  app.use('/api/', globalLimiter);

  // Logging middleware
  app.use((req, _res, next) => {
    logger.info({ method: req.method, path: req.path }, `${req.method} ${req.path}`);
    next();
  });

  // Health check
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
    });
  });

  // Swagger API Documentation
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'WhatsApp Mailbox API Docs',
  }));

  // API routes
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/messages', createMessageRoutes());
  app.use('/api/v1/contacts', createContactRoutes());
  app.use('/api/v1/quick-replies', quickReplyRoutes);
  app.use('/api/v1/media', mediaRoutes);
  app.use('/api/v1/tags', tagRoutes);
  app.use('/api/v1/segments', segmentRoutes);
  app.use('/api/v1/broadcasts', broadcastRoutes);
  app.use('/api/v1/automations', automationRoutes);
  app.use('/api/v1/automation', automationRoutes);
  app.use('/api/v1/analytics', analyticsRoutes);
  app.use('/api/v1/crm', crmRoutes);
  app.use('/api/v1/notes', noteRoutes);
  app.use('/api/v1/drip-campaigns', dripCampaignRoutes);
  app.use('/api/v1/whatsapp-web', whatsappWebRoutes);

  // Business feature routes
  app.use('/api/v1/products', productRoutes);
  app.use('/api/v1/invoices', invoiceRoutes);
  app.use('/api/v1/orders', orderRoutes);
  app.use('/api/v1/service-tickets', serviceTicketRoutes);
  app.use('/api/v1/appointments', appointmentRoutes);
  app.use('/api/v1/expenses', expenseRoutes);
  app.use('/api/v1/customer-subscriptions', customerSubscriptionRoutes);
  app.use('/api/v1/auto-tag-rules', autoTagRuleRoutes);
  app.use('/api/v1/tasks', taskRoutes);
  app.use('/api/v1/activity-logs', activityLogRoutes);
  app.use('/api/v1/scheduled-messages', scheduledMessageRoutes);
  app.use('/api/v1/message-templates', messageTemplateRoutes);
  app.use('/api/v1/labels', labelRoutes);
  app.use('/api/v1/app-config', appConfigRoutes);

  // Serve index.html for all non-API routes (SPA fallback)
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/')) {
      res.sendFile(path.join(__dirname, '../public/index.html'));
    } else {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Resource not found' } });
    }
  });

  // Error handling (must be last)
  setupErrorMiddleware(app);

  // Setup WhatsApp message listener to capture incoming messages
  setupIncomingMessageListener();

  // Setup WhatsApp reaction listener to capture reactions
  setupReactionListener();

  // Setup chat sync listener — sync existing contacts when session becomes READY
  setupChatSyncListener();

  return app;
}

/**
 * Listen for incoming WhatsApp reactions
 */
function setupReactionListener(): void {
  whatsappWebService.on('reaction', async (event: any) => {
    try {
      const { sessionId, messageId, reaction, from, timestamp } = event;
  logger.info({ sessionId, messageId, reaction, from }, 'Reaction received from WhatsApp');

      // Get session to find userId
      const session = whatsappWebService.getSession(sessionId);
      if (!session) {
        logger.warn({ sessionId }, 'Reaction received but no session found');
        return;
      }

      const userId = session.userId;
      const db = getPrismaClient();
      const messageRepo = new MessageRepository(db);

      // Find message by waMessageId
      const message = await messageRepo.findByWaMessageId(messageId);
      if (!message) {
        logger.warn({ messageId }, 'Reaction received but message not found in database');
        return;
      }

      // Update message with reaction
      await messageRepo.update(message.id, {
        metadata: {
          ...(typeof message.metadata === 'object' ? message.metadata : {}),
          reaction: reaction || null,
        } as any,
      });

      logger.info({ messageId: message.id, reaction }, 'Reaction saved to database');
      
          // Broadcast reaction to all connected users in this conversation via Socket.IO
          if (io) {
            io.to(`user:${userId}`).emit('reaction:updated', {
              messageId: message.id,
              waMessageId: messageId,
              reaction: reaction,
              from,
              timestamp,
              conversationId: message.conversationId,
            });
            logger.info({ messageId: message.id, userId }, 'Reaction broadcasted via Socket.IO');
          }
    } catch (error) {
      logger.error({ error, event }, 'Failed to save reaction');
    }
  });

  logger.info('WhatsApp reaction listener initialized');
}

/**
 * Listen for WhatsApp session READY event and sync all existing chats
 * into the database. This populates contacts that existed before the app.
 */
function setupChatSyncListener(): void {
  whatsappWebService.on('ready', async (event: any) => {
    const { sessionId } = event;
    logger.info({ sessionId }, 'Session ready — starting chat sync...');

    try {
      const session = whatsappWebService.getSession(sessionId);
      if (!session) {
        logger.warn({ sessionId }, 'Chat sync: session not found');
        return;
      }

      const userId = session.userId;
      const chats = await whatsappWebService.syncAllChats(sessionId);
      logger.info({ sessionId, chatCount: chats.length }, 'Fetched chats for sync');

      const db = getPrismaClient();
      const contactRepo = new ContactRepository(db);
      const conversationRepo = new ConversationRepository(db);

      let synced = 0;
      let skipped = 0;

      for (const chat of chats) {
        try {
          // Skip status broadcast
          if (chat.chatId === 'status@broadcast') continue;

          const phone = sanitizePhone(chat.chatId);
          if (!phone) {
            skipped++;
            continue;
          }

          const contactType = getContactType(chat.chatId, phone);

          // Download avatar locally instead of storing expired CDN URL
          let localAvatar: string | undefined;
          if (chat.profilePicUrl && !chat.profilePicUrl.startsWith('/')) {
            const downloaded = await downloadAvatar(chat.chatId, chat.profilePicUrl);
            if (downloaded) localAvatar = downloaded;
          } else if (chat.profilePicUrl) {
            localAvatar = chat.profilePicUrl;
          }

          // Create or update contact
          await contactRepo.findOrCreate(userId, phone, {
            ...(chat.name ? { name: chat.name } : {}),
            chatId: chat.chatId,
            contactType,
            ...(chat.timestamp ? { lastMessageAt: new Date(chat.timestamp * 1000) } : {}),
            ...(localAvatar ? { profilePhotoUrl: localAvatar } : {}),
          });

          // Ensure conversation exists
          const contact = await contactRepo.findByPhoneNumber(userId, phone);
          if (contact) {
            await conversationRepo.findOrCreate(userId, contact.id);
          }

          synced++;
        } catch (chatError) {
          logger.debug({ chatId: chat.chatId, error: chatError }, 'Chat sync: failed to sync individual chat');
          skipped++;
        }
      }

      logger.info({ sessionId, synced, skipped, total: chats.length }, 'Chat sync completed');

      // Notify frontend to refresh conversations
      if (io) {
        io.to(`user:${userId}`).emit('chats:synced', { synced, total: chats.length });
      }

      // Start slow background avatar fetch (non-blocking)
      const chatIdsForAvatars = chats
        .map(c => c.chatId)
        .filter(id => id !== 'status@broadcast');
      whatsappWebService.fetchAvatarsSlowly(sessionId, chatIdsForAvatars)
        .then(() => logger.info({ sessionId }, 'Background avatar fetch done'))
        .catch(err => logger.error({ err, sessionId }, 'Background avatar fetch error'));

      // Listen for downloaded avatars and update DB
      whatsappWebService.on('avatar:downloaded', async ({ chatId: avatarChatId, localUrl }) => {
        try {
          await db.contact.updateMany({
            where: { userId, chatId: avatarChatId },
            data: { profilePhotoUrl: localUrl },
          });
        } catch {
          // Non-critical
        }
      });
    } catch (error) {
      logger.error({ error, sessionId }, 'Chat sync failed');
    }
  });

  logger.info('WhatsApp chat sync listener initialized');
}

/**
 * Listen for incoming WhatsApp messages and save them to database
 */
function setupIncomingMessageListener(): void {
  whatsappWebService.on('message', async (event: any) => {
    try {
      const {
        sessionId,
        from,
        body,
        hasMedia,
        timestamp,
        waMessageId,
        messageType,
        message, // Full WhatsApp message object
          isOutgoing, // Whether this is an outgoing message
        contactName,
        contactPushName,
        contactBusinessName,
        profilePhotoUrl,
        isBusiness,
      } = event;

      logger.info(
        {
          sessionId,
          from,
          body: body?.substring(0, 50),
          hasMedia,
          timestamp,
          messageType,
          contactName,
          isOutgoing,
        },
        isOutgoing ? 'RAW outgoing message event (from mobile/desktop)' : 'RAW incoming message event'
      );

      // Skip messages with no content and no media (read receipts, delivery confirmations, etc.)
      if (!body && !hasMedia) {
        logger.debug({ sessionId, from, messageType, isOutgoing }, 'Skipping empty message with no media');
        return;
      }

      // Get the session to find the userId
      const session = whatsappWebService.getSession(sessionId);
      if (!session) {
        logger.warn({ sessionId }, 'Incoming message but no session found');
        return;
      }

      const userId = session.userId;
      const sanitizedPhone = sanitizePhone(from);
      if (!sanitizedPhone) {
        logger.warn({ sessionId, from }, 'Skipping message with no usable phone number');
        return;
      }

      logger.info(
        {
          userId,
          phoneNumber: sanitizedPhone,
                    isOutgoing,
          body: body?.substring(0, 50),
          messageType,
          contactName,
        },
        isOutgoing ? 'Processing outgoing WhatsApp message' : 'Processing incoming WhatsApp message'
      );

      // Create repositories with prisma client
      const db = getPrismaClient();
      const contactRepo = new ContactRepository(db);
      const conversationRepo = new ConversationRepository(db);
      const messageRepo = new MessageRepository(db);
      const QuickReplyRepository = require('@repositories/quick-reply.repository').QuickReplyRepository;
      const quickReplyRepo = new QuickReplyRepository(db);

      // Prepare contact data with proper name resolution
      // Only use actual name data from WhatsApp — do NOT fall back to phone number
      // as that would overwrite existing contact names on every outgoing message
      const hasRealNameData = contactBusinessName || contactName || contactPushName;
      const contactDisplayName = hasRealNameData
        ? (contactBusinessName || contactName || contactPushName)
        : undefined;

      // Get or create contact with enriched data
      const contactTypeEnum = getContactType(from, sanitizedPhone);
      const existingContact = await contactRepo.findByPhoneNumber(userId, sanitizedPhone);

      // Download avatar locally instead of storing expired CDN URL
      let localAvatar: string | undefined;
      if (profilePhotoUrl && !profilePhotoUrl.startsWith('/')) {
        const downloaded = await downloadAvatar(from, profilePhotoUrl);
        if (downloaded) localAvatar = downloaded;
      } else if (profilePhotoUrl) {
        localAvatar = profilePhotoUrl;
      }

      const contact = await contactRepo.findOrCreate(userId, sanitizedPhone, {
        // Only set name if we have real WhatsApp data, or if brand new contact (use phone as placeholder)
        ...(contactDisplayName
          ? { name: contactDisplayName }
          : (!existingContact ? { name: sanitizedPhone } : {})),
        ...(contactPushName ? { pushName: contactPushName } : {}),
        ...(contactBusinessName ? { businessName: contactBusinessName } : {}),
        ...(localAvatar ? { profilePhotoUrl: localAvatar } : {}),
        isBusiness: isBusiness || false,
        chatId: from,
        contactType: contactTypeEnum,
        lastMessageAt: new Date(timestamp * 1000),
        lastActiveAt: new Date(timestamp * 1000),
      });

      // Update contact with latest info ONLY if we have genuinely new data
      // Skip update for outgoing messages where we lack recipient's actual info
      if (hasRealNameData && (
        (contactName && contactName !== contact.name) ||
        (contactPushName && (contactPushName !== (contact as any).pushName)) ||
        (localAvatar && localAvatar !== (contact as any).profilePhotoUrl)
      )) {
        await contactRepo.update(contact.id, {
          ...(contactName ? { name: contactName } : {}),
          ...(contactPushName ? { pushName: contactPushName } : {}),
          ...(localAvatar ? { profilePhotoUrl: localAvatar } : {}),
          isBusiness: isBusiness !== undefined ? isBusiness : (contact as any).isBusiness,
          lastMessageAt: new Date(timestamp * 1000),
          lastActiveAt: new Date(timestamp * 1000),
        } as any);
      }

      // Get or create conversation
      const conversation = await conversationRepo.findOrCreate(userId, contact.id);

      // Auto-reply with quick replies on incoming messages
      // SKIP for groups (@g.us) and channels (@newsletter) - they don't support auto-replies
      const isGroupOrChannel = from.includes('@g.us') || from.includes('@newsletter') || from.includes('@broadcast');
      
      if (!isOutgoing && !isGroupOrChannel && body && body.trim()) {
        try {
          // Get all quick replies for the user
          const allQuickReplies = await quickReplyRepo.findByUserId(userId);
          
          // Use the advanced auto-reply service to find best match
          const autoReplyResult = await autoReplyService.processAutoReply(
            {
              userId,
              contactId: contact.id,
              conversationId: conversation.id,
              messageText: body,
              timestamp: Date.now(),
            },
            allQuickReplies
          );
          
          if (autoReplyResult) {
            const { reply: matchedReply, matchType, score } = autoReplyResult;
            const session = whatsappWebService.getSession(sessionId);
            
            if (session) {
              try {
                // Simulate human typing to look natural and avoid WhatsApp bot detection
                try {
                  const chat = await session.client.getChatById(from);
                  if (chat) {
                    await chat.sendStateTyping();
                    // Random delay: 2-5 seconds base + ~30ms per character (capped at 8s)
                    const charDelay = Math.min(matchedReply.content.length * 30, 5000);
                    const randomBase = 2000 + Math.random() * 3000;
                    const typingDelay = Math.min(randomBase + charDelay, 8000);
                    await new Promise(resolve => setTimeout(resolve, typingDelay));
                    await chat.clearState();
                  }
                } catch (typingErr) {
                  logger.debug({ error: typingErr }, 'Typing simulation failed, sending anyway');
                }

                // Send the auto-reply
                const sentMsg = await session.client.sendMessage(from, matchedReply.content);
                
                // Save auto-reply to database history
                const autoReplyWaId = sentMsg.id?.id || `auto-${from}-${Date.now()}`;
                const savedAutoReply = await messageRepo.create({
                  user: { connect: { id: userId } },
                  contact: { connect: { id: contact.id } },
                  conversation: { connect: { id: conversation.id } },
                  content: matchedReply.content,
                  messageType: 'TEXT' as any,
                  direction: 'OUTGOING',
                  status: 'SENT',
                  waMessageId: autoReplyWaId,
                  quickReplyId: matchedReply.id,
                } as any);
                
                // Update quick reply usage statistics
                await quickReplyRepo.update(matchedReply.id, {
                  usageCount: matchedReply.usageCount + 1,
                  usageTodayCount: matchedReply.usageTodayCount + 1,
                  lastUsedAt: new Date(),
                });
                
                // Emit auto-reply to client in real-time
                if (io) {
                  io.to(`user:${userId}`).emit('message:received', {
                    id: savedAutoReply.id,
                    contactId: contact.id,
                    conversationId: conversation.id,
                    content: savedAutoReply.content || '',
                    createdAt: savedAutoReply.createdAt.toISOString(),
                    messageType: savedAutoReply.messageType,
                    direction: savedAutoReply.direction,
                    status: savedAutoReply.status,
                  });
                }
                
                logger.info({ 
                  from, 
                  shortcut: matchedReply.shortcut,
                  reply: matchedReply.content.substring(0, 50),
                  matchType,
                  score: score.toFixed(2),
                  savedId: savedAutoReply.id
                }, 'Auto-reply sent and saved to history');
              } catch (sendError: any) {
                // Handle detached frame errors - try to reconnect
                if (sendError.message?.includes('detached Frame')) {
                  logger.warn({ sessionId, error: sendError.message }, 'Detached frame detected, will attempt reconnection');
                  session.status = 'DISCONNECTED';
                  // Session will be auto-reconnected by the next operation or user action
                } else {
                  throw sendError;
                }
              }
            }
          }
        } catch (autoReplyError) {
          logger.debug({ error: autoReplyError }, 'Failed to process auto-reply, continuing with normal message handling');
        }
      }

      // Derive a Prisma-safe message type from WhatsApp message metadata
      const normalizedType = normalizeMessageType(messageType, hasMedia);

      // Ensure we never violate the unique constraint on waMessageId
      const safeWaMessageId = waMessageId || `${from}-${timestamp}-${Date.now()}`;

      // Deduplicate if this waMessageId already exists (prevents double saves)
      if (waMessageId) {
        const existing = await messageRepo.findByWaMessageId(waMessageId);
        if (existing) {
          logger.info({ waMessageId, existingId: existing.id }, 'Skipping duplicate message by waMessageId');
          return;
        }
      }

      // Additional deduplication: check for recent messages with same content
      // This prevents auto-replies from being saved twice (once manually, once via message_create event)
      if (body && body.trim()) {
        const recentDuplicate = await messageRepo.findRecentByContent(
          userId,
          contact.id,
          body,
          isOutgoing ? 'OUTGOING' : 'INCOMING',
          3 // Check within last 3 seconds
        );
        if (recentDuplicate) {
          logger.info({ 
            messageId: recentDuplicate.id, 
            content: body.substring(0, 50),
            direction: isOutgoing ? 'OUTGOING' : 'INCOMING'
          }, 'Skipping duplicate message by content (saved recently)');
          return;
        }
      }

      // Handle media download if message has media
      let mediaUrl: string | undefined;
      if (hasMedia && message) {
        try {
          logger.info({ sessionId, from, messageType }, 'Message has media, attempting download');
          mediaUrl = await whatsappWebService.downloadMedia(message);
          logger.info({ sessionId, from, mediaUrl }, 'Media downloaded successfully');
        } catch (mediaError) {
          logger.error({ error: mediaError, sessionId, from }, 'Failed to download media');
          // Continue without media URL
        }
      }

      // Save message to database
      const savedMessage = await messageRepo.create({
        user: { connect: { id: userId } },
        contact: { connect: { id: contact.id } },
        conversation: { connect: { id: conversation.id } },
        content: body || (hasMedia ? `[${normalizedType}]` : ''),
        messageType: normalizedType as any,
        direction: isOutgoing ? 'OUTGOING' : 'INCOMING',
        status: isOutgoing ? 'SENT' : 'RECEIVED',
        waMessageId: safeWaMessageId,
        mediaUrl: mediaUrl,
      } as any);

      // Emit real-time update to client
      if (io) {
        io.to(`user:${userId}`).emit('message:received', {
          id: savedMessage.id,
          contactId: contact.id,
          conversationId: conversation.id,
          content: savedMessage.content || '',
          createdAt: savedMessage.createdAt.toISOString(),
          messageType: savedMessage.messageType,
          direction: savedMessage.direction,
          status: savedMessage.status,
          mediaUrl: savedMessage.mediaUrl,
          mediaType: savedMessage.mediaType,
        });
      }

  logger.info({ userId, phoneNumber: sanitizedPhone, contactId: contact.id, hasMedia, mediaUrl, isOutgoing }, isOutgoing ? 'Saved outgoing message to database' : 'Saved incoming message to database');

      // Trigger automations for incoming messages (forwarding, auto-tag, etc.)
      if (!isOutgoing && body) {
        try {
          const { AutomationRepository } = require('@repositories/automation.repository');
          const { AutomationService } = require('@services/automation.service');
          const { TagService } = require('@services/tag.service');
          const { TagRepository } = require('@repositories/tag.repository');

          const automationRepo = new AutomationRepository(db);
          const tagRepo = new TagRepository(db);
          const tagService = new TagService(tagRepo);
          // messageService needs WhatsApp service — use a lightweight proxy
          const { MessageService } = require('@services/message.service');
          const messageService = new MessageService(
            require('@repositories/message.repository').MessageRepository ? new (require('@repositories/message.repository').MessageRepository)(db) : {} as any,
            {} as any, // whatsapp service placeholder
            {} as any, // conversation repo placeholder
          );
          // Override sendMessage to use the actual WhatsApp session
          messageService.sendMessage = async (_uid: string, params: any) => {
            const targetContact = await contactRepo.findById(params.contactId);
            if (!targetContact) return;
            const targetChatId = (targetContact as any).chatId || `${targetContact.phoneNumber}@c.us`;
            const sess = whatsappWebService.getSession(sessionId);
            if (sess) {
              await sess.client.sendMessage(targetChatId, params.content || '');
              logger.info({ targetChatId, content: (params.content || '').substring(0, 50) }, 'Forwarded message via automation');
            }
          };

          const automationService = new AutomationService(automationRepo, messageService, tagService, contactRepo);

          // Trigger MESSAGE_RECEIVED automations
          await automationService.triggerAutomations('message_received', {
            userId,
            contactId: contact.id,
            messageContent: body,
            mediaUrl,
            from,
          });

          // Trigger KEYWORD automations — check if body matches any keyword triggers
          const keywordAutomations = await automationRepo.findByTrigger('keyword');
          for (const auto of keywordAutomations) {
            const conditions = auto.conditions as any;
            const keyword = conditions?.keyword;
            if (keyword && body.toLowerCase().includes(keyword.toLowerCase())) {
              await automationService.executeAutomation(auto.id, {
                userId,
                contactId: contact.id,
                messageContent: body,
                mediaUrl,
                from,
              });
            }
          }
        } catch (autoError) {
          logger.debug({ error: autoError }, 'Automation trigger failed (non-critical)');
        }
      }
    } catch (error) {
      logger.error({ error, event }, 'Failed to save WhatsApp message');
    }
  });

  logger.info('WhatsApp message listener initialized (incoming and outgoing)');
}


function sanitizePhone(from: string): string {
  const base = from.split('@')[0];
  const digits = base.replace(/\D/g, '');
  return digits.slice(-20);
}

function normalizeMessageType(rawType?: string, hasMedia?: boolean): MessageType {
  switch (rawType) {
    case 'image':
      return MessageType.IMAGE;
    case 'video':
      return MessageType.VIDEO;
    case 'audio':
    case 'ptt':
      return MessageType.AUDIO;
    case 'document':
      return MessageType.DOCUMENT;
    case 'location':
      return MessageType.LOCATION;
    case 'contact_card':
      return MessageType.CONTACT;
    case 'sticker':
      return MessageType.IMAGE;
    default:
      return hasMedia ? MessageType.DOCUMENT : MessageType.TEXT;
  }
}

export async function startServer(): Promise<void> {
  try {
    const env = getEnv();
    const app = createApp();

    // Connect database
    await connectDatabase();

    // Create HTTP server for Socket.IO
    const httpServer = createServer(app);
    io = new SocketIOServer(httpServer, {
      cors: {
        origin: env.CORS_ORIGIN,
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    // Socket.IO authentication middleware
    io.use((socket, next) => {
      const token = socket.handshake.auth?.token;
      if (!token) {
        // Allow unauthenticated connections for backward compatibility
        logger.warn({ socketId: socket.id }, 'Socket.IO connection without auth token');
        return next();
      }

      try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string; id: string; email: string; role: string };
        (socket as any).user = decoded;
        next();
      } catch (err) {
        logger.warn({ socketId: socket.id }, 'Socket.IO invalid auth token');
        next();
      }
    });

    // Socket.IO connection handling
    io.on('connection', (socket) => {
      const user = (socket as any).user;
      logger.info({ socketId: socket.id, userId: user?.id }, 'Socket.IO client connected');

      // Auto-join user room if authenticated
      if (user?.id) {
        socket.join(`user:${user.id}`);
        logger.info({ socketId: socket.id, userId: user.id }, 'Auto-joined user socket room');
      }

      // Backward-compatible manual join (validates against auth token)
      socket.on('join-user', (userId: string) => {
        if (user?.id && userId !== user.id) {
          logger.warn({ socketId: socket.id, requestedUserId: userId, actualUserId: user.id }, 'Socket room join denied: userId mismatch');
          return;
        }
        socket.join(`user:${userId}`);
        logger.info({ socketId: socket.id, userId }, 'User joined socket room');
      });

      socket.on('disconnect', () => {
        logger.info({ socketId: socket.id }, 'Socket.IO client disconnected');
      });
    });

    // Start listening
    httpServer.listen(env.PORT, '0.0.0.0', () => {
      logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Server started with Socket.IO');
      
      // Auto-restore WhatsApp sessions after server starts
      // LocalAuth stores sessions in directories named "session-<clientId>"
      // Our clientId format is "session_<userId>", so dirs are "session-session_<userId>"
      setTimeout(async () => {
        try {
          logger.info('Attempting to auto-restore WhatsApp sessions...');

          const fs = await import('fs');
          const sessionPath = whatsappWebService.getSessionDir();

          if (fs.existsSync(sessionPath)) {
            const sessionDirs = fs.readdirSync(sessionPath)
              .filter(d => fs.statSync(path.join(sessionPath, d)).isDirectory());
            logger.info({ count: sessionDirs.length, dirs: sessionDirs }, 'Found session directories');

            for (const dir of sessionDirs) {
              // LocalAuth creates dirs like "session-session_<userId>"
              // Only restore primary sessions (no UUID suffix from old stale sessions)
              const match = dir.match(/^session-(session_[a-z0-9]+)$/);
              if (match) {
                const sessionId = match[1]; // "session_<userId>"
                const userId = sessionId.replace(/^session_/, ''); // "<userId>"
                logger.info({ sessionId, userId, dir }, 'Restoring session from saved auth...');

                try {
                  await whatsappWebService.initializeSession(userId, sessionId);
                  logger.info({ sessionId }, 'Session restored successfully');
                } catch (error) {
                  logger.error({ sessionId, error }, 'Failed to restore session');
                }
              }
            }
          } else {
            logger.info('No existing sessions found');
          }
        } catch (error) {
          logger.error({ error }, 'Failed to auto-restore sessions');
        }
      }, 5000); // Wait 5 seconds after server starts
    });

    // ---- Appointment & Invoice Reminder Processor (every 15 min) ----
    setInterval(async () => {
      try {
        const db = getPrismaClient();
        const now = new Date();
        const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        // Find upcoming appointments (24h window) that haven't been reminded
        const upcomingAppointments = await db.appointment.findMany({
          where: {
            reminderSent: false,
            status: 'SCHEDULED',
            appointmentDate: { gte: now, lte: in24h },
          },
          include: { contact: true },
        });

        for (const apt of upcomingAppointments) {
          if (!apt.contact?.chatId) continue;

          // Get first active session for the user
          const session = whatsappWebService.getActiveSessions()
            .find(s => s.userId === apt.userId && s.status === 'READY');
          if (!session) continue;

          const timeUntil = apt.appointmentDate.getTime() - now.getTime();
          const hours = Math.round(timeUntil / (60 * 60 * 1000));
          const timeStr = hours > 1 ? `in ${hours} hours` : 'in about 1 hour';

          const message = `⏰ Reminder: You have an appointment "${apt.title}" ${timeStr}.\n\n📅 ${formatDateTime(apt.appointmentDate)}\n${apt.location ? '📍 ' + apt.location : ''}`.trim();

          try {
            await session.client.sendMessage(apt.contact.chatId, message);
            await db.appointment.update({ where: { id: apt.id }, data: { reminderSent: true } });
            logger.info({ appointmentId: apt.id, contactId: apt.contactId }, 'Appointment reminder sent');
          } catch (err) {
            logger.error({ appointmentId: apt.id, error: err }, 'Failed to send appointment reminder');
          }
        }

        // Find overdue invoices and send payment reminders (once per day logic via notes)
        const overdueInvoices = await db.invoice.findMany({
          where: {
            status: { in: ['SENT', 'PARTIALLY_PAID'] },
            dueDate: { lt: now },
          },
          include: { contact: true },
        });

        for (const inv of overdueInvoices) {
          if (!inv.contact?.chatId) continue;
          // Skip if we already reminded in the last 24 hours
          const reminderMatch = inv.notes?.match(/\[REMINDER_SENT:(\d+)\]/);
          if (reminderMatch) {
            const lastTime = parseInt(reminderMatch[1]);
            if (now.getTime() - lastTime < 24 * 60 * 60 * 1000) continue;
          }

          const session = whatsappWebService.getActiveSessions()
            .find(s => s.userId === inv.userId && s.status === 'READY');
          if (!session) continue;

          const daysOverdue = Math.ceil((now.getTime() - inv.dueDate!.getTime()) / (24 * 60 * 60 * 1000));
          const message = `💳 Payment Reminder\n\nInvoice #${inv.invoiceNumber} is ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue.\n\nAmount Due: ${inv.balanceAmount.toFixed(2)}\nDue Date: ${formatDate(inv.dueDate!)}\n\nPlease arrange payment at your earliest convenience.`;

          try {
            await session.client.sendMessage(inv.contact.chatId, message);
            // Mark reminder timestamp
            const noteAppend = `[REMINDER_SENT:${now.getTime()}]`;
            await db.invoice.update({ where: { id: inv.id }, data: { notes: (inv.notes || '') + noteAppend } });
            logger.info({ invoiceId: inv.id, invoiceNumber: inv.invoiceNumber }, 'Payment reminder sent');
          } catch (err) {
            logger.error({ invoiceId: inv.id, error: err }, 'Failed to send payment reminder');
          }
        }

        if (upcomingAppointments.length > 0 || overdueInvoices.length > 0) {
          logger.info({ appointments: upcomingAppointments.length, invoices: overdueInvoices.length }, 'Reminder check completed');
        }
      } catch (error) {
        logger.error({ error }, 'Reminder processor error');
      }
    }, 15 * 60 * 1000); // Every 15 minutes
    logger.info('Reminder processor started (15-minute interval)');

    // ---- Scheduled Message Processor (every 60 seconds) ----
    setInterval(async () => {
      try {
        const db = getPrismaClient();
        const now = new Date();

        const pendingMessages = await db.scheduledMessage.findMany({
          where: {
            status: 'PENDING',
            scheduledFor: { lte: now },
          },
          include: {
            User: true,
          },
          take: 20,
        });

        if (pendingMessages.length === 0) return;

        for (const msg of pendingMessages) {
          try {
            // Find contact to get chatId
            const contact = await db.contact.findUnique({
              where: { id: msg.contactId },
              select: { chatId: true },
            });

            if (!contact?.chatId) {
              await db.scheduledMessage.update({
                where: { id: msg.id },
                data: { status: 'FAILED', error: 'Contact has no chatId' },
              });
              continue;
            }

            // Get active session for the user
            const session = whatsappWebService.getActiveSessions()
              .find(s => s.userId === msg.userId && s.status === 'READY');

            if (!session) {
              // Don't mark as failed — retry on next cycle when session may be ready
              if (msg.retryCount >= 5) {
                await db.scheduledMessage.update({
                  where: { id: msg.id },
                  data: { status: 'FAILED', error: 'No active WhatsApp session after 5 retries' },
                });
              } else {
                await db.scheduledMessage.update({
                  where: { id: msg.id },
                  data: { retryCount: { increment: 1 } },
                });
              }
              continue;
            }

            // Send message
            if (msg.mediaUrl) {
              const { MessageMedia } = await import('whatsapp-web.js');
              const media = await MessageMedia.fromUrl(msg.mediaUrl, { unsafeMime: true });
              await session.client.sendMessage(contact.chatId, media, { caption: msg.message });
            } else {
              await session.client.sendMessage(contact.chatId, msg.message);
            }

            await db.scheduledMessage.update({
              where: { id: msg.id },
              data: { status: 'SENT', sentAt: new Date() },
            });

            logger.info({ scheduledMessageId: msg.id }, 'Scheduled message sent');
          } catch (err: any) {
            await db.scheduledMessage.update({
              where: { id: msg.id },
              data: {
                status: msg.retryCount >= 2 ? 'FAILED' : 'PENDING',
                error: err.message || 'Send failed',
                retryCount: { increment: 1 },
              },
            });
            logger.error({ scheduledMessageId: msg.id, error: err.message }, 'Failed to send scheduled message');
          }
        }
      } catch (error) {
        logger.error({ error }, 'Scheduled message processor error');
      }
    }, 60 * 1000); // Every 60 seconds
    logger.info('Scheduled message processor started (60-second interval)');

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info({ signal }, 'Received shutdown signal');

      // Disconnect WhatsApp sessions gracefully (preserve auth files for restoration)
      try {
        await whatsappWebService.disconnectAllSessions();
      } catch (error) {
        logger.error({ error }, 'Error disconnecting WhatsApp sessions during shutdown');
      }

      httpServer.close(async () => {
        await disconnectDatabase();
        if (io) {
          io.close();
        }
        logger.info('Server shut down gracefully');
        process.exit(0);
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    logger.error(error, 'Failed to start server');
    process.exit(1);
  }
}

// Start server if run directly
if (require.main === module) {
  startServer();
}
