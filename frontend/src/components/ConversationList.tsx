import React, { useEffect, useState } from 'react';
import { contactAPI } from '@/api/queries';
import { getContactTypeFromId, getContactTypeInfo, getContactTypeBadgeClass } from '@/utils/contact-type';
import '@/styles/conversation-list-enhanced.css';
import '@/styles/contact-type-badge.css';

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

export const ConversationList: React.FC<ConversationListProps> = ({
  onSelectConversation,
  selectedContactId,
  searchQuery = '',
  onAutoRefreshChange,
}) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(searchQuery);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const response = await contactAPI.searchContacts(search || undefined, 100, 0);
      
      // Handle both direct array and paginated response
      const contacts = Array.isArray(response) ? response : (response?.data || []);
      
      // Transform contacts into conversation format
      const transformedConversations: Conversation[] = contacts
        .filter((contact: any) => {
          // Filter out null/undefined
          return contact && contact.id;
        })
        .map((contact: any) => {
          // Get the last message from the messages array (already sorted by createdAt desc)
          const lastMessageObj = contact.messages && contact.messages.length > 0 
            ? contact.messages[0] 
            : null;
          
          // Format last message preview
          let lastMessagePreview: string | undefined = 'No messages yet';
          
          if (lastMessageObj) {
            // Handle text messages
            if (lastMessageObj.content && lastMessageObj.content.trim()) {
              // Truncate long messages
              const content = lastMessageObj.content.trim();
              lastMessagePreview = content.length > 50 
                ? content.substring(0, 50) + '...'
                : content;
            } 
            // Handle media messages
            else if (lastMessageObj.messageType && lastMessageObj.messageType !== 'TEXT') {
              const typeLabels: Record<string, string> = {
                'IMAGE': '📷 Image',
                'VIDEO': '🎥 Video',
                'AUDIO': '🎵 Audio',
                'DOCUMENT': '📄 Document',
                'LOCATION': '📍 Location',
                'CONTACT': '👤 Contact',
              };
              lastMessagePreview = typeLabels[lastMessageObj.messageType] || '📎 Media';
            }
            // If message has no content and no type, show direction indicator
            else {
              lastMessagePreview = lastMessageObj.direction === 'INCOMING' 
                ? '📥 Message received' 
                : '📤 Message sent';
            }
          }

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
            unreadCount: contact._count?.messages || 0,
            lastMessage: lastMessagePreview,
            lastMessageAt: lastMessageObj?.createdAt || contact.lastMessageAt,
          };
        })
        // Sort by lastMessageAt descending (most recent first)
        .sort((a, b) => {
          const dateA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const dateB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
          return dateB - dateA;
        });
      
      setConversations(transformedConversations);
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();

    // Listen for refresh events from App component
    const handleRefresh = () => {
      loadConversations();
    };

    window.addEventListener('refreshConversations', handleRefresh);
    return () => window.removeEventListener('refreshConversations', handleRefresh);
  }, [search]);

  // Update search when prop changes

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

      {/* Conversations */}
      <div className="conversations-scroll">
        {loading && <div className="loading-state">Loading...</div>}

        {!loading && conversations.length === 0 && (
          <div className="empty-state">No conversations yet</div>
        )}

        {conversations
          .filter((conv) => conv && conv.contact && conv.contact.id) // Additional safety check
          .map((conv) => {
            // Display name: use the stored contact name which includes group names from backend
            const displayName = conv.contact?.name || conv.contact?.phoneNumber || 'Unknown';
            const profilePic = conv.contact?.profilePhotoUrl || conv.contact?.avatarUrl;
            const contactType = getContactTypeFromId(
              conv.contact?.chatId,
              conv.contact?.phoneNumber,
              conv.contact?.contactType,
            );
            const typeInfo = getContactTypeInfo(contactType);
            const badgeClass = getContactTypeBadgeClass(contactType);
            
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
                <div className="conv-avatar">
                  {profilePic ? (
                    <img 
                      src={profilePic} 
                      alt={displayName} 
                      className="avatar-image"
                      onError={(e) => {
                        // Fallback to text avatar on image load error
                        e.currentTarget.style.display = 'none';
                        const textAvatar = e.currentTarget.nextElementSibling;
                        if (textAvatar) {
                          (textAvatar as HTMLElement).style.display = 'flex';
                        }
                      }}
                    />
                  ) : null}
                  <span className="avatar-text" style={{ display: profilePic ? 'none' : 'flex' }}>
                    {((conv.contact?.name?.charAt(0) || conv.contact?.phoneNumber?.charAt(0)) || '?').toUpperCase()}
                  </span>
                  {conv.unreadCount > 0 && <span className="online-indicator"></span>}
                </div>

                <div className="conv-content">
                  <div className="conv-header">
                    <div className="conv-name">
                      <span title={displayName}>{displayName}</span>
                      <span className={badgeClass} title={typeInfo.label}>
                        {typeInfo.icon} {typeInfo.label}
                      </span>
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
