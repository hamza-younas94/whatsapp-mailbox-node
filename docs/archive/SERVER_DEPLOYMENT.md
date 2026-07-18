# 🚀 Server Deployment Guide - Multimedia Features

## 📋 Pre-Deployment Checklist

Before deploying, ensure your server has:
- ✅ MySQL running and accessible
- ✅ Node.js v18+ installed
- ✅ PM2 installed globally (`npm install -g pm2`)
- ✅ Git access to repository
- ✅ Sufficient disk space for media uploads

## 🔧 Deployment Steps

### Step 1: Connect to Server
```bash
ssh root@api-box
# or
ssh root@your-server-ip
```

### Step 2: Navigate to Project Directory
```bash
cd /root/whatsapp-mailbox-php/whatsapp-mailbox-node
```

### Step 3: Pull Latest Changes
```bash
git pull origin main
```

**Expected Output:**
```
Updating dfe7b9d9..bd894078
Fast-forward
 frontend/src/components/MessageComposer.tsx | 200 ++++++++++++
 frontend/src/styles/message-composer.css   | 100 ++++++
 src/routes/media.ts                         | 150 +++++++++
 src/server.ts                               |   2 +
 ...
```

### Step 4: Install New Dependencies
```bash
npm install
```

**This installs:**
- `multer` - File upload handling
- `@types/multer` - TypeScript types

### Step 5: Run Database Migrations
```bash
# Apply safe SQL fixes for new columns
mysql -u root -p whatsapp_mailbox < safe_fix.sql

# When prompted, enter your MySQL password
```

**What this does:**
- Adds `mediaUrl` (TEXT) to Message table
- Adds `quotedMessageId`, `isGroupMessage`, `groupId`, etc.
- Adds `isActive`, `usageCount` to QuickReply table
- Uses stored procedures to avoid errors if columns exist

### Step 6: Regenerate Prisma Client
```bash
npx prisma generate
```

**Expected Output:**
```
✔ Generated Prisma Client (v5.22.0) to ./node_modules/@prisma/client
```

### Step 7: Build Frontend
```bash
cd frontend
npm install  # If first time or package.json changed
npm run build
cd ..
```

**Expected Output:**
```
vite v5.4.21 building for production...
✓ 124 modules transformed.
../public/assets/index-BWaou0Et.js   241.19 kB
../public/assets/index-CcKraTQy.css   17.52 kB
✓ built in 720ms
```

### Step 8: Build Backend
```bash
npm run build
```

**Expected Output:**
```
> whatsapp-mailbox@2.0.0 build
> tsc && tsc-alias

(No errors means success)
```

### Step 9: Create Uploads Directory
```bash
mkdir -p uploads/media
chmod 755 uploads/media
chown -R $USER:$USER uploads/
```

**What this does:**
- Creates `uploads/media/` for file storage
- Sets proper permissions (755 = rwxr-xr-x)
- Ensures server can write files

### Step 10: Restart Server with PM2
```bash
# If app already running
pm2 restart whatsapp

# If first time
pm2 start dist/server.js --name whatsapp

# Check logs
pm2 logs whatsapp
```

**Expected in logs:**
```
✓ Database connected successfully
✓ WhatsApp client initialized
Server running on port 3000
```

### Step 11: Verify Deployment
```bash
# Check server status
pm2 status

# Check if uploads directory exists
ls -la uploads/media/

# Test media endpoint (from another terminal)
curl -X POST http://localhost:3000/api/v1/media/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test-image.jpg"
```

## 🧪 Post-Deployment Testing

### Test 1: Server Health
```bash
curl http://localhost:3000/api/v1/health
```
**Expected:** `{"status": "ok"}`

### Test 2: Voice Recording
1. Open WhatsApp Mailbox in browser
2. Click microphone button
3. Record 5 seconds of audio
4. Click stop
5. Verify voice preview appears
6. Click send
7. Check message sent successfully

### Test 3: File Upload
1. Drag an image onto message composer
2. Verify blue overlay appears
3. Drop image
4. Verify thumbnail preview
5. Click send
6. Check file uploaded to `uploads/media/`

### Test 4: Multiple Files
1. Click paperclip button
2. Select 3 different files (image, video, PDF)
3. Verify all 3 previews appear
4. Click send
5. Verify all sent successfully

