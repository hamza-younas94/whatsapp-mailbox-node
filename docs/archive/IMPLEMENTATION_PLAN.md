# WhatsApp Mailbox Node.js - Feature Parity & Enhancement Plan

## Executive Summary
This document outlines the complete implementation plan to bring the Node.js version to full feature parity with the PHP version, plus additional enhancements.

---

## A) Feature Parity Checklist (PHP → Node)

### 1) Messaging / Conversations

| Feature | PHP | Node | Status | Action Required |
|---------|-----|------|--------|-----------------|
| Chat list | ✅ | ✅ | ✅ Parity | - |
| Chat view with messages | ✅ | ✅ | ✅ Parity | - |
| Message sending | ✅ | ✅ | ✅ Parity | - |
| Media sending (image/video/doc) | ✅ | ✅ | ✅ Parity | - |
| Read/unread status | ✅ | ⚠️ | ⚠️ Partial | Add UI indicators |
| Delivery/read receipts (✓ ✓✓) | ✅ | ❌ | ❌ Missing | Implement UI |
| Typing indicators | ✅ | ❌ | ❌ Missing | Add real-time events |
| Contact CRUD | ✅ | ✅ | ✅ Parity | - |
| Contact tags | ✅ | ✅ | ✅ Parity | - |
| Contact segments | ✅ | ✅ | ✅ Parity | - |
| Conversation assignment (assignedToId) | ✅ | ⚠️ | ⚠️ Backend only | Build UI |
| Duplicate detection | ✅ | ⚠️ | ⚠️ Backend only | Build UI |
| Conversation labels | ✅ | ⚠️ | ⚠️ Schema only | Build UI + API |

### 2) Quick Replies / Templates

| Feature | PHP | Node | Status | Action Required |
|---------|-----|------|--------|-----------------|
| Quick replies CRUD | ✅ | ✅ | ✅ Parity | - |
| Quick replies UI | ✅ | ✅ | ✅ Parity | - |
| Quick reply categories | ✅ | ⚠️ | ⚠️ Schema only | Build UI |
| Quick reply usage tracking | ✅ | ⚠️ | ⚠️ Schema only | Implement |
| Message templates CRUD | ✅ | ⚠️ | ⚠️ Schema only | Build UI + API |
| Template variables | ✅ | ⚠️ | ⚠️ Schema only | Implement |
| / command palette | ✅ | ❌ | ❌ Missing | Implement |
| Ctrl+Enter to send | ✅ | ❌ | ❌ Missing | Implement |

### 3) Broadcasts / Segments

| Feature | PHP | Node | Status | Action Required |
|---------|-----|------|--------|-----------------|
| Broadcast creation | ✅ | ✅ | ✅ Parity | - |
| Broadcast scheduling | ✅ | ⚠️ | ⚠️ Partial | Complete scheduling |
| Segment targeting | ✅ | ✅ | ✅ Parity | - |
| Bulk actions UI | ✅ | ❌ | ❌ Missing | Implement multi-select |
| Queue system | ✅ | ❌ | ❌ Missing | Implement BullMQ |
| Retry logic | ✅ | ❌ | ❌ Missing | Exponential backoff |
| Rate limiting | ✅ | ⚠️ | ⚠️ Basic | Per-user limits |
| Enhanced routes | ✅ | ⚠️ | ⚠️ Disabled | Enable routes |

### 4) Workflows / Automation

| Feature | PHP | Node | Status | Action Required |
|---------|-----|------|--------|-----------------|
| Automation rules CRUD | ✅ | ✅ | ✅ Parity | - |
| Automation triggers | ✅ | ✅ | ✅ Parity | - |
| **Visual workflow builder** | ✅ | ❌ | ❌ Missing | Build UI |
| Drip campaigns API | ✅ | ✅ | ✅ Parity | - |
| Drip campaigns UI | ✅ | ⚠️ | ⚠️ Partial | Complete UI |
| Drip enrollment | ✅ | ✅ | ✅ Parity | - |
| Webhook outgoing | ✅ | ⚠️ | ⚠️ Schema only | Implement |
| Zapier-style builder | ✅ | ❌ | ❌ Missing | Build UI |

### 5) Dashboard / Analytics

| Feature | PHP | Node | Status | Action Required |
|---------|-----|------|--------|-----------------|
| Basic metrics | ✅ | ⚠️ | ⚠️ Limited | Expand metrics |
| Charts/graphs | ✅ | ❌ | ❌ Missing | Add Chart.js |
| Agent performance | ✅ | ❌ | ❌ Missing | Build dashboard |
| Campaign analytics | ✅ | ⚠️ | ⚠️ Basic | Enhance |
| Response time metrics | ✅ | ❌ | ❌ Missing | Implement FRT/ART |

