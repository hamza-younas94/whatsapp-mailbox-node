---
name: whatshub-digitalocean
description: whatshub.nexofydigital.com — Node.js WhatsApp CRM app on DigitalOcean droplet (Singapore)
metadata: 
  node_type: memory
  type: project
  originSessionId: ef7b078c-9a6c-48af-890f-8f3f06c471b7
---

# whatshub.nexofydigital.com

## Server
- **Provider:** DigitalOcean (Singapore region)
- **IP:** `152.42.216.141`
- **Hostname:** `api-box`
- **OS:** Ubuntu 24.04 (6.8.0-101-generic)
- **SSH:** `ssh -i ~/.ssh/do root@152.42.216.141`
- **Key:** `~/.ssh/do`

## App
- **Domain:** `whatshub.nexofydigital.com`
- **Type:** Node.js app (PM2 process `whatsapp`)
- **Port:** 3000
- **Reverse proxy:** nginx -> port 3000

## nginx
- Config: `/etc/nginx/sites-available/default`
- SSL: Let's Encrypt (`/etc/letsencrypt/live/whatshub.nexofydigital.com/`)
- **Other site same box:** `hcb.colutionsinc.com` at `/etc/nginx/sites-enabled/hcb.colutionsinc.com`

## Docs consolidation (2026-07-18)
- Repo root had 53 stale/overlapping `*.md` files. Consolidated into a small canonical set in local clone `~/Downloads/whatsapp-mailbox-node`:
  - KEEP at root: `README.md`, `CHANGELOG.md`, `CLAUDE.md`, new `AGENTS.md` (AI-agent guide).
  - New under `docs/`: `DEPLOYMENT.md`, `FEATURES.md` (ground-truthed vs mounted routes), `ARCHITECTURE.md` (rewrote the old generic SOLID essay), and `_CONSOLIDATION_PLAN.md` (KEEP/ARCHIVE list of all 53 root md).
  - The other 50 root md files are to be `git mv`'d into `docs/archive/` (NOT deleted yet -- plan file lists them).
- Ground-truth facts baked into new docs: prod = PM2 process `whatsapp` on droplet, `deploy.sh` full flow, build both backend (`npm run build`) + frontend (`cd frontend && npm run build` -> `../public/`). WhatsApp Web version pin in `src/services/whatsapp-web.service.ts` must stay current (upstream deletes old builds -> "could not link device"); overridable via `WWEBJS_WEB_VERSION`. Session auth at `WWEBJS_AUTH_DIR=/data/wwebjs_auth`. `ALERT_WEBHOOK_URL` = Slack-style session-down alert. Shop System is SHELVED (`*.ts.bak`, not mounted). Two frontends: static HTML admin pages in `public/` + React/Vite SPA in `frontend/` (builds into `public/`), both over one Express backend.

## Mobile-responsive pass on static admin pages (2026-07-18)
- The static Tailwind-CDN admin pages in `public/*.html` were not mobile-responsive (bare `grid-cols-N` overflowed on phones; some modal tables unwrapped). Applied conservative mechanical fixes (no redesign/logic/color changes):
  - **Grids:** 24 bare `grid-cols-2..6` (no responsive prefix) -> responsive (`grid-cols-1 sm:grid-cols-2 ...` etc.) across 14 files: appointments, broadcasts, contacts, drip-campaigns, invoices, message-templates, orders, products, qr-connect, quick-replies, segments, service-tickets, subscriptions, tags. Elements already carrying `md:/sm:/lg:grid-cols` were left untouched.
  - **Tables:** most list tables were already inside `overflow-x-auto`. Wrapped 3 that weren't: `settings.html` config table (+`min-w-[640px]`), `invoices.html` line-items modal table (+`min-w-[560px]`), `contacts.html` import-preview table (added `overflow-x-auto` to its existing scroll wrapper).
  - **Flex toolbars:** added `flex-wrap gap-2` (replacing `space-x-4`) to the search+select control bars in `automation.html` & `drip-campaigns.html`, and the match-logic selector in `segments.html`.
