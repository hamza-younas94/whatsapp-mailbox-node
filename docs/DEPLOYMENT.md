# Deployment & Ops

Consolidated deploy/ops reference. Supersedes the old `DEPLOYMENT_*`, `DEPLOY_*`,
`SERVER_DEPLOYMENT`, `QUICK_DEPLOYMENT_GUIDE`, `DOCKER_SETUP`, and `DATABASE_MIGRATION_GUIDE`
docs.

## Production environment

| | |
|---|---|
| Host | DigitalOcean droplet `152.42.216.141`, user `root`, SSH key `~/.ssh/do` |
| App dir | `/root/whatsapp-mailbox-node` (Node runs via NVM) |
| Process manager | PM2, process name **`whatsapp`** (`node dist/server.js`) |
| Port | `3000` (fronted by Nginx + Certbot TLS) |
| Public URL | `https://whatshub.nexofydigital.com/` |
| Database | MySQL 8 `whatsapp_mailbox` at `127.0.0.1:3306` |
| WhatsApp session store | `/data/wwebjs_auth` (`WWEBJS_AUTH_DIR`) |

Prereqs on the box: Node ≥18, PM2 global (`npm i -g pm2`), MySQL running, a Chromium that
`whatsapp-web.js`/Puppeteer can drive (`--no-sandbox` args are set in code).

## Standard deploy

The repo ships `deploy.sh` (auto-detects its own directory) which runs the full sequence.
From the app dir on the server:

```bash
./deploy.sh
```

Steps it performs: `git pull` → `npm install` (backend) → `npm install` (frontend) →
apply SQL fixes if present → `npx prisma generate` → `cd frontend && npm run build`
(→ `../public/`) → `npm run build` (backend `tsc && tsc-alias` → `dist/`) → ensure
`uploads/media` exists → `pm2 restart whatsapp` (or first-time `pm2 start dist/server.js
--name whatsapp`) → `pm2 save`.

`quick-deploy.sh` is the fast path (backend build + frontend build + `pm2 restart whatsapp`),
skipping deps/migrations.

### One-liner from a laptop

```bash
ssh -i ~/.ssh/do root@152.42.216.141 \
  'export NVM_DIR=/root/.nvm && . "$NVM_DIR/nvm.sh" && \
   cd /root/whatsapp-mailbox-node && git pull && \
   npm run build && (cd frontend && npm run build) && pm2 restart whatsapp'
```

**Always build.** Production runs `dist/server.js`; a TS change without `npm run build`
ships nothing. Frontend build is separate from backend build — do both when the SPA changed.

### First-time PM2 setup

```bash
pm2 start dist/server.js --name whatsapp
pm2 save
pm2 startup    # enable boot persistence
```

## Database / migrations

- Canonical method is **Prisma Migrate**:
  - dev: `npx prisma migrate dev --name <name>`
  - prod: `npm run db:deploy` (`prisma migrate deploy`)
- Always run `npx prisma generate` after schema changes (deploy.sh does this).
- **MySQL CLI must use `-h 127.0.0.1`** on this server or it fails, e.g.
  `mysql -h 127.0.0.1 -u root whatsapp_mailbox`.
- Emergency raw-SQL fixes live in the repo (`safe_fix.sql`, `comprehensive_fix.sql`,
  `migrations/*.sql`) — apply via `mysql -h 127.0.0.1 … < file.sql`. These are stopgaps.
- Don'ts: no manual SQL without updating `schema.prisma`; no `prisma db push` in prod;
  never edit an already-committed migration. `prisma migrate reset` is destructive (dev only).

## Environment variables

See `AGENTS.md` for the full table. Required at boot (validated by Zod in
`src/config/env.ts`, app crashes if missing): `DATABASE_URL`, `JWT_SECRET` (≥32 chars,
`openssl rand -base64 32`), `APP_URL`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`,
`WEBHOOK_VERIFY_TOKEN`. Optional: `REDIS_URL`, `CORS_ORIGIN`, `PORT`, `LOG_LEVEL`,
`LOG_FORMAT`.

WhatsApp/ops vars read directly from `process.env` (not in the Zod schema):
- `WWEBJS_AUTH_DIR` — prod set to `/data/wwebjs_auth` (persistent session store).
- `WWEBJS_WEB_VERSION` — override the pinned WhatsApp Web build without a code deploy.
- `ALERT_WEBHOOK_URL` — Slack-compatible `{text}` alert when a session goes down.

After editing `.env`: `pm2 restart whatsapp --update-env`.

## WhatsApp session ops

- Sessions persist on disk (`WWEBJS_AUTH_DIR`) and auto-restore on restart; auto-reconnect
  retries indefinitely (every 15 min) once a session drops, and fires `ALERT_WEBHOOK_URL`.
- **Pinned WhatsApp Web version breakage**: if QR linking fails with "could not link device",
  the pinned build was likely removed upstream (404). Hotfix live by setting
  `WWEBJS_WEB_VERSION` to a current build from
  `github.com/wppconnect-team/wa-version/tree/main/html`, `pm2 restart whatsapp --update-env`,
  then bump the code default in `src/services/whatsapp-web.service.ts`. See CHANGELOG 2.1.0.
- Re-scan QR at `/qr-connect.html`. To force a fresh link, clear the auth dir contents and
  restart.

## Uploads

Media needs a writable dir or uploads fail with `EACCES … mkdir 'uploads/media'`:

```bash
mkdir -p uploads/media && chmod 755 uploads/media && chown -R $(whoami):$(whoami) uploads/
```

Per-file limit 50MB (multer). Avatars are downloaded locally to `/uploads/avatars/`
because WhatsApp CDN URLs expire.

## Verify / monitor / rollback

```bash
pm2 status whatsapp
pm2 logs whatsapp --lines 30      # expect "Database connected", "Server running on port 3000"
curl http://localhost:3000/health
```

Rollback: `git reset --hard <prev-commit>` (or `git revert HEAD`), rebuild backend +
frontend, `pm2 restart whatsapp`.

## Docker (alternative, not the prod path)

`docker compose build && docker compose up -d`; migrations via
`docker compose exec app npx prisma migrate deploy`. Services: app `:3000`, MySQL `:3306`,
Redis `:6379`. Remove the `3306:3306` port mapping in production.
</content>
