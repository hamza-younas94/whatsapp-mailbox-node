import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '@/api/client';
import { messageAPI } from '@/api/queries';
import { subscribeToMessage, subscribeToMessageStatus, subscribeToReactionUpdated, subscribeToCrmEvents, CrmEventType } from '@/api/socket';
import { getContactTypeFromId, getContactTypeInfo, getContactTypeBadgeClass } from '@/utils/contact-type';
import { getAvatarUrl, getAvatarInitial } from '@/utils/avatar';
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
  reaction?: string;
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
  const [activeTab, setActiveTab] = useState<'overview' | 'info' | 'notes' | 'transactions' | 'orders' | 'tasks' | 'automations'>('overview');
  const [automations, setAutomations] = useState<Array<{ id: string; name: string; isActive: boolean }>>([]);
  const [allTags, setAllTags] = useState<Array<{ id: string; name: string; color?: string }>>([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [orders, setOrders] = useState<Array<{ id: string; orderNumber: string; status: string; totalAmount: number; orderDate: string }>>([]);
  const [tasks, setTasks] = useState<Array<{ id: string; title: string; status: string; priority: string; dueDate?: string; description?: string }>>([]);
  // Inline CRUD state
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', dueDate: '', priority: 'TASK_MEDIUM' });
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [orderForm, setOrderForm] = useState({ orderType: 'DELIVERY', deliveryAddress: '', notes: '' });
  const [orderItems, setOrderItems] = useState([{ name: '', quantity: 1, unitPrice: 0 }]);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editNoteContent, setEditNoteContent] = useState('');
  const [editingTx, setEditingTx] = useState<string | null>(null);
  const [editTxForm, setEditTxForm] = useState({ amount: '', description: '', status: '' });
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageSubscriptionRef = useRef<(() => void) | null>(null);
  const statusSubscriptionRef = useRef<(() => void) | null>(null);
  const isContactSwitchRef = useRef(false);

  // Get contact type for display
  const contactTypeResolved = getContactTypeFromId(chatId, undefined, contactType);
  const typeInfo = getContactTypeInfo(contactTypeResolved);
  const badgeClass = getContactTypeBadgeClass(contactTypeResolved);

  // Use local avatar URL to avoid 403 errors from expired CDN URLs
  const localProfilePic = getAvatarUrl(profilePic, chatId);
  const avatarInitial = getAvatarInitial(contactName);

  // Load messages from API
  const loadMessages = useCallback(
    async (limit = 50, offset = 0) => {
      if (!contactId) return;

      try {
        if (offset > 0) setLoading(true);
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

    setMessages([]);
    isContactSwitchRef.current = true;
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
          msg.id === update.id || msg.id === update.waMessageId ? { ...msg, status: update.status } : msg
        )
      );
    });

    const unsubscribeReactions = subscribeToReactionUpdated((event) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === event.messageId
            ? {
                ...msg,
                reaction: event.reaction || undefined,
                metadata: {
                  ...(typeof msg.metadata === 'object' ? msg.metadata : {}),
                  reaction: event.reaction || undefined,
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

  // Reset CRM state when switching contacts (no more key-based remount)
  useEffect(() => {
    setShowContactInfo(false);
    setNotes([]);
    setTasks([]);
    setOrders([]);
    setTransactions([]);
    setContactTags([]);
    setAutomations([]);
    setActiveTab('overview');
    setShowTaskForm(false);
    setShowOrderForm(false);
    setEditingNote(null);
    setEditingTx(null);
    setEditingTask(null);
  }, [contactId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current && messages.length > 0) {
      const behavior = isContactSwitchRef.current ? 'instant' : 'smooth';
      messagesEndRef.current.scrollIntoView({ behavior: behavior as ScrollBehavior });
      isContactSwitchRef.current = false;
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
      loadAllTags();
      loadContactNotes();
      loadContactTransactions();
      loadContactAutomations();
      loadContactOrders();
      loadContactTasks();
    }
  }, [contactId, showContactInfo]);

  // Subscribe to CRM real-time events when modal is open
  useEffect(() => {
    if (!contactId || !showContactInfo) return;
    const unsubscribe = subscribeToCrmEvents((event: CrmEventType, payload) => {
      if (payload.contactId && payload.contactId !== contactId) return;
      if (event.startsWith('note:')) loadContactNotes();
      else if (event.startsWith('task:')) loadContactTasks();
      else if (event.startsWith('order:')) loadContactOrders();
      else if (event.startsWith('transaction:')) loadContactTransactions();
      else if (event.startsWith('tag:')) loadContactTags();
    });
    return unsubscribe;
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

  const loadAllTags = async () => {
    try {
      const { data } = await api.get('/tags');
      setAllTags(data.data || []);
    } catch {
      // Failed to load tags
    }
  };

  const loadContactOrders = async () => {
    if (!contactId) return;
    try {
      const { data } = await api.get(`/orders?contactId=${contactId}`);
      setOrders((data.data?.data || data.data || []).slice(0, 10));
    } catch {
      // Failed to load orders
    }
  };

  const loadContactTasks = async () => {
    if (!contactId) return;
    try {
      const { data } = await api.get(`/tasks?contactId=${contactId}`);
      setTasks((data.data?.data || data.data || []).slice(0, 10));
    } catch {
      // Failed to load tasks
    }
  };

  const handleSelectExistingTag = async (tag: { id: string; name: string }) => {
    if (!contactId) return;
    try {
      await api.post('/tags/contacts', { contactId, tagId: tag.id });
      setContactTags((prev) => [...prev, { id: tag.id, name: tag.name }]);
      setNewTag('');
      setShowTagSuggestions(false);
    } catch {
      // Failed to add tag (may already be assigned)
    }
  };

  // === Task CRUD ===
  const handleCreateTask = async () => {
    if (!taskForm.title.trim() || !contactId) return;
    try {
      const { data } = await api.post('/tasks', {
        contactId,
        title: taskForm.title,
        description: taskForm.description || undefined,
        dueDate: taskForm.dueDate || undefined,
        priority: taskForm.priority,
      });
      setTasks(prev => [data.data || data, ...prev]);
      setTaskForm({ title: '', description: '', dueDate: '', priority: 'TASK_MEDIUM' });
      setShowTaskForm(false);
    } catch { /* Failed */ }
  };

  const handleUpdateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      await api.put(`/tasks/${taskId}`, { status: newStatus });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    } catch { /* Failed */ }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await api.delete(`/tasks/${taskId}`);
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch { /* Failed */ }
  };

  // === Order CRUD ===
  const handleCreateOrder = async () => {
    if (!contactId || orderItems.every(i => !i.name.trim())) return;
    try {
      const validItems = orderItems.filter(i => i.name.trim());
      const { data } = await api.post('/orders', {
        contactId,
        orderType: orderForm.orderType,
        deliveryAddress: orderForm.deliveryAddress || undefined,
        notes: orderForm.notes || undefined,
        items: validItems.map(i => ({ name: i.name, quantity: i.quantity, unitPrice: i.unitPrice })),
      });
      setOrders(prev => [data.data || data, ...prev]);
      setOrderForm({ orderType: 'DELIVERY', deliveryAddress: '', notes: '' });
      setOrderItems([{ name: '', quantity: 1, unitPrice: 0 }]);
      setShowOrderForm(false);
    } catch { /* Failed */ }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await api.put(`/orders/${orderId}`, { status: newStatus });
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    } catch { /* Failed */ }
  };

  // === Note Edit ===
  const handleSaveEditNote = async () => {
    if (!editingNote || !editNoteContent.trim()) return;
    try {
      await api.put(`/notes/${editingNote}`, { content: editNoteContent });
      setNotes(prev => prev.map(n => n.id === editingNote ? { ...n, content: editNoteContent } : n));
      setEditingNote(null);
      setEditNoteContent('');
    } catch { /* Failed */ }
  };

  // === Transaction Edit/Delete ===
  const handleDeleteTransaction = async (txId: string) => {
    try {
      await api.delete(`/crm/transactions/${txId}`);
      setTransactions(prev => prev.filter(t => t.id !== txId));
    } catch { /* Failed */ }
  };

  const handleSaveEditTransaction = async () => {
    if (!editingTx) return;
    try {
      await api.put(`/crm/transactions/${editingTx}`, {
        amount: parseFloat(editTxForm.amount),
        description: editTxForm.description,
        status: editTxForm.status,
      });
      setTransactions(prev => prev.map(t => t.id === editingTx ? {
        ...t,
        amount: parseFloat(editTxForm.amount),
        description: editTxForm.description,
        status: editTxForm.status,
      } : t));
      setEditingTx(null);
    } catch { /* Failed */ }
  };

  const nextTaskStatus = (current: string) => {
    const cycle: Record<string, string> = {
      'TASK_PENDING': 'TASK_IN_PROGRESS',
      'TASK_IN_PROGRESS': 'TASK_COMPLETED',
      'TASK_COMPLETED': 'TASK_PENDING',
    };
    return cycle[current] || 'TASK_PENDING';
  };

  // Filter tag suggestions based on input
  const filteredSuggestions = newTag.trim()
    ? allTags.filter((t) => {
        const assignedIds = new Set(contactTags.map((ct) => ct.id));
        return !assignedIds.has(t.id) && t.name.toLowerCase().includes(newTag.toLowerCase());
      })
    : [];

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
            {localProfilePic ? (
              <>
                <img
                  src={localProfilePic}
                  alt={contactName || 'Contact'}
                  className="header-avatar-img"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.nextElementSibling;
                    if (fallback) (fallback as HTMLElement).style.display = 'flex';
                  }}
                />
                <div className="header-avatar-placeholder" style={{ display: 'none' }}>
                  {avatarInitial}
                </div>
              </>
            ) : (
              <div className="header-avatar-placeholder">{avatarInitial}</div>
            )}
          </div>
          <div className="chat-header-text">
            <h3 className="contact-name">{contactName || 'Unknown'}</h3>
            {phoneNumber && contactTypeResolved === 'contact' && <p className="contact-phone">{phoneNumber}</p>}
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
                {localProfilePic ? (
                  <>
                    <img
                      src={localProfilePic}
                      alt={contactName || 'Contact'}
                      className="modal-avatar"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.nextElementSibling;
                        if (fallback) (fallback as HTMLElement).style.display = 'flex';
                      }}
                    />
                    <div className="modal-avatar-placeholder" style={{ display: 'none' }}>
                      {avatarInitial}
                    </div>
                  </>
                ) : (
                  <div className="modal-avatar-placeholder">{avatarInitial}</div>
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
              <button className={`modal-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
                <span className="tab-icon">📊</span><span className="tab-label">Overview</span>
              </button>
              <button className={`modal-tab ${activeTab === 'info' ? 'active' : ''}`} onClick={() => setActiveTab('info')}>
                <span className="tab-icon">🏷️</span><span className="tab-label">Tags</span>
              </button>
              <button className={`modal-tab ${activeTab === 'notes' ? 'active' : ''}`} onClick={() => setActiveTab('notes')}>
                <span className="tab-icon">📝</span><span className="tab-label">Notes</span>
              </button>
              <button className={`modal-tab ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}>
                <span className="tab-icon">📦</span><span className="tab-label">Orders</span>
              </button>
              <button className={`modal-tab ${activeTab === 'transactions' ? 'active' : ''}`} onClick={() => setActiveTab('transactions')}>
                <span className="tab-icon">💰</span><span className="tab-label">Sales</span>
              </button>
              <button className={`modal-tab ${activeTab === 'tasks' ? 'active' : ''}`} onClick={() => setActiveTab('tasks')}>
                <span className="tab-icon">✅</span><span className="tab-label">Tasks</span>
              </button>
              <button className={`modal-tab ${activeTab === 'automations' ? 'active' : ''}`} onClick={() => setActiveTab('automations')}>
                <span className="tab-icon">⚡</span><span className="tab-label">Auto</span>
              </button>
            </div>

            <div className="modal-body">
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="modal-section">
                  <div className="overview-grid">
                    <div className="overview-card" onClick={() => setActiveTab('orders')}>
                      <div className="overview-card-icon">📦</div>
                      <div className="overview-value">{orders.length}</div>
                      <div className="overview-label">Orders</div>
                    </div>
                    <div className="overview-card" onClick={() => setActiveTab('transactions')}>
                      <div className="overview-card-icon">💰</div>
                      <div className="overview-value">{transactions.length}</div>
                      <div className="overview-label">Sales</div>
                    </div>
                    <div className="overview-card" onClick={() => setActiveTab('tasks')}>
                      <div className="overview-card-icon">📋</div>
                      <div className="overview-value">{tasks.filter(t => t.status !== 'TASK_COMPLETED').length}</div>
                      <div className="overview-label">Open Tasks</div>
                    </div>
                    <div className="overview-card" onClick={() => setActiveTab('notes')}>
                      <div className="overview-card-icon">📝</div>
                      <div className="overview-value">{notes.length}</div>
                      <div className="overview-label">Notes</div>
                    </div>
                  </div>

                  <div className="section-header">
                    <h4>Tags</h4>
                    <span className="badge-count">{contactTags.length}</span>
                  </div>
                  <div className="tags-grid">
                    {contactTags.length === 0 ? (
                      <p className="empty-hint">No tags — add from Tags tab</p>
                    ) : (
                      contactTags.map((tag) => (
                        <span key={tag.id} className="tag-chip">{tag.name}</span>
                      ))
                    )}
                  </div>

                  <div className="section-header" style={{ marginTop: 16 }}>
                    <h4>Quick Access</h4>
                  </div>
                  <div className="quick-links-grid">
                    <a href="/orders.html" target="_blank" className="quick-link-card">📦 Orders</a>
                    <a href="/tasks.html" target="_blank" className="quick-link-card">✅ Tasks</a>
                    <a href="/invoices.html" target="_blank" className="quick-link-card">🧾 Invoices</a>
                    <a href="/products.html" target="_blank" className="quick-link-card">🛍️ Products</a>
                    <a href="/appointments.html" target="_blank" className="quick-link-card">📅 Bookings</a>
                    <a href="/automation.html" target="_blank" className="quick-link-card">⚡ Automation</a>
                  </div>
                </div>
              )}

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

                  <div className="add-input-group tag-autocomplete-container">
                    <input
                      type="text"
                      placeholder="Add or search tags..."
                      value={newTag}
                      onChange={(e) => { setNewTag(e.target.value); setShowTagSuggestions(true); }}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                      onFocus={() => setShowTagSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowTagSuggestions(false), 200)}
                    />
                    <button onClick={handleAddTag} disabled={!newTag.trim()}>
                      Add
                    </button>
                    {showTagSuggestions && filteredSuggestions.length > 0 && (
                      <div className="tag-suggestions-dropdown">
                        {filteredSuggestions.map((tag) => (
                          <button
                            key={tag.id}
                            className="tag-suggestion-item"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleSelectExistingTag(tag)}
                          >
                            {tag.name}
                          </button>
                        ))}
                      </div>
                    )}
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
                          {editingNote === note.id ? (
                            <>
                              <textarea
                                className="inline-edit-textarea"
                                value={editNoteContent}
                                onChange={(e) => setEditNoteContent(e.target.value)}
                                rows={3}
                              />
                              <div className="note-footer">
                                <button className="btn-inline-save" onClick={handleSaveEditNote}>Save</button>
                                <button className="btn-inline-cancel" onClick={() => setEditingNote(null)}>Cancel</button>
                              </div>
                            </>
                          ) : (
                            <>
                              <p>{note.content}</p>
                              <div className="note-footer">
                                <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                                <div className="action-buttons">
                                  <button onClick={() => { setEditingNote(note.id); setEditNoteContent(note.content); }} title="Edit">✏️</button>
                                  <button onClick={() => handleDeleteNote(note.id)} title="Delete">🗑️</button>
                                </div>
                              </div>
                            </>
                          )}
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
                          {editingTx === tx.id ? (
                            <div className="inline-form">
                              <div className="inline-form-row">
                                <input type="number" placeholder="Amount" value={editTxForm.amount} onChange={e => setEditTxForm(p => ({ ...p, amount: e.target.value }))} />
                                <select value={editTxForm.status} onChange={e => setEditTxForm(p => ({ ...p, status: e.target.value }))}>
                                  <option value="PENDING">Pending</option>
                                  <option value="COMPLETED">Completed</option>
                                  <option value="CANCELLED">Cancelled</option>
                                  <option value="REFUNDED">Refunded</option>
                                </select>
                              </div>
                              <input type="text" placeholder="Description" value={editTxForm.description} onChange={e => setEditTxForm(p => ({ ...p, description: e.target.value }))} />
                              <div className="form-actions">
                                <button className="btn-inline-save" onClick={handleSaveEditTransaction}>Save</button>
                                <button className="btn-inline-cancel" onClick={() => setEditingTx(null)}>Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="tx-card-amount">${tx.amount.toFixed(2)}</div>
                              <div className="tx-card-info">
                                <span className="tx-desc">{tx.description || 'No description'}</span>
                                <span className={`tx-badge tx-${tx.status}`}>{tx.status}</span>
                              </div>
                              <div className="tx-card-date">
                                {new Date(tx.createdAt).toLocaleDateString()}
                                <div className="action-buttons">
                                  <button onClick={() => { setEditingTx(tx.id); setEditTxForm({ amount: String(tx.amount), description: tx.description, status: tx.status }); }} title="Edit">✏️</button>
                                  <button onClick={() => handleDeleteTransaction(tx.id)} title="Delete">🗑️</button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Orders Tab */}
              {activeTab === 'orders' && (
                <div className="modal-section">
                  <div className="section-header">
                    <h4>Orders</h4>
                    <button className="btn-primary-small" onClick={() => setShowOrderForm(!showOrderForm)}>
                      {showOrderForm ? '- Cancel' : '+ New'}
                    </button>
                  </div>

                  {showOrderForm && (
                    <div className="inline-form">
                      <div className="inline-form-row">
                        <select value={orderForm.orderType} onChange={e => setOrderForm(p => ({ ...p, orderType: e.target.value }))}>
                          <option value="DELIVERY">Delivery</option>
                          <option value="PICKUP">Pickup</option>
                          <option value="DINE_IN">Dine In</option>
                        </select>
                        <input type="text" placeholder="Delivery address" value={orderForm.deliveryAddress} onChange={e => setOrderForm(p => ({ ...p, deliveryAddress: e.target.value }))} />
                      </div>
                      <div className="section-header" style={{ marginTop: 8, marginBottom: 4 }}>
                        <h4 style={{ fontSize: 12 }}>Items</h4>
                        <button className="btn-inline-add" onClick={() => setOrderItems(p => [...p, { name: '', quantity: 1, unitPrice: 0 }])}>+ Item</button>
                      </div>
                      {orderItems.map((item, i) => (
                        <div key={i} className="inline-form-row item-row">
                          <input type="text" placeholder="Item name" value={item.name} onChange={e => { const v = e.target.value; setOrderItems(p => p.map((it, idx) => idx === i ? { ...it, name: v } : it)); }} />
                          <input type="number" placeholder="Qty" min={1} style={{ width: 60 }} value={item.quantity} onChange={e => { const v = parseInt(e.target.value) || 1; setOrderItems(p => p.map((it, idx) => idx === i ? { ...it, quantity: v } : it)); }} />
                          <input type="number" placeholder="Price" min={0} style={{ width: 80 }} value={item.unitPrice} onChange={e => { const v = parseFloat(e.target.value) || 0; setOrderItems(p => p.map((it, idx) => idx === i ? { ...it, unitPrice: v } : it)); }} />
                          {orderItems.length > 1 && <button className="btn-inline-remove" onClick={() => setOrderItems(p => p.filter((_, idx) => idx !== i))}>x</button>}
                        </div>
                      ))}
                      <input type="text" placeholder="Order notes (optional)" value={orderForm.notes} onChange={e => setOrderForm(p => ({ ...p, notes: e.target.value }))} />
                      <div className="form-actions">
                        <button className="btn-inline-save" onClick={handleCreateOrder} disabled={orderItems.every(i => !i.name.trim())}>Create Order</button>
                      </div>
                    </div>
                  )}

                  <div className="orders-list-container">
                    {orders.length === 0 && !showOrderForm ? (
                      <div className="empty-state-small">
                        <span>📦</span>
                        <p>No orders yet</p>
                        <button onClick={() => setShowOrderForm(true)}>Create First Order</button>
                      </div>
                    ) : (
                      orders.map((order) => (
                        <div key={order.id} className="tx-card">
                          <div className="tx-card-amount">${(order.totalAmount || 0).toFixed(2)}</div>
                          <div className="tx-card-info">
                            <span className="tx-desc">#{order.orderNumber}</span>
                            <select className="status-select" value={order.status} onChange={e => handleUpdateOrderStatus(order.id, e.target.value)}>
                              <option value="PENDING">Pending</option>
                              <option value="CONFIRMED">Confirmed</option>
                              <option value="PREPARING">Preparing</option>
                              <option value="READY">Ready</option>
                              <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
                              <option value="DELIVERED">Delivered</option>
                              <option value="CANCELLED">Cancelled</option>
                            </select>
                          </div>
                          <div className="tx-card-date">
                            {new Date(order.orderDate).toLocaleDateString()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Tasks Tab */}
              {activeTab === 'tasks' && (
                <div className="modal-section">
                  <div className="section-header">
                    <h4>Tasks</h4>
                    <button className="btn-primary-small" onClick={() => setShowTaskForm(!showTaskForm)}>
                      {showTaskForm ? '- Cancel' : '+ New'}
                    </button>
                  </div>

                  {showTaskForm && (
                    <div className="inline-form">
                      <input type="text" placeholder="Task title" value={taskForm.title} onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))} />
                      <textarea placeholder="Description (optional)" value={taskForm.description} onChange={e => setTaskForm(p => ({ ...p, description: e.target.value }))} rows={2} />
                      <div className="inline-form-row">
                        <input type="date" value={taskForm.dueDate} onChange={e => setTaskForm(p => ({ ...p, dueDate: e.target.value }))} />
                        <select value={taskForm.priority} onChange={e => setTaskForm(p => ({ ...p, priority: e.target.value }))}>
                          <option value="TASK_LOW">Low</option>
                          <option value="TASK_MEDIUM">Medium</option>
                          <option value="TASK_HIGH">High</option>
                          <option value="TASK_URGENT">Urgent</option>
                        </select>
                      </div>
                      <div className="form-actions">
                        <button className="btn-inline-save" onClick={handleCreateTask} disabled={!taskForm.title.trim()}>Create Task</button>
                      </div>
                    </div>
                  )}

                  <div className="tasks-list-container">
                    {tasks.length === 0 && !showTaskForm ? (
                      <div className="empty-state-small">
                        <span>✅</span>
                        <p>No tasks yet</p>
                        <button onClick={() => setShowTaskForm(true)}>Create First Task</button>
                      </div>
                    ) : (
                      tasks.map((task) => (
                        <div key={task.id} className="task-card">
                          <button
                            className={`task-status-dot ${task.status === 'TASK_COMPLETED' ? 'completed' : ''}`}
                            onClick={() => handleUpdateTaskStatus(task.id, nextTaskStatus(task.status))}
                            title={`Click to mark ${nextTaskStatus(task.status).replace('TASK_', '').toLowerCase()}`}
                          />
                          <div className="task-card-info">
                            <span className={`task-title ${task.status === 'TASK_COMPLETED' ? 'completed' : ''}`}>{task.title}</span>
                            <div className="task-meta">
                              <span className={`task-priority priority-${(task.priority || '').replace('TASK_', '').toLowerCase()}`}>
                                {(task.priority || '').replace('TASK_', '')}
                              </span>
                              {task.dueDate && (
                                <span className="task-due">Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                              )}
                              <button className="btn-task-delete" onClick={() => handleDeleteTask(task.id)} title="Delete">🗑️</button>
                            </div>
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
              message={{ ...msg, messageType: msg.messageType || 'TEXT' }}
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
