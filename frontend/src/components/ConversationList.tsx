import React, { useEffect, useState, useRef, useMemo } from 'react';
import { contactAPI } from '@/api/queries';
import { getContactTypeFromId, getContactTypeInfo, ContactTypeEnum } from '@/utils/contact-type';
import '@/styles/conversation-list-enhanced.css';

interface Conversation {
  id: string;
  contact: {
    id: string;
    phoneNumber: string;
    chatId?: string | null;
    name?: string;
    contactType?: string | null;
    avatarUrl?: string | null;
    profilePhotoUrl?: string | null;
  };
  unreadCount: number;
  lastMessage?: string;
  lastMessageAt?: string;
}

interface ConversationListProps {
  onSelectConversation: (contactId: string, conversation: Conversation) => void;
  selectedContactId?: string;
  searchQuery?: string;
  onAutoRefreshChange?: (enabled: boolean) => void;
}

type TabType = 'all' | 'unread' | 'contacts' | 'groups' | 'channels';

// Avatar gradient by contact type
const avatarGradients: Record<string, string> = {
  contact: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  group: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  channel: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
  broadcast: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
  unknown: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
};

// Avatar icon by contact type
const avatarIcons: Record<string, string> = {
  group: '👥',
  channel: '📢',
  broadcast: '📻',
};

