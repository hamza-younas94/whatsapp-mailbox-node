import React, { useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import { messageAPI } from '@/api/queries';
import '@/styles/message-bubble-enhanced.css';

interface Message {
  id: string;
  content?: string;
  messageType: string;
  direction: 'INCOMING' | 'OUTGOING';
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'RECEIVED';
  mediaUrl?: string;
  mediaType?: string;
  createdAt: string;
  reaction?: string;
  metadata?: any;
}

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  highlightText?: string;
}

const REACTION_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];

// Highlight search matches in text
function highlightMatches(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  if (parts.length === 1) return text;
  return <>{parts.map((part, i) =>
    regex.test(part) ? <mark key={i} className="search-highlight">{part}</mark> : part
  )}</>;
}

// Format message content: replace raw @mentions with styled spans
function formatMessageContent(content: string, searchQuery?: string): React.ReactNode {
  // Match @<digits> patterns (WhatsApp raw mentions)
  const mentionRegex = /@(\d{10,20})/g;
  if (!mentionRegex.test(content)) return searchQuery ? highlightMatches(content, searchQuery) : content;

  // Reset regex lastIndex after test
  mentionRegex.lastIndex = 0;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mentionRegex.exec(content)) !== null) {
    // Text before the mention
    if (match.index > lastIndex) {
      const textPart = content.slice(lastIndex, match.index);
      parts.push(searchQuery ? highlightMatches(textPart, searchQuery) : textPart);
    }
    // Styled mention
    parts.push(
      <span key={match.index} className="mention-tag">@member</span>
    );
    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last mention
  if (lastIndex < content.length) {
    const textPart = content.slice(lastIndex);
    parts.push(searchQuery ? highlightMatches(textPart, searchQuery) : textPart);
  }

  return <>{parts}</>;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isOwn, highlightText }) => {
  const [showReactions, setShowReactions] = useState(false);
  const [selectedReaction, setSelectedReaction] = useState<string | undefined>(
    message.reaction || message.metadata?.reaction
  );
  const [isLoading, setIsLoading] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const hideTimeout = useRef<NodeJS.Timeout | null>(null);

  const time = new Date(message.createdAt).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const isMediaType = message.messageType !== 'TEXT' && message.messageType !== undefined;
  const hasMedia = isMediaType && message.mediaUrl;
  const mediaSrc = message.mediaUrl
    ? (message.mediaUrl.startsWith('http') ? message.mediaUrl : `${window.location.origin}${message.mediaUrl}`)
    : undefined;

  // Media type label for fallback display when media URL is missing
  const mediaTypeLabels: Record<string, string> = {
    IMAGE: '📷 Image',
    VIDEO: '🎥 Video',
    AUDIO: '🎵 Audio',
    DOCUMENT: '📄 Document',
    LOCATION: '📍 Location',
    CONTACT: '👤 Contact',
    STICKER: '🏷️ Sticker',
  };

  const handleReaction = async (emoji: string) => {
    try {
      setIsLoading(true);
      
      // Toggle reaction off if same emoji clicked again
      const newReaction = selectedReaction === emoji ? undefined : emoji;
      
      // Call API to send reaction
      await messageAPI.sendReaction(message.id, newReaction || '');
      
      // Update local state
      setSelectedReaction(newReaction);
      setShowReactions(false);
    } catch {
      setSelectedReaction(selectedReaction);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMouseEnter = () => {
    // Clear any pending hide timeout
    if (hideTimeout.current) {
      clearTimeout(hideTimeout.current);
      hideTimeout.current = null;
    }
    setShowReactions(true);
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    // Check if mouse is moving to the reaction picker
    const relatedTarget = e.relatedTarget;
    const isMovingToReactionPicker = relatedTarget instanceof HTMLElement &&
      (relatedTarget.closest('.reaction-picker') || relatedTarget.closest('.reaction-btn'));
    
    if (isMovingToReactionPicker) {
      return; // Don't hide if moving to reaction picker
    }
    
    // Add a longer delay before hiding to allow moving to reaction picker
    if (!isLoading) {
      hideTimeout.current = setTimeout(() => {
        setShowReactions(false);
      }, 500);
    }
  };

  const handleReactionPickerMouseEnter = () => {
    // Clear hide timeout when mouse enters reaction picker
    if (hideTimeout.current) {
      clearTimeout(hideTimeout.current);
      hideTimeout.current = null;
    }
  };

  const handleReactionPickerMouseLeave = () => {
    // Hide after leaving reaction picker
    if (!isLoading) {
      hideTimeout.current = setTimeout(() => {
        setShowReactions(false);
      }, 300);
    }
  };

  return (
    <div 
      className={`message-bubble-wrapper ${isOwn ? 'own' : 'other'}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={`message-bubble ${isOwn ? 'own' : 'other'}`}>
        {/* Media content */}
        {hasMedia && (
          <div className="message-media">
            {message.messageType === 'IMAGE' && (
              <img
                src={mediaSrc}
                alt="Image"
                className="media-image"
                onClick={() => setShowImagePreview(true)}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
            {message.messageType === 'VIDEO' && (
              <video
                src={mediaSrc}
                controls
                className="media-video"
                preload="metadata"
                onError={(e) => {
                  (e.target as HTMLVideoElement).style.display = 'none';
                }}
              />
            )}
            {(message.messageType === 'AUDIO' || message.messageType === 'PTT') && (
              <div className="media-audio-wrapper">
                <div className="audio-icon">🎵</div>
                <audio
                  src={mediaSrc}
                  controls
                  className="media-audio"
                  preload="metadata"
                />
              </div>
            )}
            {message.messageType === 'DOCUMENT' && (
              <a href={mediaSrc} target="_blank" rel="noopener noreferrer" className="document-link">
                <span className="doc-icon">📎</span>
                <span className="doc-text">{message.mediaType || 'Document'}</span>
                <span className="doc-download">↓</span>
              </a>
            )}
            {message.messageType === 'STICKER' && (
              <img src={mediaSrc} alt="Sticker" className="media-sticker" />
            )}
          </div>
        )}

        {/* Fallback label when media type is set but URL is missing */}
        {isMediaType && !message.mediaUrl && (
          <div className="media-fallback">
            {mediaTypeLabels[message.messageType || ''] || `📎 ${message.messageType}`}
          </div>
        )}

        {/* Text content — skip if it's just a bracketed media label like [AUDIO] */}
        {message.content && !/^\[(IMAGE|VIDEO|AUDIO|DOCUMENT|STICKER|PTT|LOCATION|CONTACT)\]$/i.test(message.content.trim()) && (
          <p className="message-text">{formatMessageContent(message.content, highlightText)}</p>
        )}

        {/* Message meta */}
        <div className="message-meta">
          <span className="time">{time}</span>
          {isOwn && (
            <span className={`status-icon status-${message.status.toLowerCase()}`}>
              {message.status === 'PENDING' && <span className="status-pending">⏱</span>}
              {message.status === 'SENT' && <span className="status-sent">✓</span>}
              {message.status === 'DELIVERED' && <span className="status-delivered">✓✓</span>}
              {message.status === 'READ' && <span className="status-read">✓✓</span>}
              {message.status === 'FAILED' && <span className="status-failed">✗</span>}
            </span>
          )}
        </div>

        {/* Selected Reaction */}
        {selectedReaction && (
          <div className="message-reaction">
            {selectedReaction}
          </div>
        )}

        {/* Reaction Picker */}
        {showReactions && (
          <div 
            className={`reaction-picker ${isOwn ? 'own' : 'other'}`}
            onMouseEnter={handleReactionPickerMouseEnter}
            onMouseLeave={handleReactionPickerMouseLeave}
          >
            {REACTION_EMOJIS.map(emoji => (
              <button
                key={emoji}
                className={`reaction-btn ${selectedReaction === emoji ? 'selected' : ''}`}
                onClick={() => handleReaction(emoji)}
                title={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Image lightbox — rendered via Portal to escape stacking context */}
      {showImagePreview && mediaSrc && ReactDOM.createPortal(
        <div
          className="image-preview-modal"
          onClick={() => setShowImagePreview(false)}
        >
          <div className="image-preview-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="image-preview-close"
              onClick={() => setShowImagePreview(false)}
            >
              ✕
            </button>
            <img src={mediaSrc} alt="Full size" className="image-preview-img" />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default MessageBubble;
