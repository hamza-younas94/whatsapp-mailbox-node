// src/services/whatsmeow-adapter.ts
//
// Adapts the native whatsmeow bridge to the SAME interface + event shapes the app's
// legacy `whatsappWebService` exposes, so `server.ts` / controllers can switch engines
// via the WA_ENGINE flag with no changes to the message-processing logic.
//
// Single-account model: the whole app drives one WhatsApp number, tied to one app user
// (WA_BRIDGE_USER_ID). sessionId is `session_<userId>` to match existing session-dir naming.

import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { whatsmeowBridge, BridgeMessage } from './whatsmeow-bridge.client';
import logger from '@utils/logger';

type Status = 'INITIALIZING' | 'QR_READY' | 'AUTHENTICATED' | 'READY' | 'DISCONNECTED';

/** whatsmeow uses user@s.whatsapp.net for individuals; the app keys contacts on @c.us. */
function normalizeJid(jid: string): string {
  if (!jid) return jid;
  if (jid.endsWith('@s.whatsapp.net')) return jid.replace('@s.whatsapp.net', '@c.us');
  return jid; // @g.us, @newsletter, @broadcast, @c.us pass through
}
/** Reverse: the app may hand us @c.us; whatsmeow wants @s.whatsapp.net for individuals. */
function toWaJid(jid: string): string {
  if (!jid) return jid;
  if (jid.endsWith('@c.us')) return jid.replace('@c.us', '@s.whatsapp.net');
  if (!jid.includes('@')) return `${jid}@s.whatsapp.net`;
  return jid;
}

export class WhatsmeowAdapter extends EventEmitter {
  private userId: string;
  private sessionId: string;
  private status: Status = 'DISCONNECTED';
  private qrCode?: string;
  private phoneNumber?: string;
  private started = false;

  constructor() {
    super();
    this.userId = process.env.WA_BRIDGE_USER_ID || '';
    this.sessionId = `session_${this.userId}`;
  }

  /** Begin listening to the bridge and wiring its events into legacy-shaped events. */
  start(): void {
    if (this.started) return;
    this.started = true;

    whatsmeowBridge.on('qr', ({ qrCode }: { qrCode: string }) => {
      this.qrCode = qrCode;
      this.status = 'QR_READY';
      this.emit('qr', { sessionId: this.sessionId, qrCode });
    });

    whatsmeowBridge.on('ready', () => {
      this.status = 'READY';
      this.qrCode = undefined;
      this.emit('ready', { sessionId: this.sessionId, phoneNumber: this.phoneNumber });
    });

    whatsmeowBridge.on('disconnected', ({ reason }: { reason: string }) => {
      this.status = 'DISCONNECTED';
      this.emit('disconnected', { sessionId: this.sessionId, reason });
    });

    whatsmeowBridge.on('message', (m: BridgeMessage) => this.forwardMessage(m));

    whatsmeowBridge.on('reaction', (r: any) => {
      this.emit('reaction', {
        sessionId: this.sessionId,
        messageId: r.messageId,
        reaction: r.emoji,
        from: normalizeJid(r.chatJid),
        timestamp: Date.now(),
      });
    });

    whatsmeowBridge.start();
    // Kick a connect so a fresh device produces a QR promptly.
    whatsmeowBridge.connect().catch(() => {});
  }

  /** Map a native bridge message to the legacy 'message' event the app already handles. */
  private forwardMessage(m: BridgeMessage): void {
    const isGroupOrChannel = m.isGroup || m.isChannel;
    this.emit('message', {
      sessionId: this.sessionId,
      from: normalizeJid(m.chatJid),
      body: m.text || '',
      hasMedia: !!m.mediaUrl,
      timestamp: m.timestamp, // unix seconds
      waMessageId: m.id,
      messageType: m.type,
      message: null, // no raw browser object; media is pre-resolved below
      isOutgoing: m.fromMe,
      contactName: isGroupOrChannel ? m.chatName || m.senderName : m.senderName,
      contactPushName: m.senderName,
      contactBusinessName: undefined,
      profilePhotoUrl: undefined,
      isBusiness: false,
      senderName: isGroupOrChannel ? m.senderName : undefined,
      mediaUrl: m.mediaUrl || undefined, // consumed directly by server.ts (no re-download)
    });
  }

