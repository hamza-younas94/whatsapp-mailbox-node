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
  const [activeTab, setActiveTab] = useState<'overview' | 'info' | 'notes' | 'transactions' | 'orders' | 'tasks' | 'appointments' | 'invoices' | 'automations' | 'tickets' | 'subscriptions' | 'timeline'>('overview');
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
  const [appointments, setAppointments] = useState<Array<{ id: string; title: string; appointmentDate: string; duration: number; location?: string; status: string; description?: string }>>([]);
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [appointmentForm, setAppointmentForm] = useState({ title: '', appointmentDate: '', duration: 30, location: '', description: '' });
  const [invoices, setInvoices] = useState<Array<{ id: string; invoiceNumber: string; status: string; totalAmount: number; dueDate?: string; createdAt: string }>>([]);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({ dueDate: '', notes: '' });
  const [invoiceItems, setInvoiceItems] = useState([{ description: '', quantity: 1, unitPrice: 0 }]);
  // Contact info edit state
  const [contactInfo, setContactInfo] = useState<{ name?: string; email?: string; company?: string; department?: string } | null>(null);
  const [editingContactInfo, setEditingContactInfo] = useState(false);
  const [contactInfoForm, setContactInfoForm] = useState({ name: '', email: '', company: '', department: '' });
  // Order details state
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [orderDetails, setOrderDetails] = useState<any>(null);
  // Task edit state
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [editTaskForm, setEditTaskForm] = useState({ title: '', description: '', dueDate: '', priority: 'TASK_MEDIUM', status: 'TASK_PENDING' });
  // Appointment edit state
  const [editApptId, setEditApptId] = useState<string | null>(null);
  const [editApptForm, setEditApptForm] = useState({ title: '', appointmentDate: '', duration: 30, location: '', status: 'SCHEDULED' });
  // Invoice payments state
  const [showPaymentModal, setShowPaymentModal] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'CASH', reference: '' });
  const [invoicePayments, setInvoicePayments] = useState<any[]>([]);
  const [showPayments, setShowPayments] = useState<string | null>(null);
  // Service tickets & subscriptions
  const [tickets, setTickets] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketForm, setTicketForm] = useState({ title: '', description: '', priority: 'MEDIUM' });
  const [showSubForm, setShowSubForm] = useState(false);
  const [subForm, setSubForm] = useState({ planName: '', amount: '', billingCycle: 'MONTHLY' });
  // Timeline
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  // Conversation assignment
  const [assignedToId, setAssignedToId] = useState<string | null>(null);
  const [teamUsers, setTeamUsers] = useState<any[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Message[] | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Toast notification system
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  }, []);
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

  // Search messages with debounce
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    searchDebounceRef.current = setTimeout(async () => {
      if (!contactId) return;
      try {
        const response = await messageAPI.getMessagesByContact(contactId, 100, 0, query.trim());
        setSearchResults(response.data.reverse());
      } catch {
        setSearchResults([]);
      }
    }, 300);
  }, [contactId]);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults(null);
  }, []);

  // Close search when switching contacts
  // Initial load and subscribe to real-time updates
  useEffect(() => {
    if (!contactId) {
      setMessages([]);
      return;
    }

    setMessages([]);
    closeSearch();
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
    setContactInfo(null);
    setEditingContactInfo(false);
    setExpandedOrderId(null);
    setOrderDetails(null);
    setEditTaskId(null);
    setEditApptId(null);
    setShowPaymentModal(null);
    setShowPayments(null);
    setInvoicePayments([]);
    setTickets([]);
    setSubscriptions([]);
    setShowTicketForm(false);
    setShowSubForm(false);
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
      loadContactAppointments();
      loadContactInvoices();
      loadContactInfo();
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
      else if (event.startsWith('appointment:')) loadContactAppointments();
      else if (event.startsWith('invoice:')) loadContactInvoices();
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
      showToast('Contact enrolled in automation!');
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
      setOrders((data.items || data.data?.items || data.data || []).slice(0, 10));
    } catch {
      // Failed to load orders
    }
  };

  const loadContactTasks = async () => {
    if (!contactId) return;
    try {
      const { data } = await api.get(`/tasks?contactId=${contactId}`);
      setTasks((data.items || data.data?.items || data.data || []).slice(0, 10));
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

  // === Appointments CRUD ===
  const loadContactAppointments = async () => {
    if (!contactId) return;
    try {
      const { data } = await api.get(`/appointments?contactId=${contactId}`);
      setAppointments((data.items || data.data?.items || data.data || []).slice(0, 10));
    } catch { /* Failed */ }
  };

  const handleCreateAppointment = async () => {
    if (!appointmentForm.title.trim() || !appointmentForm.appointmentDate || !contactId) return;
    try {
      const { data } = await api.post('/appointments', {
        contactId,
        title: appointmentForm.title,
        appointmentDate: new Date(appointmentForm.appointmentDate).toISOString(),
        duration: appointmentForm.duration,
        location: appointmentForm.location || undefined,
        description: appointmentForm.description || undefined,
      });
      setAppointments(prev => [data.data || data, ...prev]);
      setAppointmentForm({ title: '', appointmentDate: '', duration: 30, location: '', description: '' });
      setShowAppointmentForm(false);
    } catch { /* Failed */ }
  };

  const handleDeleteAppointment = async (id: string) => {
    try {
      await api.delete(`/appointments/${id}`);
      setAppointments(prev => prev.filter(a => a.id !== id));
    } catch { /* Failed */ }
  };

  // === Invoices CRUD ===
  const loadContactInvoices = async () => {
    if (!contactId) return;
    try {
      const { data } = await api.get(`/invoices?contactId=${contactId}`);
      setInvoices((data.items || data.data?.items || data.data || []).slice(0, 10));
    } catch { /* Failed */ }
  };

  const handleCreateInvoice = async () => {
    if (!contactId || invoiceItems.every(i => !i.description.trim())) return;
    try {
      const validItems = invoiceItems.filter(i => i.description.trim());
      const { data } = await api.post('/invoices', {
        contactId,
        dueDate: invoiceForm.dueDate ? new Date(invoiceForm.dueDate).toISOString() : undefined,
        notes: invoiceForm.notes || undefined,
        items: validItems.map(i => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })),
      });
      setInvoices(prev => [data.data || data, ...prev]);
      setInvoiceForm({ dueDate: '', notes: '' });
      setInvoiceItems([{ description: '', quantity: 1, unitPrice: 0 }]);
      setShowInvoiceForm(false);
    } catch { /* Failed */ }
  };

  const handleDownloadInvoicePdf = async (invoiceId: string, invoiceNumber: string) => {
    try {
      const response = await api.get(`/invoices/${invoiceId}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoiceNumber || 'invoice'}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch { /* Failed */ }
  };

  const [sendingInvoiceId, setSendingInvoiceId] = useState<string | null>(null);

  const handleSendInvoice = async (invoiceId: string) => {
    try {
      setSendingInvoiceId(invoiceId);
      const { data } = await api.post(`/invoices/${invoiceId}/send`);
      // Update invoice status locally if it was DRAFT
      setInvoices(prev => prev.map(inv =>
        inv.id === invoiceId && inv.status === 'DRAFT' ? { ...inv, status: 'SENT' } : inv
      ));
      showToast(data.message || 'Invoice sent!', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to send invoice', 'error');
    } finally {
      setSendingInvoiceId(null);
    }
  };

  // Filter tag suggestions based on input
  const filteredSuggestions = newTag.trim()
    ? allTags.filter((t) => {
        const assignedIds = new Set(contactTags.map((ct) => ct.id));
        return !assignedIds.has(t.id) && t.name.toLowerCase().includes(newTag.toLowerCase());
      })
    : [];

  // === Contact Info CRUD ===
  const loadContactInfo = async () => {
    if (!contactId) return;
    try {
      const { data } = await api.get(`/contacts/${contactId}`);
      const c = data.data || data;
      const info = { name: c.name || '', email: c.email || '', company: c.company || '', department: c.department || '' };
      setContactInfo(info);
      setContactInfoForm(info);
    } catch { /* Failed */ }
  };

  const saveContactInfo = async () => {
    if (!contactId) return;
    try {
      await api.put(`/contacts/${contactId}`, contactInfoForm);
      setContactInfo({ ...contactInfoForm });
      setEditingContactInfo(false);
      showToast('Contact info updated!');
    } catch { showToast('Failed to update contact', 'error'); }
  };

  // === Order Details & Delete ===
  const loadOrderDetails = async (orderId: string) => {
    try {
      const { data } = await api.get(`/orders/${orderId}`);
      setOrderDetails(data.data || data);
      setExpandedOrderId(orderId);
    } catch { /* Failed */ }
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      await api.delete(`/orders/${orderId}`);
      setOrders(prev => prev.filter(o => o.id !== orderId));
      if (expandedOrderId === orderId) { setExpandedOrderId(null); setOrderDetails(null); }
    } catch { /* Failed */ }
  };

  // === Task Edit ===
  const handleEditTask = async () => {
    if (!editTaskId) return;
    try {
      await api.put(`/tasks/${editTaskId}`, {
        title: editTaskForm.title,
        description: editTaskForm.description || undefined,
        dueDate: editTaskForm.dueDate || undefined,
        priority: editTaskForm.priority,
        status: editTaskForm.status,
      });
      setTasks(prev => prev.map(t => t.id === editTaskId ? { ...t, title: editTaskForm.title, description: editTaskForm.description, dueDate: editTaskForm.dueDate, priority: editTaskForm.priority, status: editTaskForm.status } : t));
      setEditTaskId(null);
      showToast('Task updated!');
    } catch { showToast('Failed to update task', 'error'); }
  };

  // === Appointment Edit ===
  const handleEditAppointment = async () => {
    if (!editApptId) return;
    try {
      await api.put(`/appointments/${editApptId}`, {
        title: editApptForm.title,
        appointmentDate: editApptForm.appointmentDate ? new Date(editApptForm.appointmentDate).toISOString() : undefined,
        duration: editApptForm.duration,
        location: editApptForm.location || undefined,
        status: editApptForm.status,
      });
      setAppointments(prev => prev.map(a => a.id === editApptId ? {
        ...a, title: editApptForm.title, appointmentDate: editApptForm.appointmentDate,
        duration: editApptForm.duration, location: editApptForm.location, status: editApptForm.status,
      } : a));
      setEditApptId(null);
      showToast('Appointment updated!');
    } catch { showToast('Failed to update appointment', 'error'); }
  };

  // === Invoice Payments ===
  const handleRecordPayment = async () => {
    if (!showPaymentModal || !paymentForm.amount) return;
    try {
      await api.post(`/invoices/${showPaymentModal}/payments`, {
        amount: parseFloat(paymentForm.amount),
        method: paymentForm.method,
        reference: paymentForm.reference || undefined,
      });
      setShowPaymentModal(null);
      setPaymentForm({ amount: '', method: 'CASH', reference: '' });
      loadContactInvoices();
      showToast('Payment recorded!');
    } catch { showToast('Failed to record payment', 'error'); }
  };

  const loadInvoicePayments = async (invoiceId: string) => {
    try {
      const { data } = await api.get(`/invoices/${invoiceId}/payments`);
      setInvoicePayments(data.data || data || []);
      setShowPayments(invoiceId);
    } catch { /* Failed */ }
  };

  // === Service Tickets ===
  const loadTickets = async () => {
    if (!contactId) return;
    try {
      const { data } = await api.get(`/service-tickets?contactId=${contactId}`);
      setTickets(data.data || data.items || []);
    } catch { /* Failed */ }
  };

  const handleCreateTicket = async () => {
    if (!contactId || !ticketForm.title.trim()) return;
    try {
      const { data } = await api.post('/service-tickets', {
        contactId,
        title: ticketForm.title,
        description: ticketForm.description || undefined,
        priority: ticketForm.priority,
      });
      setTickets(prev => [data.data || data, ...prev]);
      setTicketForm({ title: '', description: '', priority: 'MEDIUM' });
      setShowTicketForm(false);
    } catch { /* Failed */ }
  };

  // === Subscriptions ===
  const loadSubscriptions = async () => {
    if (!contactId) return;
    try {
      const { data } = await api.get(`/customer-subscriptions?contactId=${contactId}`);
      setSubscriptions(data.data || data.items || []);
    } catch { /* Failed */ }
  };

  const handleCreateSubscription = async () => {
    if (!contactId || !subForm.planName.trim() || !subForm.amount) return;
    try {
      const { data } = await api.post('/customer-subscriptions', {
        contactId,
        planName: subForm.planName,
        amount: parseFloat(subForm.amount),
        billingCycle: subForm.billingCycle,
      });
      setSubscriptions(prev => [data.data || data, ...prev]);
      setSubForm({ planName: '', amount: '', billingCycle: 'MONTHLY' });
      setShowSubForm(false);
    } catch { /* Failed */ }
  };

  // === Timeline ===
  const loadTimeline = async () => {
    if (!contactId) return;
    setTimelineLoading(true);
    try {
      const [msgRes, noteRes, orderRes, invoiceRes, apptRes, taskRes] = await Promise.all([
        api.get(`/messages/contact/${contactId}?limit=20`).catch(() => ({ data: { data: [] } })),
        api.get(`/notes?contactId=${contactId}`).catch(() => ({ data: { data: [] } })),
        api.get(`/orders?contactId=${contactId}`).catch(() => ({ data: { data: [] } })),
        api.get(`/invoices?contactId=${contactId}`).catch(() => ({ data: { data: [] } })),
        api.get(`/appointments?contactId=${contactId}`).catch(() => ({ data: { data: [] } })),
        api.get(`/tasks?contactId=${contactId}`).catch(() => ({ data: { data: [] } })),
      ]);
      const events: any[] = [];
      (msgRes.data.data || []).forEach((m: any) => events.push({ type: 'message', date: m.createdAt, icon: m.direction === 'INCOMING' ? '📩' : '📤', title: `${m.direction === 'INCOMING' ? 'Received' : 'Sent'} message`, detail: (m.content || '').substring(0, 80) }));
      (noteRes.data.data || []).forEach((n: any) => events.push({ type: 'note', date: n.createdAt, icon: '📝', title: 'Note added', detail: (n.content || '').substring(0, 80) }));
      ((orderRes.data.data?.items || orderRes.data.data) || []).forEach((o: any) => events.push({ type: 'order', date: o.createdAt || o.orderDate, icon: '📦', title: `Order #${o.orderNumber}`, detail: `${o.status} — $${(o.totalAmount || 0).toFixed(2)}` }));
      ((invoiceRes.data.data?.items || invoiceRes.data.data) || []).forEach((i: any) => events.push({ type: 'invoice', date: i.createdAt, icon: '🧾', title: `Invoice #${i.invoiceNumber}`, detail: `${i.status} — $${(i.totalAmount || 0).toFixed(2)}` }));
      ((apptRes.data.data?.items || apptRes.data.data) || []).forEach((a: any) => events.push({ type: 'appointment', date: a.appointmentDate, icon: '📅', title: a.title, detail: `${a.status} — ${a.duration}min` }));
      ((taskRes.data.data?.items || taskRes.data.data) || []).forEach((t: any) => events.push({ type: 'task', date: t.createdAt, icon: '✅', title: t.title, detail: t.status.replace('TASK_', '') }));
      events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTimelineEvents(events.slice(0, 50));
    } catch { /* Failed */ }
    setTimelineLoading(false);
  };

  // === Conversation Assignment ===
  const loadTeamUsers = async () => {
    try {
      const { data } = await api.get('/auth/users');
      setTeamUsers(data.data || []);
    } catch { /* Failed — user may not be admin */ }
  };

  const handleAssign = async (userId: string) => {
    if (!contactId) return;
    try {
      // Find conversation for this contact
      const { data: msgData } = await api.get(`/messages/contact/${contactId}?limit=1`);
      const msgs = msgData.data || [];
      const convId = msgs[0]?.conversationId;
      if (!convId) { showToast('No conversation found', 'error'); return; }
      await api.patch(`/messages/conversations/${convId}/assign`, { assignedToId: userId || null });
      setAssignedToId(userId || null);
      showToast(userId ? 'Conversation assigned!' : 'Assignment removed');
    } catch { showToast('Failed to assign', 'error'); }
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
      showToast('Failed to send message', 'error');
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
      {/* Toast Notification */}
      {toast && (
        <div className={`toast-notification toast-${toast.type}`} onClick={() => setToast(null)}>
          <span className="toast-icon">{toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : 'ℹ'}</span>
          {toast.message}
        </div>
      )}
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
            onClick={() => { setSearchOpen(!searchOpen); if (!searchOpen) setTimeout(() => searchInputRef.current?.focus(), 100); else closeSearch(); }}
            title="Search messages"
          >
            🔍
          </button>
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

      {/* Search Bar */}
      {searchOpen && (
        <div className="chat-search-bar">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search in conversation..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') closeSearch(); }}
            className="chat-search-input"
          />
          {searchQuery && (
            <span className="chat-search-count">
              {searchResults ? `${searchResults.length} found` : 'Searching...'}
            </span>
          )}
          <button className="chat-search-close" onClick={closeSearch}>✕</button>
        </div>
      )}

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
                <span className="tab-icon">ℹ️</span><span className="tab-label">Info</span>
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
              <button className={`modal-tab ${activeTab === 'appointments' ? 'active' : ''}`} onClick={() => setActiveTab('appointments')}>
                <span className="tab-icon">📅</span><span className="tab-label">Appts</span>
              </button>
              <button className={`modal-tab ${activeTab === 'invoices' ? 'active' : ''}`} onClick={() => setActiveTab('invoices')}>
                <span className="tab-icon">🧾</span><span className="tab-label">Invoices</span>
              </button>
              <button className={`modal-tab ${activeTab === 'automations' ? 'active' : ''}`} onClick={() => setActiveTab('automations')}>
                <span className="tab-icon">⚡</span><span className="tab-label">Auto</span>
              </button>
              <button className={`modal-tab ${activeTab === 'tickets' ? 'active' : ''}`} onClick={() => { setActiveTab('tickets'); if (tickets.length === 0) loadTickets(); }}>
                <span className="tab-icon">🎫</span><span className="tab-label">Tickets</span>
              </button>
              <button className={`modal-tab ${activeTab === 'subscriptions' ? 'active' : ''}`} onClick={() => { setActiveTab('subscriptions'); if (subscriptions.length === 0) loadSubscriptions(); }}>
                <span className="tab-icon">🔄</span><span className="tab-label">Subs</span>
              </button>
              <button className={`modal-tab ${activeTab === 'timeline' ? 'active' : ''}`} onClick={() => { setActiveTab('timeline'); loadTimeline(); }}>
                <span className="tab-icon">📈</span><span className="tab-label">Timeline</span>
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
                    <div className="overview-card" onClick={() => setActiveTab('appointments')}>
                      <div className="overview-card-icon">📅</div>
                      <div className="overview-value">{appointments.filter(a => a.status === 'SCHEDULED').length}</div>
                      <div className="overview-label">Upcoming</div>
                    </div>
                    <div className="overview-card" onClick={() => setActiveTab('invoices')}>
                      <div className="overview-card-icon">🧾</div>
                      <div className="overview-value">{invoices.filter(i => i.status !== 'PAID' && i.status !== 'CANCELLED').length}</div>
                      <div className="overview-label">Unpaid</div>
                    </div>
                    <div className="overview-card" onClick={() => { setActiveTab('tickets'); if (tickets.length === 0) loadTickets(); }}>
                      <div className="overview-card-icon">🎫</div>
                      <div className="overview-value">{tickets.length}</div>
                      <div className="overview-label">Tickets</div>
                    </div>
                    <div className="overview-card" onClick={() => { setActiveTab('subscriptions'); if (subscriptions.length === 0) loadSubscriptions(); }}>
                      <div className="overview-card-icon">🔄</div>
                      <div className="overview-value">{subscriptions.length}</div>
                      <div className="overview-label">Subs</div>
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
                    <h4>Assign To</h4>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <select
                      className="status-select"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8 }}
                      value={assignedToId || ''}
                      onChange={e => handleAssign(e.target.value)}
                      onFocus={() => { if (teamUsers.length === 0) loadTeamUsers(); }}
                    >
                      <option value="">Unassigned</option>
                      {teamUsers.map((u: any) => (
                        <option key={u.id} value={u.id}>{u.name || u.email} ({u.role})</option>
                      ))}
                    </select>
                  </div>

                  <div className="section-header" style={{ marginTop: 16 }}>
                    <h4>Quick Access</h4>
                  </div>
                  <div className="quick-links-grid">
                    <button onClick={() => setActiveTab('orders')} className="quick-link-card">📦 Orders</button>
                    <button onClick={() => setActiveTab('tasks')} className="quick-link-card">✅ Tasks</button>
                    <button onClick={() => setActiveTab('transactions')} className="quick-link-card">💰 Sales</button>
                    <button onClick={() => setActiveTab('notes')} className="quick-link-card">📝 Notes</button>
                    <button onClick={() => setActiveTab('info')} className="quick-link-card">🏷️ Tags</button>
                    <button onClick={() => setActiveTab('appointments')} className="quick-link-card">📅 Appts</button>
                    <button onClick={() => setActiveTab('invoices')} className="quick-link-card">🧾 Invoices</button>
                    <button onClick={() => setActiveTab('automations')} className="quick-link-card">⚡ Automation</button>
                    <button onClick={() => { setActiveTab('tickets'); if (tickets.length === 0) loadTickets(); }} className="quick-link-card">🎫 Tickets</button>
                    <button onClick={() => { setActiveTab('subscriptions'); if (subscriptions.length === 0) loadSubscriptions(); }} className="quick-link-card">🔄 Subs</button>
                  </div>
                </div>
              )}

              {/* Info Tab — Contact Details + Tags */}
              {activeTab === 'info' && (
                <div className="modal-section">
                  <div className="section-header">
                    <h4>Contact Details</h4>
                    {!editingContactInfo && (
                      <button className="btn-primary-small" onClick={() => setEditingContactInfo(true)}>Edit</button>
                    )}
                  </div>

                  {editingContactInfo ? (
                    <div className="inline-form" style={{ marginBottom: 16 }}>
                      <input type="text" placeholder="Name" value={contactInfoForm.name} onChange={e => setContactInfoForm(p => ({ ...p, name: e.target.value }))} />
                      <input type="email" placeholder="Email" value={contactInfoForm.email} onChange={e => setContactInfoForm(p => ({ ...p, email: e.target.value }))} />
                      <input type="text" placeholder="Company" value={contactInfoForm.company} onChange={e => setContactInfoForm(p => ({ ...p, company: e.target.value }))} />
                      <input type="text" placeholder="Department" value={contactInfoForm.department} onChange={e => setContactInfoForm(p => ({ ...p, department: e.target.value }))} />
                      <div className="form-actions">
                        <button className="btn-inline-save" onClick={saveContactInfo}>Save</button>
                        <button className="btn-inline-cancel" onClick={() => { setEditingContactInfo(false); if (contactInfo) setContactInfoForm({ name: contactInfo.name || '', email: contactInfo.email || '', company: contactInfo.company || '', department: contactInfo.department || '' }); }}>Cancel</button>
                      </div>
                    </div>
                  ) : contactInfo ? (
                    <div className="contact-details-grid" style={{ marginBottom: 16 }}>
                      <div className="info-detail"><label>Name</label><span>{contactInfo.name || '—'}</span></div>
                      <div className="info-detail"><label>Email</label><span>{contactInfo.email || '—'}</span></div>
                      <div className="info-detail"><label>Company</label><span>{contactInfo.company || '—'}</span></div>
                      <div className="info-detail"><label>Department</label><span>{contactInfo.department || '—'}</span></div>
                    </div>
                  ) : null}

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
                        <div key={order.id} className="tx-card" style={{ flexDirection: 'column' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                            <div className="tx-card-amount">${(order.totalAmount || 0).toFixed(2)}</div>
                            <div className="tx-card-info" style={{ flex: 1 }}>
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
                            <div className="tx-card-date">{new Date(order.orderDate).toLocaleDateString()}</div>
                            <div className="action-buttons">
                              <button onClick={() => expandedOrderId === order.id ? (setExpandedOrderId(null), setOrderDetails(null)) : loadOrderDetails(order.id)} title="Details">📋</button>
                              <button onClick={() => handleDeleteOrder(order.id)} title="Delete">🗑️</button>
                            </div>
                          </div>
                          {expandedOrderId === order.id && orderDetails && (
                            <div style={{ width: '100%', marginTop: 8, padding: '8px 0', borderTop: '1px solid #eee', fontSize: 12, color: '#666' }}>
                              {(orderDetails.items || []).map((item: any, i: number) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                                  <span>{item.name || item.description} x{item.quantity}</span>
                                  <span>${(item.unitPrice * item.quantity).toFixed(2)}</span>
                                </div>
                              ))}
                              {orderDetails.notes && <div style={{ marginTop: 4, fontStyle: 'italic' }}>Note: {orderDetails.notes}</div>}
                            </div>
                          )}
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
                          {editTaskId === task.id ? (
                            <div className="inline-form" style={{ width: '100%' }}>
                              <input type="text" placeholder="Title" value={editTaskForm.title} onChange={e => setEditTaskForm(p => ({ ...p, title: e.target.value }))} />
                              <textarea placeholder="Description" value={editTaskForm.description} onChange={e => setEditTaskForm(p => ({ ...p, description: e.target.value }))} rows={2} />
                              <div className="inline-form-row">
                                <input type="date" value={editTaskForm.dueDate} onChange={e => setEditTaskForm(p => ({ ...p, dueDate: e.target.value }))} />
                                <select value={editTaskForm.priority} onChange={e => setEditTaskForm(p => ({ ...p, priority: e.target.value }))}>
                                  <option value="TASK_LOW">Low</option>
                                  <option value="TASK_MEDIUM">Medium</option>
                                  <option value="TASK_HIGH">High</option>
                                  <option value="TASK_URGENT">Urgent</option>
                                </select>
                                <select value={editTaskForm.status} onChange={e => setEditTaskForm(p => ({ ...p, status: e.target.value }))}>
                                  <option value="TASK_PENDING">Pending</option>
                                  <option value="TASK_IN_PROGRESS">In Progress</option>
                                  <option value="TASK_COMPLETED">Completed</option>
                                </select>
                              </div>
                              <div className="form-actions">
                                <button className="btn-inline-save" onClick={handleEditTask}>Save</button>
                                <button className="btn-inline-cancel" onClick={() => setEditTaskId(null)}>Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <>
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
                                  <button className="btn-task-delete" onClick={() => { setEditTaskId(task.id); setEditTaskForm({ title: task.title, description: task.description || '', dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '', priority: task.priority, status: task.status }); }} title="Edit">✏️</button>
                                  <button className="btn-task-delete" onClick={() => handleDeleteTask(task.id)} title="Delete">🗑️</button>
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

              {/* Appointments Tab */}
              {activeTab === 'appointments' && (
                <div className="modal-section">
                  <div className="section-header">
                    <h4>Appointments</h4>
                    <button className="btn-primary-small" onClick={() => setShowAppointmentForm(!showAppointmentForm)}>
                      {showAppointmentForm ? '- Cancel' : '+ New'}
                    </button>
                  </div>

                  {showAppointmentForm && (
                    <div className="inline-form">
                      <input type="text" placeholder="Appointment title" value={appointmentForm.title} onChange={e => setAppointmentForm(p => ({ ...p, title: e.target.value }))} />
                      <div className="inline-form-row">
                        <input type="datetime-local" value={appointmentForm.appointmentDate} onChange={e => setAppointmentForm(p => ({ ...p, appointmentDate: e.target.value }))} />
                        <input type="number" placeholder="Min" min={5} step={5} style={{ width: 70 }} value={appointmentForm.duration} onChange={e => setAppointmentForm(p => ({ ...p, duration: parseInt(e.target.value) || 30 }))} />
                      </div>
                      <input type="text" placeholder="Location (optional)" value={appointmentForm.location} onChange={e => setAppointmentForm(p => ({ ...p, location: e.target.value }))} />
                      <textarea placeholder="Description (optional)" value={appointmentForm.description} onChange={e => setAppointmentForm(p => ({ ...p, description: e.target.value }))} rows={2} />
                      <div className="form-actions">
                        <button className="btn-inline-save" onClick={handleCreateAppointment} disabled={!appointmentForm.title.trim() || !appointmentForm.appointmentDate}>Schedule</button>
                      </div>
                    </div>
                  )}

                  <div className="appointments-list-container">
                    {appointments.length === 0 && !showAppointmentForm ? (
                      <div className="empty-state-small">
                        <span>📅</span>
                        <p>No appointments yet</p>
                        <button onClick={() => setShowAppointmentForm(true)}>Schedule First</button>
                      </div>
                    ) : (
                      appointments.map((appt) => (
                        <div key={appt.id} className="tx-card" style={{ flexDirection: 'column' }}>
                          {editApptId === appt.id ? (
                            <div className="inline-form" style={{ width: '100%' }}>
                              <input type="text" placeholder="Title" value={editApptForm.title} onChange={e => setEditApptForm(p => ({ ...p, title: e.target.value }))} />
                              <div className="inline-form-row">
                                <input type="datetime-local" value={editApptForm.appointmentDate} onChange={e => setEditApptForm(p => ({ ...p, appointmentDate: e.target.value }))} />
                                <input type="number" placeholder="Min" min={5} step={5} style={{ width: 70 }} value={editApptForm.duration} onChange={e => setEditApptForm(p => ({ ...p, duration: parseInt(e.target.value) || 30 }))} />
                              </div>
                              <input type="text" placeholder="Location" value={editApptForm.location} onChange={e => setEditApptForm(p => ({ ...p, location: e.target.value }))} />
                              <select value={editApptForm.status} onChange={e => setEditApptForm(p => ({ ...p, status: e.target.value }))}>
                                <option value="SCHEDULED">Scheduled</option>
                                <option value="CONFIRMED">Confirmed</option>
                                <option value="COMPLETED">Completed</option>
                                <option value="CANCELLED">Cancelled</option>
                                <option value="NO_SHOW">No Show</option>
                              </select>
                              <div className="form-actions">
                                <button className="btn-inline-save" onClick={handleEditAppointment}>Save</button>
                                <button className="btn-inline-cancel" onClick={() => setEditApptId(null)}>Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                              <div className="tx-card-info" style={{ flex: 1 }}>
                                <span className="tx-desc" style={{ fontWeight: 600 }}>{appt.title}</span>
                                <span className={`tx-badge tx-${appt.status}`}>{appt.status}</span>
                              </div>
                              <div className="tx-card-date">
                                <span>{new Date(appt.appointmentDate).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                                <span style={{ color: '#9ca3af', fontSize: 11 }}>{appt.duration}min{appt.location ? ` · ${appt.location}` : ''}</span>
                              </div>
                              <div className="action-buttons">
                                <button onClick={() => { setEditApptId(appt.id); setEditApptForm({ title: appt.title, appointmentDate: appt.appointmentDate.slice(0, 16), duration: appt.duration, location: appt.location || '', status: appt.status }); }} title="Edit">✏️</button>
                                <button onClick={() => handleDeleteAppointment(appt.id)} title="Delete">🗑️</button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Invoices Tab */}
              {activeTab === 'invoices' && (
                <div className="modal-section">
                  <div className="section-header">
                    <h4>Invoices</h4>
                    <button className="btn-primary-small" onClick={() => setShowInvoiceForm(!showInvoiceForm)}>
                      {showInvoiceForm ? '- Cancel' : '+ New'}
                    </button>
                  </div>

                  {showInvoiceForm && (
                    <div className="inline-form">
                      <div className="section-header" style={{ marginTop: 0, marginBottom: 4 }}>
                        <h4 style={{ fontSize: 12 }}>Items</h4>
                        <button className="btn-inline-add" onClick={() => setInvoiceItems(p => [...p, { description: '', quantity: 1, unitPrice: 0 }])}>+ Item</button>
                      </div>
                      {invoiceItems.map((item, i) => (
                        <div key={i} className="inline-form-row item-row">
                          <input type="text" placeholder="Description" value={item.description} onChange={e => { const v = e.target.value; setInvoiceItems(p => p.map((it, idx) => idx === i ? { ...it, description: v } : it)); }} />
                          <input type="number" placeholder="Qty" min={1} style={{ width: 60 }} value={item.quantity} onChange={e => { const v = parseInt(e.target.value) || 1; setInvoiceItems(p => p.map((it, idx) => idx === i ? { ...it, quantity: v } : it)); }} />
                          <input type="number" placeholder="Price" min={0} style={{ width: 80 }} value={item.unitPrice} onChange={e => { const v = parseFloat(e.target.value) || 0; setInvoiceItems(p => p.map((it, idx) => idx === i ? { ...it, unitPrice: v } : it)); }} />
                          {invoiceItems.length > 1 && <button className="btn-inline-remove" onClick={() => setInvoiceItems(p => p.filter((_, idx) => idx !== i))}>x</button>}
                        </div>
                      ))}
                      <div className="inline-form-row">
                        <input type="date" placeholder="Due date" value={invoiceForm.dueDate} onChange={e => setInvoiceForm(p => ({ ...p, dueDate: e.target.value }))} />
                      </div>
                      <input type="text" placeholder="Notes (optional)" value={invoiceForm.notes} onChange={e => setInvoiceForm(p => ({ ...p, notes: e.target.value }))} />
                      <div className="form-actions">
                        <button className="btn-inline-save" onClick={handleCreateInvoice} disabled={invoiceItems.every(i => !i.description.trim())}>Create Invoice</button>
                      </div>
                    </div>
                  )}

                  <div className="invoices-list-container">
                    {invoices.length === 0 && !showInvoiceForm ? (
                      <div className="empty-state-small">
                        <span>🧾</span>
                        <p>No invoices yet</p>
                        <button onClick={() => setShowInvoiceForm(true)}>Create First Invoice</button>
                      </div>
                    ) : (
                      invoices.map((inv) => (
                        <div key={inv.id} className="tx-card" style={{ flexDirection: 'column' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                            <div className="tx-card-amount">${(inv.totalAmount || 0).toFixed(2)}</div>
                            <div className="tx-card-info" style={{ flex: 1 }}>
                              <span className="tx-desc">#{inv.invoiceNumber}</span>
                              <span className={`tx-badge tx-${inv.status}`}>{inv.status}</span>
                            </div>
                            <div className="action-buttons">
                              {(inv.status === 'SENT' || inv.status === 'OVERDUE') && (
                                <button onClick={() => { setShowPaymentModal(inv.id); setPaymentForm({ amount: String(inv.totalAmount || 0), method: 'CASH', reference: '' }); }} title="Record Payment">💵</button>
                              )}
                              <button onClick={() => showPayments === inv.id ? setShowPayments(null) : loadInvoicePayments(inv.id)} title="View Payments">📊</button>
                              <button onClick={() => handleSendInvoice(inv.id)} title="Send via WhatsApp" disabled={sendingInvoiceId === inv.id}>
                                {sendingInvoiceId === inv.id ? '⏳' : '📤'}
                              </button>
                              <button onClick={() => handleDownloadInvoicePdf(inv.id, inv.invoiceNumber)} title="Download PDF">📄</button>
                            </div>
                          </div>
                          <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                            {inv.dueDate ? `Due: ${new Date(inv.dueDate).toLocaleDateString()}` : new Date(inv.createdAt).toLocaleDateString()}
                          </div>
                          {showPayments === inv.id && (
                            <div style={{ width: '100%', marginTop: 8, padding: '8px 0', borderTop: '1px solid #eee', fontSize: 12 }}>
                              {invoicePayments.length === 0 ? (
                                <span style={{ color: '#999' }}>No payments recorded</span>
                              ) : invoicePayments.map((pay: any, i: number) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#555' }}>
                                  <span>${parseFloat(pay.amount).toFixed(2)} — {pay.method}</span>
                                  <span>{new Date(pay.createdAt || pay.paymentDate).toLocaleDateString()}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Tickets Tab */}
              {activeTab === 'tickets' && (
                <div className="modal-section">
                  <div className="section-header">
                    <h4>Service Tickets</h4>
                    <button className="btn-primary-small" onClick={() => setShowTicketForm(!showTicketForm)}>
                      {showTicketForm ? '- Cancel' : '+ New'}
                    </button>
                  </div>

                  {showTicketForm && (
                    <div className="inline-form">
                      <input type="text" placeholder="Ticket title" value={ticketForm.title} onChange={e => setTicketForm(p => ({ ...p, title: e.target.value }))} />
                      <textarea placeholder="Description (optional)" value={ticketForm.description} onChange={e => setTicketForm(p => ({ ...p, description: e.target.value }))} rows={2} />
                      <select value={ticketForm.priority} onChange={e => setTicketForm(p => ({ ...p, priority: e.target.value }))}>
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="URGENT">Urgent</option>
                      </select>
                      <div className="form-actions">
                        <button className="btn-inline-save" onClick={handleCreateTicket} disabled={!ticketForm.title.trim()}>Create Ticket</button>
                      </div>
                    </div>
                  )}

                  <div className="tasks-list-container">
                    {tickets.length === 0 && !showTicketForm ? (
                      <div className="empty-state-small">
                        <span>🎫</span>
                        <p>No service tickets</p>
                        <button onClick={() => setShowTicketForm(true)}>Create First Ticket</button>
                      </div>
                    ) : (
                      tickets.map((ticket: any) => (
                        <div key={ticket.id} className="tx-card">
                          <div className="tx-card-info" style={{ flex: 1 }}>
                            <span className="tx-desc" style={{ fontWeight: 600 }}>{ticket.title}</span>
                            <span className={`tx-badge tx-${ticket.status}`}>{ticket.status}</span>
                          </div>
                          <div className="tx-card-date">
                            <span className={`task-priority priority-${(ticket.priority || '').toLowerCase()}`}>{ticket.priority}</span>
                            <span style={{ fontSize: 11, color: '#999' }}>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Subscriptions Tab */}
              {activeTab === 'subscriptions' && (
                <div className="modal-section">
                  <div className="section-header">
                    <h4>Subscriptions</h4>
                    <button className="btn-primary-small" onClick={() => setShowSubForm(!showSubForm)}>
                      {showSubForm ? '- Cancel' : '+ New'}
                    </button>
                  </div>

                  {showSubForm && (
                    <div className="inline-form">
                      <input type="text" placeholder="Plan name" value={subForm.planName} onChange={e => setSubForm(p => ({ ...p, planName: e.target.value }))} />
                      <div className="inline-form-row">
                        <input type="number" placeholder="Amount" min={0} value={subForm.amount} onChange={e => setSubForm(p => ({ ...p, amount: e.target.value }))} />
                        <select value={subForm.billingCycle} onChange={e => setSubForm(p => ({ ...p, billingCycle: e.target.value }))}>
                          <option value="WEEKLY">Weekly</option>
                          <option value="MONTHLY">Monthly</option>
                          <option value="QUARTERLY">Quarterly</option>
                          <option value="YEARLY">Yearly</option>
                        </select>
                      </div>
                      <div className="form-actions">
                        <button className="btn-inline-save" onClick={handleCreateSubscription} disabled={!subForm.planName.trim() || !subForm.amount}>Create</button>
                      </div>
                    </div>
                  )}

                  <div className="tasks-list-container">
                    {subscriptions.length === 0 && !showSubForm ? (
                      <div className="empty-state-small">
                        <span>🔄</span>
                        <p>No subscriptions</p>
                        <button onClick={() => setShowSubForm(true)}>Add First Subscription</button>
                      </div>
                    ) : (
                      subscriptions.map((sub: any) => (
                        <div key={sub.id} className="tx-card">
                          <div className="tx-card-amount">${parseFloat(sub.amount || 0).toFixed(2)}</div>
                          <div className="tx-card-info" style={{ flex: 1 }}>
                            <span className="tx-desc" style={{ fontWeight: 600 }}>{sub.planName}</span>
                            <span className={`tx-badge tx-${sub.status}`}>{sub.status}</span>
                          </div>
                          <div className="tx-card-date">
                            <span style={{ fontSize: 11, color: '#888' }}>{sub.billingCycle}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Timeline Tab */}
              {activeTab === 'timeline' && (
                <div className="modal-section">
                  <div className="section-header">
                    <h4>Activity Timeline</h4>
                    <button className="btn-primary-small" onClick={loadTimeline}>Refresh</button>
                  </div>
                  {timelineLoading ? (
                    <div className="empty-state-small"><span>Loading...</span></div>
                  ) : timelineEvents.length === 0 ? (
                    <div className="empty-state-small"><span>📈</span><p>No activity yet</p></div>
                  ) : (
                    <div style={{ position: 'relative', paddingLeft: 24, borderLeft: '2px solid #e0e0e0' }}>
                      {timelineEvents.map((ev, i) => (
                        <div key={i} style={{ marginBottom: 16, position: 'relative' }}>
                          <div style={{ position: 'absolute', left: -32, top: 2, width: 20, height: 20, borderRadius: '50%', background: 'white', border: '2px solid #128C7E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>
                            {ev.icon}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>{ev.title}</div>
                          {ev.detail && <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{ev.detail}</div>}
                          <div style={{ fontSize: 10, color: '#bbb', marginTop: 2 }}>{new Date(ev.date).toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  )}
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

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(null)} style={{ zIndex: 10001 }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Record Payment</h3>
            <div className="form-group">
              <label>Amount ($)</label>
              <input type="number" value={paymentForm.amount} onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" />
            </div>
            <div className="form-group">
              <label>Method</label>
              <select value={paymentForm.method} onChange={e => setPaymentForm(p => ({ ...p, method: e.target.value }))}>
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CREDIT_CARD">Credit Card</option>
                <option value="DEBIT_CARD">Debit Card</option>
                <option value="PAYPAL">PayPal</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label>Reference (optional)</label>
              <input type="text" value={paymentForm.reference} onChange={e => setPaymentForm(p => ({ ...p, reference: e.target.value }))} placeholder="Transaction reference" />
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowPaymentModal(null)} className="btn-cancel">Cancel</button>
              <button onClick={handleRecordPayment} className="btn-save" disabled={!paymentForm.amount}>Record Payment</button>
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

      <div className="messages-container" ref={scrollRef} onScroll={searchResults ? undefined : handleScroll}>
        {loading && <div className="loading-indicator">Loading messages...</div>}

        {searchResults !== null && searchResults.length === 0 && (
          <div className="search-no-results">No messages found for "{searchQuery}"</div>
        )}

        <div className="messages-list">
          {(searchResults ?? messages).map((msg) => (
            <MessageBubble
              key={msg.id}
              message={{ ...msg, messageType: msg.messageType || 'TEXT' }}
              isOwn={msg.direction === 'OUTGOING'}
              highlightText={searchResults ? searchQuery : undefined}
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
