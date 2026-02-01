# WhatsApp Web QR Code Integration Guide

## Overview

The mailbox now supports **TWO** methods for connecting to WhatsApp:

### 1. WhatsApp Business API (Recommended for Production)
- Official API access
- Requires Meta Business verification
- Best for businesses
- More stable and reliable
- Used via `/api/v1/messages` endpoints

### 2. WhatsApp Web QR Code (Personal Accounts)
- Scan QR code with your phone
- Works with personal WhatsApp accounts
- No verification needed
- Used via `/api/v1/whatsapp-web` endpoints

## Quick Start - WhatsApp Web

### 1. Initialize a Session

```bash
curl -X POST http://localhost:3000/api/v1/whatsapp-web/init \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

Response:
```json
{
  "success": true,
  "data": {
    "sessionId": "session_user123_uuid",
    "status": "INITIALIZING",
    "message": "Session initialized. Wait for QR code."
  }
}
```

### 2. Get QR Code

```bash
curl -X GET http://localhost:3000/api/v1/whatsapp-web/sessions/SESSION_ID/qr \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Response:
```json
{
  "success": true,
  "data": {
    "qrCode": "data:image/png;base64,iVBORw0KG...",
    "status": "QR_READY"
  }
}
```

### 3. Scan QR Code
1. Open the returned `qrCode` (base64 data URL) in your browser
2. Open WhatsApp on your phone
3. Go to **Settings** > **Linked Devices** > **Link a Device**
4. Scan the QR code

### 4. Wait for Authentication

Check status:
```bash
curl -X GET http://localhost:3000/api/v1/whatsapp-web/sessions/SESSION_ID/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Response when ready:
```json
{
  "success": true,
  "data": {
    "sessionId": "session_user123_uuid",
    "status": "READY",
    "phoneNumber": "1234567890"
  }
}
```

### 5. Send Messages

```bash
curl -X POST http://localhost:3000/api/v1/whatsapp-web/sessions/SESSION_ID/send \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "1234567890",
    "message": "Hello from WhatsApp Web!"
  }'
```

## API Endpoints

### Session Management

#### Initialize Session
```
POST /api/v1/whatsapp-web/init
```
Creates a new WhatsApp Web session.

#### List Sessions
```
GET /api/v1/whatsapp-web/sessions
```
Get all active sessions for current user.

#### Get QR Code
```
GET /api/v1/whatsapp-web/sessions/:sessionId/qr
```
Get QR code for scanning (base64 data URL).

#### Stream QR Code (Real-time)
```
GET /api/v1/whatsapp-web/sessions/:sessionId/qr/stream
```
Server-Sent Events (SSE) stream for real-time QR updates.

#### Get Session Status
```
GET /api/v1/whatsapp-web/sessions/:sessionId/status
```
Check if session is ready.

#### Restart Session
```
POST /api/v1/whatsapp-web/sessions/:sessionId/restart
```
Restart a disconnected session.

#### Logout Session
```
DELETE /api/v1/whatsapp-web/sessions/:sessionId
```
Logout and destroy session.

### Messaging

#### Send Text Message
```
POST /api/v1/whatsapp-web/sessions/:sessionId/send
Body: {
  "to": "1234567890",
  "message": "Hello!"
}
```

#### Send Media Message
```
POST /api/v1/whatsapp-web/sessions/:sessionId/send
Body: {
  "to": "1234567890",
  "message": "Check this out!",
  "mediaUrl": "https://example.com/image.jpg"
}
```

## Session States

| State | Description |
|-------|-------------|
| `INITIALIZING` | Session is being created |
| `QR_READY` | QR code is available for scanning |
| `AUTHENTICATED` | QR code scanned successfully |
| `READY` | Session is active and ready to send messages |
| `DISCONNECTED` | Session lost connection |

## Real-time QR Code with SSE

For a better user experience, use Server-Sent Events to get real-time updates:

```javascript
const eventSource = new EventSource(
  `http://localhost:3000/api/v1/whatsapp-web/sessions/${sessionId}/qr/stream`,
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);

eventSource.addEventListener('qr', (event) => {
  const data = JSON.parse(event.data);
  // Display QR code: data.qrCode
  document.getElementById('qr-image').src = data.qrCode;
});

eventSource.addEventListener('ready', (event) => {
  const data = JSON.parse(event.data);
  console.log('WhatsApp connected!', data.phoneNumber);
  eventSource.close();
});

