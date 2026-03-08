import React, { useState, useEffect, useRef } from 'react';
import { subscribeToSessionStatus } from '@/api/socket';
import { sessionAPI } from '@/api/queries';
import '@/styles/session-status.css';

type SessionState = 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' | 'QR_READY' | 'INITIALIZING' | 'UNKNOWN';

interface QRData {
  qr: string;
  sessionId: string;
}

interface SessionStatusProps {
  onQRRequired?: (qrData: QRData) => void;
  onStatusChange?: (status: SessionState) => void;
}

const SessionStatus: React.FC<SessionStatusProps> = ({ onQRRequired, onStatusChange }) => {
  const [status, setStatus] = useState<SessionState>('UNKNOWN');
  const [showQR, setShowQR] = useState(false);
  const [qrData, setQRData] = useState<QRData | null>(null);
  const [message, setMessage] = useState('Initializing...');
  const [isInitializing, setIsInitializing] = useState(false);
  const hasInitializedRef = useRef(false);

  // Notify parent and sync static navbar status indicator
  const updateStatus = (newStatus: SessionState) => {
    setStatus(newStatus);
    onStatusChange?.(newStatus);

    // Sync static navbar status indicator (from navbar.js)
    const dot = document.getElementById('navStatusDot');
    const text = document.getElementById('navStatusText');
    const wrapper = document.getElementById('navSessionStatus');
    if (dot && text && wrapper) {
      const labels: Record<string, string> = {
        CONNECTED: 'Connected', CONNECTING: 'Connecting...', DISCONNECTED: 'Disconnected',
        QR_READY: 'Scan QR', INITIALIZING: 'Starting...', UNKNOWN: 'Checking...',
      };
      text.textContent = labels[newStatus] || 'Unknown';
      if (newStatus === 'CONNECTED') {
        wrapper.className = 'hidden md:flex items-center px-3 py-1.5 bg-green-50 rounded-full';
        dot.className = 'w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse';
        text.className = 'text-xs text-green-700 font-medium';
      } else if (newStatus === 'DISCONNECTED') {
        wrapper.className = 'hidden md:flex items-center px-3 py-1.5 bg-red-50 rounded-full';
        dot.className = 'w-2 h-2 bg-red-500 rounded-full mr-2';
        text.className = 'text-xs text-red-700 font-medium';
      } else {
        wrapper.className = 'hidden md:flex items-center px-3 py-1.5 bg-yellow-50 rounded-full';
        dot.className = 'w-2 h-2 bg-yellow-500 rounded-full mr-2 animate-pulse';
        text.className = 'text-xs text-yellow-700 font-medium';
      }
    }
  };

  // Check session status first, then initialize if needed
  useEffect(() => {
    let mounted = true;

    const checkAndInitialize = async () => {
      if (hasInitializedRef.current || isInitializing) return;

      const token = localStorage.getItem('authToken');
      if (!token) {
        if (mounted) {
          setMessage('Please log in first');
          updateStatus('DISCONNECTED');
        }
        return;
      }

      try {
        setIsInitializing(true);

        const currentStatus = await sessionAPI.getSessionStatus();
        if (!mounted) return;

        // Already connected
        if (currentStatus.isConnected || currentStatus.status === 'READY' || currentStatus.status === 'AUTHENTICATED') {
          updateStatus('CONNECTED');
          setMessage('Connected to WhatsApp');
          hasInitializedRef.current = true;
          setIsInitializing(false);
          return;
        }

        // QR code available
        if (currentStatus.qr) {
          updateStatus('QR_READY');
          setMessage('Scan QR code to connect');
          setQRData({ qr: currentStatus.qr, sessionId: currentStatus.sessionId });
          setShowQR(true);
          onQRRequired?.({ qr: currentStatus.qr, sessionId: currentStatus.sessionId });
          hasInitializedRef.current = true;
          setIsInitializing(false);
          return;
        }

        // Already initializing on the server side
        if (currentStatus.status === 'INITIALIZING') {
          setMessage('Connecting to WhatsApp...');
          updateStatus('INITIALIZING');
          hasInitializedRef.current = true;
          setIsInitializing(false);
          return;
        }

        // QR_READY status with QR code
        if (currentStatus.status === 'QR_READY' && currentStatus.qr) {
          updateStatus('QR_READY');
          setMessage('Scan QR code to connect');
          setQRData({ qr: currentStatus.qr, sessionId: currentStatus.sessionId });
          setShowQR(true);
          onQRRequired?.({ qr: currentStatus.qr, sessionId: currentStatus.sessionId });
          hasInitializedRef.current = true;
          setIsInitializing(false);
          return;
        }

        // No active session — initialize
        if (!currentStatus.isConnected && currentStatus.status !== 'QR_READY' && currentStatus.status !== 'INITIALIZING') {
          setMessage('Starting WhatsApp session...');
          updateStatus('INITIALIZING');

          const result = await sessionAPI.initializeSession();
          if (!mounted) return;

          if (result.qr) {
            updateStatus('QR_READY');
            setMessage('Scan QR code to connect');
            setQRData({ qr: result.qr, sessionId: result.sessionId });
            setShowQR(true);
            onQRRequired?.({ qr: result.qr, sessionId: result.sessionId });
          } else if (result.status === 'READY') {
            updateStatus('CONNECTED');
            setMessage('Connected to WhatsApp');
          }
        }

        hasInitializedRef.current = true;
      } catch (error: any) {
        console.error('Failed to initialize session:', error);
        if (mounted) {
          updateStatus('DISCONNECTED');
          setMessage('Failed to initialize. Click reconnect.');
        }
      } finally {
        if (mounted) {
          setIsInitializing(false);
        }
      }
    };

    // Debounce initialization by 500ms
    const timeoutId = setTimeout(checkAndInitialize, 500);

    // Poll until initialized
    const pollInterval = setInterval(async () => {
      if (!mounted || hasInitializedRef.current) return;

      const token = localStorage.getItem('authToken');
      if (!token) return;

      try {
        const currentStatus = await sessionAPI.getSessionStatus();
        if (!mounted) return;

        if (currentStatus.isConnected || currentStatus.status === 'READY' || currentStatus.status === 'AUTHENTICATED') {
          updateStatus('CONNECTED');
          setMessage('Connected to WhatsApp');
          hasInitializedRef.current = true;
          clearInterval(pollInterval);
          return;
        }

        if (currentStatus.qr && currentStatus.status === 'QR_READY') {
          updateStatus('QR_READY');
          setMessage('Scan QR code to connect');
          setQRData({ qr: currentStatus.qr, sessionId: currentStatus.sessionId });
          setShowQR(true);
          onQRRequired?.({ qr: currentStatus.qr, sessionId: currentStatus.sessionId });
          hasInitializedRef.current = true;
          clearInterval(pollInterval);
        }
      } catch {
        // Silently retry on next poll
      }
    }, 3000);

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      clearInterval(pollInterval);
    };
  }, []);

  // Subscribe to real-time session status via Socket.IO
  useEffect(() => {
    const unsubscribe = subscribeToSessionStatus((data) => {
      const newStatus = (data.status || 'UNKNOWN') as SessionState;
      updateStatus(newStatus);

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
      hasInitializedRef.current = false;
      setMessage('Reconnecting to WhatsApp...');
      updateStatus('CONNECTING');

      const result = await sessionAPI.initializeSession();

      if (result.qr) {
        updateStatus('QR_READY');
        setMessage('Scan QR code to connect');
        setQRData({ qr: result.qr, sessionId: result.sessionId });
        setShowQR(true);
        onQRRequired?.({ qr: result.qr, sessionId: result.sessionId });
      } else if (result.status === 'READY') {
        updateStatus('CONNECTED');
        setMessage('Connected to WhatsApp');
      }

      hasInitializedRef.current = true;
    } catch (error) {
      console.error('Failed to reconnect:', error);
      setMessage('Failed to reconnect. Please try again.');
      updateStatus('DISCONNECTED');
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