### 6) Security & Auth

| Feature | PHP | Node | Status | Action Required |
|---------|-----|------|--------|-----------------|
| JWT auth | ✅ | ✅ | ✅ Parity | - |
| Role-based access | ✅ | ⚠️ | ⚠️ Basic | Enhance RBAC |
| 2FA/MFA | ✅ | ❌ | ❌ Missing | Implement TOTP |
| Session timeout | ✅ | ❌ | ❌ Missing | Add config |
| Audit logging | ✅ | ⚠️ | ⚠️ Basic | Enhance |
| Rate limiting | ✅ | ⚠️ | ⚠️ Basic | Per-user/IP |

---

## B) Implementation Phases

### Phase 1: Week 1 (Critical - Must Ship)

**Priority: 🔴 Critical**

1. **Enable disabled enhanced routes** (2h)
   - Rename `.bak` files back to `.ts`
   - Uncomment imports in `server.ts`
   - Test all endpoints

2. **Keyboard shortcuts** (4h)
   - `/` command palette for quick replies
   - `Ctrl+Enter` to send message
   - `Escape` to close modals

3. **Read receipt display** (4h)
   - Add ✓ (sent), ✓✓ (delivered), blue ✓✓ (read) icons
   - Real-time status updates via Socket.IO

4. **Emoji picker** (3h)
   - Add emoji-picker-react component
   - Integrate in MessageComposer

5. **Message retry logic** (6h)
   - Exponential backoff for failed sends
   - Queue system for broadcasts (BullMQ)
   - Dead letter handling

### Phase 2: Weeks 2-4 (Core Features)

**Priority: 🟡 High**

6. **Conversation assignment UI** (8h)
   - Dropdown to assign agent
   - Filter by assigned agent
   - Reassignment notifications

7. **Conversation labels** (6h)
   - Label CRUD API
   - Label assignment UI
   - Filter conversations by label

8. **CSV import wizard** (12h)
   - File upload
   - Column mapping UI
   - Preview + validation
   - Progress tracking

9. **Visual workflow builder** (20h)
   - React Flow integration
   - Node types: trigger, condition, action
   - Save/load workflows
   - Execution engine

10. **Agent performance dashboard** (10h)
    - First Response Time (FRT)
    - Average Response Time (ART)
    - Messages per hour/day
    - Agent load distribution

### Phase 3: Month 2 (Enhancements)

**Priority: 🟢 Medium**

11. **Message templates UI** (8h)
12. **Dark mode theme** (6h)
13. **Zapier/webhook builder** (16h)
14. **2FA/MFA implementation** (10h)
15. **Virtual scrolling** (6h)
16. **Notification center** (8h)

---

## C) File-by-File Change List

### Backend Changes

```
src/
├── routes/
│   ├── index.ts                    # Enable enhanced routes
│   ├── broadcasts-enhanced.ts      # Rename from .bak
│   ├── segments-enhanced.ts        # Rename from .bak  
│   ├── quick-replies-enhanced.ts   # Rename from .bak
│   ├── labels.ts                   # NEW: Conversation labels
│   ├── templates.ts                # NEW: Message templates
│   ├── imports.ts                  # NEW: CSV import
│   ├── workflows.ts                # NEW: Visual workflows
│   ├── agent-metrics.ts            # NEW: Agent analytics
│   └── webhooks.ts                 # NEW: Outgoing webhooks
│
├── services/
│   ├── queue.service.ts            # NEW: BullMQ integration
│   ├── broadcast-queue.service.ts  # NEW: Broadcast processing
│   ├── retry.service.ts            # NEW: Retry with backoff
│   ├── workflow-engine.service.ts  # NEW: Workflow execution
│   ├── import.service.ts           # NEW: CSV processing
│   ├── totp.service.ts             # NEW: 2FA TOTP
│   └── audit.service.ts            # ENHANCE: Full audit log
│
├── middleware/
│   ├── rate-limit.middleware.ts    # ENHANCE: Per-user limits
│   └── session.middleware.ts       # NEW: Session timeout
│
└── workers/
    ├── broadcast.worker.ts         # NEW: BullMQ worker
    ├── drip.worker.ts              # NEW: Drip campaign worker
    └── import.worker.ts            # NEW: Import processing
```

### Frontend Changes

