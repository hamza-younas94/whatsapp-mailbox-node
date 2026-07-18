// src/services/whatsmeow-bridge.client.ts
//
// Node-side client for the Go whatsmeow bridge (see ../../bridge). It connects to the
// bridge WebSocket for real-time events and calls its HTTP API to send. It re-emits the
// SAME event names the legacy `whatsappWebService` used ('qr' | 'ready' | 'message' |
// 'reaction' | 'disconnected'), so `server.ts` can switch engines with minimal changes.
//
// Requires the `ws` package: npm i ws @types/ws
//
// Env:
//   WA_BRIDGE_URL   default http://127.0.0.1:8088
//   WA_BRIDGE_TOKEN optional shared secret (matches the bridge's BRIDGE_TOKEN)

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import logger from '@utils/logger';

export interface BridgeMessage {
  id: string;
  chatJid: string;
  senderJid: string;
  senderName?: string;
  fromMe: boolean;
  timestamp: number;
  type: string;
  text?: string;
  mediaUrl?: string;
  mimetype?: string;
  isGroup: boolean;
  isChannel: boolean;
  chatName?: string;
}

export class WhatsmeowBridgeClient extends EventEmitter {
  private baseUrl: string;
  private token: string;
  private ws?: WebSocket;
  private reconnectTimer?: NodeJS.Timeout;
  private connectedToWa = false;

  constructor() {
    super();
    this.baseUrl = process.env.WA_BRIDGE_URL || 'http://127.0.0.1:8088';
    this.token = process.env.WA_BRIDGE_TOKEN || '';
  }

  /** Open (and keep open) the WebSocket to the bridge. */
  start(): void {
    this.openSocket();
  }

  private wsUrl(): string {
    const u = this.baseUrl.replace(/^http/, 'ws') + '/ws';
    return this.token ? `${u}?token=${encodeURIComponent(this.token)}` : u;
  }

  private openSocket(): void {
    const ws = new WebSocket(this.wsUrl());
    this.ws = ws;

    ws.on('open', () => logger.info('Connected to whatsmeow bridge'));
    ws.on('message', (raw: WebSocket.RawData) => {
      try {
        this.handleEvent(JSON.parse(raw.toString()));
      } catch (err) {
        logger.warn({ err }, 'bridge: bad event payload');
      }
    });
    ws.on('close', () => this.scheduleReconnect());
    ws.on('error', (err) => {
      logger.warn({ err: err.message }, 'bridge socket error');
      ws.close();
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.openSocket();
    }, 3000);
  }

  private handleEvent(evt: any): void {
    switch (evt.type) {
      case 'qr':
        this.emit('qr', { qrCode: evt.code });
        break;
      case 'connected':
        this.connectedToWa = true;
        this.emit('ready', {});
        break;
      case 'disconnected':
        this.connectedToWa = false;
        this.emit('disconnected', { reason: evt.reason || 'disconnected' });
        break;
      case 'logged_out':
        this.connectedToWa = false;
        this.emit('disconnected', { reason: 'LOGOUT' });
        break;
      case 'message':
        this.emit('message', evt.data as BridgeMessage);
        break;
      case 'reaction':
        this.emit('reaction', evt.data);
        break;
      case 'receipt':
        this.emit('receipt', evt.data);
        break;
    }
  }

  isReady(): boolean {
    return this.connectedToWa;
  }

  // --- HTTP command helpers ---

  private async post(path: string, body?: unknown): Promise<any> {
    const res = await fetch(this.baseUrl + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`bridge ${path} -> ${res.status}`);
    return res.json();
  }

  private async get(path: string): Promise<any> {
    const res = await fetch(this.baseUrl + path, {
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
    });
    if (!res.ok) throw new Error(`bridge ${path} -> ${res.status}`);
    return res.json();
  }

  getStatus(): Promise<{ connected: boolean; loggedIn: boolean; jid: string }> {
    return this.get('/status');
  }
  getQR(): Promise<{ code: string }> {
    return this.get('/qr');
  }
  connect(): Promise<any> {
    return this.post('/connect');
  }
  logout(): Promise<any> {
    return this.post('/logout');
  }
  sendMessage(chatJid: string, text: string): Promise<{ id: string }> {
    return this.post('/send', { chatJid, text });
  }
  sendMedia(params: {
    chatJid: string;
    type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';
    mimetype: string;
    mediaBase64: string;
    caption?: string;
    fileName?: string;
  }): Promise<{ id: string }> {
    return this.post('/send-media', params);
  }
  sendReaction(chatJid: string, messageId: string, senderJid: string, fromMe: boolean, emoji: string): Promise<any> {
    return this.post('/react', { chatJid, messageId, senderJid, fromMe, emoji });
  }
  markRead(chatJid: string, senderJid: string, messageIds: string[]): Promise<any> {
    return this.post('/read', { chatJid, senderJid, messageIds });
  }
  getGroupInfo(jid: string): Promise<{ jid: string; name: string; topic: string; participants: string[] }> {
    return this.get(`/group?jid=${encodeURIComponent(jid)}`);
  }
}

export const whatsmeowBridge = new WhatsmeowBridgeClient();