export const ConversationList: React.FC<ConversationListProps> = ({
  onSelectConversation,
  selectedContactId,
  searchQuery = '',
  onAutoRefreshChange,
}) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(searchQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();

  // Sync search when navbar searchQuery prop changes
  useEffect(() => {
    setSearch(searchQuery);
  }, [searchQuery]);

  // Debounce search input by 300ms
  useEffect(() => {
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(debounceTimer.current);
  }, [search]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const response = await contactAPI.searchContacts(debouncedSearch || undefined, 100, 0);

      const contacts = Array.isArray(response) ? response : (response?.data || []);

      const transformedConversations: Conversation[] = contacts
        .filter((contact: any) => contact && contact.id)
        .map((contact: any) => {
          const lastMessageObj = contact.messages && contact.messages.length > 0
            ? contact.messages[0]
            : null;

          let lastMessagePreview: string | undefined = 'No messages yet';

          if (lastMessageObj) {
            const mediaLabelMap: Record<string, string> = {
              'IMAGE': '📷 Image',
              'VIDEO': '🎥 Video',
              'AUDIO': '🎵 Audio',
              'DOCUMENT': '📄 Document',
              'LOCATION': '📍 Location',
              'CONTACT': '👤 Contact',
              'STICKER': '🏷️ Sticker',
              'PTT': '🎤 Voice message',
            };

            // Check if content is a bracketed media label like [IMAGE], [VIDEO], etc.
            const bracketMatch = lastMessageObj.content?.trim().match(/^\[(IMAGE|VIDEO|AUDIO|DOCUMENT|STICKER|PTT|LOCATION|CONTACT)\]$/i);

            if (bracketMatch) {
              // Content is a media label — show emoji version
              lastMessagePreview = mediaLabelMap[bracketMatch[1].toUpperCase()] || `📎 ${bracketMatch[1]}`;
            } else if (lastMessageObj.content && lastMessageObj.content.trim()) {
              const content = lastMessageObj.content.trim();
              lastMessagePreview = content.length > 50
                ? content.substring(0, 50) + '...'
                : content;
            } else if (lastMessageObj.messageType && lastMessageObj.messageType !== 'TEXT') {
              const typeLabels: Record<string, string> = {
                'IMAGE': '📷 Image',
                'VIDEO': '🎥 Video',
                'AUDIO': '🎵 Audio',
                'DOCUMENT': '📄 Document',
                'LOCATION': '📍 Location',
                'CONTACT': '👤 Contact',
              };
              lastMessagePreview = typeLabels[lastMessageObj.messageType] || '📎 Media';
            } else {
              lastMessagePreview = lastMessageObj.direction === 'INCOMING'
                ? '📥 Message received'
                : '📤 Message sent';
            }
          }

          // Use backend-calculated unread count (filtered _count of INCOMING+RECEIVED messages)
          const unreadCount = contact._count?.messages || 0;

          return {
            id: contact.id || `contact-${contact.phoneNumber}`,
            contact: {
              id: contact.id,
              phoneNumber: contact.phoneNumber || '',
              chatId: contact.chatId || null,
              name: contact.name,
              contactType: contact.contactType || null,
              avatarUrl: contact.avatarUrl || null,
              profilePhotoUrl: contact.profilePhotoUrl || null,
            },
            unreadCount,
            lastMessage: lastMessagePreview,
            lastMessageAt: lastMessageObj?.createdAt || contact.lastMessageAt,
          };
        })
        .sort((a: Conversation, b: Conversation) => {
          const dateA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const dateB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
          return dateB - dateA;
        });

      setConversations(transformedConversations);
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();

    const handleRefresh = () => {
      loadConversations();
    };

    window.addEventListener('refreshConversations', handleRefresh);
    return () => window.removeEventListener('refreshConversations', handleRefresh);
  }, [debouncedSearch]);

  // Get contact type for a conversation
  const getConvType = (conv: Conversation): ContactTypeEnum => {
    return getContactTypeFromId(
      conv.contact?.chatId,
      conv.contact?.phoneNumber,
      conv.contact?.contactType,
    );
  };

  // Filter conversations based on active tab
  const filteredConversations = conversations.filter((conv) => {
    if (!conv || !conv.contact || !conv.contact.id) return false;
    const type = getConvType(conv);
    switch (activeTab) {
      case 'unread': return conv.unreadCount > 0;
      case 'contacts': return type === 'contact';
      case 'groups': return type === 'group';
      case 'channels': return type === 'channel' || type === 'broadcast';
      default: return true;
    }
  });

  // Count per tab (memoized to avoid recalculation on every render)
  const counts = useMemo(() => ({
    all: conversations.length,
    unread: conversations.filter(c => c.unreadCount > 0).length,
    contacts: conversations.filter(c => getConvType(c) === 'contact').length,
    groups: conversations.filter(c => getConvType(c) === 'group').length,
    channels: conversations.filter(c => {
      const t = getConvType(c);
      return t === 'channel' || t === 'broadcast';
    }).length,
  }), [conversations]);

  const tabs: { key: TabType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'unread', label: 'Unread' },
    { key: 'contacts', label: 'Contacts' },
    { key: 'groups', label: 'Groups' },
    { key: 'channels', label: 'Channels' },
  ];

  return (
    <div className="conversation-list-container">
      {/* Search header */}
      <div className="list-header">
        <input
          type="text"
          className="search-input"
          placeholder="Search contacts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Filter tabs */}
      <div className="conv-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`conv-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            {counts[tab.key] > 0 && (
              <span className="conv-tab-count">{counts[tab.key]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Conversations */}
      <div className="conversations-scroll">
        {loading && (
          <div className="skeleton-list">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton-item">
                <div className="skeleton-avatar"></div>
                <div className="skeleton-content">
                  <div className="skeleton-line skeleton-name"></div>
                  <div className="skeleton-line skeleton-preview"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && filteredConversations.length === 0 && (
          <div className="empty-state">
            {activeTab === 'all' ? 'No conversations yet' : `No ${activeTab} conversations`}
          </div>
        )}

        {filteredConversations.map((conv) => {
          const displayName = conv.contact?.name || conv.contact?.phoneNumber || 'Unknown';
          const profilePic = conv.contact?.profilePhotoUrl || conv.contact?.avatarUrl;
          const contactType = getConvType(conv);
          const typeInfo = getContactTypeInfo(contactType);
          const gradient = avatarGradients[contactType] || avatarGradients.unknown;
          const avatarIcon = avatarIcons[contactType];

          const timeAgo = conv.lastMessageAt
            ? (() => {
                const now = new Date();
                const msgDate = new Date(conv.lastMessageAt);
                const diffMs = now.getTime() - msgDate.getTime();
                const diffMins = Math.floor(diffMs / 60000);
                const diffHours = Math.floor(diffMs / 3600000);
                const diffDays = Math.floor(diffMs / 86400000);

                if (diffMins < 1) return 'Just now';
                if (diffMins < 60) return `${diffMins}m ago`;
                if (diffHours < 24) return `${diffHours}h ago`;
                if (diffDays < 7) return `${diffDays}d ago`;
                return msgDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              })()
            : '';

          return (
            <div
              key={conv.id}
              className={`conversation-item ${selectedContactId === conv.contact?.id ? 'selected' : ''} ${conv.unreadCount > 0 ? 'has-unread' : ''}`}
              onClick={() => conv.contact?.id && onSelectConversation(conv.contact.id, conv)}
            >
              <div className="conv-avatar" style={{ background: profilePic ? 'none' : gradient }}>
                {profilePic ? (
                  <img
                    src={profilePic}
                    alt={displayName}
                    className="avatar-image"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      // Restore gradient background on parent
                      const parent = e.currentTarget.parentElement;
                      if (parent) parent.style.background = gradient;
                      const textAvatar = e.currentTarget.nextElementSibling;
                      if (textAvatar) {
                        (textAvatar as HTMLElement).style.display = 'flex';
                      }
                    }}
                  />
                ) : null}
                <span className="avatar-text" style={{ display: profilePic ? 'none' : 'flex' }}>
                  {avatarIcon || ((conv.contact?.name?.charAt(0) || conv.contact?.phoneNumber?.charAt(0)) || '?').toUpperCase()}
                </span>
                {conv.unreadCount > 0 && <span className="online-indicator"></span>}
              </div>

              <div className="conv-content">
                <div className="conv-header">
                  <div className="conv-name-row">
                    <span className="conv-name" title={displayName}>{displayName}</span>
                    {contactType !== 'contact' && (
                      <span className={`conv-type-badge conv-type-${contactType}`}>
                        {typeInfo.icon}
                      </span>
                    )}
                  </div>
                  {timeAgo && <span className="conv-time">{timeAgo}</span>}
                </div>
                <div className="conv-preview-row">
                  <p className="conv-preview" title={conv.lastMessage}>
                    {conv.lastMessage || 'No messages yet'}
                  </p>
                  {conv.unreadCount > 0 && (
                    <span className="unread-badge">{conv.unreadCount > 99 ? '99+' : conv.unreadCount}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ConversationList;