```
frontend/src/
├── components/
│   ├── MessageComposer.tsx         # ENHANCE: / shortcuts, emoji
│   ├── MessageBubble.tsx           # ENHANCE: Receipt icons
│   ├── ChatPane.tsx                # ENHANCE: Labels, assignment
│   ├── ConversationList.tsx        # ENHANCE: Bulk actions
│   ├── EmojiPicker.tsx             # NEW
│   ├── CommandPalette.tsx          # NEW: / command menu
│   ├── LabelManager.tsx            # NEW
│   ├── AssignmentDropdown.tsx      # NEW
│   ├── BulkActionBar.tsx           # NEW
│   ├── ImportWizard/               # NEW: Multi-step wizard
│   │   ├── FileUpload.tsx
│   │   ├── ColumnMapping.tsx
│   │   ├── Preview.tsx
│   │   └── Progress.tsx
│   ├── WorkflowBuilder/            # NEW: React Flow
│   │   ├── Canvas.tsx
│   │   ├── NodeTypes/
│   │   ├── Sidebar.tsx
│   │   └── PropertyPanel.tsx
│   ├── AgentDashboard/             # NEW
│   │   ├── MetricsCards.tsx
│   │   ├── ResponseTimeChart.tsx
│   │   └── AgentTable.tsx
│   └── NotificationCenter.tsx      # NEW
│
├── pages/ (or routes)
│   ├── workflows.tsx               # NEW
│   ├── templates.tsx               # NEW
│   ├── import.tsx                  # NEW
│   ├── agent-metrics.tsx           # NEW
│   └── settings/
│       └── security.tsx            # NEW: 2FA setup
│
└── hooks/
    ├── useKeyboardShortcuts.ts     # NEW
    ├── useVirtualScroll.ts         # NEW
    └── useTheme.ts                 # NEW: Dark mode
```

### Database Changes (Prisma Schema)

```prisma
// New models to add:

model Workflow {
  id               String   @id @default(cuid())
  userId           String
  name             String
  description      String?
  triggerType      String   // message, tag, stage, time
  triggerConditions Json    @default("{}")
  actions          Json     @default("[]")
  isActive         Boolean  @default(true)
  executionCount   Int      @default(0)
  lastExecutedAt   DateTime?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  
  user User @relation(fields: [userId], references: [id])
  
  @@index([userId])
  @@index([isActive])
}

model UserSession {
  id           String   @id @default(cuid())
  userId       String
  token        String   @unique
  ipAddress    String?
  userAgent    String?
  expiresAt    DateTime
  lastActiveAt DateTime @default(now())
  createdAt    DateTime @default(now())
  
  user User @relation(fields: [userId], references: [id])
  
  @@index([userId])
  @@index([expiresAt])
}

model TwoFactorAuth {
  id        String   @id @default(cuid())
  userId    String   @unique
  secret    String   // Encrypted TOTP secret
  isEnabled Boolean  @default(false)
  backupCodes Json?  // Encrypted backup codes
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  user User @relation(fields: [userId], references: [id])
}

model OutgoingWebhook {
  id        String   @id @default(cuid())
  userId    String
  name      String
  url       String
  events    Json     // Array of event types
  headers   Json?    // Custom headers
  secret    String?  // HMAC signing secret
  isActive  Boolean  @default(true)
  lastTriggeredAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  user User @relation(fields: [userId], references: [id])
  logs WebhookDeliveryLog[]
  
  @@index([userId])
}

model WebhookDeliveryLog {
  id           String   @id @default(cuid())
  webhookId    String
  event        String
  payload      Json
  statusCode   Int?
  response     String?  @db.Text
  error        String?
  attemptCount Int      @default(1)
  createdAt    DateTime @default(now())
  
  webhook OutgoingWebhook @relation(fields: [webhookId], references: [id])
  
  @@index([webhookId])
  @@index([createdAt])
}
```

---

## D) API Endpoints (OpenAPI Outline)

### New Endpoints

