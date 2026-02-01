import React, { useEffect, useState, useRef } from 'react';
import { MessageEvent } from '@/api/socket';
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
}

const REACTION_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isOwn }) => {
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

  const hasMedia = message.messageType !== 'TEXT' && message.mediaUrl;
  const mediaSrc = message.mediaUrl
    ? (message.mediaUrl.startsWith('http') ? message.mediaUrl : `${window.location.origin}${message.mediaUrl}`)
    : undefined;

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
    } catch (error) {
      console.error('Failed to send reaction:', error);
      // Reset state on error
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
    const relatedTarget = e.relatedTarget as HTMLElement;
    const isMovingToReactionPicker = relatedTarget?.closest('.reaction-picker') || 
                                      relatedTarget?.closest('.reaction-btn');
    
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
              <>
                <img 
                  src={mediaSrc} 
                  alt="Message" 
                  className="media-image"
                  onClick={() => setShowImagePreview(true)}
                  style={{ cursor: 'pointer' }}
                  onError={(e) => {
                    console.error('Image failed to load:', message.mediaUrl);
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                {showImagePreview && (
                  <div 
                    className="image-preview-modal" 
                    onClick={() => setShowImagePreview(false)}
                  >
                    <div className="image-preview-content">
                      <button 
                        className="image-preview-close"
                        onClick={() => setShowImagePreview(false)}
                      >
                        ✕
                      </button>
                      <img src={mediaSrc} alt="Full size" className="image-preview-img" />
                    </div>
                  </div>
                )}
              </>
            )}
            {message.messageType === 'VIDEO' && (
              <video 
                src={mediaSrc} 
                controls 
                className="media-video"
                onError={(e) => {
                  console.error('Video failed to load:', message.mediaUrl);
                  (e.target as HTMLVideoElement).style.display = 'none';
                }}
              />
            )}
            {message.messageType === 'AUDIO' && (
              <div className="media-audio-wrapper">
                <div className="audio-icon">🎵</div>
                <audio 
                  src={mediaSrc} 
                  controls 
                  className="media-audio"
                  onError={(e) => {
                    console.error('Audio failed to load:', message.mediaUrl);
                    (e.target as HTMLAudioElement).style.display = 'none';
                  }}
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
          </div>
        )}

        {/* Text content */}
        {message.content && <p className="message-text">{message.content}</p>}

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
    </div>
  );
};

export default MessageBubble;
