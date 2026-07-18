# Architecture

Brief map of how the system fits together. For deploy specifics see `docs/DEPLOYMENT.md`;
for agent-oriented gotchas see `AGENTS.md`.

## Request flow

```
Browser ──HTTP──▶ Express (src/server.ts)
                    │
                    ├─ Middleware:  auth (JWT) → Zod validation → rate limit → activity log
                    ▼
                 Route  (src/routes/*.ts, all under /api/v1)
                    ▼
                 Controller        (HTTP in/out)
                    ▼
                 Service           (business logic, throws AppError)
                    ▼
                 Repository        (extends BaseRepository)
                    ▼
                 Prisma Client ──▶ MySQL 8
```

- Layering is strict: `Route → Controller → Service → Repository → Prisma`. Services own
  business rules and throw typed errors (`NotFoundError`, `ConflictError`, `ValidationError`);
  controllers/middleware translate those to HTTP. Dependencies are passed via constructors
  (DI), not global singletons.
- Responses use `{ success, data?, error? }`. Path aliases (`@services`, `@repositories`, …)
  are resolved at build time by `tsc-alias`.
- Env is validated once at boot by Zod (`src/config/env.ts`); missing required vars crash the
  process.

## Hybrid frontend split

Two independent UIs are served by the same Express app out of `public/`:

1. **Static HTML admin (primary CRM dashboard)** — one standalone page per module in
   `public/` (`contacts.html`, `invoices.html`, `broadcasts.html`, `dashboard.html`,
   `qr-connect.html`, …), built with Tailwind CDN + Font Awesome + vanilla JS. Each page calls
   the REST API directly with a JWT.
2. **React SPA (chat/mailbox view)** — `frontend/` (React 18 + Vite + TypeScript, custom CSS,
   no Tailwind). `vite build` emits into `../public/`, so the SPA's bundle sits alongside the
   HTML pages and shares the same backend API + Socket.IO server.

They are separate apps over one backend, not a single router. Real-time updates flow over
Socket.IO (`message:received`, `message:sent`, `message:status`, `reaction:updated`,
`session:status`).

## WhatsApp session lifecycle

WhatsApp connectivity is `whatsapp-web.js` (Puppeteer driving headless Chromium), managed by
`src/services/whatsapp-web.service.ts`:

1. **Init** — `initializeSession(userId, sessionId)` creates a `Client` with `LocalAuth`
   (`dataPath = WWEBJS_AUTH_DIR`, prod `/data/wwebjs_auth`) and a **pinned `webVersion`** whose
   HTML is fetched from the `wppconnect-team/wa-version` repo.
2. **Link** — client emits a QR; user scans it at `/qr-connect.html`. On `ready` the session
   goes live and existing chats are synced into the DB (`syncAllChats`).
3. **Run** — inbound messages are persisted via repositories and pushed to clients over
   Socket.IO; auto-reply and automations may fire.
4. **Drop / heal** — auth persists on disk and auto-restores on restart. If a session drops,
   auto-reconnect retries indefinitely (every 15 min) and fires an `ALERT_WEBHOOK_URL` alert.
   `disconnectSession()` preserves auth files; `destroySession()` wipes them (forces re-scan).

Failure mode to know: if the pinned WhatsApp Web build is removed upstream, its HTML 404s and
device linking fails ("could not link device"). Hotfix via `WWEBJS_WEB_VERSION` env, then bump
the code default. (See CHANGELOG 2.1.0.)

## Data layer (Prisma)

- Single MySQL 8 database `whatsapp_mailbox`; schema in `prisma/schema.prisma`, migrations in
  `prisma/migrations/`.
- Data access goes through repositories extending a shared `BaseRepository` (common CRUD),
  with model-specific queries added per repository. No raw SQL in services.
- Redis (Bull) backs queues/scheduling for broadcasts, drip campaigns, and scheduled messages.

## Background work

Broadcasts, drip-campaign steps, and scheduled messages are time-driven jobs (Redis/Bull +
schedulers) rather than request-synchronous. The auto-reply and automation engines run
inline off inbound-message events.
</content>
