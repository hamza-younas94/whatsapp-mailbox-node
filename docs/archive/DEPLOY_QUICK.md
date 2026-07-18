# 🚀 Quick Deployment Guide

## Critical Fix Applied ✅
**Problem**: Media uploads were failing with "mediaUrl: Invalid url" error
**Solution**: 
- Changed validation from strict URL to accept relative paths
- Frontend now converts relative URLs to full URLs
- Better error handling for upload failures

---

## Deploy to Server (2 Options)

### Option 1: Full Deployment (Recommended)
Complete deployment with all steps:
```bash
ssh root@api-box
cd /root/whatsapp-mailbox-php/whatsapp-mailbox-node
./deploy.sh
```

**What it does:**
- ✅ Git pull latest code
- ✅ Install backend dependencies
- ✅ Install frontend dependencies  
- ✅ Run database migrations (safe_fix.sql)
- ✅ Generate Prisma Client
- ✅ Build frontend
- ✅ Build backend
- ✅ Create uploads directory
- ✅ Restart PM2 application

**Time:** ~2-3 minutes

---

### Option 2: Quick Deploy (Fast)
For code-only changes (no new dependencies):
```bash
ssh root@api-box
cd /root/whatsapp-mailbox-php/whatsapp-mailbox-node
git pull
./quick-deploy.sh
```

**What it does:**
- ✅ Build backend
- ✅ Build frontend
- ✅ Restart PM2

**Time:** ~30 seconds

---

## Manual Deployment (If Scripts Fail)

```bash
# 1. Connect to server
ssh root@api-box

# 2. Navigate to project
cd /root/whatsapp-mailbox-php/whatsapp-mailbox-node

# 3. Pull code
git pull origin main

# 4. Install dependencies
npm install
cd frontend && npm install && cd ..

# 5. Database migration (if needed)
mysql -u root -p whatsapp_mailbox < safe_fix.sql

# 6. Generate Prisma
npx prisma generate

# 7. Build everything
cd frontend && npm run build && cd ..
npm run build

# 8. Create uploads folder
mkdir -p uploads/media
chmod 755 uploads/media

# 9. Restart server
pm2 restart whatsapp
pm2 logs whatsapp
```

---

## Verify Deployment

### Check PM2 Status
```bash
pm2 status
pm2 logs whatsapp --lines 50
```

**Look for:**
- ✅ Status: `online`
- ✅ No error logs
- ✅ "Server running on port 3000"
- ✅ "Database connected successfully"

### Test Media Upload
1. Open WhatsApp Mailbox in browser
2. Click paperclip button or drag a file
3. Select/drop an image
4. Verify preview appears
5. Click send
6. Check message sent with media

### Check Uploads Directory
```bash
ls -lh /root/whatsapp-mailbox-php/whatsapp-mailbox-node/uploads/media/
```

Should show uploaded files after testing.

---

## Common Issues & Fixes

### Issue 1: "mediaUrl: Invalid url"
**Status:** ✅ FIXED in latest commit
**What was fixed:** Validation now accepts relative paths like `/uploads/media/file.jpg`

### Issue 2: PM2 Not Found
```bash
npm install -g pm2
```

### Issue 3: MySQL Not Running
```bash
systemctl start mysql
# or
service mysql start
```

### Issue 4: Permission Denied on uploads/
```bash
chmod 755 uploads/media
chown -R $USER:$USER uploads/
```

### Issue 5: Port 3000 Already in Use
```bash
pm2 stop whatsapp
lsof -ti:3000 | xargs kill -9
pm2 start whatsapp
```

---

## PM2 Quick Commands

```bash
# View real-time logs
pm2 logs whatsapp -f

# Monitor CPU/memory
pm2 monit

# Restart app
pm2 restart whatsapp

# Stop app
pm2 stop whatsapp

# View status
pm2 status

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

---

## What's New in This Update

### Fixed Issues ✅
- ✅ Media URL validation error resolved
- ✅ Files now upload correctly
- ✅ Better error messages for failed uploads
- ✅ Full URL conversion in frontend

### New Features 🎉
- 🎤 Voice recording with timer
- 📎 Drag & drop file upload
- 📁 Multiple file attachments (up to 10)
- 🎨 Support for images, videos, audio, documents
- ⚡ 50MB file size limit per file

### New Scripts 🛠️
- **deploy.sh**: Complete deployment automation
- **quick-deploy.sh**: Fast rebuild and restart

---

## Testing Checklist

After deployment, test these features:

- [ ] Login works
- [ ] Conversations load
- [ ] Can send text message
- [ ] Can click paperclip to upload file
- [ ] Can drag & drop file
- [ ] File preview appears
- [ ] Can send image
- [ ] Can send video
- [ ] Can send PDF
- [ ] Voice recording works (click mic)
- [ ] Recording timer shows
- [ ] Can send voice note
- [ ] Media displays in chat
- [ ] Multiple files can be attached

---

## Emergency Rollback

If something breaks after deployment:

```bash
# Go back to previous commit
cd /root/whatsapp-mailbox-php/whatsapp-mailbox-node
git log --oneline  # Find previous commit hash
git reset --hard <previous-commit-hash>

# Rebuild
npm run build
cd frontend && npm run build && cd ..

# Restart
pm2 restart whatsapp
```

---

## Support

**View Logs:**
```bash
pm2 logs whatsapp --lines 100
```

**Check Database:**
```bash
mysql -u root -p whatsapp_mailbox
USE whatsapp_mailbox;
DESCRIBE Message;  # Should show mediaUrl column
SELECT * FROM Message WHERE mediaUrl IS NOT NULL LIMIT 5;
```

**Test API Endpoint:**
```bash
curl -X POST http://localhost:3000/api/v1/media/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test.jpg"
```

---

## Success Indicators

✅ **Deployment Successful When:**
- PM2 shows "online" status
- No errors in logs
- Can send and receive messages
- Media uploads work
- Files appear in `uploads/media/`
- Images display in chat

🎉 **You're All Set!**
