// src/services/whatsapp-web.service.ts
// WhatsApp Web integration with QR code support

import { Client, LocalAuth, Message as WAMessage } from 'whatsapp-web.js';
import qrcode from 'qrcode';
import { EventEmitter } from 'events';
import logger from '@utils/logger';
import { downloadAvatar } from '@utils/avatar';
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
  private reconnectAttempts: Map<string, number> = new Map(); // Track reconnect attempts per session
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map(); // Health check timers
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
      // Clean up old disconnected session (preserve auth files for restoration)
      await this.disconnectSession(sessionId);
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
      // Reset reconnect counter on successful connection
      this.reconnectAttempts.delete(id);

      // Get phone number
      const info = client.info;
      if (info) {
        session.phoneNumber = info.wid.user;
      }

      this.emit('ready', { sessionId: id, phoneNumber: session.phoneNumber });
      logger.info({ sessionId: id, phoneNumber: session.phoneNumber }, 'WhatsApp Web ready');

      // Start periodic health check
      this.startHealthCheck(id);
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

    // Disconnected event — auto-reconnect with exponential backoff
    client.on('disconnected', (reason) => {
      this.initializingSessions.delete(id);
      session.status = 'DISCONNECTED';
      this.emit('disconnected', { sessionId: id, reason });
      logger.warn({ sessionId: id, reason }, 'WhatsApp Web disconnected');

      // Auto-reconnect (max 10 attempts with exponential backoff)
      const attempts = this.reconnectAttempts.get(id) || 0;
      const maxAttempts = 10;

      if (attempts < maxAttempts) {
        const delay = Math.min(30_000 * Math.pow(2, attempts), 600_000); // 30s, 60s, 120s... max 10min
        this.reconnectAttempts.set(id, attempts + 1);
        logger.info({ sessionId: id, attempt: attempts + 1, delayMs: delay }, 'Scheduling auto-reconnect');

        setTimeout(async () => {
          try {
            // Check if session was manually reconnected in the meantime
            const current = this.sessions.get(id);
            if (current && current.status === 'READY') {
              logger.info({ sessionId: id }, 'Session already reconnected, skipping auto-reconnect');
              return;
            }

            logger.info({ sessionId: id, attempt: attempts + 1 }, 'Auto-reconnecting WhatsApp session...');
            await this.reconnectSession(id);
          } catch (error) {
            logger.error({ error, sessionId: id, attempt: attempts + 1 }, 'Auto-reconnect failed');
          }
        }, delay);
      } else {
        logger.error({ sessionId: id, attempts }, 'Max reconnect attempts reached, manual reconnection required');
      }
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
          const isGroupMessage = chatId.includes('@g.us') || chatId.includes('@newsletter') || chatId.includes('@broadcast');

          if (isGroupMessage) {
            // For group/channel messages: get GROUP name from chat, NOT sender's name
            const session = this.sessions.get(sessionId);
            if (session?.client) {
              try {
                const chat = await session.client.getChatById(chatId);
                if (chat) {
                  contactName = chat.name;
                  // Download group profile pic
                  try {
                    const cdnUrl = await this.getProfilePicUrlSafe(session.client, chatId);
                    if (cdnUrl) {
                      const localUrl = await downloadAvatar(chatId, cdnUrl);
                      profilePhotoUrl = localUrl || undefined;
                    }
                  } catch {
                    // Group profile pic fetch is non-critical
                  }
                }
              } catch {
                logger.debug({ chatId }, 'Failed to get group chat info');
              }
            }
          } else {
            // For individual incoming messages: get sender's contact info
            const contact = await message.getContact();
            if (contact) {
              contactName = contact.name || contact.pushname;
              contactPushName = contact.pushname;
              if (contact.isBusiness) {
                isBusiness = true;
                contactBusinessName = (contact as any).formattedName || contactName;
              }
              // Try to get profile photo
              const sessionForPic = this.sessions.get(sessionId);
              if (sessionForPic?.client) {
                try {
                  const cdnUrl = await this.getProfilePicUrlSafe(sessionForPic.client, chatId);
                  if (cdnUrl) {
                    const localUrl = await downloadAvatar(chatId, cdnUrl);
                    profilePhotoUrl = localUrl || undefined;
                  }
                } catch {
                  logger.debug({ chatId }, 'Failed to fetch profile photo');
                }
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
                      const cdnUrl = await this.getProfilePicUrlSafe(session.client, chatId);
                      if (cdnUrl) {
                        const localUrl = await downloadAvatar(chatId, cdnUrl);
                        profilePhotoUrl = localUrl || undefined;
                      }
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
   * Get all active sessions (READY status)
   */
  getActiveSessions(): WhatsAppWebSession[] {
    return Array.from(this.sessions.values());
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
   * Gracefully disconnect a session (close browser WITHOUT logging out).
   * Preserves auth files in .wwebjs_auth/ so the session can be restored
   * after PM2 restart without re-scanning the QR code.
   */
  async disconnectSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    this.stopHealthCheck(sessionId);

    try {
      await session.client.destroy();
    } catch (error) {
      logger.error({ error, sessionId }, 'Error during graceful disconnect');
    }

    session.status = 'DISCONNECTED';
    this.sessions.delete(sessionId);
    this.initializingSessions.delete(sessionId);
    logger.info({ sessionId }, 'Session disconnected (auth preserved)');
  }

  /**
   * Gracefully disconnect ALL sessions (for server shutdown).
   * Preserves auth files so sessions restore on next startup.
   */
  async disconnectAllSessions(): Promise<void> {
    const sessionIds = Array.from(this.sessions.keys());
    for (const sessionId of sessionIds) {
      await this.disconnectSession(sessionId);
    }
    logger.info({ count: sessionIds.length }, 'All sessions disconnected gracefully');
  }

  /**
   * Logout and destroy session (WIPES auth files — user must re-scan QR).
   * Only use for explicit user logout, NOT for PM2 restart/reconnection.
   */
  async destroySession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return;
    }

    this.stopHealthCheck(sessionId);

    try {
      await session.client.logout();
      await session.client.destroy();
    } catch (error) {
      logger.error({ error, sessionId }, 'Error destroying session');
    }

    this.sessions.delete(sessionId);
    this.initializingSessions.delete(sessionId);
    logger.info({ sessionId }, 'Session destroyed (auth wiped)');
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
   * Get profile pic URL using Puppeteer page.evaluate to bypass
   * the 'isNewsletter' bug in WhatsApp's internal JS.
   */
  private profilePicDiagLogged = false;

  async getProfilePicUrlSafe(client: Client, chatId: string): Promise<string | undefined> {
    try {
      // Try Puppeteer page.evaluate (bypasses buggy WhatsApp JS)
      const page = (client as any).pupPage;
      if (page) {
        const result = await page.evaluate(async (id: string, wantDiag: boolean) => {
          try {
            const wStore = (globalThis as any).Store;
            if (!wStore) return { url: null };

            // Log diagnostics once
            if (wantDiag) {
              const storeKeys = Object.keys(wStore).filter((k: string) =>
                k.toLowerCase().includes('pic') || k.toLowerCase().includes('profile') ||
                k.toLowerCase().includes('wid') || k.toLowerCase().includes('thumb')
              );
              return { diag: true, storeKeys };
            }

            // Create proper WID object from string chatId
            let wid: any = id;
            if (wStore.WidFactory?.createWid) {
              wid = wStore.WidFactory.createWid(id);
            }

            if (wStore.ProfilePic?.profilePicFind) {
              const pic = await wStore.ProfilePic.profilePicFind(wid);
              if (pic?.eurl || pic?.imgFull || pic?.img) {
                return { url: pic.eurl || pic.imgFull || pic.img };
              }
            }

            // Fallback: check ProfilePicThumb cache
            if (wStore.ProfilePicThumb?.get) {
              const thumb = wStore.ProfilePicThumb.get(id);
              if (thumb?.eurl || thumb?.imgFull) {
                return { url: thumb.eurl || thumb.imgFull };
              }
            }
          } catch (e: any) {
            return { error: e?.message || String(e) };
          }
          return { url: null };
        }, chatId, !this.profilePicDiagLogged);

        if (result?.diag) {
          logger.info({ hasStore: result.hasStore, profileKeys: result.profileKeys }, 'Profile pic Store diagnostics');
          this.profilePicDiagLogged = true;
          // Retry without diagnostics
          return this.getProfilePicUrlSafe(client, chatId);
        }
        if (result?.error) {
          logger.debug({ chatId, error: result.error }, 'Profile pic evaluate error');
        }
        if (result?.url) return result.url;
      }
    } catch {
      // Puppeteer approach failed
    }

    // Fallback to standard API (may throw isNewsletter bug)
    try {
      return await client.getProfilePicUrl(chatId);
    } catch {
      return undefined;
    }
  }

  /**
   * Start periodic health check for a session.
   * Pings the Puppeteer page every 60s to verify WhatsApp Web is alive.
   * Triggers auto-reconnect if the session is dead but still marked READY.
   */
  private startHealthCheck(sessionId: string): void {
    // Clear any existing health check for this session
    this.stopHealthCheck(sessionId);

    const interval = setInterval(async () => {
      const session = this.sessions.get(sessionId);
      if (!session || session.status !== 'READY') {
        this.stopHealthCheck(sessionId);
        return;
      }

      try {
        const page = (session.client as any).pupPage;
        if (!page || page.isClosed()) {
          throw new Error('Puppeteer page is closed');
        }

        // Ping the page — if Puppeteer crashed this will throw
        const alive = await Promise.race([
          page.evaluate(() => true),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Health check timeout')), 15000)),
        ]);

        if (!alive) throw new Error('Page not responding');
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        logger.warn({ sessionId, error: errMsg }, 'Health check failed — session is stale, triggering reconnect');
        this.stopHealthCheck(sessionId);

        // Mark as disconnected and trigger reconnect
        session.status = 'DISCONNECTED';
        this.emit('disconnected', { sessionId, reason: `health_check_failed: ${errMsg}` });

        try {
          await this.reconnectSession(sessionId);
        } catch (reconnectError) {
          logger.error({ sessionId, error: reconnectError }, 'Health check reconnect failed');
        }
      }
    }, 60_000); // Check every 60 seconds

    this.healthCheckIntervals.set(sessionId, interval);
    logger.info({ sessionId }, 'Health check started (60s interval)');
  }

  /**
   * Stop health check for a session.
   */
  private stopHealthCheck(sessionId: string): void {
    const interval = this.healthCheckIntervals.get(sessionId);
    if (interval) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(sessionId);
    }
  }

  /**
   * Restart a session (WIPES auth — user must re-scan QR)
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
   * Reconnect a session (preserves auth — no QR scan needed).
   * Use this when Puppeteer frame detaches or session becomes stale.
   */
  async reconnectSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn({ sessionId }, 'Cannot reconnect: session not found');
      return;
    }

    const userId = session.userId;
    logger.info({ sessionId, userId }, 'Reconnecting session (preserving auth)...');

    // Disconnect without wiping auth files
    await this.disconnectSession(sessionId);

    // Re-initialize — LocalAuth will find saved auth and skip QR
    try {
      await this.initializeSession(userId, sessionId);
      logger.info({ sessionId }, 'Session reconnected successfully');
    } catch (error) {
      logger.error({ error, sessionId }, 'Failed to reconnect session');
    }
  }

  /**
   * Get the session directory path (for auto-restore on startup)
   */
  getSessionDir(): string {
    return this.sessionDir;
  }

  /**
   * Sync all existing WhatsApp chats into the database.
   * Called once when a session becomes READY to populate contacts
   * that existed before the app was set up.
   */
  async syncAllChats(sessionId: string): Promise<Array<{
    chatId: string;
    name: string;
    isGroup: boolean;
    isChannel: boolean;
    timestamp: number;
    profilePicUrl?: string;
  }>> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'READY') {
      throw new Error('Session not ready for chat sync');
    }

    try {
      const chats = await session.client.getChats();
      logger.info({ sessionId, chatCount: chats.length }, 'Fetched all chats for sync');

      // Map chat data (skip bulk profile pic fetch — WhatsApp rate-limits it)
      const chatData = chats.map(chat => ({
        chatId: chat.id._serialized,
        name: chat.name,
        isGroup: chat.isGroup,
        isChannel: !!(chat as any).isChannel,
        timestamp: chat.timestamp || 0,
        profilePicUrl: undefined as string | undefined,
      }));

      logger.info({ sessionId, total: chatData.length }, 'Chat data mapped (avatars fetched in background)');

      return chatData;
    } catch (error) {
      logger.error({ error, sessionId }, 'Failed to fetch chats for sync');
      return [];
    }
  }

  /**
   * Slowly fetch and download avatars one at a time with delays.
   * Runs in background after sync to avoid WhatsApp rate limiting.
   */
  async fetchAvatarsSlowly(sessionId: string, chatIds: string[]): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'READY') return;

    let fetched = 0;
    let failed = 0;
    let noPic = 0;
    let processed = 0;

    for (const chatId of chatIds) {
      // Abort if session disconnected
      if (session.status !== 'READY') {
        logger.info({ sessionId, fetched, failed, noPic }, 'Avatar fetch aborted: session no longer ready');
        return;
      }

      processed++;

      try {
        const cdnUrl = await this.getProfilePicUrlSafe(session.client, chatId);
        if (cdnUrl) {
          const localUrl = await downloadAvatar(chatId, cdnUrl);
          if (localUrl) {
            fetched++;
            this.emit('avatar:downloaded', { sessionId, chatId, localUrl });
          } else {
            failed++;
          }
        } else {
          noPic++;
        }
      } catch (err) {
        failed++;
        if (failed <= 3) {
          logger.info({ chatId, err: err instanceof Error ? err.message : String(err) }, 'Avatar fetch failed (sample)');
        }
      }

      // Wait 2 seconds between each to avoid rate limiting
      await new Promise(r => setTimeout(r, 2000));

      // Log progress every 50 contacts
      if (processed % 50 === 0) {
        logger.info({ fetched, failed, noPic, processed, total: chatIds.length }, 'Avatar fetch progress');
      }
    }

    logger.info({ sessionId, fetched, failed, noPic, total: chatIds.length }, 'Background avatar fetch completed');
  }
}

// Singleton instance
export const whatsappWebService = new WhatsAppWebService();
