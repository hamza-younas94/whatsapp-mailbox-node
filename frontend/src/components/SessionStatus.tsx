import React, { useState, useEffect } from 'react';
import { subscribeToSessionStatus } from '@/api/socket';
import { sessionAPI } from '@/api/queries';
import '@/styles/session-status.css';

type SessionState = 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' | 'QR_READY' | 'UNKNOWN';

interface QRData {
  qr: string;
  sessionId: string;
}

interface SessionStatusProps {
  onQRRequired?: (qrData: QRData) => void;
}

const SessionStatus: React.FC<SessionStatusProps> = ({ onQRRequired }) => {
  const [status, setStatus] = useState<SessionState>('UNKNOWN');
  const [showQR, setShowQR] = useState(false);
  const [qrData, setQRData] = useState<QRData | null>(null);
  const [message, setMessage] = useState('Initializing...');
  const [isInitializing, setIsInitializing] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Check session status first, then initialize if needed
  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout | null = null;

    const checkAndInitialize = async () => {
      // Prevent multiple initialization attempts
      if (hasInitialized || isInitializing) {
        console.log('Skipping initialization - already initialized or in progress');
        return;
      }

      const token = localStorage.getItem('authToken');
      if (!token) {
        if (mounted) {
          setMessage('Please log in first');
          setStatus('DISCONNECTED');
        }
        return;
      }

      try {
        setIsInitializing(true);
        
        // First, check current session status
        const currentStatus = await sessionAPI.getSessionStatus();
        console.log('Current session status:', currentStatus);
        
        if (!mounted) return;
        
        // If already connected or ready, update status and STOP
        if (currentStatus.isConnected || currentStatus.status === 'READY' || currentStatus.status === 'AUTHENTICATED') {
          setStatus('CONNECTED');
          setMessage('Connected to WhatsApp');
          setHasInitialized(true);
          setIsInitializing(false);
          console.log('Session is already ready, stopping initialization checks');
          return;
        }

        // If QR code is available, show it
        if (currentStatus.qr) {
          setStatus('QR_READY');
          setMessage('Scan QR code to connect');
          setQRData({ qr: currentStatus.qr, sessionId: currentStatus.sessionId });
          setShowQR(true);
          onQRRequired?.({ qr: currentStatus.qr, sessionId: currentStatus.sessionId });
          setHasInitialized(true);
          setIsInitializing(false);
          return;
        }

        // If status is INITIALIZING, wait a bit and check again (but don't call initialize again)
        if (currentStatus.status === 'INITIALIZING') {
          console.log('Session is already initializing, waiting...');
          setMessage('Connecting to WhatsApp...');
          setStatus('INITIALIZING');
          setHasInitialized(true);
          setIsInitializing(false);
          // Don't call initialize again - just wait
          return;
        }

        // If QR_READY, just show it and stop
        if (currentStatus.status === 'QR_READY' && currentStatus.qr) {
          setStatus('QR_READY');
          setMessage('Scan QR code to connect');
          setQRData({ qr: currentStatus.qr, sessionId: currentStatus.sessionId });
          setShowQR(true);
          onQRRequired?.({ qr: currentStatus.qr, sessionId: currentStatus.sessionId });
          setHasInitialized(true);
          setIsInitializing(false);
          return;
        }

        // Only initialize if no active session and not already initializing
        if (!currentStatus.isConnected && currentStatus.status !== 'QR_READY' && currentStatus.status !== 'INITIALIZING') {
          setMessage('Starting WhatsApp session...');
          console.log('Auto-initializing WhatsApp session...');
          
          const result = await sessionAPI.initializeSession();
          console.log('Session initialization result:', result);
          
          if (!mounted) return;
          
          // If result has QR code, show it
          if (result.qr) {
            setStatus('QR_READY');
            setMessage('Scan QR code to connect');
            setQRData({ qr: result.qr, sessionId: result.sessionId });
            setShowQR(true);
            onQRRequired?.({ qr: result.qr, sessionId: result.sessionId });
          } else if (result.status === 'READY') {
            setStatus('CONNECTED');
            setMessage('Connected to WhatsApp');
          }
        }
        
        setHasInitialized(true);
      } catch (error: any) {
        console.error('Failed to initialize session:', error);
        if (mounted) {
          setStatus('DISCONNECTED');
          setMessage('Failed to initialize session. Click reconnect to try again.');
        }
      } finally {
        if (mounted) {
          setIsInitializing(false);
        }
      }
    };

    // Debounce initialization check by 500ms
    timeoutId = setTimeout(() => {
      checkAndInitialize();
    }, 500);

    // Set up polling to check session status periodically if not connected
    const pollInterval = setInterval(async () => {
      if (!mounted || hasInitialized) return;
      
      const token = localStorage.getItem('authToken');
      if (!token) return;

      try {
        const currentStatus = await sessionAPI.getSessionStatus();
        
        if (!mounted) return;
        
        // If connected, update status and stop polling
        if (currentStatus.isConnected || currentStatus.status === 'READY' || currentStatus.status === 'AUTHENTICATED') {
          setStatus('CONNECTED');
          setMessage('Connected to WhatsApp');
          setHasInitialized(true);
          clearInterval(pollInterval);
          return;
        }
        
        // If QR code available, show it
        if (currentStatus.qr && currentStatus.status === 'QR_READY') {
          setStatus('QR_READY');
          setMessage('Scan QR code to connect');
          setQRData({ qr: currentStatus.qr, sessionId: currentStatus.sessionId });
          setShowQR(true);
          onQRRequired?.({ qr: currentStatus.qr, sessionId: currentStatus.sessionId });
          setHasInitialized(true);
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error('Error polling session status:', error);
      }
    }, 3000); // Poll every 3 seconds

    return () => {
      mounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      clearInterval(pollInterval);
    };
  }, []); // Empty dependency array - only run once on mount

  // Subscribe to session status updates via socket
  useEffect(() => {
    const unsubscribe = subscribeToSessionStatus((data) => {
      const newStatus = (data.status || 'UNKNOWN') as SessionState;
      setStatus(newStatus);

      switch (newStatus) {
        case 'CONNECTED':
          setMessage('Connected to WhatsApp');
          setShowQR(false);
          break;
        case 'CONNECTING':
          setMessage('Connecting to WhatsApp...');
          setShowQR(false);
          break;
        case 'QR_READY':
          setMessage('Scan QR code to connect');
          setQRData(data);
          setShowQR(true);
          onQRRequired?.(data);
          break;
        case 'DISCONNECTED':
          setMessage('Disconnected from WhatsApp');
          setShowQR(false);
          break;
        default:
          setMessage('Loading...');
          setShowQR(false);
      }
    });

    return unsubscribe;
  }, [onQRRequired]);

  const handleReconnect = async () => {
    try {
      setIsInitializing(true);
      setHasInitialized(false); // Reset to allow re-initialization
      setMessage('Reconnecting to WhatsApp...');
      const result = await sessionAPI.initializeSession();
      console.log('Reconnection result:', result);
      
      // Update status based on result
      if (result.qr) {
        setStatus('QR_READY');
        setMessage('Scan QR code to connect');
        setQRData({ qr: result.qr, sessionId: result.sessionId });
        setShowQR(true);
        onQRRequired?.({ qr: result.qr, sessionId: result.sessionId });
      } else if (result.status === 'READY') {
        setStatus('CONNECTED');
        setMessage('Connected to WhatsApp');
      }
      
      setHasInitialized(true);
    } catch (error) {
      console.error('Failed to reconnect:', error);
      setMessage('Failed to reconnect. Please try again.');
      setStatus('DISCONNECTED');
    } finally {
      setIsInitializing(false);
    }
  };

  const statusClass = status.toLowerCase();

  return (
    <div className={`session-status status-${statusClass}`}>
      <div className="status-content">
        <div className="status-indicator">
          <div className="status-dot"></div>
          <span className="status-text">{message}</span>
        </div>

        {status === 'DISCONNECTED' && (
          <button className="reconnect-btn" onClick={handleReconnect} disabled={isInitializing}>
            {isInitializing ? 'Reconnecting...' : 'Reconnect'}
          </button>
        )}
      </div>

      {showQR && qrData && (
        <div className="qr-modal-overlay" onClick={() => setShowQR(false)}>
          <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Scan QR Code</h3>
            <p>Open WhatsApp on your phone and scan this QR code to connect your account.</p>
            <div className="qr-container">
              <img src={`data:image/png;base64,${qrData.qr}`} alt="QR Code" className="qr-image" />
            </div>
            <p className="qr-helper-text">Make sure your phone is connected to the internet</p>
            <button className="close-btn" onClick={() => setShowQR(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionStatus;
