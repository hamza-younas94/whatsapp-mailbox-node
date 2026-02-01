# WhatsApp Mailbox Frontend

A modern React + Vite SPA frontend for the WhatsApp Mailbox application, providing a professional WhatsApp-like interface for managing conversations and messages.

## Features

- **Real-time Message Sync**: Socket.io integration for live message updates
- **Media Support**: Send and receive images, videos, audio files, and documents
- **Responsive Design**: Desktop 2-column layout, mobile-optimized stacking
- **Message Status Tracking**: Visual indicators (pending, sent, delivered, read, failed)
- **Contact Search**: Quick search and filtering of conversations
- **Session Management**: QR code scanning for WhatsApp authentication
- **Typing Indicators**: See when contacts are typing
- **Auto-scroll**: Messages automatically scroll to latest on new messages

## Technology Stack

- **React 18**: Modern component-based UI
- **Vite**: Fast, bundler for development and production builds
- **TypeScript**: Type-safe development
- **Axios**: HTTP client with Bearer token authentication
- **Socket.io Client**: Real-time WebSocket communication
- **CSS Variables**: Theme-based styling with WhatsApp green color scheme

## Project Structure

```
frontend/
├── src/
│   ├── api/
│   │   ├── client.ts          # Axios instance with auth
│   │   ├── queries.ts          # API functions (messages, contacts)
│   │   └── socket.ts           # Socket.io subscriptions
│   ├── components/
│   │   ├── App.tsx             # Root component
│   │   ├── SessionStatus.tsx    # Connection state & QR modal
│   │   ├── ConversationList.tsx # Contact list with search
│   │   ├── ChatPane.tsx         # Message display & history
│   │   ├── MessageBubble.tsx    # Individual message UI
│   │   └── MessageComposer.tsx  # Message input & file upload
│   ├── styles/
│   │   ├── globals.css          # Theme variables & utilities
│   │   ├── app-layout.css       # Main layout
│   │   ├── chat-pane.css        # Chat view styles
│   │   ├── conversation-list.css # List styles
│   │   ├── message-bubble.css   # Message styles
│   │   ├── message-composer.css # Composer styles
│   │   └── session-status.css   # Status bar styles
│   └── index.tsx                # React entry point
├── index.html                    # HTML template
├── vite.config.ts               # Vite configuration
├── tsconfig.json                # TypeScript configuration
└── package.json                 # Dependencies

public/                           # Build output (auto-generated)
├── index.html
└── assets/                       # CSS & JS bundles
```

## Installation

1. Install dependencies:

```bash
cd frontend
npm install
```

## Development

Run the development server with hot reload:

```bash
npm run dev
```

The app will be available at `http://localhost:5173` by default. Vite proxies `/api` and `/socket.io` to the backend server (localhost:3000).

## Build

Create an optimized production build:

```bash
npm run build
```

This outputs to `../public/` which is served by the Express backend.

## API Integration

The frontend connects to the backend via:

- **REST API**: All HTTP requests go to `/api/v1/*` with Bearer token auth
- **WebSockets**: Socket.io connects to `/socket.io` for real-time updates

### Authentication

The API client automatically injects the Bearer token from localStorage:

```typescript
const token = localStorage.getItem('authToken');
// Passed in all requests as: Authorization: Bearer {token}
```

### Key Endpoints

- `GET /messages` - List conversations
- `GET /messages/contact/:contactId` - Get messages for contact
- `POST /messages/send` - Send message (text or media)
- `PUT /messages/:id/read` - Mark as read
- `GET /contacts` - Search contacts
- `GET /contacts/:id` - Get contact details

### Socket Events

- `message:received` - New message from contact
- `message:sent` - Your sent message confirmed
- `message:status` - Message status update (sent/delivered/read)
- `chat:typing` - Typing indicator
- `session:status` - WhatsApp session state (connected/qr/disconnected)

## Components

### SessionStatus
Displays WhatsApp session state (online/connecting/QR needed). Shows QR code modal for authentication if needed.

### ConversationList
Lists all contacts with:
- Search/filter by name or phone
- Unread message count badge
- Avatar (contact initials)
- Last message preview
- Selection highlighting

### ChatPane
Shows all messages in selected conversation:
- Message bubbles with own/other styling
- Media previews (images, videos, audio, documents)
- Status indicators (pending, sent, delivered, read, failed)
- Timestamps
- Auto-scroll to latest message
- Load older messages on scroll

### MessageBubble
Displays individual message with:
- Text content (truncated if long)
- Media preview with click-to-download
- Timestamp and status icon
- Smooth slide-in animation
- Own/other alignment and colors

### MessageComposer
Input area for new messages:
- Textarea with Enter-to-send (Shift+Enter for newline)
- File attachment button (images, videos, audio, PDF)
- Media preview with clear button
- Send button (disabled if no content)
- 10MB max file size with validation

## Styling

The app uses CSS variables for theming in `globals.css`:

```css
/* Main theme colors */
--color-primary: #25d366         /* WhatsApp green */
--color-primary-dark: #128c7e
--color-primary-light: #dcf8c6

/* Status colors */
--color-sent: #0084ff
--color-delivered: #128c7e
--color-read: #128c7e
--color-failed: #ff4458
--color-pending: #f0ad4e

/* UI colors */
--color-bg: #ffffff
--color-border: #e5e5e5
--color-text: #111827
--color-text-light: #999999
```

## Responsive Design

### Desktop (≥768px)
- 2-column layout: ConversationList (30%) + ChatPane (70%)
- Both panels always visible
- Optimized for large screens

### Mobile (<768px)
- Stacked single-column layout
- Show list OR chat, not both
- Back button to switch between views
- Full-width components
- Touch-friendly button sizes

## Error Handling

- API errors display toast notifications
- Failed messages show error status
- Reconnect button appears if disconnected
- Network errors gracefully degrade

## Future Enhancements

- [ ] Voice messages (record and send)
- [ ] Video calls integration
- [ ] Message reactions
- [ ] Contact blocking
- [ ] Message search
- [ ] Forwarding messages
- [ ] Message editing and deletion
- [ ] Starred/pinned messages
- [ ] Group chat support
- [ ] Dark mode toggle

## Performance

- Lazy loading of older messages
- Message virtualization for long chats
- Debounced search
- Optimized re-renders with React.memo
- CSS animations use GPU acceleration

## Browser Support

- Chrome/Edge: Latest
- Firefox: Latest
- Safari: Latest 2 versions
- Mobile browsers (iOS Safari, Chrome Mobile)

## Troubleshooting

### Messages not loading
1. Check backend API is running on port 3000
2. Verify auth token in localStorage
3. Check browser console for API errors

### Real-time updates not working
1. Ensure socket.io connection is established
2. Check WebSocket URL in network tab
3. Verify backend is emitting socket events

### Build issues
1. Clear node_modules: `rm -rf node_modules && npm install`
2. Clear Vite cache: `rm -rf .vite`
3. Check Node.js version (requires 16+)

## Development Tips

- Use React DevTools for component inspection
- Check Network tab for API requests
- Use Console tab for socket event debugging
- TypeScript provides autocomplete for API queries
- CSS variables enable easy theme customization

---

For backend setup, see the main [README.md](../README.md)
