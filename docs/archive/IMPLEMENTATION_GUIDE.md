# Implementation Guide - Advanced WhatsApp Mailbox Features

## Step 1: Update Database Schema

### A. Update existing `prisma/schema.prisma` file

Add these fields to existing models:

#### **Conversation Model** - Add:
```prisma
model Conversation {
  // ... existing fields ...
  
  status         String       @default("open") // open, closed, pending, snoozed
  priority       String       @default("normal") // low, normal, high, urgent
  assignedToId   String?
  snoozedUntil   DateTime?
  isArchived     Boolean      @default(false)
  archivedAt     DateTime?
  labels         ConversationLabel[]
  notes          ConversationNote[]
}
```

#### **QuickReply Model** - Add:
```prisma
model QuickReply {
  // ... existing fields ...
  
  categoryId     String?
  category       QuickReplyCategory? @relation(fields: [categoryId], references: [id])
  variables      Json?       @default("[]")
  mediaUrl       String?     @db.Text
  mediaType      String?
  tags           Json?       @default("[]")
  lastUsedAt     DateTime?
  
  usageLogs      QuickReplyUsage[]
}
```

#### **User Model** - Add relations:
```prisma
model User {
  // ... existing relations ...
  
  broadcasts        Broadcast[]
  labels            Label[]
  customFields      ContactField[]
  scheduledMessages ScheduledMessage[]
  teamMemberships   TeamMember[]
  savedFilters      SavedFilter[]
  webhooks          Webhook[]
  imports           ImportJob[]
}
```

### B. Run migration:
```bash
npx prisma migrate dev --name add_advanced_features
npx prisma generate
```

## Step 2: Create New Backend Services

### Quick Reply Service Enhancement
File: `src/services/quick-reply-enhanced.service.ts`

```typescript
import { PrismaClient } from '@prisma/client';

export class QuickReplyEnhancedService {
  constructor(private prisma: PrismaClient) {}

  async create(userId: string, data: CreateQuickReplyDto) {
    return this.prisma.quickReply.create({
      data: {
        userId,
        title: data.title,
        content: data.content,
        categoryId: data.categoryId,
        shortcut: data.shortcut,
        variables: data.variables || [],
        mediaUrl: data.mediaUrl,
        mediaType: data.mediaType,
        tags: data.tags || [],
      },
      include: {
        category: true,
      },
    });
  }

  async findAllWithCategories(userId: string) {
    const [quickReplies, categories] = await Promise.all([
      this.prisma.quickReply.findMany({
        where: { userId, isActive: true },
        include: { category: true },
        orderBy: [{ category: { sortOrder: 'asc' } }, { usageCount: 'desc' }],
      }),
      this.prisma.quickReplyCategory.findMany({
        where: { userId },
        orderBy: { sortOrder: 'asc' },
      }),
    ]);

    return { quickReplies, categories };
  }

  async trackUsage(quickReplyId: string, userId: string, contactId?: string) {
    await Promise.all([
      this.prisma.quickReply.update({
        where: { id: quickReplyId },
        data: {
          usageCount: { increment: 1 },
          usageTodayCount: { increment: 1 },
          lastUsedAt: new Date(),
        },
      }),
      this.prisma.quickReplyUsage.create({
        data: { quickReplyId, userId, contactId },
      }),
    ]);
  }

  async getAnalytics(userId: string, startDate: Date, endDate: Date) {
    const usage = await this.prisma.quickReplyUsage.groupBy({
      by: ['quickReplyId'],
      where: {
        userId,
        usedAt: { gte: startDate, lte: endDate },
      },
      _count: { id: true },
    });

    const quickReplies = await this.prisma.quickReply.findMany({
      where: { id: { in: usage.map(u => u.quickReplyId) } },
      select: { id: true, title: true, shortcut: true },
    });

    return usage.map(u => ({
      ...quickReplies.find(qr => qr.id === u.quickReplyId),
      usageCount: u._count.id,
    }));
  }
}
```

### Broadcast Service
File: `src/services/broadcast.service.ts`

