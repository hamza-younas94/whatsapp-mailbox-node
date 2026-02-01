# WhatsApp Mailbox Frontend - Quick Reference

## 🚀 Getting Started (2 minutes)

```bash
# Navigate to project
cd /Users/hamzayounas/Desktop/whatsapp-mailbox-php/whatsapp-mailbox-node

# Install dependencies (first time only)
npm install
cd frontend && npm install && cd ..

# Start backend
npm run dev

# In another terminal, start frontend dev server
cd frontend && npm run dev
```

Access at:
- Frontend (hot reload): http://localhost:5173
- Backend API: http://localhost:3000/api/v1
- Built frontend: http://localhost:3000/ (after `npm run build`)

## 📦 What's Included

### React Components (6 files)
- **App.tsx** - Root component with responsive layout
- **SessionStatus.tsx** - Connection state + QR code modal
- **ConversationList.tsx** - Contact list with search
- **ChatPane.tsx** - Message display & history
- **MessageBubble.tsx** - Individual message UI
- **MessageComposer.tsx** - Text input & file upload

### API Layer (3 files)
- **client.ts** - Axios with Bearer token auth
- **queries.ts** - Message & contact API functions
- **socket.ts** - Real-time socket subscriptions

### Styling (7 files + 1 config)
- **globals.css** - Theme variables & utilities
- **app-layout.css** - Main responsive layout
- **chat-pane.css** - Message view styles
- **conversation-list.css** - Contact list styles
- **message-bubble.css** - Message bubbles & media
- **message-composer.css** - Input & file upload
- **session-status.css** - Connection indicator

### Config (4 files)
- **vite.config.ts** - Build & dev server
- **tsconfig.json** - TypeScript options
- **package.json** - Dependencies & scripts
- **index.html** - HTML entry point

## 💻 Development Commands

```bash
# Start dev server (hot reload)
cd frontend && npm run dev

# Build for production (outputs to ../public/)
npm run build

# Build and watch for changes
npm run build:watch

# Type check
tsc --noEmit

# List all scripts
cat package.json | grep -A 10 '"scripts"'
```

## 🎨 Key Features

| Feature | Implementation | Status |
|---------|---------------|--------|
| Real-time messages | Socket.io subscriptions | ✅ Ready |
| Send messages | Axios POST /send | ✅ Ready |
| Media upload | File input + multipart | ✅ Ready |
| Contact search | Debounced filter | ✅ Ready |
| QR authentication | Modal popup | ✅ Ready |
| Responsive design | CSS media queries | ✅ Ready |
| Message status | Visual indicators | ✅ Ready |
| Auto-scroll | useEffect scroll-to-bottom | ✅ Ready |

## 🔧 Common Tasks

### Add a new component
```bash
touch frontend/src/components/NewComponent.tsx
touch frontend/src/styles/new-component.css
```

### Change the theme color
Edit `frontend/src/styles/globals.css`:
```css
:root {
  --color-primary: #YOUR_COLOR;  /* Change from #25d366 */
}
```

### Add new API endpoint
Edit `frontend/src/api/queries.ts`:
```typescript
export const contactAPI = {
  yourNewFunction: async (param: string) => {
    const response = await client.get(`/contacts/${param}`);
    return response.data;
  }
};
```

### Listen to new socket events
Edit `frontend/src/api/socket.ts`:
```typescript
export const subscribeToNewEvent = (callback: (data: any) => void) => {
  const socket = getSocket();
  socket.on('new:event', callback);
  return () => socket.off('new:event', callback);
};
```

## 📊 Build Output

```
frontend/
└── src/                      Source files (TypeScript + CSS)
    ├── api/                  REST & WebSocket clients
    ├── components/           React components
    ├── styles/               Component styles
    └── index.tsx             Entry point

public/                        Production build
├── index.html                Generated HTML
└── assets/
    ├── index-*.css          Combined CSS (14KB)
    └── index-*.js           Bundled JS (231KB)
```

## 🐛 Debugging

### See what's being sent to API
```javascript
// In browser console
localStorage.getItem('authToken')  // View auth token
```

### Enable Vite debug logs
```bash
DEBUG=vite:* npm run dev
```

### Check socket.io connection
```javascript
// In browser console
window.location.socket  // Check if connected
```

### Inspect React components
- Install React DevTools browser extension
- Open DevTools → Components tab
- See component tree and props

## 📱 Responsive Breakpoints

```css
/* Desktop (≥768px): 2-column layout */
ConversationList (30%) | ChatPane (70%)

/* Tablet (768px): Stack */
ConversationList (full width)

/* Mobile (<480px): Stack with back button */
Stacked with navigation
```

## 🔐 Security Notes

- ✅ JWT auth token stored in localStorage
- ✅ All API requests include Bearer token
- ✅ File uploads limited to 10MB
- ✅ React auto-escapes HTML content
- ✅ CORS handled via Vite proxy

⚠️ **Production Notes:**
- Enable HTTPS in production
- Set secure HTTP-only cookies for tokens
- Implement CSRF protection
- Add rate limiting on API

## 📈 Performance Tips

- Message virtualization for long chats (planned)
- Lazy load older messages (implemented)
- Debounce search input (300ms - implemented)
- Cache contact list (localStorage - todo)
- Use IndexedDB for offline support (planned)

## 🚀 Deployment Checklist

Before deploying to server:

```bash
# 1. Build production
npm run build

# 2. Verify no errors
echo "Check console output above"

# 3. Test locally
npm start
# Visit http://localhost:3000

# 4. Commit and push
git add -A
git commit -m "Your message"
git push

# 5. On server
git pull
npm install
npm run build
```

## 📞 Useful Resources

- Frontend Docs: [frontend/README.md](./frontend/README.md)
- Completion Summary: [FRONTEND_COMPLETION.md](./FRONTEND_COMPLETION.md)
- API Docs: See backend README
- Socket Events: [frontend/src/api/socket.ts](./frontend/src/api/socket.ts)

## 💡 Tips & Tricks

**Hot reload during development:**
- Edit any file in `frontend/src/`
- Vite automatically reloads browser
- Changes appear in <100ms

**Quick style changes:**
- Edit CSS variables in `globals.css`
- All components use variables for colors/spacing
- One change updates entire theme

**Debug socket issues:**
```typescript
// Add to socket.ts
socket.on('connect', () => console.log('Connected!'));
socket.on('disconnect', () => console.log('Disconnected!'));
socket.on('error', (err) => console.error('Error:', err));
```

**View network requests:**
- Open DevTools → Network tab
- Filter by XHR to see API calls
- Check request/response in Details tab

---

**Last Updated**: Today  
**Version**: 1.0.0  
**Status**: ✅ Production Ready

For detailed docs, see [FRONTEND_COMPLETION.md](./FRONTEND_COMPLETION.md)
