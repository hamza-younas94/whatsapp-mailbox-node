import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

function decodeBase64Url(input: string): string {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return atob(padded);
}

function getUserIdFromToken(): string | null {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = JSON.parse(decodeBase64Url(parts[1]));
    return payload?.userId || payload?.id || null;
  } catch {
    return null;
  }
}

export function getSocket(): Socket {
  if (!socket) {
    socket = io(window.location.origin, {
      auth: {
        token: localStorage.getItem('authToken'),
      },
    });

    // Event listeners
    socket.on('connect', () => {
      console.log('Socket connected');
      const userId = getUserIdFromToken();
      if (userId) {
        socket?.emit('join-user', userId);
      }
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  }

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export enum MessageEvent {
  MessageReceived = 'message:received',
  MessageSent = 'message:sent',
  MessageStatusChanged = 'message:status',
  TypingIndicator = 'chat:typing',
  SessionStatus = 'session:status',
  ConversationUpdated = 'conversation:updated',
  ReactionUpdated = 'reaction:updated',
}

export interface IMessageReceivedEvent {
  id: string;
  contactId: string;
  conversationId: string;
  content: string;
  createdAt: string;
  messageType?: string;
  direction?: 'INCOMING' | 'OUTGOING';
  status?: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'RECEIVED';
  mediaUrl?: string | null;
  mediaType?: string | null;
}

export interface IMessageSentEvent {
  id: string;
  waMessageId: string;
  status: 'SENT' | 'DELIVERED' | 'READ';
}

export interface IReactionUpdatedEvent {
  messageId: string;
  waMessageId?: string;
  reaction: string | null;
  conversationId?: string;
  timestamp?: number;
}

export interface ITypingEvent {
  contactId: string;
  isTyping: boolean;
}

export function subscribeToMessage(callback: (msg: IMessageReceivedEvent) => void) {
  const socket = getSocket();
  socket.on(MessageEvent.MessageReceived, callback);
  return () => socket.off(MessageEvent.MessageReceived, callback);
}

export function subscribeToTyping(callback: (event: ITypingEvent) => void) {
  const socket = getSocket();
  socket.on(MessageEvent.TypingIndicator, callback);
  return () => socket.off(MessageEvent.TypingIndicator, callback);
}

export function subscribeToMessageStatus(callback: (event: IMessageSentEvent) => void) {
  const socket = getSocket();
  socket.on(MessageEvent.MessageStatusChanged, callback);
  return () => socket.off(MessageEvent.MessageStatusChanged, callback);
}

export function subscribeToSessionStatus(callback: (status: any) => void) {
  const socket = getSocket();
  socket.on(MessageEvent.SessionStatus, callback);
  return () => socket.off(MessageEvent.SessionStatus, callback);
}

export function subscribeToReactionUpdated(callback: (event: IReactionUpdatedEvent) => void) {
  const socket = getSocket();
  socket.on(MessageEvent.ReactionUpdated, callback);
  return () => socket.off(MessageEvent.ReactionUpdated, callback);
}

// CRM real-time events
export interface ICrmEvent {
  contactId?: string;
  data?: any;
  id?: string;
}

const CRM_EVENTS = [
  'note:created', 'note:updated', 'note:deleted',
  'task:created', 'task:updated', 'task:deleted',
  'order:created', 'order:updated', 'order:deleted',
  'transaction:created', 'transaction:updated', 'transaction:deleted',
  'tag:assigned', 'tag:removed',
] as const;

export type CrmEventType = typeof CRM_EVENTS[number];

export function subscribeToCrmEvents(callback: (event: CrmEventType, data: ICrmEvent) => void) {
  const socket = getSocket();
  const handlers = CRM_EVENTS.map((eventName) => {
    const handler = (payload: ICrmEvent) => callback(eventName, payload);
    socket.on(eventName, handler);
    return { eventName, handler };
  });
  return () => {
    for (const { eventName, handler } of handlers) {
      socket.off(eventName, handler);
    }
  };
}
