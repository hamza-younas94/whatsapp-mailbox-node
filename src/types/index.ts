// src/types/index.ts
// Core type definitions following Domain-Driven Design

export interface CreateMessageInput {
  contactId: string;
  content: string;
  messageType?: MessageType;
  mediaUrl?: string;
  mediaType?: MediaType;
}

export interface CreateContactInput {
  phoneNumber: string;
  name?: string;
  email?: string;
}

export interface MessageFilters {
  conversationId?: string;
  contactId?: string;
  status?: MessageStatus;
  direction?: MessageDirection;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface ContactFilters {
  search?: string;
  tags?: string[];
  isBlocked?: boolean;
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface JwtPayload {
  id: string;
  email: string;
  role: UserRole;
}

export interface WebhookPayload {
  type: string;
  data: Record<string, unknown>;
}

export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  DOCUMENT = 'DOCUMENT',
}

export enum MediaType {
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
}

export enum MessageStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED',
}

export enum MessageDirection {
  INCOMING = 'INCOMING',
  OUTGOING = 'OUTGOING',
}

export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  AGENT = 'AGENT',
  USER = 'USER',
}
