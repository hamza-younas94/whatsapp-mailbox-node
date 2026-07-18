# Features

Consolidated, ground-truthed feature list. Each item maps to a route mounted in
`src/server.ts` and/or a concrete service in `src/services/`. Aspirational "X% complete"
claims from the old `IMPLEMENTATION_*` / `*_ENHANCEMENT_PLAN` docs are excluded.

## Mailbox / Messaging
- Send/receive WhatsApp messages, history, search, delete (`/api/v1/messages`).
- Two connection methods: WhatsApp Web via QR (primary — `/api/v1/whatsapp-web`: session
  init, QR fetch, SSE QR stream, status, restart, logout, multi-session per user, on-disk
  session persistence) and the Meta WhatsApp Business API path.
- Multimedia: image/video/audio/document upload, voice recording, drag-and-drop, up to 10
  attachments, 50MB/file (multer) — `/api/v1/media/upload`, `/upload-multiple`.
- Message reactions, quoted-message replies, group/channel/status flags.
- Message templates (`/api/v1/message-templates`); quick replies with shortcuts, variables,
  categories, usage tracking (`/api/v1/quick-replies`).
- Conversation labels (`/api/v1/labels`); contact notes (`/api/v1/notes`).

## CRM / Contacts
- Contact CRUD, search, bulk ops, tagging (`/api/v1/contacts`, `/api/v1/tags`).
- Enrichment: real WhatsApp names, push/business names, profile photos (downloaded locally),
  business detection, company/department fields.
- Engagement scoring (0–100) + level classification; filter/sort by engagement, type, tags,
  message count; pagination.
- CRM module (`/api/v1/crm`); activity logs (`/api/v1/activity-logs`).

## Marketing
- Broadcasts: bulk send with segment/tag/manual/all targeting, scheduling, cancel, rate
  limiting, delivery tracking (`/api/v1/broadcasts`).
- Drip campaigns: multi-step time-delayed sequences, enrollment, trigger types
  (MANUAL / TAG_ADDED / FORM_SUBMITTED), progress tracking (`/api/v1/drip-campaigns`).
- Segments: dynamic condition-based contact segments with AND/OR logic and operators, live
  preview count (`/api/v1/segments`).

## Commerce
- Products / inventory: catalog, SKU, pricing, cost, stock, low-stock thresholds, categories
  (`/api/v1/products`).
- Orders: line items, status pipeline, payment status (`/api/v1/orders`).
- Invoices: generate from orders, statuses (Draft/Sent/Paid/Overdue/Cancelled), tax/discount
  calc, due dates, send (`/api/v1/invoices`).
- Expenses (`/api/v1/expenses`); customer subscriptions (`/api/v1/customer-subscriptions`).

> **Shop System is shelved.** The unified multi-shop / POS layer (`shops.html`,
> `/api/v1/shops`, `/api/v1/shop-system/*`) is NOT wired — `src/services/shop.service.ts.bak`
> and `src/routes/shop*.ts.bak` are disabled and `shop-api.ts` is never mounted. Only the
> decomposed commerce routes above are live.

## Automation
- Rule-based automations: triggers (message_received, contact_created, message_sent,
  tag_added, keyword, schedule), conditions, multi-action workflows (send message, add/remove
  tag, wait, webhook) — `/api/v1/automations`.
- Auto-reply engine: multi-strategy matching (exact, exact-word, contains, keyword-overlap,
  Levenshtein fuzzy), 0.5 confidence threshold, 5s rate limit, 1-min dedup, usage stats,
  English + basic Urdu (`src/services/auto-reply.service.ts`).
- Auto-tag rules (`/api/v1/auto-tag-rules`).
- Scheduled messages: future delivery, batch processing, cancellation
  (`/api/v1/scheduled-messages`).

## Support
- Service tickets (`/api/v1/service-tickets`), tasks (`/api/v1/tasks`), appointments
  (`/api/v1/appointments`).

## Analytics
- Message stats (sent/received/total), contact metrics, campaign performance, time-based
  trends, message-type breakdown, custom date ranges (`/api/v1/analytics`).

## Platform / cross-cutting
- JWT auth (register/login/refresh, bcrypt) — `/api/v1/auth`; Zod validation, Helmet, CORS,
  global + activity-logger middleware, rate limiting.
- App config (`/api/v1/app-config`), Swagger docs, health check, real-time via Socket.IO.
- Each module has a static admin page in `public/` (e.g. `broadcasts.html`, `invoices.html`,
  `contacts.html`, `analytics.html`, `qr-connect.html`).

## Roadmap (documented, not built)
CSV import/export, duplicate detection, contact-timeline UI, CRM deals/pipelines, RBAC /
team management / multi-tenant / billing, A/B testing for drips, AI features (smart replies,
sentiment, auto-categorization), payment-gateway / POS / catalog / loyalty (the shelved shop
system). "Enhanced" route variants (`*-enhanced`) referenced in old docs are not mounted.
</content>
