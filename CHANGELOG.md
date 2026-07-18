# Changelog

All notable changes to this project are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/); versioning is [SemVer](https://semver.org/).

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