```typescript
export class BroadcastService {
  constructor(private prisma: PrismaClient, private whatsappService: WhatsAppWebService) {}

  async create(userId: string, data: CreateBroadcastDto) {
    // Get recipients based on targeting
    const recipients = await this.getRecipients(
      userId,
      data.segmentId,
      data.tagIds,
      data.contactIds
    );

    const broadcast = await this.prisma.broadcast.create({
      data: {
        userId,
        name: data.name,
        message: data.message,
        mediaUrl: data.mediaUrl,
        mediaType: data.mediaType,
        status: data.scheduledFor ? 'SCHEDULED' : 'DRAFT',
        scheduledFor: data.scheduledFor,
        recipientCount: recipients.length,
        recipients: {
          create: recipients.map(contact => ({
            contactId: contact.id,
            phoneNumber: contact.phoneNumber,
            status: 'PENDING',
          })),
        },
      },
      include: { recipients: true },
    });

    // If scheduled, create job
    if (data.scheduledFor) {
      await this.schedulebroadcast(broadcast.id, data.scheduledFor);
    }

    return broadcast;
  }

  async send(broadcastId: string) {
    const broadcast = await this.prisma.broadcast.findUnique({
      where: { id: broadcastId },
      include: { recipients: { where: { status: 'PENDING' } } },
    });

    if (!broadcast) throw new Error('Broadcast not found');

    await this.prisma.broadcast.update({
      where: { id: broadcastId },
      data: { status: 'SENDING', startedAt: new Date() },
    });

    // Send messages with rate limiting
    for (const recipient of broadcast.recipients) {
      try {
        await this.whatsappService.sendMessage({
          phoneNumber: recipient.phoneNumber,
          content: broadcast.message,
          mediaUrl: broadcast.mediaUrl,
        });

        await this.prisma.broadcastRecipient.update({
          where: { id: recipient.id },
          data: { status: 'SENT', sentAt: new Date() },
        });

        // Update counts
        await this.prisma.broadcast.update({
          where: { id: broadcastId },
          data: { sentCount: { increment: 1 } },
        });

        // Rate limiting: wait 1 second between messages
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        await this.prisma.broadcastRecipient.update({
          where: { id: recipient.id },
          data: {
            status: 'FAILED',
            error: error.message,
            failedAt: new Date(),
          },
        });

        await this.prisma.broadcast.update({
          where: { id: broadcastId },
          data: { failedCount: { increment: 1 } },
        });
      }
    }

    await this.prisma.broadcast.update({
      where: { id: broadcastId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
  }

  private async getRecipients(
    userId: string,
    segmentId?: string,
    tagIds?: string[],
    contactIds?: string[]
  ) {
    // Implementation for getting recipients based on criteria
    let where: any = { userId };

    if (segmentId) {
      // Apply segment criteria
      const segment = await this.prisma.segment.findUnique({ where: { id: segmentId } });
      where = { ...where, ...segment.criteria };
    }

    if (tagIds && tagIds.length > 0) {
      where.tags = { some: { tagId: { in: tagIds } } };
    }

    if (contactIds && contactIds.length > 0) {
      where.id = { in: contactIds };
    }

    return this.prisma.contact.findMany({ where });
  }
}
```

### Segment Service Enhancement
File: `src/services/segment-enhanced.service.ts`

```typescript
export class SegmentEnhancedService {
  constructor(private prisma: PrismaClient) {}

  async previewCount(userId: string, criteria: any) {
    const where = this.buildWhereClause(userId, criteria);
    return this.prisma.contact.count({ where });
  }

  async getContacts(segmentId: string, limit = 100, offset = 0) {
    const segment = await this.prisma.segment.findUnique({
      where: { id: segmentId },
    });

    if (!segment) throw new Error('Segment not found');

    const where = this.buildWhereClause(segment.userId, segment.criteria);

    return this.prisma.contact.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { lastMessageAt: 'desc' },
    });
  }

  private buildWhereClause(userId: string, criteria: any) {
    const where: any = { userId };

    if (criteria.tags && criteria.tags.length > 0) {
      where.tags = { some: { tagId: { in: criteria.tags } } };
    }

    if (criteria.engagementLevel) {
      where.engagementLevel = { in: criteria.engagementLevel };
    }

    if (criteria.lastMessageAfter) {
      where.lastMessageAt = { gte: new Date(criteria.lastMessageAfter) };
    }

    if (criteria.messageCountMin) {
      where.messageCount = { gte: criteria.messageCountMin };
    }

    if (criteria.customFields) {
      // Complex query for custom fields
      // Implementation depends on your custom fields structure
    }

    return where;
  }
}
```

## Step 3: Create Frontend Components

### Quick Reply Manager Component
File: `frontend/src/pages/QuickReplyManager.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { Plus, Search, Trash2, Edit2, BarChart3 } from 'lucide-react';

export const QuickReplyManager = () => {
  const [quickReplies, setQuickReplies] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    fetchQuickReplies();
  }, []);

  const fetchQuickReplies = async () => {
    const response = await fetch('/api/v1/quick-replies/with-categories');
    const data = await response.json();
    setQuickReplies(data.quickReplies);
    setCategories(data.categories);
  };

  const filteredReplies = quickReplies.filter(qr => {
    const matchesSearch = qr.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         qr.shortcut?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || qr.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="quick-reply-manager">
      <div className="header">
        <h1>Quick Replies</h1>
        <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus size={20} /> New Quick Reply
        </button>
      </div>

      <div className="filters">
        <div className="search-box">
          <Search size={20} />
          <input
            type="text"
            placeholder="Search quick replies..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
          <option value="all">All Categories</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      <div className="quick-replies-grid">
        {filteredReplies.map(qr => (
          <QuickReplyCard key={qr.id} quickReply={qr} onEdit={handleEdit} onDelete={handleDelete} />
        ))}
      </div>
    </div>
  );
};

const QuickReplyCard = ({ quickReply, onEdit, onDelete }) => {
  return (
    <div className="quick-reply-card">
      <div className="card-header">
        <h3>{quickReply.title}</h3>
        <div className="actions">
          <button onClick={() => onEdit(quickReply)}><Edit2 size={16} /></button>
          <button onClick={() => onDelete(quickReply.id)}><Trash2 size={16} /></button>
        </div>
      </div>
      
      <div className="card-body">
        <p className="content">{quickReply.content}</p>
        {quickReply.shortcut && (
          <span className="shortcut">/{quickReply.shortcut}</span>
        )}
      </div>
      
      <div className="card-footer">
        <span className="usage-count">
          <BarChart3 size={14} /> Used {quickReply.usageCount} times
        </span>
        {quickReply.category && (
          <span className="category" style={{ background: quickReply.category.color }}>
            {quickReply.category.name}
          </span>
        )}
      </div>
    </div>
  );
};
```

