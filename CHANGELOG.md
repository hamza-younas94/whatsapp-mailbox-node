# Changelog

All notable changes to this project are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/); versioning is [SemVer](https://semver.org/).

## [2.2.1] - 2026-07-18

### Fixed
- **Session flapping / "portal not connected".** The droplet was OOM-killing Chromium (WhatsApp
  Web holding 800+ chats on a 1.9 GB box), so the session connected then dropped every ~10s.
  Added memory-reduction Chromium flags (disable extensions/background subsystems, cap V8 heap,
  `--disable-features=site-per-process`) plus a 4 GB swap file on the server. NOTE: durable fix is
  a larger droplet — 1.9 GB RAM is undersized for this workload. (`src/services/whatsapp-web.service.ts`)
- **QR code image broken in the SPA modal** (`ERR_INVALID_URL`). The `data:image/png;base64,`
  prefix was doubled — the backend already returns a full data URL. Now used as-is.
  (`frontend/src/components/SessionStatus.tsx`)
- **Groups & channels displayed as plain chats.** The chat header now shows a Group/Channel/Broadcast
  type label (icon + colored) under the name and a type icon in the avatar, instead of treating every
  conversation as an individual contact. (`frontend/src/components/ChatPane.tsx`)

## [2.2.0] - 2026-07-18

### Fixed
- **Reactions did not work end-to-end.** Three defects: (1) the backend `message_reaction`
  handler emitted the reaction event's *own* id instead of `reaction.msgId` (the reacted-to
  message), so incoming reactions never matched a stored message and were dropped; (2) the
  React `MessageBubble` seeded its reaction from props only at mount and never re-synced, so
  live `reaction:updated` socket events never rendered; (3) the reaction picker was clipped by
  the messages scroll container. Fixed the id, added a props→state re-sync effect, and portaled
  the picker to `<body>` with computed positioning (flips below when near the viewport top).
  (`src/services/whatsapp-web.service.ts`, `frontend/src/components/MessageBubble.tsx`)
- **New conversations didn't appear in the sidebar.** A first-ever message from a contact not
  already in the list was dropped by the socket handler; it now triggers a debounced reload.
  (`frontend/src/components/ConversationList.tsx`)

### Changed
- **Mobile responsiveness across all standalone pages.** Non-responsive `grid-cols-N` stat/filter
  rows now use responsive breakpoints, unwrapped data tables get horizontal scroll containers, and
  wide filter bars wrap on small screens. (24 grid + 3 table + 3 flex fixes across `public/*.html`)
- **Modernized UI.** Added a shared `public/css/app-theme.css` (Inter font, refined green-anchored
  palette, softer cards/shadows, modern buttons/inputs, smooth transitions), injected on every page
  via `public/js/navbar.js` plus direct links on the auth pages. Purely additive — no markup/logic
  changes, no responsive classes altered.

### Removed
- Dead Shop System route backups (`src/routes/shop-system.ts.bak`, `src/routes/shops.ts.bak`) —
  never mounted; feature is shelved.

### Docs
- Consolidated 53 chaotic root markdown files down to 4 (`README`, `CHANGELOG`, `CLAUDE`, `AGENTS`)
  plus `docs/{DEPLOYMENT,FEATURES,ARCHITECTURE}.md`; the 50 stale files were moved to `docs/archive/`.

## [2.1.0] - 2026-07-18

### Fixed
- **WhatsApp device linking ("could not link device").** The pinned WhatsApp Web build
  (`2.3000.1031490220-alpha`) was removed upstream and started returning HTTP 404, so the
  client could not load a valid WhatsApp Web version and every QR scan failed. Updated the
  pin to a current build (`2.3000.1043421788-alpha`) and made it overridable at runtime via
  the `WWEBJS_WEB_VERSION` env var so future breakage can be hotfixed without a code deploy.
  (`src/services/whatsapp-web.service.ts`)
- **Silent session death.** Auto-reconnect previously gave up permanently after 10 attempts
  ("manual reconnection required") with no alert — this caused message sync to be dead for
  ~5 weeks (2026-06-11 → 2026-07-18) with nobody notified. Reconnect now falls back to a slow
  indefinite retry (every 15 min) so the session self-heals, and fires a one-time alert when
  it crosses into that state. (`src/services/whatsapp-web.service.ts`)
- **Auto-tag crash on incoming messages.** An automation `ADD_TAG`/`REMOVE_TAG` action with no
  configured `tagId` passed `undefined` to Prisma, throwing on every inbound message. The action
  is now skipped with a warning, and `TagRepository.addToContact/removeFromContact` validate their
  inputs. `addToContact` is also now idempotent (upsert) so re-tagging an already-tagged contact
  no longer errors. (`src/services/automation.service.ts`, `src/repositories/tag.repository.ts`)

### Added
- `ALERT_WEBHOOK_URL` env var — when set, the app POSTs a Slack-compatible `{text}` alert
  whenever a WhatsApp session goes down and needs a manual QR re-scan. No-op if unset.
- `WWEBJS_WEB_VERSION` env var — override the pinned WhatsApp Web version without redeploying.

## [2.0.0] - prior
- Node.js / Express / TypeScript / Prisma WhatsApp Business mailbox (baseline before changelog was kept).
