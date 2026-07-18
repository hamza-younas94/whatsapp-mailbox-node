# AGENTS.md — WhatsApp Mailbox (Node)

Guide for AI coding agents working in this repo. Keep it factual; when docs and code
disagree, trust the code. `CLAUDE.md` holds the same operational detail — read both.

## What this is

A WhatsApp Business CRM / mailbox. It links a real WhatsApp account over
**whatsapp-web.js** (Puppeteer-driven WhatsApp Web), stores conversations/contacts/CRM
data in MySQL via Prisma, and exposes a REST + Socket.IO API consumed by two frontends.

## Stack

- **Backend**: Node ≥18, Express, TypeScript, Prisma ORM → MySQL 8, Redis (Bull queues),
  Socket.IO, `whatsapp-web.js`. Entry point `src/server.ts`, compiled to `dist/server.js`.
- **Frontend A (SPA)**: React 18 + Vite + TypeScript, custom CSS (NO Tailwind). Lives in
  `frontend/`. `vite build` outputs into `../public/` (served by Express).
- **Frontend B (static)**: standalone HTML pages in `public/` (Tailwind CDN + Font Awesome
  + vanilla JS) — one page per module (`contacts.html`, `invoices.html`, `broadcasts.html`,
  `dashboard.html`, `qr-connect.html`, …). These are the primary CRM admin UI.
- **Process manager**: PM2, process name **`whatsapp`**, on a DigitalOcean droplet.

### How the two frontends relate

Both are served by the same Express app from `public/`. The static HTML pages are the
main multi-module admin dashboard (each `*.html` calls the REST API directly with a JWT).
The React SPA is the WhatsApp-style chat/mailbox view; its Vite build lands in `public/`
alongside the HTML pages and shares the same backend API + Socket.IO server. They are
independent UIs over one backend — not a single-router app.

## Build & run

```bash
# Backend (repo root)
npm install
npm run dev            # tsx watch src/server.ts (+ prisma studio) — http://localhost:3000
npm run build          # tsc && tsc-alias -> dist/   (REQUIRED before start; prod runs dist/)
npm start              # node dist/server.js

# Frontend SPA
cd frontend && npm install
npm run dev            # Vite dev server :5173, proxies API to :3000
npm run build          # -> ../public/

# DB / quality
npm run db:deploy      # prisma migrate deploy (prod)
npm run db:migrate     # prisma migrate dev
npm run db:studio
npm run type-check     # tsc --noEmit
npm run lint
npm test               # jest
```

TypeScript path aliases (resolved by tsc-alias): `@controllers @services @repositories
@routes @middleware @config @utils`.

## Deploy flow (prod)

PM2 on the DigitalOcean droplet (`152.42.216.141`, user `root`, key `~/.ssh/do`), app at
`/root/whatsapp-mailbox-node`. Standard deploy = pull, build backend + frontend, restart PM2:

```bash
ssh -i ~/.ssh/do root@152.42.216.141 \
  'export NVM_DIR=/root/.nvm && . "$NVM_DIR/nvm.sh" && \
   cd /root/whatsapp-mailbox-node && git pull && \
   npm run build && (cd frontend && npm run build) && pm2 restart whatsapp'
```

`deploy.sh` in the repo does the full sequence (deps → migrations → prisma generate →
frontend build → backend build → uploads dir → `pm2 restart whatsapp`). See
`docs/DEPLOYMENT.md`.

## Key env vars

Validated by Zod in `src/config/env.ts` (missing required vars crash on boot). Some
WhatsApp/ops vars are read directly from `process.env`, not the schema.

| Var | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | MySQL connection (`mysql://…/whatsapp_mailbox`) |
| `JWT_SECRET` | yes (≥32 chars) | JWT signing |
| `APP_URL` | yes | Public base URL |
| `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WEBHOOK_VERIFY_TOKEN` | yes (schema) | Meta Cloud API fields (schema requires them even though wa-web is the live path) |
| `REDIS_URL` | no (default `redis://localhost:6379`) | queues/cache |
| `CORS_ORIGIN` | no (default `*`) | CORS allowlist |
| `PORT` | no (default `3000`) | HTTP port |
| `LOG_LEVEL` / `LOG_FORMAT` | no | Pino logging |
| `WWEBJS_AUTH_DIR` | prod: **`/data/wwebjs_auth`** | persistent WhatsApp session store (LocalAuth `dataPath`) |
| `WWEBJS_WEB_VERSION` | no | override pinned WhatsApp Web build without a code deploy |
| `ALERT_WEBHOOK_URL` | no | Slack-compatible `{text}` webhook; alerts on session-down (no-op if unset) |

## Gotchas (read before touching WhatsApp code)

- **Pinned WhatsApp Web version must stay current.** `src/services/whatsapp-web.service.ts`
  pins `webVersion` (currently `2.3000.1043421788-alpha`) and loads its HTML from the
  `wppconnect-team/wa-version` repo. Upstream periodically **deletes** old builds; when the
  pinned HTML 404s, device linking fails with "could not link device" and every QR scan
  breaks. Fix by bumping the pin — hotfix live via `WWEBJS_WEB_VERSION` env, then update the
  code default. This exact failure already caused a ~5-week outage (see CHANGELOG 2.1.0).
- **Session auth persistence.** LocalAuth writes to `WWEBJS_AUTH_DIR` (prod `/data/wwebjs_auth`).
  Wipe it and users must re-scan the QR at `/qr-connect.html`. `disconnectSession()` preserves
  auth files (auto-reconnect); `destroySession()` wipes them.
- **Auto-reconnect** falls back to slow indefinite retry (every 15 min) rather than giving up,
  and fires a one-time `ALERT_WEBHOOK_URL` alert when a session goes down.
- **Contact/chat types by chatId suffix**: `@c.us` individual, `@g.us` group (send directly,
  skip `getNumberId()`), `@newsletter`/`@broadcast` read-only. For group *names* use
  `client.getChatById(chatId).name`, not `message.getContact()` (that's the sender).
- **Profile pictures**: WhatsApp CDN URLs expire — download locally via `downloadAvatar()`
  (`src/utils/avatar.ts`), served from `/uploads/avatars/`.
- **Prod runs `dist/`**: a TS change with no `npm run build` ships nothing. Always build.
- Shop/e-commerce routes exist as `*.ts.bak` (`src/routes/shop-system.ts.bak`, `shops.ts.bak`,
  `src/services/shop.service.ts.bak`) — shelved, not wired into `server.ts`. Don't assume live.

## Conventions

- Layering: `Route → Middleware (auth/validate) → Controller → Service → Repository → Prisma`.
  Services throw typed `AppError`s (`NotFoundError`, `ConflictError`, `ValidationError`);
  controllers/middleware translate to HTTP. DI via constructors, no global singletons in logic.
- All routes under `/api/v1/`. Auth = JWT Bearer. Response shape `{ success, data?, error? }`.
- Validation via Zod + `validateRequest()` middleware.
- Socket.IO events: `message:received`, `message:sent`, `message:status`, `reaction:updated`,
  `session:status`.
- Git: repo `git@github.com:hamza-younas94/whatsapp-mailbox-node.git`. Never add
  `Co-Authored-By` / "Generated with" footers to commits or PRs.
</content>
</invoke>