```yaml
# Labels
POST   /api/v1/labels                 # Create label
GET    /api/v1/labels                 # List labels
PUT    /api/v1/labels/:id             # Update label
DELETE /api/v1/labels/:id             # Delete label
POST   /api/v1/conversations/:id/labels  # Add label to conversation
DELETE /api/v1/conversations/:id/labels/:labelId  # Remove label

# Message Templates
POST   /api/v1/templates              # Create template
GET    /api/v1/templates              # List templates
GET    /api/v1/templates/:id          # Get template
PUT    /api/v1/templates/:id          # Update template
DELETE /api/v1/templates/:id          # Delete template

# Workflows (Visual Builder)
POST   /api/v1/workflows              # Create workflow
GET    /api/v1/workflows              # List workflows
GET    /api/v1/workflows/:id          # Get workflow
PUT    /api/v1/workflows/:id          # Update workflow
DELETE /api/v1/workflows/:id          # Delete workflow
POST   /api/v1/workflows/:id/toggle   # Toggle active
GET    /api/v1/workflows/:id/logs     # Execution logs

# CSV Import
POST   /api/v1/imports/upload         # Upload CSV
POST   /api/v1/imports/:id/preview    # Preview with mapping
POST   /api/v1/imports/:id/process    # Start processing
GET    /api/v1/imports/:id/status     # Get progress

# Agent Metrics
GET    /api/v1/agent-metrics          # Get all agents metrics
GET    /api/v1/agent-metrics/:userId  # Get specific agent
GET    /api/v1/agent-metrics/summary  # Summary stats

# Conversation Assignment
PUT    /api/v1/conversations/:id/assign  # Assign to agent
GET    /api/v1/conversations/assigned/:userId  # Get assigned convos

# Outgoing Webhooks
POST   /api/v1/webhooks               # Create webhook
GET    /api/v1/webhooks               # List webhooks
PUT    /api/v1/webhooks/:id           # Update webhook
DELETE /api/v1/webhooks/:id           # Delete webhook
POST   /api/v1/webhooks/:id/test      # Test webhook
GET    /api/v1/webhooks/:id/logs      # Delivery logs

# 2FA
POST   /api/v1/auth/2fa/setup         # Generate QR code
POST   /api/v1/auth/2fa/verify        # Verify TOTP
POST   /api/v1/auth/2fa/disable       # Disable 2FA
POST   /api/v1/auth/2fa/backup-codes  # Generate backup codes
```

---

## E) Testing Plan

### Unit Tests

```typescript
// services/
- queue.service.test.ts
- retry.service.test.ts
- workflow-engine.service.test.ts
- import.service.test.ts
- totp.service.test.ts

// controllers/
- labels.controller.test.ts
- workflows.controller.test.ts
- imports.controller.test.ts
- agent-metrics.controller.test.ts
```

### Integration Tests

```typescript
// Critical paths
- broadcasts/send-with-retry.test.ts
- workflows/trigger-execution.test.ts
- imports/csv-processing.test.ts
- auth/2fa-flow.test.ts
- assignments/conversation-assignment.test.ts
```

### E2E Tests

```typescript
// User flows
- quick-reply-shortcut.e2e.ts
- broadcast-create-send.e2e.ts
- workflow-builder.e2e.ts
- import-wizard.e2e.ts
```

---

## F) Security Considerations

### Implemented Defaults

1. **Rate Limiting**
   - 100 requests/minute per IP
   - 1000 requests/minute per user
   - 10 broadcasts/hour per user

2. **Session Management**
   - JWT expires in 24 hours
   - Session timeout: 30 minutes inactive
   - Max 5 concurrent sessions

3. **2FA**
   - Required for admin users
   - TOTP with 30-second window
   - 10 backup codes per user

4. **Audit Logging**
   - All CRUD operations
   - Authentication events
   - Configuration changes
   - Retained 90 days

5. **WhatsApp Rate Limits**
   - Max 1 message/second per number
   - Max 1000 messages/day (configurable)
   - Automatic throttling on 429

---

## G) Feature Flags

```typescript
// config/feature-flags.ts
export const FEATURE_FLAGS = {
  WORKFLOW_BUILDER: true,
  AI_SUGGESTIONS: false,
  BULK_IMPORT: true,
  TWO_FACTOR_AUTH: true,
  DARK_MODE: true,
  ZAPIER_WEBHOOKS: false,
  AGENT_METRICS: true,
};
```

---

## H) Migration Safety

### Backward Compatible Changes

1. All new columns have defaults
2. No column renames
3. No column deletions
4. New tables don't affect existing data

### Migration Scripts

```bash
# Generate migration
npx prisma migrate dev --name add_workflows_and_webhooks

# Apply to production
npx prisma migrate deploy
```

---

## Next Steps

1. ✅ Create this plan document
2. ⏳ Enable disabled routes
3. ⏳ Implement keyboard shortcuts
4. ⏳ Add read receipt icons
5. ⏳ Build queue system

---

*Document generated: 2026-01-31*
*Lead Engineer: AI Assistant*
