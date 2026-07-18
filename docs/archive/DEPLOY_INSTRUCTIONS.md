# 🚀 DEPLOYMENT INSTRUCTIONS - CRITICAL FIXES

## Run these commands on your server NOW:

```bash
cd /root/whatsapp-mailbox-php/whatsapp-mailbox-node

# 1. Pull latest code
git pull

# 2. Apply comprehensive database fix
mysql -u mailbox -p whatsapp_mailbox < comprehensive_fix.sql

# 3. Regenerate Prisma Client
npx prisma generate

# 4. Rebuild application
npm run build

# 5. Restart PM2
pm2 restart whatsapp

# 6. Check logs
pm2 logs whatsapp --lines 50
```

## What This Fixes:

✅ **QuickReply Edit** - Adds isActive, usageCount, usageTodayCount columns
✅ **Long URL Support** - Changes avatarUrl, profilePhotoUrl, mediaUrl to TEXT
✅ **Group Messages** - Adds group message detection and metadata
✅ **Channel Messages** - Adds channel message support
✅ **Status Updates** - Adds status update detection
✅ **Message Types** - Adds STICKER, POLL, GROUP_INVITE, STATUS, CHANNEL_POST

## Database Changes Applied:

### QuickReply Table
- `isActive` BOOLEAN DEFAULT true
- `usageCount` INT DEFAULT 0
- `usageTodayCount` INT DEFAULT 0

### Contact Table  
- `avatarUrl` TEXT (was VARCHAR)
- `profilePhotoUrl` TEXT (was VARCHAR)

### Message Table
- `mediaUrl` TEXT (was VARCHAR(1000))
- `quotedMessageId` VARCHAR(191) - For replies
- `isGroupMessage` BOOLEAN - Group detection
- `groupId` VARCHAR(191) - Group ID
- `groupName` VARCHAR(255) - Group name
- `isStatusUpdate` BOOLEAN - Status detection
- `isChannelMessage` BOOLEAN - Channel detection
- `channelId` VARCHAR(191) - Channel ID
- `senderName` VARCHAR(255) - Sender in group/channel

### New Message Types
- STICKER
- POLL
- GROUP_INVITE
- STATUS
- CHANNEL_POST

## Verification

After restart, test:
1. ✅ Quick replies page loads without errors
2. ✅ Can edit quick replies
3. ✅ Messages display with proper media
4. ✅ Groups appear in separate conversations
5. ✅ Status updates are properly labeled
6. ✅ Channels show correctly

## If You See Errors:

```bash
# Check what columns exist
mysql -u mailbox -p whatsapp_mailbox -e "SHOW COLUMNS FROM QuickReply;"
mysql -u mailbox -p whatsapp_mailbox -e "SHOW COLUMNS FROM Message;"
mysql -u mailbox -p whatsapp_mailbox -e "SHOW COLUMNS FROM Contact;"

# Re-apply fix if needed
mysql -u mailbox -p whatsapp_mailbox < comprehensive_fix.sql
```

## Migration Strategy Going Forward

Read: `DATABASE_MIGRATION_GUIDE.md`

**ONE METHOD ONLY: Prisma Migrate**

Development:
```bash
npx prisma migrate dev --name feature_name
```

Production:
```bash
npx prisma migrate deploy
```
