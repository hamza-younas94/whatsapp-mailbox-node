# WhatsApp Bridge (whatsmeow)

A small, standalone **Go** service that talks to WhatsApp using the native multi-device
protocol via [whatsmeow](https://github.com/tulir/whatsmeow) — **no browser, no Puppeteer**.
It replaces the fragile `whatsapp-web.js` engine while the existing Node app keeps all of its
UI, CRM, and database logic.

```
[ Go bridge: whatsmeow ]  ⇄ WebSocket (events) + HTTP (commands) ⇄  [ Node app ]
   • connects to WhatsApp                                               • UI / CRM / DB
   • QR pairing, auto-reconnect                                         • unchanged
   • native media download/upload                                      • swaps the connector
```

## Why
Every recurring failure in the old stack came from driving a headless Chrome:
"could not link device" (removed web version), Chromium OOM / `TargetCloseError`, media
download `"r"` errors, `LOGOUT` drops, ~700 MB RAM. whatsmeow speaks the protocol directly,
so those whole classes of problems disappear. It uses ~30–80 MB and runs comfortably on the
current 1.9 GB droplet.

## Build & run

```bash
cd bridge
cp .env.example .env        # edit as needed
go mod tidy
go build -o whatsapp-bridge .
set -a; . ./.env; set +a
./whatsapp-bridge
```

On first run it has no session, so it emits a `qr` event (and `/qr` returns the code).
Scan it once from the phone (Linked Devices → Link a device). The session persists in the
SQLite store, so restarts reconnect automatically **without** a re-scan.

Run it under pm2/systemd next to the Node app, e.g.:
```bash
pm2 start ./whatsapp-bridge --name wa-bridge
```

## Events (bridge → Node, over WebSocket `/ws`)

Each frame is a JSON object with a `type`:

| type | payload |
|---|---|
| `qr` | `{ "type":"qr", "code":"<string to render as QR>" }` |
| `connected` | connected to WhatsApp |
| `disconnected` | transient drop (whatsmeow auto-reconnects) |
| `logged_out` | device unlinked — needs a new QR |
| `pair_success` | `{ "jid":"..." }` after a successful scan |
| `message` | `{ "data": MessageData }` (see below) |
| `reaction` | `{ "data": { messageId, chatJid, senderJid, emoji, fromMe } }` |
| `receipt` | `{ "data": { chatJid, senderJid, messageIds, kind:"read" } }` |

`MessageData`:
```jsonc
{
  "id": "3EB0...", "chatJid": "123@g.us", "senderJid": "92300...@s.whatsapp.net",
  "senderName": "Ali",           // WhatsApp push name — "who sent what" in groups
  "fromMe": false, "timestamp": 1752840000,
  "type": "IMAGE",               // TEXT|IMAGE|VIDEO|AUDIO|PTT|DOCUMENT|STICKER|LOCATION|CONTACT
  "text": "caption or body",
  "mediaUrl": "/uploads/media/172...-3EB0.jpg",  // already downloaded + written to disk
  "mimetype": "image/jpeg",
  "isGroup": true, "isChannel": false,
  "chatName": "PCM Products Update"  // real group/channel name, not a raw JID
}
```

## Commands (Node → bridge, HTTP)

All accept/return JSON. If `BRIDGE_TOKEN` is set, pass `?token=` or `Authorization: Bearer`.

| method + path | body | returns |
|---|---|---|
| `GET /status` | — | `{ connected, loggedIn, jid }` |
| `GET /qr` | — | `{ code }` (current QR, empty if paired) |
| `POST /connect` | — | `{ ok }` — (re)start connect/pairing |
| `POST /logout` | — | `{ ok }` — unlink (wipes session) |
| `POST /send` | `{ chatJid, text }` | `{ id }` |
| `POST /send-media` | `{ chatJid, type, mimetype, caption?, fileName?, mediaBase64 }` | `{ id }` |
| `POST /react` | `{ chatJid, messageId, senderJid, fromMe, emoji }` (empty emoji removes) | `{ ok }` |
| `POST /read` | `{ chatJid, senderJid, messageIds[] }` | `{ ok }` |
| `GET /group?jid=...` | — | `{ jid, name, topic, participants[] }` |

## Node integration
See `../src/services/whatsmeow-bridge.client.ts` for a drop-in client that connects to `/ws`
and wraps the HTTP commands. To migrate: emit the same internal events the current
`whatsappWebService` emits (`qr`, `ready`, `message`, `reaction`, `disconnected`) from the
bridge client, and route `sendMessage` / `sendReaction` / media to the HTTP API. The Node
message handler in `server.ts` already stores `mediaUrl`, `senderName`, `contactType`, so most
of it maps 1:1.

## Notes
- JIDs: individual `user@s.whatsapp.net`, group `...@g.us`, channel `...@newsletter`,
  broadcast `...@broadcast`. The old app keyed contacts by `chatId` with these same suffixes,
  so `getContactType()` on the Node side keeps working.
- Media is written into the shared `uploads/media` dir; the Node app serves it as-is.
- whatsmeow's API occasionally shifts (context params were added to several methods); if a
  future `go get -u` breaks the build, the fixes are usually just adding `ctx`.
