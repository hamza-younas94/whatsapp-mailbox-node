# 🚀 Standard Deployment Workflow

## This workflow MUST be followed for every code change

---

## 📋 Pre-Deployment Checklist

- [ ] All code changes tested locally
- [ ] TypeScript compiles without errors
- [ ] No console errors in browser
- [ ] Database migrations created (if schema changed)
- [ ] Documentation updated

---

## 🔄 Step-by-Step Deployment Process

### 1️⃣ Test Locally First
```bash
# Build TypeScript
npm run build

# Check for errors
npm run type-check

# Test locally
npm run dev
```

### 2️⃣ Commit Changes
```bash
# Check status
git status

# Add all changes
git add .

# Commit with descriptive message
git commit -m "feat: [Brief description of changes]

- Fixed QR auto-initialization on deployment
- Fixed tags display in contact info
- Added complete invoicing system
- Optimized contacts pane performance"
```

**Commit Message Format:**
- `feat:` - New feature
- `fix:` - Bug fix
- `perf:` - Performance improvement
- `docs:` - Documentation only
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `chore:` - Maintenance tasks

### 3️⃣ Push to Repository
```bash
# Push to main branch
git push origin main

# Or push to specific branch
git push origin your-branch-name
```

### 4️⃣ Deploy to Server

**Option A: Full Deployment (Recommended for major changes)**
```bash
# Run full deployment script
./deploy.sh
```

**Option B: Quick Deployment (For minor changes)**
```bash
# Run quick deployment
./quick-deploy.sh
```

### 5️⃣ Verify Deployment

#### A. Check Server Status
```bash
# SSH into server
ssh your-server

# Check PM2 processes
pm2 status

# Check logs for errors
pm2 logs --lines 50
```

#### B. Verify Database
```bash
# If migrations were added
ssh your-server
cd /path/to/app
npx prisma migrate deploy
```

#### C. Test Critical Features

1. **QR Initialization**
   - [ ] Open browser devtools console
   - [ ] Should see "Auto-restoring WhatsApp sessions..."
   - [ ] QR code appears immediately (no 5-second delay)

2. **Tags Display**
   - [ ] Open any contact
   - [ ] Click tags tab
   - [ ] Tags should display correctly
   - [ ] Console shows "Loaded contact tags: [...]"

3. **Invoicing System** (if applicable)
   ```bash
   # Test shop creation
   curl -X POST https://your-domain.com/api/v1/shops \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"name":"Test Shop","type":"ONLINE","currency":"USD"}'
   
   # Should return 201 Created
   ```

4. **Contacts Performance**
   - [ ] Open contacts page
   - [ ] Search is responsive (300ms debounce)
   - [ ] Scrolling is smooth
   - [ ] Images lazy load

5. **General Health Check**
   ```bash
   # Check health endpoint
   curl https://your-domain.com/health
   
   # Should return:
   # {"status":"ok","timestamp":"...","environment":"production"}
   ```

#### D. Check Error Logs
```bash
# On server
pm2 logs --err --lines 100

# Look for any errors after deployment
```

---

## 🐛 Troubleshooting After Deployment

### Server Won't Start
```bash
# Check logs
pm2 logs

# Restart manually
pm2 restart all

# If still failing, check syntax
cd /path/to/app
npm run build
```

### Database Issues
```bash
# Run migrations
npx prisma migrate deploy

# Check database connection
npx prisma db pull

# Reset if needed (CAUTION: loses data)
npx prisma migrate reset
```

### Environment Variables Missing
```bash
# Check .env file exists
cat .env

# Restart PM2 to reload env vars
pm2 restart all --update-env
```

### Port Already in Use
```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 PID
```

---

## 📊 Post-Deployment Monitoring

### First 5 Minutes
- [ ] Check PM2 status every minute
- [ ] Monitor error logs
- [ ] Test critical user flows
- [ ] Check database connections

### First Hour
- [ ] Monitor error rate
- [ ] Check response times
- [ ] Verify WebSocket connections
- [ ] Test WhatsApp connectivity

### First 24 Hours
- [ ] Review error logs daily
- [ ] Check user reports
- [ ] Monitor server resources (CPU, RAM)
- [ ] Verify automated tasks running

---

## 🔔 Rollback Procedure (If Issues Found)

### Quick Rollback
```bash
# On server
git log --oneline -10  # Find previous commit
git checkout PREVIOUS_COMMIT_HASH
npm run build
pm2 restart all
```

### Database Rollback
```bash
# Rollback last migration
npx prisma migrate resolve --rolled-back MIGRATION_NAME

# Re-run previous migration
npx prisma migrate deploy
```

---

## 📝 Deployment Log Template

After each deployment, record:

```
Date: YYYY-MM-DD HH:MM
Commit: [Git commit hash]
Branch: main
Deployed by: [Your name]
Deployment method: deploy.sh / quick-deploy.sh

Changes:
- [Change 1]
- [Change 2]
- [Change 3]

Tests Passed:
✅ QR initialization
✅ Tags display
✅ Invoicing API
✅ Contact performance
✅ Health check

Issues Found:
- [Any issues]

Rollback Required: Yes/No

Notes:
- [Any additional notes]
```

---

## ⚡ Quick Reference Commands

### Essential Commands
```bash
# Local build & test
npm run build && npm run dev

# Commit & push
git add . && git commit -m "feat: changes" && git push

# Full deploy
./deploy.sh

# Quick deploy
./quick-deploy.sh

# Check server
ssh server "pm2 status && pm2 logs --lines 20"

# Health check
curl https://your-domain.com/health
```

### One-Line Deploy
```bash
# Complete workflow in one command
npm run build && git add . && git commit -m "feat: updates" && git push && ./deploy.sh
```

---

## 🎯 Success Criteria

A deployment is successful when ALL of these are true:

- ✅ Server starts without errors
- ✅ PM2 shows all processes as "online"
- ✅ Health endpoint returns 200 OK
- ✅ QR initialization works immediately
- ✅ Tags display correctly
- ✅ No console errors in browser
- ✅ No error logs on server
- ✅ All API endpoints respond correctly
- ✅ Database connections stable
- ✅ WebSocket connections working

---

## 🚨 Emergency Contacts

**If deployment fails:**
1. Check this document's troubleshooting section
2. Review PM2 logs: `pm2 logs --err`
3. Rollback if critical: `git checkout PREVIOUS_COMMIT`
4. Document issue for future reference

---

## 📚 Related Documentation

- [DEPLOYMENT_FIXES_SUMMARY.md](DEPLOYMENT_FIXES_SUMMARY.md) - Recent fixes
- [INVOICING_SYSTEM_GUIDE.md](INVOICING_SYSTEM_GUIDE.md) - Invoicing system docs
- [QUICK_DEPLOYMENT_GUIDE.md](QUICK_DEPLOYMENT_GUIDE.md) - Quick reference
- [deploy.sh](deploy.sh) - Full deployment script
- [quick-deploy.sh](quick-deploy.sh) - Quick deployment script

---

## ✅ Final Checklist

Before marking deployment as complete:

- [ ] Code committed and pushed
- [ ] Deployment script executed successfully
- [ ] Server restarted and running
- [ ] All tests passed
- [ ] No errors in logs
- [ ] Documentation updated
- [ ] Deployment logged
- [ ] Team notified (if applicable)

---

**Remember: Always test locally before deploying to production!**

**Last Updated:** February 1, 2026
