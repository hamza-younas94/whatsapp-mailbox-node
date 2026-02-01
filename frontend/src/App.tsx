import React, { useState, useEffect } from 'react';
import { contactAPI } from '@/api/queries';
import Navbar from '@/components/Navbar';
import SessionStatus from '@/components/SessionStatus';
import ConversationList from '@/components/ConversationList';
import ChatPane from '@/components/ChatPane';
import '@/styles/app-layout.css';

interface ContactInfo {
  id: string;
  phoneNumber: string;
  chatId?: string | null;
  name?: string;
  contactType?: string | null;
  avatarUrl?: string | null;
  profilePhotoUrl?: string | null;
}

interface Conversation {
  id: string;
  contact: ContactInfo;
  unreadCount: number;
  lastMessage?: string;
  lastMessageAt?: string;
}

const App: React.FC = () => {
  const [selectedContactId, setSelectedContactId] = useState<string | undefined>();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | undefined>();
  const [isMobile, setIsMobile] = useState(false);
  const [showList, setShowList] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);

  // Check authentication on mount
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const urlToken = new URLSearchParams(window.location.search).get('token');
    
    if (urlToken) {
      // Token provided in URL query param (from login page redirect)
      localStorage.setItem('authToken', urlToken);
      setIsAuthenticated(true);
      // Clean URL by removing token param
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (token) {
      // Token already in localStorage
      setIsAuthenticated(true);
    } else {
      // No token found - redirect to login
      setIsAuthenticated(false);
      // Redirect to login page
      const loginUrl = '/login.html';
      console.log('No auth token found, redirecting to:', loginUrl);
      window.location.href = loginUrl;
    }
    
    setIsCheckingAuth(false);
  }, []);

  // Auto-sync conversations every 3 seconds when auto-refresh is enabled
  useEffect(() => {
    if (!autoRefreshEnabled || !isAuthenticated) {
      return;
    }

    const syncInterval = setInterval(() => {
      // Trigger refresh by updating search query to force ConversationList to reload
      // This is done by dispatching a custom event that ConversationList listens to
      window.dispatchEvent(new CustomEvent('refreshConversations'));
    }, 3000); // Sync every 3 seconds

    return () => clearInterval(syncInterval);
  }, [autoRefreshEnabled, isAuthenticated]);

  // Check if mobile
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setShowList(mobile ? !selectedContactId : true);
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, [selectedContactId]);

  const handleSelectConversation = (contactId: string, conversation: Conversation) => {
    // Store contact ID and the full conversation object with correct contact data
    setSelectedContactId(contactId);
    setSelectedConversation(conversation);
    
    // On mobile, hide list when chat is selected
    if (isMobile) {
      setShowList(false);
    }
  };

  const handleBackToList = () => {
    setShowList(true);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    setIsAuthenticated(false);
  };

  return (
    <div className="app-container">
      {isAuthenticated && <Navbar onLogout={handleLogout} onSearch={handleSearch} />}
      
      <SessionStatus />

      <div className="mailbox-main">
        {/* Conversation List - visible on desktop or when showList is true on mobile */}
        {(showList || !isMobile) && (
          <div className={`list-panel ${!showList && isMobile ? 'hidden' : ''}`}>
            <ConversationList
              onSelectConversation={handleSelectConversation}
              selectedContactId={selectedContactId}
              searchQuery={searchQuery}
              onAutoRefreshChange={setAutoRefreshEnabled}
            />
          </div>
        )}

        {/* Chat Pane - visible on desktop or when not showList on mobile */}
        {(!showList || !isMobile) && (
          <div className={`chat-panel ${showList && isMobile ? 'hidden' : ''}`}>
            {selectedContactId && selectedConversation && (
              <div className="chat-header-mobile">
                {isMobile && (
                  <button className="back-button" onClick={handleBackToList}>
                    ← Back
                  </button>
                )}
              </div>
            )}
            <ChatPane
              key={selectedContactId} // Force re-render when contact changes
              contactId={selectedContactId}
              contactName={selectedConversation?.contact?.name || selectedConversation?.contact?.phoneNumber}
              chatId={selectedConversation?.contact?.chatId}
              contactType={selectedConversation?.contact?.contactType}
              profilePic={selectedConversation?.contact?.profilePhotoUrl || selectedConversation?.contact?.avatarUrl}
              phoneNumber={selectedConversation?.contact?.phoneNumber}
            />
          </div>
        )}

        {/* Empty State on Desktop */}
        {!selectedContactId && !isMobile && (
          <div className="empty-chat-desktop">
            <div className="empty-content">
              <div className="empty-icon">💬</div>
              <h2>WhatsApp Mailbox</h2>
              <p>Select a conversation to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