- Not touched: React SPA (`frontend/`), `public/index.html`, login/register/forgot/reset pages, navbar grids (responsive already, injected via `public/js/navbar.js`). Tag balance verified on all structurally-edited files.

## Modern visual refresh -- shared theme layer (2026-07-18)
- Added ONE stylesheet `public/css/app-theme.css` as a conservative, low-risk design layer over the existing Tailwind-CDN markup. No HTML content restructuring, no JS/logic changes, responsive classes untouched.
- What it does: `@import` Inter (googleapis) + sets it as body font; CSS vars palette anchored on WhatsApp green (`#25D366`/green-600 `#16a34a`); soft page bg `#f8fafc` (via `body{background-color}` -- LOW specificity so Tailwind bg utilities like login gradient / `bg-gray-50` still win); softer shadow + larger radius on `.bg-white.rounded-lg/xl/2xl/md` (compound (0,2,0) so it upgrades existing cards); gradient + hover-lift + focus ring on **button/a/input** `.bg-green-600/.bg-green-500` only (scoped so status dots/badges/logo spans are untouched); baseline border/radius/focus-ring on `input(:not checkbox/radio/...)/select/textarea` (low specificity -- existing field classes win); subtler `thead th`; thin modern scrollbars.
- **Injection:** IIFE at top of `public/js/navbar.js` injects `<link rel="stylesheet" href="/css/app-theme.css">` into `<head>` (idempotent) -> covers all 26 navbar pages + `index.html` (SPA) with zero HTML edits. The 7 pages that don't load navbar.js got the `<link>` added directly: login, register, forgot-password, reset-password, qr-connect, api-test, qr-test. All 33 pages verified covered.
- CSP OK: every page with a CSP meta already allows `fonts.googleapis.com` (style-src) + `fonts.gstatic.com` (font-src) + `'self'` for the local css; pages without CSP are unrestricted.
- Design intent: bump the version + CHANGELOG on next release per user pref (feedback-version-and-notes).

## Known Issue (2026-04-22)
- nginx crashed -- `hcb.colutionsinc.com` config refs `api.base44.com` upstream, DNS fails at nginx start
- Error: `host not found in upstream "api.base44.com"`
- Node app still on port 3000 but nginx down -> Cloudflare 521
- Fix: disable `hcb.colutionsinc.com` from sites-enabled OR add resolver to nginx config

## Frontend UI modernization (2026-07-18)
- Mailbox chat SPA (`frontend/src/`, React+TS+Vite, built to `public/assets/`, `npm run build`). No node_modules by default -- `npm install` first (~99 pkgs, fast).
- **WhatsApp-Web restyle** via CSS design tokens in `globals.css` (Inter font @import from Google Fonts; palette vars `--wa-green #00a884`, `--wa-green-dark #008069`, `--wa-header-bg #f0f2f5`, `--wa-chat-bg #efeae2`, `--wa-bubble-out #d9fdd3`, `--wa-bubble-in #fff`, `--wa-badge #25d366`; thin scrollbars).
- Edited: `globals.css`, `app-layout.css`, `conversation-list-enhanced.css` (the ACTIVE list CSS -- `conversation-list.css` + `message-bubble.css` are dead/unused, not imported), `chat-pane.css`, `message-bubble-enhanced.css`, `message-composer.css`, `navbar.css`.
- Bubbles: own=green `#d9fdd3` dark text + right tail (::before), incoming=white + left tail; status ticks read blue `#53bdeb`; composer bg gray, white pill input, green send/mic circles, gray attach.
- **Groups/channels fix**: `ConversationList.tsx` + `ChatPane.tsx` header now render a `.conv-type-pill` (icon + label, styled in conversation-list-enhanced.css) for group/channel/broadcast so raw-number-named groups are clearly badged; avatar placeholder already uses type emoji from `avatarIcons` map. Contacts unchanged. Type logic from `utils/contact-type.ts` (`@g.us`=group, `@newsletter`=channel, `@broadcast`=broadcast).
- Build verified clean (128 modules). Pre-existing warning about `/js/navbar.js` non-module is unrelated.