### Test 5: Database Check
```bash
mysql -u root -p whatsapp_mailbox

# Inside MySQL
USE whatsapp_mailbox;

# Check Message table structure
DESCRIBE Message;

# Should show:
# - mediaUrl (text)
# - quotedMessageId (varchar)
# - isGroupMessage (tinyint)
# - groupId (varchar)
# etc.

# Check recent messages
SELECT id, content, mediaUrl, messageType FROM Message ORDER BY timestamp DESC LIMIT 5;

EXIT;
```

## 🐛 Troubleshooting

### Issue 1: "Cannot reach database server"
**Solution:**
```bash
# Check MySQL status
systemctl status mysql
# or
service mysql status

# Start MySQL if stopped
systemctl start mysql
# or
service mysql start

# Verify connection
mysql -u root -p -e "SELECT 1;"
```

### Issue 2: "Module not found: multer"
**Solution:**
```bash
npm install multer @types/multer
npm run build
pm2 restart whatsapp
```

### Issue 3: "EACCES: permission denied, mkdir 'uploads/media'"
**Solution:**
```bash
sudo mkdir -p uploads/media
sudo chown -R $USER:$USER uploads/
sudo chmod -R 755 uploads/
```

### Issue 4: "Column already exists" in SQL
**Solution:**
```bash
# The safe_fix.sql checks before adding columns
# If error persists, columns may already exist from previous migration
# Just skip this step or drop and recreate columns
```

### Issue 5: PM2 not found
**Solution:**
```bash
npm install -g pm2
pm2 start dist/server.js --name whatsapp
```

### Issue 6: Frontend not showing new features
**Solution:**
```bash
# Clear browser cache or hard refresh (Ctrl+Shift+R)
# Rebuild frontend
cd frontend && npm run build && cd ..
pm2 restart whatsapp
```

## 📊 Monitoring

### View Real-Time Logs
```bash
pm2 logs whatsapp
```

### Check Server Metrics
```bash
pm2 monit
```

### View All PM2 Processes
```bash
pm2 list
```

### Restart if Issues
```bash
pm2 restart whatsapp
```

### Stop Server
```bash
pm2 stop whatsapp
```

### Delete Process
```bash
pm2 delete whatsapp
```

## 🔐 Security Considerations

### File Upload Security
- ✅ MIME type validation (only allowed types)
- ✅ File size limit (50MB max)
- ✅ Unique filenames (prevent overwrites)
- ✅ Authentication required for uploads
- ✅ Files served from separate directory

### Recommended: Add Rate Limiting
Edit `src/routes/media.ts`:
```typescript
import rateLimit from 'express-rate-limit';

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

router.post('/upload', uploadLimiter, upload.single('file'), ...);
```

### Recommended: Add File Scanning
Consider adding virus scanning with ClamAV:
```bash
apt-get install clamav clamav-daemon
npm install clamscan
```

## 📈 Maintenance

### Weekly Tasks
- Check disk space: `df -h`
- Review logs: `pm2 logs whatsapp --lines 100`
- Clear old uploads if needed: `find uploads/media/ -mtime +30 -delete`

### Monthly Tasks
- Update dependencies: `npm update`
- Review and optimize database
- Backup uploads directory

### Backup Strategy
```bash
# Backup uploads
tar -czf uploads-backup-$(date +%Y%m%d).tar.gz uploads/

# Backup database
mysqldump -u root -p whatsapp_mailbox > db-backup-$(date +%Y%m%d).sql
```

## ✅ Success Criteria

Deployment is successful when:
- ✅ PM2 shows "online" status
- ✅ No errors in `pm2 logs whatsapp`
- ✅ Database columns added (`DESCRIBE Message`)
- ✅ `uploads/media/` directory exists
- ✅ Frontend loads new interface
- ✅ Voice recording works
- ✅ File upload works
- ✅ Multiple files can be sent

## 🎉 You're Done!

Your WhatsApp Mailbox now has:
- 🎤 Voice message recording
- 📎 Drag & drop file upload
- 📁 Multiple file attachments
- 🎨 Support for images, videos, audio, documents
- ⚡ 50MB file uploads
- 🔒 Secure file validation

**Need help?** Check [MULTIMEDIA_FEATURES.md](MULTIMEDIA_FEATURES.md) for detailed feature documentation.
