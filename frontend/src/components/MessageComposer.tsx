import React, { useRef, useState, useEffect } from 'react';
import '@/styles/message-composer.css';

interface QuickReply {
  id: string;
  title: string;
  content: string;
  shortcut: string | null;
  category: string | null;
}

interface MediaFile {
  file: File;
  preview: string;
  type: 'image' | 'video' | 'audio' | 'document';
}

interface MessageComposerProps {
  onSend: (content: string, mediaUrl?: string, mediaType?: string) => Promise<void>;
  isLoading?: boolean;
  disabled?: boolean;
}

const normalizeShortcut = (value?: string | null) => {
  if (!value) return '';
  return value.trim().replace(/^\/+/, '').toLowerCase();
};

const formatShortcut = (value?: string | null) => {
  const normalized = normalizeShortcut(value);
  return normalized ? `/${normalized}` : '';
};

export const MessageComposer: React.FC<MessageComposerProps> = ({ onSend, isLoading = false, disabled = false }) => {
  const [content, setContent] = useState('');
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [filteredQuickReplies, setFilteredQuickReplies] = useState<QuickReply[]>([]);
  const [selectedReplyIndex, setSelectedReplyIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Load quick replies on mount
  useEffect(() => {
    loadQuickReplies();
  }, []);

  const loadQuickReplies = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${window.location.origin}/api/v1/quick-replies?limit=100`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const result = await response.json();
        const replies = Array.isArray(result.data) ? result.data : (result.data?.data || []);
        setQuickReplies(replies);
      }
    } catch (error) {
      console.error('Failed to load quick replies:', error);
    }
  };

  // Handle quick reply shortcuts
  useEffect(() => {
    if (!content.includes('/')) {
      setShowQuickReplies(false);
      return;
    }

    const lastWord = content.split(' ').pop() || '';
    if (lastWord.startsWith('/') && lastWord.length > 1) {
      const searchTerm = normalizeShortcut(lastWord.substring(1));
      const filtered = quickReplies.filter((qr) => {
        const shortcut = normalizeShortcut(qr.shortcut);
        const title = (qr.title || '').toLowerCase();
        return shortcut.includes(searchTerm) || title.includes(searchTerm);
      });
      setFilteredQuickReplies(filtered);
      setShowQuickReplies(filtered.length > 0);
      setSelectedReplyIndex(0);
    } else {
      setShowQuickReplies(false);
    }
  }, [content, quickReplies]);

  const handleSend = async () => {
    if (!content.trim() && mediaFiles.length === 0) return;

    try {
      // Handle media upload if present
      if (mediaFiles.length > 0) {
        for (const mediaFile of mediaFiles) {
          const formData = new FormData();
          formData.append('file', mediaFile.file);
          
          // Upload media to server
          const response = await fetch(`${window.location.origin}/api/v1/media/upload`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: formData
          });
          
          if (response.ok) {
            const result = await response.json();
            // Convert relative path to full URL
            const mediaUrl = result.data.url.startsWith('http') 
              ? result.data.url 
              : `${window.location.origin}${result.data.url}`;
            await onSend(content.trim(), mediaUrl, mediaFile.type);
          } else {
            const errorData = await response.json();
            console.error('Upload failed:', errorData);
            alert(`Failed to upload ${mediaFile.file.name}: ${errorData.error || 'Unknown error'}`);
          }
        }
      } else {
        await onSend(content.trim());
      }
      
      setContent('');
      setMediaFiles([]);
    } catch (err) {
      console.error('Failed to send message:', err);
      alert('Failed to send message. Please try again.');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    processFiles(files);
  };

  const processFiles = (files: File[]) => {
    files.forEach(file => {
      // Validate file size (max 50MB)
      if (file.size > 50 * 1024 * 1024) {
        alert(`File ${file.name} is too large. Max 50MB.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const preview = event.target?.result as string;
        let type: MediaFile['type'] = 'document';
        
        if (file.type.startsWith('image/')) type = 'image';
        else if (file.type.startsWith('video/')) type = 'video';
        else if (file.type.startsWith('audio/')) type = 'audio';

        setMediaFiles(prev => [...prev, { file, preview, type }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleClearMedia = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
        const preview = URL.createObjectURL(audioBlob);
        
        setMediaFiles(prev => [...prev, {
          file: audioFile,
          preview,
          type: 'audio'
        }]);
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showQuickReplies) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedReplyIndex(prev => 
          prev < filteredQuickReplies.length - 1 ? prev + 1 : prev
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedReplyIndex(prev => prev > 0 ? prev - 1 : 0);
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        insertQuickReply(filteredQuickReplies[selectedReplyIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setShowQuickReplies(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const insertQuickReply = (reply: QuickReply) => {
    const words = content.split(' ');
    words.pop(); // Remove the /shortcut
    const newContent = words.length > 0 
      ? words.join(' ') + ' ' + reply.content 
      : reply.content;
    setContent(newContent);
    setShowQuickReplies(false);
    textareaRef.current?.focus();
  };

  return (
    <div 
      className={`message-composer ${isDragging ? 'dragging' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="drag-overlay">
          <div className="drag-message">
            📎 Drop files here to send
          </div>
        </div>
      )}

      {/* Quick Replies Dropdown */}
      {showQuickReplies && filteredQuickReplies.length > 0 && (
        <div className="quick-replies-dropdown">
          {filteredQuickReplies.map((reply, index) => (
            <div
              key={reply.id}
              className={`quick-reply-item ${index === selectedReplyIndex ? 'selected' : ''}`}
              onClick={() => insertQuickReply(reply)}
              onMouseEnter={() => setSelectedReplyIndex(index)}
            >
              <div className="qr-header">
                {reply.shortcut && <span className="qr-shortcut">{formatShortcut(reply.shortcut)}</span>}
                <span className="qr-title">{reply.title}</span>
              </div>
              <div className="qr-preview">{reply.content.substring(0, 60)}...</div>
            </div>
          ))}
          <div className="qr-hint">
            <span>↑↓ Navigate</span>
            <span>Tab/Enter Select</span>
            <span>Esc Close</span>
          </div>
        </div>
      )}

      {/* Media Previews */}
      {mediaFiles.length > 0 && (
        <div className="media-previews">
          {mediaFiles.map((media, index) => (
            <div key={index} className="media-preview-item">
              {media.type === 'image' && (
                <img src={media.preview} alt="Preview" className="media-preview-img" />
              )}
              {media.type === 'video' && (
                <video src={media.preview} className="media-preview-video" />
              )}
              {media.type === 'audio' && (
                <div className="media-preview-audio">
                  🎵 Audio Recording
                </div>
              )}
              {media.type === 'document' && (
                <div className="media-preview-doc">
                  📄 {media.file.name}
                </div>
              )}
              <button
                className="media-clear-btn"
                onClick={() => handleClearMedia(index)}
                title="Remove"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Recording indicator */}
      {isRecording && (
        <div className="recording-indicator">
          <span className="recording-dot"></span>
          <span className="recording-time">{formatRecordingTime(recordingTime)}</span>
          <button onClick={stopRecording} className="stop-recording-btn">
            Stop Recording
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="composer-input-row">
        <button
          className="attach-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isLoading || isRecording}
          title="Attach file"
        >
          📎
        </button>

        <button
          className={`voice-btn ${isRecording ? 'recording' : ''}`}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={disabled || isLoading}
          title={isRecording ? "Stop recording" : "Record voice message"}
        >
          {isRecording ? '⏹' : '🎤'}
        </button>

        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Use / for quick replies)"
          disabled={disabled || isLoading || isRecording}
          className="input-field"
          rows={1}
        />

        <button
          className="send-btn"
          onClick={handleSend}
          disabled={disabled || isLoading || isRecording || (!content.trim() && mediaFiles.length === 0)}
          title="Send message"
        >
          {isLoading ? '⏳' : '➤'}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
          multiple
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
};

export default MessageComposer;
