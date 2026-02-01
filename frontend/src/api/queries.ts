import api from './client';

export interface Contact {
  id: string;
  userId: string;
  phoneNumber: string;
  name?: string;
  email?: string;
  isBlocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationList {
  id: string;
  contactId: string;
  contact: Contact;
  lastMessage?: any;
  unreadCount: number;
  isActive: boolean;
  lastMessageAt?: string;
}

export interface Message {
  id: string;
  contactId: string;
  conversationId: string;
  content?: string;
  messageType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'LOCATION' | 'CONTACT';
  direction: 'INCOMING' | 'OUTGOING';
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'RECEIVED';
  mediaUrl?: string;
  mediaType?: string;
  waMessageId?: string;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const messageAPI = {
  // Fetch all conversations for user
  async getConversations(page = 1, limit = 20) {
    const { data } = await api.get('/messages', { params: { page, limit } });
    return data.data;
  },

  // Fetch messages for a contact
  async getMessagesByContact(contactId: string, limit = 50, offset = 0) {
    const { data } = await api.get(`/messages/contact/${contactId}`, { params: { limit, offset } });
    return data.data;
  },

  // Send message
  async sendMessage(contactId: string, content: string, mediaUrl?: string) {
    const payload: any = { contactId, content };
    if (mediaUrl) {
      payload.mediaUrl = mediaUrl;
    }
    const { data } = await api.post('/messages', payload);
    return data.data;
  },

  // Mark message as read
  async markAsRead(messageId: string) {
    const { data } = await api.put(`/messages/${messageId}/read`);
    return data.data;
  },

  // Send reaction to message
  async sendReaction(messageId: string, emoji: string) {
    const { data } = await api.post(`/messages/${messageId}/reaction`, { emoji });
    return data.data;
  },
};

export const sessionAPI = {
  // Initialize WhatsApp Web session
  async initializeSession() {
    try {
      const { data } = await api.post('/whatsapp-web/initialize');
      // Handle both {success, sessionId, status} and {data: {...}} response formats
      return data.data || data;
    } catch (error: any) {
      console.error('Session initialization error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Get session status
  async getSessionStatus() {
    try {
      const { data } = await api.get('/whatsapp-web/status');
      // Handle both direct response and nested data response
      return data.data || data;
    } catch (error: any) {
      console.error('Session status error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Disconnect session
  async disconnectSession() {
    try {
      const { data } = await api.post('/whatsapp-web/disconnect');
      return data.data;
    } catch (error: any) {
      console.error('Session disconnect error:', error.response?.data || error.message);
      throw error;
    }
  },
};

export const contactAPI = {
  // Search/list contacts
  async searchContacts(search?: string, limit = 20, offset = 0) {
    const { data } = await api.get('/contacts', { params: { search, limit, offset } });
    return data.data;
  },

  // Get contact by id
  async getContact(contactId: string) {
    const { data } = await api.get(`/contacts/${contactId}`);
    return data.data;
  },

  // Update contact
  async updateContact(contactId: string, updates: Partial<Contact>) {
    const { data } = await api.put(`/contacts/${contactId}`, updates);
    return data.data;
  },

  // Create contact
  async createContact(phoneNumber: string, name?: string) {
    const { data } = await api.post('/contacts', { phoneNumber, name });
    return data.data;
  },
};
