# Database Migration Strategy - WhatsApp Mailbox

## OFFICIAL MIGRATION METHOD

We use **Prisma Migrate** as the single source of truth for all database changes.

## Migration Workflow

### 1. Development (Local)
```bash
# Make changes to prisma/schema.prisma
# Then create and apply migration:
npx prisma migrate dev --name descriptive_name

# This will:
# - Create migration SQL in prisma/migrations/
# - Apply it to your local database
# - Regenerate Prisma Client
```

### 2. Production (Server)
```bash
# Pull latest code
git pull

# Apply pending migrations
npx prisma migrate deploy

# Regenerate Prisma Client
npx prisma generate

# Rebuild application
npm run build

# Restart server
pm2 restart whatsapp
```

## Emergency Fix (When migrations fail)

If migrations are broken and you need immediate fix:

```bash
# 1. Apply SQL fix directly
mysql -u mailbox -p whatsapp_mailbox < comprehensive_fix.sql

# 2. Regenerate Prisma Client to match database
npx prisma generate

# 3. Rebuild and restart
npm run build
pm2 restart whatsapp
```

## DO NOT DO

❌ Manual SQL changes without updating schema.prisma
❌ Using `prisma db push` in production
❌ Modifying migration files after they're committed
❌ Multiple migration methods (stick to Prisma Migrate)

## DO THIS

✅ Always update prisma/schema.prisma first
✅ Create migration with `prisma migrate dev`
✅ Test locally before deploying
✅ Use `prisma migrate deploy` in production
✅ Keep migrations in version control

## Current Schema Status

Last major changes:
- QuickReply: Added isActive, usageCount, usageTodayCount
- Contact: Changed avatarUrl and profilePhotoUrl to TEXT
- Message: Changed mediaUrl to TEXT, added group/channel/status support
- MessageType enum: Added STICKER, POLL, GROUP_INVITE, STATUS, CHANNEL_POST

## Troubleshooting

### "Column doesn't exist" error
```bash
# Apply comprehensive fix
mysql -u mailbox -p whatsapp_mailbox < comprehensive_fix.sql
npx prisma generate
npm run build
pm2 restart whatsapp
```

### Migration shadow database error
```bash
# Use db push for immediate fix (emergency only)
npx prisma db push --accept-data-loss
```

### Clean slate (DESTRUCTIVE - development only)
```bash
npx prisma migrate reset
```
