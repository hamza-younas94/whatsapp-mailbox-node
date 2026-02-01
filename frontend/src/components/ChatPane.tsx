import React, { useState, useEffect, useRef, useCallback } from 'react';
import { messageAPI } from '@/api/queries';
import { subscribeToMessage, subscribeToMessageStatus, subscribeToReactionUpdated, getSocket } from '@/api/socket';
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

const ChatPane: React.FC<ChatPaneProps> = ({ contactId, contactName, chatId, contactType, profilePic, phoneNumber, onUnload }) => {
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
          // Initial load: replace messages
          setMessages(response.data.reverse()); // Reverse to show oldest first
          
          // Mark unread messages as read
          const unreadMessages = response.data.filter(
            (msg: any) => msg.direction === 'INCOMING' && msg.status !== 'READ'
          );
          unreadMessages.forEach((msg: any) => {
            messageAPI.markAsRead(msg.id).catch((err) => 
              console.error('Failed to mark message as read:', err)
            );
          });
        } else {
          // Pagination: prepend older messages
          setMessages((prev) => [...response.data.reverse(), ...prev]);
        }
        
        // Check if there are more messages to load
        setHasMore(response.data.length === limit);
      } catch (error) {
        console.error('Failed to load messages:', error);
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

    // Load initial messages
    loadMessages(50, 0);

    // Subscribe to new messages (incoming)
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

    // Subscribe to message status updates
    statusSubscriptionRef.current = subscribeToMessageStatus((update) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === update.messageId ? { ...msg, status: update.status } : msg
        )
      );
    });

    // Subscribe to reaction updates
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

    // Cleanup is handled in the subscription setup above
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
      // Load more when scrolled near top
      loadMessages(50, messages.length);
    }
  }, [loading, hasMore, messages.length, loadMessages]);

  // Handle phone call
  const handleCall = () => {
    if (phoneNumber) {
      // Open phone dialer with the number
      window.open(`tel:${phoneNumber}`, '_self');
    } else {
      alert('Phone number not available for this contact');
    }
  };

  // Load contact tags
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
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${window.location.origin}/api/v1/contacts/${contactId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const result = await response.json();
        const contact = result.data || result;
        const tags = contact.tags || [];
        
        // Handle both TagOnContact structure and direct Tag structure
        const processedTags = tags
          .map((t: any) => {
            // If it's a TagOnContact with nested tag, extract it
            if (t.tag && t.tag.id && t.tag.name) {
              return { id: t.tag.id, name: t.tag.name };
            }
            // If it's already a flat Tag object
            if (t.id && t.name) {
              return { id: t.id, name: t.name };
            }
            return null;
          })
          .filter((t: any) => t !== null);
        
        console.log('Loaded contact tags:', processedTags, 'from:', tags);
        setContactTags(processedTags);
      }
    } catch (error) {
      console.error('Failed to load contact tags:', error);
    }
  };

  const handleAddTag = async () => {
    const tagName = newTag.trim();
    if (!tagName || !contactId) return;

    try {
      const token = localStorage.getItem('authToken');

      // Fetch existing tags to avoid duplicates
      const listResponse = await fetch(`${window.location.origin}/api/v1/tags`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      let tagId: string | undefined;
      if (listResponse.ok) {
        const listResult = await listResponse.json();
        const tags = listResult.data || [];
        const existing = tags.find((t: any) => (t.name || '').toLowerCase() === tagName.toLowerCase());
        if (existing) {
          tagId = existing.id;
        }
      }

      // Create tag if it doesn't exist
      if (!tagId) {
        const createResponse = await fetch(`${window.location.origin}/api/v1/tags`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name: tagName })
        });
        if (createResponse.ok) {
          const created = await createResponse.json();
          tagId = created.data?.id;
        }
      }

      if (!tagId) return;

      // Link tag to contact
      const linkResponse = await fetch(`${window.location.origin}/api/v1/tags/contacts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ contactId, tagId })
      });

      if (linkResponse.ok) {
        setContactTags((prev) => [...prev, { id: tagId as string, name: tagName }]);
        setNewTag('');
      }
    } catch (error) {
      console.error('Failed to add tag:', error);
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    if (!contactId) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${window.location.origin}/api/v1/tags/contacts/${contactId}/${tagId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setContactTags((prev) => prev.filter((t) => t.id !== tagId));
      }
    } catch (error) {
      console.error('Failed to remove tag:', error);
    }
  };

  // Load contact notes
  const loadContactNotes = async () => {
    if (!contactId) return;
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${window.location.origin}/api/v1/notes?contactId=${contactId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const result = await response.json();
        setNotes(result.data || []);
      }
    } catch (error) {
      console.error('Failed to load notes:', error);
    }
  };

  // Add note
  const handleAddNote = async () => {
    if (!newNote.trim() || !contactId) return;
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${window.location.origin}/api/v1/notes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ contactId, content: newNote })
      });
      if (response.ok) {
        const result = await response.json();
        setNotes(prev => [result.data || result, ...prev]);
        setNewNote('');
      }
    } catch (error) {
      console.error('Failed to add note:', error);
    }
  };

  // Delete note
  const handleDeleteNote = async (noteId: string) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${window.location.origin}/api/v1/notes/${noteId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setNotes(prev => prev.filter(n => n.id !== noteId));
      }
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  // Load transactions
  const loadContactTransactions = async () => {
    if (!contactId) return;
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${window.location.origin}/api/v1/crm/transactions?contactId=${contactId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const result = await response.json();
        setTransactions(result.data || []);
      }
    } catch (error) {
      console.error('Failed to load transactions:', error);
    }
  };

  // Add transaction
  const handleAddTransaction = async () => {
    if (!newTransaction.amount || !contactId) return;
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${window.location.origin}/api/v1/crm/transactions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contactId,
          amount: parseFloat(newTransaction.amount),
          description: newTransaction.description,
          status: newTransaction.status
        })
      });
      if (response.ok) {
        const result = await response.json();
        setTransactions(prev => [result.data || result, ...prev]);
        setNewTransaction({ amount: '', description: '', status: 'pending' });
        setShowTransactionModal(false);
      }
    } catch (error) {
      console.error('Failed to add transaction:', error);
    }
  };

  // Load automations
  const loadContactAutomations = async () => {
    if (!contactId) return;
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${window.location.origin}/api/v1/automations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const result = await response.json();
        setAutomations(result.data || []);
      }
    } catch (error) {
      console.error('Failed to load automations:', error);
    }
  };

  // Enroll in automation
  const handleEnrollInAutomation = async (automationId: string) => {
    if (!contactId) return;
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${window.location.origin}/api/v1/automations/${automationId}/enroll`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ contactId })
      });
      if (response.ok) {
        alert('Contact enrolled in automation!');
      }
    } catch (error) {
      console.error('Failed to enroll in automation:', error);
    }
  };

  const handleOpenCRM = () => {
    // Open CRM page with this contact
    window.open(`/crm_dashboard.php?contact=${contactId}`, '_blank');
  };

  // Handle send message
  const handleSend = async (content: string, mediaUrl?: string) => {
    if (!contactId || (!content && !mediaUrl)) return;

    try {
      setSending(true);
      
      // Add optimistic message immediately
      const tempId = `temp-${Date.now()}`;
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
      
      // Send message
      const sentMessage = await messageAPI.sendMessage(contactId, content, mediaUrl);
      
      // Replace optimistic message with real message
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
      
      // Reload messages after a short delay to ensure we have the latest from server
      setTimeout(() => {
        loadMessages(50, 0);
      }, 1000);
    } catch (error) {
      console.error('Failed to send message:', error);
      // Remove optimistic message on error
      setMessages((prev) => prev.filter(msg => msg.id !== `temp-${Date.now()}`));
      alert('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  if (!contactId) {
    return (
      <div className="chat-pane empty-chat">
        <div className="empty-state-content">
          <div className="empty-icon">💬</div></div>
          <p className="empty-text">Select a conversation to start chatting</p>
        </div></div>
      </div></div>
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
              <div className="header-avatar-placeholder">{contactName?.[0] || '?'}</div></div>
            )}
          </div></div>
          <div className="chat-header-text">
            <h3 className="contact-name">{contactName || 'Unknown'}</h3>
            {phoneNumber && !phoneNumber.includes('@g.us') && <p className="contact-phone">{phoneNumber}</p>}
          </div></div>
        </div></div>
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
        </div></div>
      </div></div>

      {/* CRM Modal */}
      {showContactInfo && (
        <div className="modal-overlay" onClick={() => setShowContactInfo(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-content">
                {profilePic ? (
                  <img src={profilePic} alt={contactName || 'Contact'} className="modal-avatar" />
                ) : (
                  <div className="modal-avatar-placeholder">{contactName?.[0] || '?'}</div></div>
                )}
                <div className="modal-title">
                  <h3>{contactName || 'Unknown'}</h3>
                  {phoneNumber && <p>{phoneNumber}</p>}
                  <span className={`modal-badge ${badgeClass}`}>
                    {typeInfo.icon} {typeInfo.label}
                  </span>
                </div></div>
              </div></div>
              <button className="modal-close" onClick={() => setShowContactInfo(false)}>
                ✕
              </button>
            </div></div>

            {/* Navigation Tabs */}
            <div className="modal-tabs">
              <button 
                className={`modal-tab ${activeTab === 'info' ? 'active' : ''}`}
                onClick={() => setActiveTab('info')}
              >
                <span className="tab-icon">🏷️</span>
                <span className="tab-label">TAGS</span>
              </button>
              <button 
                className={`modal-tab ${activeTab === 'notes' ? 'active' : ''}`}
                onClick={() => setActiveTab('notes')}
              >
                <span className="tab-icon">📝</span>
                <span className="tab-label">NOTES</span>
              </button>
              <button 
                className={`modal-tab ${activeTab === 'transactions' ? 'active' : ''}`}
                onClick={() => setActiveTab('transactions')}
              >
                <span className="tab-icon">💰</span>
                <span className="tab-label">SALES</span>
              </button>
              <button 
                className={`modal-tab ${activeTab === 'automations' ? 'active' : ''}`}
                onClick={() => setActiveTab('automations')}
              >
                <span className="tab-icon">⚡</span>
                <span className="tab-label">AUTO</span>
              </button>
            </div></div>

            <div className="modal-body">
              {/* Tags Tab */}
              {activeTab === 'info' && (
                <div className="modal-section">
                  <div className="section-header">
                    <h4>Contact Tags</h4>
                    <span className="badge-count">{contactTags.length}</span>
                  </div></div>
                  
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
                  </div></div>

                  <div className="add-input-group">
                    <input 
                      type="text"
                      placeholder="Add new tag..."
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                    />
                    <button onClick={handleAddTag} disabled={!newTag.trim()}>
                      Add
                    </button>
                  </div></div>

                  {chatId && (
                    <div className="info-detail">
                      <label>Chat ID</label>
                      <code>{chatId}</code>
                    </div></div>
                  )}
                </div></div>
              )}

              {/* Notes Tab */}
              {activeTab === 'notes' && (
                <div className="modal-section">
                  <div className="section-header">
                    <h4>Notes</h4>
                    <span className="badge-count">{notes.length}</span>
                  </div></div>

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
                  </div></div>

                  <div className="notes-list-container">
                    {notes.length === 0 ? (
                      <div className="empty-state-small">
                        <span>📝</span>
                        <p>No notes yet</p>
                      </div></div>
                    ) : (
                      notes.map((note) => (
                        <div key={note.id} className="note-card">
                          <p>{note.content}</p>
                          <div className="note-footer">
                            <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                            <button onClick={() => handleDeleteNote(note.id)}>🗑️</button>
                          </div></div>
                        </div></div>
                      ))
                    )}
                  </div></div>
                </div></div>
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
                  </div></div>

                  <div className="transactions-list-container">
                    {transactions.length === 0 ? (
                      <div className="empty-state-small">
                        <span>💰</span>
                        <p>No transactions yet</p>
                        <button onClick={() => setShowTransactionModal(true)}>Add First Transaction</button>
                      </div></div>
                    ) : (
                      transactions.map((tx) => (
                        <div key={tx.id} className="tx-card">
                          <div className="tx-card-amount">${tx.amount.toFixed(2)}</div></div>
                          <div className="tx-card-info">
                            <span className="tx-desc">{tx.description || 'No description'}</span>
                            <span className={`tx-badge tx-${tx.status}`}>{tx.status}</span>
                          </div></div>
                          <div className="tx-card-date">
                            {new Date(tx.createdAt).toLocaleDateString()}
                          </div></div>
                        </div></div>
                      ))
                    )}
                  </div></div>
                </div></div>
              )}

              {/* Automations Tab */}
              {activeTab === 'automations' && (
                <div className="modal-section">
                  <div className="section-header">
                    <h4>Automations</h4>
                  </div></div>

                  <div className="automations-list-container">
                    {automations.length === 0 ? (
                      <div className="empty-state-small">
                        <span>⚡</span>
                        <p>No automations available</p>
                        <a href="/automation.html" target="_blank">Create Automation</a>
                      </div></div>
                    ) : (
                      automations.map((auto) => (
                        <div key={auto.id} className="automation-card">
                          <div className={`auto-indicator ${auto.isActive ? 'active' : ''}`}></div></div>
                          <span className="auto-card-name">{auto.name}</span>
                          <button 
                            className="btn-enroll"
                            onClick={() => handleEnrollInAutomation(auto.id)}
                          >
                            Enroll
                          </button>
                        </div></div>
                      ))
                    )}
                  </div></div>

                  <div className="quick-links">
                    <a href="/automation.html" target="_blank" className="quick-link">
                      ⚙️ Manage Automations
                    </a>
                    <a href="/drip-campaigns.html" target="_blank" className="quick-link">
                      💧 Drip Campaigns
                    </a>
                  </div></div>
                </div></div>
              )}
            </div></div>
          </div></div>
        </div></div>
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
            </div></div>
            <div className="form-group">
              <label>Description</label>
              <input
                type="text"
                value={newTransaction.description}
                onChange={(e) => setNewTransaction(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Product/Service description"
              />
            </div></div>
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
            </div></div>
            <div className="modal-actions">
              <button onClick={() => setShowTransactionModal(false)} className="btn-cancel">
                Cancel
              </button>
              <button onClick={handleAddTransaction} className="btn-save">
                Save Transaction
              </button>
            </div></div>
          </div></div>
        </div></div>
      )}

      <div className="messages-container" ref={scrollRef} onScroll={handleScroll}>
        {loading && <div className="loading-indicator">Loading messages...</div></div>}
        
        <div className="messages-list">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isOwn={msg.direction === 'OUTGOING'}
            />
          ))}
          <div ref={messagesEndRef} />
        </div></div>
      </div></div>

      {/* Check if this is a group or channel - they typically don't support direct messaging from bots */}
      {(chatId?.includes('@g.us') || chatId?.includes('@broadcast') || contactTypeResolved === 'GROUP' || contactTypeResolved === 'CHANNEL') ? (
        <div className="group-chat-notice">
          <div className="notice-icon">👥</div></div>
          <div className="notice-content">
            <strong>{contactTypeResolved === 'GROUP' ? 'Group Chat' : contactTypeResolved === 'CHANNEL' ? 'Channel' : 'Broadcast List'}</strong>
            <p>Sending messages to groups/channels is limited. Messages are received but may require WhatsApp Business API for sending.</p>
          </div></div>
        </div></div>
      ) : (
        <MessageComposer onSend={handleSend} isLoading={sending} disabled={sending} />
      )}
    </div></div>
  );
};

export default ChatPane;