  // --- Fake session object so getSession(...).userId and .client.sendMessage(...) work ---
  private fakeSession() {
    return {
      id: this.sessionId,
      userId: this.userId,
      status: this.status,
      phoneNumber: this.phoneNumber,
      qrCode: this.qrCode,
      client: {
        // Automation "forward message" path calls session.client.sendMessage(jid, content)
        sendMessage: async (to: string, content: string) => {
          await whatsmeowBridge.sendMessage(toWaJid(to), content);
        },
        getChatById: async () => null,
      },
    };
  }

  // --- whatsappWebService interface surface used by server.ts / controllers ---

  async initializeSession(_userId?: string, _sessionId?: string) {
    this.status = 'INITIALIZING';
    await whatsmeowBridge.connect().catch(() => {});
    return this.fakeSession();
  }

  getSession(_sessionId?: string) {
    return whatsmeowBridge.isReady() || this.status !== 'DISCONNECTED' ? this.fakeSession() : this.fakeSession();
  }

  getActiveSessions() {
    return [this.fakeSession()];
  }
  getUserSessions() {
    return [this.fakeSession()];
  }
  isInitializing() {
    return this.status === 'INITIALIZING';
  }
  isSessionReady() {
    return whatsmeowBridge.isReady();
  }
  getQRCode() {
    return this.qrCode;
  }
  getSessionDir() {
    return '';
  }

  async sendMessage(_sessionId: string, to: string, message: string) {
    try {
      const res = await whatsmeowBridge.sendMessage(toWaJid(to), message);
      return { success: true, messageId: res.id };
    } catch (err) {
      logger.error({ err }, 'bridge sendMessage failed');
      return { success: false };
    }
  }

  async sendMediaMessage(_sessionId: string, to: string, mediaUrl: string, caption?: string) {
    try {
      // mediaUrl is a local path served under /uploads — read it back and forward as base64.
      const rel = mediaUrl.replace(/^\//, '');
      const full = path.join(process.cwd(), rel);
      const data = fs.readFileSync(full);
      const mimetype = mimeFromExt(full);
      const type = typeFromMime(mimetype);
      const res = await whatsmeowBridge.sendMedia({
        chatJid: toWaJid(to),
        type,
        mimetype,
        caption,
        fileName: path.basename(full),
        mediaBase64: data.toString('base64'),
      });
      return { success: true, messageId: res.id };
    } catch (err) {
      logger.error({ err }, 'bridge sendMediaMessage failed');
      return { success: false };
    }
  }

  async sendReaction(_sessionId: string, _messageId: string, _emoji: string) {
    // The bridge needs chatJid + senderJid to react; the legacy signature lacks them.
    // Wired up in a follow-up (look up the message's chat from the DB). No-op for now.
    logger.warn('bridge sendReaction: not yet wired (needs chat context)');
    return { success: false };
  }

  async downloadMedia(): Promise<string | undefined> {
    return undefined; // media already downloaded by the bridge and delivered as mediaUrl
  }

  async syncAllChats(): Promise<any[]> {
    return []; // live delivery only; historical bulk sync is a follow-up
  }
  async fetchAvatarsSlowly(): Promise<void> {
    /* no-op for now */
  }

  async disconnectSession() {
    /* bridge stays connected; nothing to tear down per-session */
  }
  async disconnectAllSessions() {
    /* no-op */
  }
  async destroySession() {
    await whatsmeowBridge.logout().catch(() => {});
  }
  async restartSession() {
    await whatsmeowBridge.connect().catch(() => {});
    return this.fakeSession();
  }
}

function mimeFromExt(file: string): string {
  const ext = path.extname(file).toLowerCase();
  const map: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
    '.gif': 'image/gif', '.mp4': 'video/mp4', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg',
    '.pdf': 'application/pdf',
  };
  return map[ext] || 'application/octet-stream';
}
function typeFromMime(mime: string): 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' {
  if (mime.startsWith('image/')) return 'IMAGE';
  if (mime.startsWith('video/')) return 'VIDEO';
  if (mime.startsWith('audio/')) return 'AUDIO';
  return 'DOCUMENT';
}

export const whatsmeowAdapter = new WhatsmeowAdapter();
