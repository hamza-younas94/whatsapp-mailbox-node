import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '@/api/client';
import { messageAPI } from '@/api/queries';
import { subscribeToMessage, subscribeToMessageStatus, subscribeToReactionUpdated } from '@/api/socket';
import { getContactTypeFromId, getContactTypeInfo, getContactTypeBadgeClass } from '@/utils/contact-type';
import MessageBubble from '@/components/MessageBubble';
import MessageComposer from '@/components/MessageComposer';
import '@/styles/chat-pane.css';
import '@/styles/contact-type-badge.css';
import '@/styles/contact-modal.css';

interface Message {
  id: string;
  contactId: string;
  conversationId?: string;
  content?: string;
  messageType?: string;
  direction: 'INCOMING' | 'OUTGOING';
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'RECEIVED';
  createdAt: string;
  mediaUrl?: string;
  mediaType?: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';
  reaction?: string | null;
  metadata?: any;
}

interface ChatPaneProps {
  contactId?: string;
  contactName?: string;
  chatId?: string;
  contactType?: string | null;
  profilePic?: string | null;
  phoneNumber?: string;
  onUnload?: () => void;
}

const ChatPane: React.FC<ChatPaneProps> = ({ contactId, contactName, chatId, contactType, profilePic, phoneNumber }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [contactTags, setContactTags] = useState<Array<{ id: string; name: string }>>([]);
  const [newTag, setNewTag] = useState('');
  const [notes, setNotes] = useState<Array<{ id: string; content: string; createdAt: string }>>([]);
  const [newNote, setNewNote] = useState('');
  const [transactions, setTransactions] = useState<Array<{ id: string; amount: number; description: string; status: string; createdAt: string }>>([]);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [newTransaction, setNewTransaction] = useState({ amount: '', description: '', status: 'pending' });
  const [activeTab, setActiveTab] = useState<'info' | 'notes' | 'transactions' | 'automations'>('info');
  const [automations, setAutomations] = useState<Array<{ id: string; name: string; isActive: boolean }>>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageSubscriptionRef = useRef<(() => void) | null>(null);
  const statusSubscriptionRef = useRef<(() => void) | null>(null);

  // Get contact type for display
  const contactTypeResolved = getContactTypeFromId(chatId, undefined, contactType);
  const typeInfo = getContactTypeInfo(contactTypeResolved);
  const badgeClass = getContactTypeBadgeClass(contactTypeResolved);

  // Load messages from API
  const loadMessages = useCallback(
    async (limit = 50, offset = 0) => {
      if (!contactId) return;

      try {
        setLoading(true);
        const response = await messageAPI.getMessagesByContact(contactId, limit, offset);

        if (offset === 0) {
          setMessages(response.data.reverse());

          // Mark unread messages as read
          const unreadMessages = response.data.filter(
            (msg: any) => msg.direction === 'INCOMING' && msg.status !== 'READ'
          );
          unreadMessages.forEach((msg: any) => {
            messageAPI.markAsRead(msg.id).catch(() => {});
          });
        } else {
          setMessages((prev) => [...response.data.reverse(), ...prev]);
        }

        setHasMore(response.data.length === limit);
      } catch {
        // Failed to load messages
      } finally {
        setLoading(false);
      }
    },
    [contactId]
  );

  // Initial load and subscribe to real-time updates
  useEffect(() => {
    if (!contactId) {
      setMessages([]);
      return;
    }

    loadMessages(50, 0);

    messageSubscriptionRef.current = subscribeToMessage((msg) => {
      if (msg.contactId === contactId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, {
            id: msg.id,
            contactId: msg.contactId,
            conversationId: msg.conversationId,
            content: msg.content,
            messageType: msg.messageType,
            direction: msg.direction || 'INCOMING',
            status: msg.status || 'RECEIVED',
            createdAt: msg.createdAt,
            mediaUrl: msg.mediaUrl || undefined,
            mediaType: msg.mediaType as any,
          }];
        });
      }
    });

    statusSubscriptionRef.current = subscribeToMessageStatus((update) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === update.messageId ? { ...msg, status: update.status } : msg
        )
      );
    });

    const unsubscribeReactions = subscribeToReactionUpdated((event) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === event.messageId
            ? {
                ...msg,
                reaction: event.reaction || null,
                metadata: {
                  ...(typeof msg.metadata === 'object' ? msg.metadata : {}),
                  reaction: event.reaction || null,
                },
              }
            : msg
        )
      );
    });

    return () => {
      messageSubscriptionRef.current?.();
      statusSubscriptionRef.current?.();
      unsubscribeReactions?.();
    };
  }, [contactId, loadMessages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Handle scroll to load older messages
  const handleScroll = useCallback(() => {
    if (!scrollRef.current || loading || !hasMore) return;

    const { scrollTop } = scrollRef.current;
    if (scrollTop < 100) {
      loadMessages(50, messages.length);
    }
  }, [loading, hasMore, messages.length, loadMessages]);

  // Handle phone call
  const handleCall = () => {
    if (phoneNumber) {
      window.open(`tel:${phoneNumber}`, '_self');
    }
  };

  // Load CRM data when contact info panel opens
  useEffect(() => {
    if (contactId && showContactInfo) {
      loadContactTags();
      loadContactNotes();
      loadContactTransactions();
      loadContactAutomations();
    }
  }, [contactId, showContactInfo]);

  const loadContactTags = async () => {
    try {
      const { data } = await api.get(`/contacts/${contactId}`);
      const contact = data.data || data;
      const tags = contact.tags || [];

      const processedTags = tags
        .map((t: any) => {
          if (t.tag && t.tag.id && t.tag.name) {
            return { id: t.tag.id, name: t.tag.name };
          }
          if (t.id && t.name) {
            return { id: t.id, name: t.name };
          }
          return null;
        })
        .filter((t: any) => t !== null);

      setContactTags(processedTags);
    } catch {
      // Failed to load tags
    }
  };

  const handleAddTag = async () => {
    const tagName = newTag.trim();
    if (!tagName || !contactId) return;

    try {
      // Fetch existing tags to avoid duplicates
      const { data: listResult } = await api.get('/tags');
      const tags = listResult.data || [];
      const existing = tags.find((t: any) => (t.name || '').toLowerCase() === tagName.toLowerCase());

      let tagId: string | undefined = existing?.id;

      // Create tag if it doesn't exist
      if (!tagId) {
        const { data: created } = await api.post('/tags', { name: tagName });
        tagId = created.data?.id;
      }

      if (!tagId) return;

      // Link tag to contact
      await api.post('/tags/contacts', { contactId, tagId });
      setContactTags((prev) => [...prev, { id: tagId as string, name: tagName }]);
      setNewTag('');
    } catch {
      // Failed to add tag
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    if (!contactId) return;
    try {
      await api.delete(`/tags/contacts/${contactId}/${tagId}`);
      setContactTags((prev) => prev.filter((t) => t.id !== tagId));
    } catch {
      // Failed to remove tag
    }
  };

  const loadContactNotes = async () => {
    if (!contactId) return;
    try {
      const { data } = await api.get(`/notes?contactId=${contactId}`);
      setNotes(data.data || []);
    } catch {
      // Failed to load notes
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !contactId) return;
    try {
      const { data } = await api.post('/notes', { contactId, content: newNote });
      setNotes(prev => [data.data || data, ...prev]);
      setNewNote('');
    } catch {
      // Failed to add note
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await api.delete(`/notes/${noteId}`);
      setNotes(prev => prev.filter(n => n.id !== noteId));
    } catch {
      // Failed to delete note
    }
  };

  const loadContactTransactions = async () => {
    if (!contactId) return;
    try {
      const { data } = await api.get(`/crm/transactions?contactId=${contactId}`);
      setTransactions(data.data || []);
    } catch {
      // Failed to load transactions
    }
  };

  const handleAddTransaction = async () => {
    if (!newTransaction.amount || !contactId) return;
    try {
      const { data } = await api.post('/crm/transactions', {
        contactId,
        amount: parseFloat(newTransaction.amount),
        description: newTransaction.description,
        status: newTransaction.status
      });
      setTransactions(prev => [data.data || data, ...prev]);
      setNewTransaction({ amount: '', description: '', status: 'pending' });
      setShowTransactionModal(false);
    } catch {
      // Failed to add transaction
    }
  };

  const loadContactAutomations = async () => {
    if (!contactId) return;
    try {
      const { data } = await api.get('/automations');
      setAutomations(data.data || []);
    } catch {
      // Failed to load automations
    }
  };

  const handleEnrollInAutomation = async (automationId: string) => {
    if (!contactId) return;
    try {
      await api.post(`/automations/${automationId}/enroll`, { contactId });
      alert('Contact enrolled in automation!');
    } catch {
      // Failed to enroll
    }
  };

  // Handle send message — tempId declared before try for proper scope in catch
  const handleSend = async (content: string, mediaUrl?: string) => {
    if (!contactId || (!content && !mediaUrl)) return;

    const tempId = `temp-${Date.now()}`;

    try {
      setSending(true);

      const optimisticMessage: Message = {
        id: tempId,
        contactId,
        content,
        direction: 'OUTGOING',
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        mediaUrl,
      };
      setMessages((prev) => [...prev, optimisticMessage]);

      const sentMessage = await messageAPI.sendMessage(contactId, content, mediaUrl);

      if (sentMessage) {
        setMessages((prev) =>
          prev.map(msg =>
            msg.id === tempId
              ? {
                  id: sentMessage.id,
                  contactId: sentMessage.contactId || contactId,
                  content: sentMessage.content || content,
                  direction: 'OUTGOING',
                  status: sentMessage.status || 'SENT',
                  createdAt: sentMessage.createdAt || new Date().toISOString(),
                  mediaUrl: sentMessage.mediaUrl || mediaUrl,
                  mediaType: sentMessage.mediaType,
                }
              : msg
          )
        );
      }
    } catch {
      setMessages((prev) => prev.filter(msg => msg.id !== tempId));
      alert('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  if (!contactId) {
    return (
      <div className="chat-pane empty-chat">
        <div className="empty-state-content">
          <div className="empty-icon">💬</div>
          <p className="empty-text">Select a conversation to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-pane">
      <div className="chat-header">
        <div className="chat-header-info">
          <div className="chat-header-avatar">
            {profilePic ? (
              <img src={profilePic} alt={contactName || 'Contact'} className="header-avatar-img" />
            ) : (
              <div className="header-avatar-placeholder">{contactName?.[0] || '?'}</div>
            )}
          </div>
          <div className="chat-header-text">
            <h3 className="contact-name">{contactName || 'Unknown'}</h3>
            {phoneNumber && !phoneNumber.includes('@g.us') && <p className="contact-phone">{phoneNumber}</p>}
          </div>
        </div>
        <div className="chat-header-actions">
          <button
            className="icon-button"
            onClick={handleCall}
            title="Call"
          >
            📞
          </button>
          <button
            className="icon-button"
            onClick={() => setShowContactInfo(!showContactInfo)}
            title="Contact Info"
          >
            ℹ️
          </button>
        </div>
      </div>

      {/* CRM Modal */}
      {showContactInfo && (
        <div className="modal-overlay" onClick={() => setShowContactInfo(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-content">
                {profilePic ? (
                  <img src={profilePic} alt={contactName || 'Contact'} className="modal-avatar" />
                ) : (
                  <div className="modal-avatar-placeholder">{contactName?.[0] || '?'}</div>
                )}
                <div className="modal-title">
                  <h3>{contactName || 'Unknown'}</h3>
                  {phoneNumber && <p>{phoneNumber}</p>}
                  <span className={`modal-badge ${badgeClass}`}>
                    {typeInfo.icon} {typeInfo.label}
                  </span>
                </div>
              </div>
              <button className="modal-close" onClick={() => setShowContactInfo(false)}>
                ✕
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="modal-tabs">
              <button
                className={`modal-tab ${activeTab === 'info' ? 'active' : ''}`}
                onClick={() => setActiveTab('info')}
              >
                <span className="tab-icon">🏷️</span>
                <span className="tab-label">Tags</span>
              </button>
              <button
                className={`modal-tab ${activeTab === 'notes' ? 'active' : ''}`}
                onClick={() => setActiveTab('notes')}
              >
                <span className="tab-icon">📝</span>
                <span className="tab-label">Notes</span>
              </button>
              <button
                className={`modal-tab ${activeTab === 'transactions' ? 'active' : ''}`}
                onClick={() => setActiveTab('transactions')}
              >
                <span className="tab-icon">💰</span>
                <span className="tab-label">Sales</span>
              </button>
              <button
                className={`modal-tab ${activeTab === 'automations' ? 'active' : ''}`}
                onClick={() => setActiveTab('automations')}
              >
                <span className="tab-icon">⚡</span>
                <span className="tab-label">Auto</span>
              </button>
            </div>

            <div className="modal-body">
              {/* Tags Tab */}
              {activeTab === 'info' && (
                <div className="modal-section">
                  <div className="section-header">
                    <h4>Contact Tags</h4>
                    <span className="badge-count">{contactTags.length}</span>
                  </div>

                  <div className="tags-grid">
                    {contactTags.length === 0 ? (
                      <p className="empty-hint">No tags added yet</p>
                    ) : (
                      contactTags.map((tag) => (
                        <span key={tag.id} className="tag-chip">
                          {tag.name}
                          <button onClick={() => handleRemoveTag(tag.id)}>×</button>
                        </span>
                      ))
                    )}
                  </div>

                  <div className="add-input-group">
                    <input
                      type="text"
                      placeholder="Add new tag..."
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                    />
                    <button onClick={handleAddTag} disabled={!newTag.trim()}>
                      Add
                    </button>
                  </div>

                  {chatId && (
                    <div className="info-detail">
                      <label>Chat ID</label>
                      <code>{chatId}</code>
                    </div>
                  )}
                </div>
              )}

              {/* Notes Tab */}
              {activeTab === 'notes' && (
                <div className="modal-section">
                  <div className="section-header">
                    <h4>Notes</h4>
                    <span className="badge-count">{notes.length}</span>
                  </div>

                  <div className="add-note-form">
                    <textarea
                      placeholder="Write a note about this contact..."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      rows={3}
                    />
                    <button onClick={handleAddNote} disabled={!newNote.trim()}>
                      💾 Save Note
                    </button>
                  </div>

                  <div className="notes-list-container">
                    {notes.length === 0 ? (
                      <div className="empty-state-small">
                        <span>📝</span>
                        <p>No notes yet</p>
                      </div>
                    ) : (
                      notes.map((note) => (
                        <div key={note.id} className="note-card">
                          <p>{note.content}</p>
                          <div className="note-footer">
                            <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                            <button onClick={() => handleDeleteNote(note.id)}>🗑️</button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Transactions Tab */}
              {activeTab === 'transactions' && (
                <div className="modal-section">
                  <div className="section-header">
                    <h4>Sales & Transactions</h4>
                    <button
                      className="btn-primary-small"
                      onClick={() => setShowTransactionModal(true)}
                    >
                      + Add
                    </button>
                  </div>

                  <div className="transactions-list-container">
                    {transactions.length === 0 ? (
                      <div className="empty-state-small">
                        <span>💰</span>
                        <p>No transactions yet</p>
                        <button onClick={() => setShowTransactionModal(true)}>Add First Transaction</button>
                      </div>
                    ) : (
                      transactions.map((tx) => (
                        <div key={tx.id} className="tx-card">
                          <div className="tx-card-amount">${tx.amount.toFixed(2)}</div>
                          <div className="tx-card-info">
                            <span className="tx-desc">{tx.description || 'No description'}</span>
                            <span className={`tx-badge tx-${tx.status}`}>{tx.status}</span>
                          </div>
                          <div className="tx-card-date">
                            {new Date(tx.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Automations Tab */}
              {activeTab === 'automations' && (
                <div className="modal-section">
                  <div className="section-header">
                    <h4>Automations</h4>
                  </div>

                  <div className="automations-list-container">
                    {automations.length === 0 ? (
                      <div className="empty-state-small">
                        <span>⚡</span>
                        <p>No automations available</p>
                        <a href="/automation.html" target="_blank">Create Automation</a>
                      </div>
                    ) : (
                      automations.map((auto) => (
                        <div key={auto.id} className="automation-card">
                          <div className={`auto-indicator ${auto.isActive ? 'active' : ''}`}></div>
                          <span className="auto-card-name">{auto.name}</span>
                          <button
                            className="btn-enroll"
                            onClick={() => handleEnrollInAutomation(auto.id)}
                          >
                            Enroll
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="quick-links">
                    <a href="/automation.html" target="_blank" className="quick-link">
                      ⚙️ Manage Automations
                    </a>
                    <a href="/drip-campaigns.html" target="_blank" className="quick-link">
                      💧 Drip Campaigns
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {showTransactionModal && (
        <div className="modal-overlay" onClick={() => setShowTransactionModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Add Transaction</h3>
            <div className="form-group">
              <label>Amount ($)</label>
              <input
                type="number"
                value={newTransaction.amount}
                onChange={(e) => setNewTransaction(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <input
                type="text"
                value={newTransaction.description}
                onChange={(e) => setNewTransaction(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Product/Service description"
              />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select
                value={newTransaction.status}
                onChange={(e) => setNewTransaction(prev => ({ ...prev, status: e.target.value }))}
              >
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowTransactionModal(false)} className="btn-cancel">
                Cancel
              </button>
              <button onClick={handleAddTransaction} className="btn-save">
                Save Transaction
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="messages-container" ref={scrollRef} onScroll={handleScroll}>
        {loading && <div className="loading-indicator">Loading messages...</div>}

        <div className="messages-list">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isOwn={msg.direction === 'OUTGOING'}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Only block channels and broadcasts - groups CAN send via whatsapp-web.js */}
      {(chatId?.includes('@newsletter') || chatId?.includes('@broadcast') || contactTypeResolved === 'channel' || contactTypeResolved === 'broadcast') ? (
        <div className="group-chat-notice">
          <div className="notice-icon">{contactTypeResolved === 'channel' ? '📢' : '📻'}</div>
          <div className="notice-content">
            <strong>{contactTypeResolved === 'channel' ? 'Channel' : 'Broadcast List'}</strong>
            <p>This is a read-only {contactTypeResolved === 'channel' ? 'channel' : 'broadcast list'}. You can view messages but cannot send.</p>
          </div>
        </div>
      ) : (
        <MessageComposer onSend={handleSend} isLoading={sending} disabled={sending} />
      )}
    </div>
  );
};

export default ChatPane;
