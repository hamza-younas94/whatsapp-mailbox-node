// src/services/whatsapp-web.service.ts
// WhatsApp Web integration with QR code support

import { Client, LocalAuth, Message as WAMessage } from 'whatsapp-web.js';
import qrcode from 'qrcode';
import { EventEmitter } from 'events';
import logger from '@utils/logger';
import path from 'path';
import fs from 'fs';

export interface WhatsAppWebSession {
  id: string;
  userId: string;
  client: Client;
  status: 'INITIALIZING' | 'QR_READY' | 'AUTHENTICATED' | 'READY' | 'DISCONNECTED';
  qrCode?: string;
  phoneNumber?: string;
  createdAt: Date;
}

export class WhatsAppWebService extends EventEmitter {
  private sessions: Map<string, WhatsAppWebSession> = new Map();
  private initializingSessions: Set<string> = new Set(); // Track sessions being initialized
  private sessionDir: string;

  constructor() {
    super();
    // Allow persistent session directory override so deployments keep sessions
    this.sessionDir = process.env.WWEBJS_AUTH_DIR
      ? path.resolve(process.env.WWEBJS_AUTH_DIR)
      : path.join(process.cwd(), '.wwebjs_auth');
    
    // Ensure session directory exists
    if (!fs.existsSync(this.sessionDir)) {
      fs.mkdirSync(this.sessionDir, { recursive: true });
    }
  }