eventSource.addEventListener('disconnected', (event) => {
  console.log('WhatsApp disconnected');
  eventSource.close();
});
```

## Frontend Example (React)

```jsx
import { useState, useEffect } from 'react';

function WhatsAppWebConnect() {
  const [sessionId, setSessionId] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [status, setStatus] = useState('IDLE');

  const initSession = async () => {
    const response = await fetch('/api/v1/whatsapp-web/init', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    const data = await response.json();
    setSessionId(data.data.sessionId);
    setStatus('INITIALIZING');
    
    // Start polling for QR code
    pollQRCode(data.data.sessionId);
  };

  const pollQRCode = async (sid) => {
    const interval = setInterval(async () => {
      const response = await fetch(`/api/v1/whatsapp-web/sessions/${sid}/qr`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      
      if (data.data.qrCode) {
        setQrCode(data.data.qrCode);
        setStatus('QR_READY');
      }
      
      if (data.data.status === 'READY') {
        setStatus('READY');
        clearInterval(interval);
      }
    }, 2000);
  };

  return (
    <div>
      {status === 'IDLE' && (
        <button onClick={initSession}>Connect WhatsApp</button>
      )}
      
      {status === 'INITIALIZING' && <p>Initializing...</p>}
      
      {status === 'QR_READY' && qrCode && (
        <div>
          <h3>Scan this QR code with WhatsApp</h3>
          <img src={qrCode} alt="WhatsApp QR Code" />
        </div>
      )}
      
      {status === 'READY' && (
        <div>✅ WhatsApp Connected!</div>
      )}
    </div>
  );
}
```

## Docker Setup

The Docker setup includes Chromium for WhatsApp Web:

```dockerfile
# Chromium dependencies already included in Dockerfile
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    ...
```

Sessions are persisted in `.wwebjs_auth/` directory (mounted as volume).

## Session Persistence

Sessions are automatically saved and restored:
- Session data stored in `.wwebjs_auth/`
- On restart, sessions reconnect automatically
- No need to scan QR code again after restart

## Multiple Sessions

You can have multiple WhatsApp Web sessions:
- One per user
- Or multiple per user (e.g., different phone numbers)
- Each session has unique ID

```bash
# User can have multiple sessions
GET /api/v1/whatsapp-web/sessions
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "sessionId": "session_user123_uuid1",
      "status": "READY",
      "phoneNumber": "1234567890"
    },
    {
      "sessionId": "session_user123_uuid2",
      "status": "READY",
      "phoneNumber": "0987654321"
    }
  ]
}
```

## Comparison: API vs Web

| Feature | WhatsApp Business API | WhatsApp Web |
|---------|---------------------|--------------|
| Setup | Requires verification | Just scan QR |
| Account Type | Business accounts | Personal/Business |
| Stability | Very stable | Can disconnect |
| Rate Limits | Higher limits | Lower limits |
| Cost | May have costs | Free |
| Multiple Devices | Limited | Yes (WhatsApp feature) |
| Best For | Production | Development/Personal |

## Troubleshooting

### QR Code Not Appearing
- Wait 5-10 seconds after initialization
- Check session status endpoint
- Restart session if stuck

### Session Disconnected
- Happens if phone goes offline
- Restart session to get new QR code
- Or wait for automatic reconnection

### Chromium Issues in Docker
- Ensure all dependencies installed
- Check Docker logs: `docker-compose logs app`
- May need to increase Docker memory

### Multiple Sessions Interfering
- Each session needs unique ID
- Sessions are isolated
- Check active sessions list

## Security Considerations

1. **Session Storage**: Sessions stored locally, protect filesystem
2. **QR Code**: QR codes expire after 30-60 seconds
3. **Authentication**: All endpoints require JWT token
4. **Logout**: Always logout when done to free resources

## Production Recommendations

1. **Use Business API for production** (more reliable)
2. **WhatsApp Web for**:
   - Development/testing
   - Personal use
   - Small-scale operations
3. **Monitor sessions** - restart if disconnected
4. **Clean up old sessions** - logout when not needed
5. **Backup session data** - persist `.wwebjs_auth/` directory

## Next Steps

1. Connect WhatsApp Web using QR code
2. Test sending messages
3. Integrate with your frontend
4. Set up message webhooks (incoming messages)
5. Build chat interface

For production, consider upgrading to WhatsApp Business API!
