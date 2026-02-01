// src/server.ts
// Express application setup

import dotenv from 'dotenv';
dotenv.config();

import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
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
// import shopRoutes from '@routes/shops'; // Disabled - using shop-api instead
import shopApiRoutes from './routes/shop-api';
import { whatsappWebService } from '@services/whatsapp-web.service';
import { autoReplyService } from '@services/auto-reply.service';
import { getContactType } from '@utils/contact-type';
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

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // Serve static files (QR test page and uploaded media)
  app.use(express.static(path.join(__dirname, '../public')));
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

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
  // app.use('/api/v1', shopRoutes); // Disabled - using shop-api instead
  app.use('/api/v1', shopApiRoutes); // Shop automation system with proper Prisma types

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
      const contactDisplayName =
        contactBusinessName || contactName || contactPushName || sanitizedPhone;

      // Get or create contact with enriched data
      const contactTypeEnum = getContactType(from, sanitizedPhone);
      
      // For outgoing messages, don't overwrite existing contact name if we don't have new data
      // This prevents the bug where sender's name overwrites recipient's name
      const existingContact = await contactRepo.findByPhoneNumber(userId, sanitizedPhone);
      const shouldUseFallbackName = !existingContact && !contactDisplayName;
      
      const contact = await contactRepo.findOrCreate(userId, sanitizedPhone, {
        // Only set name if we have real data OR if this is a new contact with no data
        ...(contactDisplayName || shouldUseFallbackName ? { name: contactDisplayName || sanitizedPhone } : {}),
        ...(contactPushName ? { pushName: contactPushName } : {}),
        ...(contactBusinessName ? { businessName: contactBusinessName } : {}),
        ...(profilePhotoUrl ? { profilePhotoUrl } : {}),
        isBusiness: isBusiness || false,
        chatId: from, // Store full WhatsApp ID (e.g., 123@c.us or 456@newsletter)
        contactType: contactTypeEnum, // Set contact type based on chatId
        lastMessageAt: new Date(timestamp * 1000),
        lastActiveAt: new Date(timestamp * 1000),
      });

      // Update contact with latest info ONLY if we have genuinely new data
      // Skip update for outgoing messages if we don't have recipient's actual info
      const hasNewContactInfo = contactName || contactPushName || profilePhotoUrl;
      if (hasNewContactInfo && (
        (contactName && contactName !== contact.name) ||
        (contactPushName && (contactPushName !== (contact as any).pushName)) ||
        (profilePhotoUrl && profilePhotoUrl !== (contact as any).profilePhotoUrl)
      )) {
        await contactRepo.update(contact.id, {
          ...(contactName ? { name: contactName } : {}),
          ...(contactPushName ? { pushName: contactPushName } : {}),
          ...(profilePhotoUrl ? { profilePhotoUrl } : {}),
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

    // Socket.IO connection handling
    io.on('connection', (socket) => {
      logger.info({ socketId: socket.id }, 'Socket.IO client connected');

      // Join user's room for targeted broadcasts
      socket.on('join-user', (userId: string) => {
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
      
      // Auto-restore WhatsApp sessions IMMEDIATELY on deployment (no delay)
      // This ensures QR codes or connections are available right away
      setImmediate(async () => {
        try {
          logger.info('Auto-restoring WhatsApp sessions on deployment...');
          
          // Check for existing session files
          const fs = await import('fs');
          const sessionPath = whatsappWebService.getSessionDir();
          
          if (fs.existsSync(sessionPath)) {
            const sessionDirs = fs.readdirSync(sessionPath);
            logger.info({ count: sessionDirs.length }, 'Found session directories');
            
            // Try to restore each session in background (non-blocking)
            for (const dir of sessionDirs) {
              if (dir.startsWith('session_')) {
                const sessionId = dir;
                logger.info({ sessionId }, 'Initiating session restore...');
                
                // Check if already active
                if (whatsappWebService.getSession(sessionId)) {
                  logger.info({ sessionId }, 'Session already active, skipping');
                  continue;
                }
                
                // Run initialization in background without blocking
                (async () => {
                  try {
                    const userId = sessionId.replace('session_', '');
                    await whatsappWebService.initializeSession(userId, sessionId);
                    logger.info({ sessionId }, 'Session restored successfully');
                  } catch (error) {
                    logger.error({ sessionId, error }, 'Failed to restore session');
                  }
                })();
              }
            }
          } else {
            logger.info('No existing sessions found - ready for new connections');
          }
        } catch (error) {
          logger.error({ error }, 'Failed to auto-restore sessions');
        }
      });
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info({ signal }, 'Received shutdown signal');

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