  /**
   * Initialize a new WhatsApp Web session for a user
   */
  async initializeSession(userId: string, sessionId: string): Promise<WhatsAppWebSession> {
    // Check if session is already being initialized (prevent concurrent calls)
    if (this.initializingSessions.has(sessionId)) {
      logger.warn({ userId, sessionId }, 'Session initialization already in progress, waiting for existing initialization');
      // Wait a bit and check if session was created
      await new Promise(resolve => setTimeout(resolve, 1000));
      const existing = this.sessions.get(sessionId);
      if (existing && existing.status !== 'DISCONNECTED') {
        return existing;
      }
      // If still not ready, throw error to prevent infinite loops
      throw new Error('Session initialization already in progress');
    }

    // Check if session already exists
    if (this.sessions.has(sessionId)) {
      const existing = this.sessions.get(sessionId)!;
      // Return existing session if it's not disconnected
      // This prevents multiple simultaneous initializations
      if (existing.status !== 'DISCONNECTED') {
        logger.info({ userId, sessionId, status: existing.status }, 'Session already exists, returning existing session');
        return existing;
      }
      // Clean up old disconnected session
      await this.destroySession(sessionId);
    }

    // Mark session as being initialized
    this.initializingSessions.add(sessionId);

    // Create new client with persistent session
    const client = new Client({
      authStrategy: new LocalAuth({
        clientId: sessionId,
        dataPath: this.sessionDir,
      }),
      // Pin a known-good WhatsApp Web version to avoid markedUnread/sendSeen breakage (issue #5718)
      webVersion: '2.3000.1031490220-alpha',
      webVersionCache: {
        type: 'remote',
        remotePath:
          'https://raw.githubusercontent.com/wppconnect-team/wa-version/refs/heads/main/html/2.3000.1031490220-alpha.html',
      },
      authTimeoutMs: 300000,
      qrMaxRetries: 6,
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--single-process',
        ],
      },
    });

    const session: WhatsAppWebSession = {
      id: sessionId,
      userId,
      client,
      status: 'INITIALIZING',
      createdAt: new Date(),
    };

    this.sessions.set(sessionId, session);

    // Setup event handlers
    this.setupClientEvents(session);

    // Initialize the client
    try {
      logger.info({ userId, sessionId }, 'Starting WhatsApp Web client initialization...');
      await client.initialize();
      logger.info({ userId, sessionId }, 'WhatsApp Web client.initialize() completed');
    } catch (error) {
      logger.error({ userId, sessionId, error }, 'Failed to initialize WhatsApp Web client');
      session.status = 'DISCONNECTED';
      // Remove from initializing set on error
      this.initializingSessions.delete(sessionId);
      throw error;
    }

    return session;
  }

  /**
   * Setup event handlers for WhatsApp Web client
   */
  private setupClientEvents(session: WhatsAppWebSession): void {
    const { client, id } = session;

    // Loading screen event (for debugging)
    client.on('loading_screen', (percent, message) => {
      logger.info({ sessionId: id, percent, message }, 'WhatsApp Web loading');
    });

    // QR Code event
    client.on('qr', async (qr) => {
      try {
        // Generate QR code as data URL
        const qrDataUrl = await qrcode.toDataURL(qr);
        session.qrCode = qrDataUrl;
        session.status = 'QR_READY';
        // Remove from initializing set - initialization is complete (waiting for QR scan)
        this.initializingSessions.delete(id);

        this.emit('qr', { sessionId: id, qrCode: qrDataUrl });
        logger.info({ sessionId: id }, 'QR code generated');
      } catch (error) {
        logger.error({ error, sessionId: id }, 'Failed to generate QR code');
      }
    });

    // Authenticated event
    client.on('authenticated', () => {
      session.status = 'AUTHENTICATED';
      session.qrCode = undefined; // Clear QR code after authentication
      this.emit('authenticated', { sessionId: id });
      logger.info({ sessionId: id }, 'WhatsApp Web authenticated');
    });

    // Ready event
    client.on('ready', async () => {
      session.status = 'READY';
      // Remove from initializing set - initialization is complete
      this.initializingSessions.delete(id);
      
      // Get phone number
      const info = client.info;
      if (info) {
        session.phoneNumber = info.wid.user;
      }

      this.emit('ready', { sessionId: id, phoneNumber: session.phoneNumber });
      logger.info({ sessionId: id, phoneNumber: session.phoneNumber }, 'WhatsApp Web ready');
    });

    // Message event
    client.on('message', async (message: WAMessage) => {
      // Ignore WhatsApp status broadcast system messages to avoid duplicate IDs
      if (message.from === 'status@broadcast') {
        logger.debug({ sessionId: id }, 'Ignoring status broadcast message');
        return;
      }

      // Process incoming message
      await this.processMessage(id, message, false);
    });

    // Message create event - captures outgoing messages sent from mobile/desktop
    client.on('message_create', async (message: WAMessage) => {
      // Ignore WhatsApp status broadcast system messages
      if (message.from === 'status@broadcast' || message.to === 'status@broadcast') {
        logger.debug({ sessionId: id }, 'Ignoring status broadcast message');
        return;
      }

      // Only process if message was sent by us (fromMe = true)
      if (message.fromMe) {
        logger.info({ sessionId: id, to: message.to }, 'Outgoing message from mobile/desktop detected');
        await this.processMessage(id, message, true);
      }
    });

    // Disconnected event
    client.on('disconnected', (reason) => {
      this.initializingSessions.delete(id);
      session.status = 'DISCONNECTED';
      this.emit('disconnected', { sessionId: id, reason });
      logger.warn({ sessionId: id, reason }, 'WhatsApp Web disconnected');
    });

    // Message reaction event
    client.on('message_reaction', async (reaction: any) => {
      try {
        this.emit('reaction', {
          sessionId: id,
          messageId: reaction.id._serialized,
          reaction: reaction.reaction,
          from: reaction.senderId || reaction.id.remote,
          timestamp: reaction.timestamp || Date.now(),
        });
        logger.info({ sessionId: id, messageId: reaction.id._serialized, reaction: reaction.reaction }, 'Reaction received');
      } catch (error) {
        logger.error({ error, sessionId: id }, 'Failed to process reaction');
      }
    });

    // Auth failure event
    client.on('auth_failure', (error) => {
      session.status = 'DISCONNECTED';
      this.initializingSessions.delete(id);
      this.emit('auth_failure', { sessionId: id, error });
      logger.error({ sessionId: id, error }, 'WhatsApp Web authentication failed');
    });
  }

  /**
   * Process a message (incoming or outgoing)
   */
  private async processMessage(sessionId: string, message: WAMessage, isOutgoing: boolean): Promise<void> {
    // Ping-pong test command (for incoming messages only)
    if (!isOutgoing && message.body.toLowerCase() === 'ping') {
      try {
        logger.info({ sessionId, from: message.from }, 'Ping received, replying with pong');
        const session = this.sessions.get(sessionId);
        if (session) {
          await session.client.sendMessage(message.from, 'pong');
          logger.info({ sessionId, from: message.from }, 'Pong sent successfully');
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error({ errorMsg, sessionId, from: message.from }, 'Failed to send pong reply');
      }
    }

    // Try to get contact details from the message object
      let contactName: string | undefined;
      let contactPushName: string | undefined;
      let contactBusinessName: string | undefined;
      let profilePhotoUrl: string | undefined;
      let isBusiness = false;

      // For outgoing messages, use message.to instead of message.from
      const chatId = isOutgoing ? message.to : message.from;

      try {
        // For outgoing messages, we need the RECIPIENT's contact info, not sender's
        // message.getContact() returns the SENDER's info which is wrong for outgoing
        // For incoming messages, message.getContact() gives us the sender (correct)
        if (!isOutgoing && message.getContact && typeof message.getContact === 'function') {
          // For incoming messages, get sender's contact info
          const contact = await message.getContact();
          if (contact) {
            contactName = contact.name || contact.pushname;
            contactPushName = contact.pushname;
            // For business accounts, try to get formatted name
            if (contact.isBusiness) {
              isBusiness = true;
              contactBusinessName = (contact as any).formattedName || contactName;
            }
            // Try to get profile photo
            if (contact.getProfilePicUrl && typeof contact.getProfilePicUrl === 'function') {
              try {
                profilePhotoUrl = await contact.getProfilePicUrl();
              } catch (photoError) {
                logger.debug({ chatId }, 'Failed to fetch profile photo');
              }
            }
          }
        } else if (isOutgoing) {
          // For outgoing messages, try to get recipient's contact info from chat
          const session = this.sessions.get(sessionId);
          if (session?.client) {
            try {
              const chat = await session.client.getChatById(message.to);
              if (chat) {
                // For groups/channels, use chat name
                if (chat.isGroup || (chat as any).isChannel) {
                  contactName = chat.name;
                } else {
                  // For individual chats, try to get contact
                  const recipientContact = await chat.getContact?.();
                  if (recipientContact) {
                    contactName = recipientContact.name || recipientContact.pushname;
                    contactPushName = recipientContact.pushname;
                    if (recipientContact.isBusiness) {
                      isBusiness = true;
                      contactBusinessName = (recipientContact as any).formattedName || contactName;
                    }
                    try {
                      profilePhotoUrl = await recipientContact.getProfilePicUrl?.();
                    } catch {
                      // Ignore profile pic errors
                    }
                  }
                }
              }
            } catch (chatError) {
              logger.debug({ chatId, error: chatError }, 'Failed to get recipient contact for outgoing message');
            }
          }
        }
      } catch (contactError) {
        logger.debug({ chatId, error: contactError }, 'Failed to extract contact details');
      }

      // Emit message event with direction indicator
      this.emit('message', {
        sessionId,
        from: chatId,
        body: message.body,
        hasMedia: message.hasMedia,
        timestamp: message.timestamp,
        waMessageId: message.id?._serialized,
        messageType: message.type,
        message: message, // Pass full message object for media download
        isOutgoing, // Indicate if this is an outgoing message
        // Add contact information
        contactName: contactName || contactPushName,
        contactPushName,
        contactBusinessName,
        profilePhotoUrl,
        isBusiness,
      });
  }

  /**
   * Send a reaction to a message
   */
  async sendReaction(
    sessionId: string,
    messageId: string,
    emoji: string,
  ): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'READY') {
      throw new Error('Session not ready');
    }

    try {
      const message = await session.client.getMessageById(messageId);
      if (!message) {
        throw new Error('Message not found');
      }

      await message.react(emoji);
      logger.info({ sessionId, messageId, emoji }, 'Reaction sent successfully');
      return { success: true };
    } catch (error) {
      logger.error({ error, sessionId, messageId, emoji }, 'Failed to send reaction');
      throw error;
    }
  }

  /**
   * Send a message via WhatsApp Web
   */
  async sendMessage(
    sessionId: string,
    to: string,
    message: string,
  ): Promise<{ success: boolean; messageId?: string }> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status !== 'READY') {
      throw new Error('Session not ready');
    }

    try {
      // Format phone number (add @c.us if not present)
      const chatId = to.includes('@') ? to : `${to}@c.us`;
      
      const sentMessage = await session.client.sendMessage(chatId, message);

      logger.info({ sessionId, to, messageId: sentMessage.id._serialized }, 'Message sent via WhatsApp Web');

      return {
        success: true,
        messageId: sentMessage.id._serialized,
      };
    } catch (error) {
      logger.error({ error, sessionId, to }, 'Failed to send message via WhatsApp Web');
      return { success: false };
    }
  }

  /**
   * Send media message
   */
  async sendMediaMessage(
    sessionId: string,
    to: string,
    mediaUrl: string,
    caption?: string,
  ): Promise<{ success: boolean; messageId?: string }> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status !== 'READY') {
      throw new Error('Session not ready');
    }

    try {
      const chatId = to.includes('@') ? to : `${to}@c.us`;
      
      const { MessageMedia } = await import('whatsapp-web.js');
      const media = await MessageMedia.fromUrl(mediaUrl);
      
      const sentMessage = await session.client.sendMessage(chatId, media, { caption });

      logger.info({ sessionId, to, messageId: sentMessage.id._serialized }, 'Media sent via WhatsApp Web');

      return {
        success: true,
        messageId: sentMessage.id._serialized,
      };
    } catch (error) {
      logger.error({ error, sessionId, to }, 'Failed to send media via WhatsApp Web');
      return { success: false };
    }
  }

  /**
   * Get session status
   */
  getSession(sessionId: string): WhatsAppWebSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Check if a session is currently being initialized
   */
  isInitializing(sessionId: string): boolean {
    return this.initializingSessions.has(sessionId);
  }

  /**
   * Get all sessions for a user
   */
  getUserSessions(userId: string): WhatsAppWebSession[] {
    return Array.from(this.sessions.values()).filter((s) => s.userId === userId);
  }

  /**
   * Check if session is ready
   */
  isSessionReady(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    return session?.status === 'READY';
  }

  /**
   * Logout and destroy session
   */
  async destroySession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return;
    }

    try {
      await session.client.logout();
      await session.client.destroy();
    } catch (error) {
      logger.error({ error, sessionId }, 'Error destroying session');
    }

    this.sessions.delete(sessionId);
    logger.info({ sessionId }, 'Session destroyed');
  }

  /**
   * Get QR code for session (if available)
   */
  getQRCode(sessionId: string): string | undefined {
    const session = this.sessions.get(sessionId);
    return session?.qrCode;
  }

  /**
   * Download media from a message
   */
  async downloadMedia(message: WAMessage): Promise<string | undefined> {
    try {
      if (!message.hasMedia) {
        return undefined;
      }

      logger.info({ messageId: message.id._serialized }, 'Downloading media from message');
      
      const media = await message.downloadMedia();
      if (!media) {
        logger.warn({ messageId: message.id._serialized }, 'Media download returned null');
        return undefined;
      }

      // Generate filename based on message type and timestamp
      const timestamp = Date.now();
      const ext = media.mimetype?.split('/')[1] || 'bin';
      const filename = `${timestamp}-${Math.random().toString(36).substr(2, 9)}.${ext}`;
      
      // Save to uploads/media directory
      const mediaPath = path.join(process.cwd(), 'uploads', 'media', filename);
      const mediaDir = path.dirname(mediaPath);
      
      // Ensure directory exists
      if (!fs.existsSync(mediaDir)) {
        fs.mkdirSync(mediaDir, { recursive: true });
      }

      // Write media file
      const buffer = Buffer.from(media.data, 'base64');
      fs.writeFileSync(mediaPath, buffer);
      
      const mediaUrl = `/uploads/media/${filename}`;
      logger.info({ mediaUrl, mimetype: media.mimetype, size: buffer.length }, 'Media saved successfully');
      
      return mediaUrl;
    } catch (error) {
      logger.error({ error, messageId: message.id?._serialized }, 'Failed to download media');
      return undefined;
    }
  }

  /**
   * Restart a session
   */
  async restartSession(sessionId: string): Promise<WhatsAppWebSession> {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      throw new Error('Session not found');
    }

    const userId = session.userId;
    await this.destroySession(sessionId);
    
    return this.initializeSession(userId, sessionId);
  }

  /**
   * Get the session directory path (for auto-restore on startup)
   */
  getSessionDir(): string {
    return this.sessionDir;
  }
}

// Singleton instance
export const whatsappWebService = new WhatsAppWebService();
