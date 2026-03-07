# CLAUDE.md - WhatsApp Mailbox

## Project Overview
Professional WhatsApp Business CRM and messaging platform. Manages WhatsApp conversations, contacts, automations, broadcasts, drip campaigns, invoicing, orders, tasks, and more — all from a single dashboard.

## Stack
- **Backend**: Express + TypeScript + Prisma ORM + MySQL + Redis (Bull queues) + Socket.IO + whatsapp-web.js
- **Frontend (SPA)**: React 18 + Vite + TypeScript + custom CSS (NO Tailwind)
- **Frontend (Static)**: HTML + Tailwind CDN + Font Awesome + vanilla JS
- **Database**: MySQL 8.0 (Docker container `whatsapp-mailbox-db`)
- **Process Manager**: PM2 (process name: `whatsapp`)

## Architecture
```
HTTP Request -> Route -> Middleware (auth/validation) -> Controller -> Service -> Repository -> Prisma -> MySQL
```

Path aliases: `@controllers`, `@services`, `@repositories`, `@routes`, `@middleware`, `@config`, `@utils`

## Directory Structure
```
src/
  config/          - Database, env, swagger config
  controllers/     - HTTP request handlers
  services/        - Business logic
  repositories/    - Data access layer (extends BaseRepository)
  routes/          - Express route definitions
  middleware/      - auth, error, rate-limit, validation
  utils/           - Helpers (contact-type, errors, logger, avatar)
  server.ts        - App setup, Socket.IO, WhatsApp message listeners

frontend/src/
  components/      - React components (App, Navbar, ChatPane, ConversationList, MessageBubble, MessageComposer, SessionStatus)
  api/             - Axios client (client.ts), API queries (queries.ts), Socket subscriptions (socket.ts)
  styles/          - CSS files (custom, NO Tailwind)
  utils/           - Contact type detection (contact-type.ts)

public/            - Vite build output + static HTML pages (contacts, tags, orders, invoices, etc.)
prisma/            - schema.prisma + migrations
```

## Commands

### Development
```bash
npm run dev                    # Start backend with hot reload (tsx watch + prisma studio)
cd frontend && npm run dev     # React dev server at localhost:5173 with API proxy
```

### Build & Deploy
```bash
# CRITICAL: Server runs node dist/server.js — must npm run build after TS changes!
npm run build                  # tsc && tsc-alias -> dist/
cd frontend && npm run build   # Vite builds React SPA -> ../public/

# Deploy to production server
ssh -i ~/.ssh/do root@152.42.216.141 'export NVM_DIR="/root/.nvm" && . "$NVM_DIR/nvm.sh" && cd /root/whatsapp-mailbox-node && git pull && npm run build && pm2 restart whatsapp'

# Frontend-only deploy: build locally first, then push + deploy
```

### Database
```bash
npm run db:migrate    # Run Prisma migrations (dev)
npm run db:deploy     # Deploy migrations (production)
npm run db:studio     # Open Prisma Studio GUI
npm run db:seed       # Seed default data
```

### Testing
```bash
npm test              # Jest with coverage
npm run type-check    # TypeScript type check (no emit)
npm run lint          # ESLint
```

## Server Access
- IP: `152.42.216.141`, user `root`, SSH key `~/.ssh/do`
- App dir: `/root/whatsapp-mailbox-node`
- PM2 process: `whatsapp`
- DB: MySQL `whatsapp_mailbox` at `127.0.0.1:3306`
- WhatsApp auth: `/data/wwebjs_auth/` (env `WWEBJS_AUTH_DIR`)

## API Conventions
- All routes prefixed with `/api/v1/`
- Auth: JWT Bearer token in `Authorization` header
- Response format: `{ success: boolean, data?: any, error?: string }`
- Validation: Zod schemas via `validateRequest()` middleware
- Errors: Custom `AppError` classes (`NotFoundError`, `ConflictError`, `ValidationError`)

## Key Patterns

### WhatsApp Sessions
- `disconnectSession()` - preserves auth files for auto-reconnect
- `destroySession()` - wipes auth files, requires new QR scan
- Session auth stored at `WWEBJS_AUTH_DIR` (default `/data/wwebjs_auth/`)

### Contact Types (chatId suffixes)
- `@c.us` = individual contact (can send messages)
- `@g.us` = group (can send messages, skip getNumberId)
- `@newsletter` = channel (read-only)
- `@broadcast` = broadcast list (read-only)

### Group Messaging
- Skip `getNumberId()` for `@g.us` chats — send directly via chatId
- Channels and broadcasts are blocked with notice
- For incoming group messages: use `client.getChatById(chatId).name` for group name (NOT `message.getContact()` which returns the sender)

### Profile Pictures
- WhatsApp CDN URLs expire — download locally to `/uploads/avatars/`
- Use `downloadAvatar(chatId, cdnUrl)` from `src/utils/avatar.ts`
- Served by Express static: `app.use('/uploads', express.static(...))`

### Frontend Conventions
- Image lightbox: uses `ReactDOM.createPortal` (CSS transforms break `position:fixed`)
- Contact names: only update from actual WhatsApp data, never fallback to phone number
- Socket.IO events: `message:received`, `message:sent`, `message:status`, `reaction:updated`
- Auth: token from URL `?token=xxx` or localStorage `authToken`
- CRM styles split across: `contact-modal.css` (modal layout), `chat-pane.css` (cards, badges, overview)

## Git Preferences
- **Never** add `Co-Authored-By` lines to commits
- Node.js repo: `git@github.com:hamza-younas94/whatsapp-mailbox-node.git`
- PHP repo: `git@github.com:hamza-younas94/whatsapp-mailbox-php.git`