### Broadcast Creator Component
File: `frontend/src/pages/BroadcastCreator.tsx`

```typescript
import React, { useState } from 'react';
import { Send, Users, Calendar, Image } from 'lucide-react';

export const BroadcastCreator = () => {
  const [step, setStep] = useState(1);
  const [broadcast, setBroadcast] = useState({
    name: '',
    message: '',
    recipients: [],
    scheduledFor: null,
  });

  const handleSubmit = async () => {
    const response = await fetch('/api/v1/broadcasts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(broadcast),
    });

    if (response.ok) {
      // Navigate to broadcasts list
    }
  };

  return (
    <div className="broadcast-creator">
      <div className="steps-indicator">
        <Step number={1} label="Message" active={step === 1} />
        <Step number={2} label="Recipients" active={step === 2} />
        <Step number={3} label="Schedule" active={step === 3} />
        <Step number={4} label="Review" active={step === 4} />
      </div>

      {step === 1 && (
        <MessageStep
          message={broadcast.message}
          onChange={(message) => setBroadcast({ ...broadcast, message })}
          onNext={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <RecipientsStep
          recipients={broadcast.recipients}
          onChange={(recipients) => setBroadcast({ ...broadcast, recipients })}
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
        />
      )}

      {step === 3 && (
        <ScheduleStep
          scheduledFor={broadcast.scheduledFor}
          onChange={(scheduledFor) => setBroadcast({ ...broadcast, scheduledFor })}
          onNext={() => setStep(4)}
          onBack={() => setStep(2)}
        />
      )}

      {step === 4 && (
        <ReviewStep
          broadcast={broadcast}
          onSubmit={handleSubmit}
          onBack={() => setStep(3)}
        />
      )}
    </div>
  );
};
```

## Step 4: Update Existing Components

### Enhanced ConversationList Component
Add to `frontend/src/components/ConversationList.tsx`:

```typescript
// Add search bar
const [searchTerm, setSearchTerm] = useState('');
const [filterStatus, setFilterStatus] = useState('all');

// Add filter toolbar
<div className="conversation-filters">
  <input
    type="text"
    placeholder="Search conversations..."
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
  />
  <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
    <option value="all">All</option>
    <option value="open">Open</option>
    <option value="closed">Closed</option>
    <option value="unread">Unread</option>
  </select>
</div>

// Update conversation card with status badge
<div className="conversation-card">
  {conv.unreadCount > 0 && (
    <span className="unread-badge">{conv.unreadCount}</span>
  )}
  {conv.status === 'open' && <span className="status-dot status-open"></span>}
  {conv.labels?.map(label => (
    <span key={label.id} className="label" style={{ background: label.color }}>
      {label.name}
    </span>
  ))}
</div>
```

## Step 5: Create API Routes

### Quick Replies Routes
File: `src/routes/quick-replies-enhanced.ts`

```typescript
router.post('/categories', auth, async (req, res) => {
  // Create category
});

router.get('/with-categories', auth, async (req, res) => {
  // Get all quick replies with categories
});

router.get('/analytics', auth, async (req, res) => {
  // Get usage analytics
});

router.post('/:id/use', auth, async (req, res) => {
  // Track usage
});
```

### Broadcast Routes
File: `src/routes/broadcasts.ts`

```typescript
router.post('/', auth, async (req, res) => {
  // Create broadcast
});

router.post('/:id/send', auth, async (req, res) => {
  // Send broadcast immediately
});

router.get('/:id/analytics', auth, async (req, res) => {
  // Get broadcast analytics
});
```

## Step 6: Add Styling

Create: `frontend/src/styles/quick-replies.css`
Create: `frontend/src/styles/broadcasts.css`
Create: `frontend/src/styles/segments.css`

## Step 7: Testing

1. Test quick reply CRUD operations
2. Test broadcast creation and sending
3. Test segment filtering
4. Test search functionality
5. Test real-time updates

## Priority Implementation Order

1. ✅ Database schema updates (30 min)
2. ✅ Quick Reply Manager UI (2 hours)
3. ✅ Enhanced Mailbox Search (1 hour)
4. ✅ Broadcast System (3 hours)
5. ✅ Segment Builder (2 hours)
6. ✅ Drip Campaign UI (3 hours)
7. ✅ Analytics Dashboard (2 hours)

Total estimated time: 13-15 hours

Ready to start implementation?
