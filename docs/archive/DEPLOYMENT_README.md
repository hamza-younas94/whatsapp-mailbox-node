# 🚀 Quick Start - Deployment Commands

## For ALL Future Changes - Use This!

### Automated Complete Deployment (Recommended)
```bash
./deploy-current-changes.sh
```

This script will automatically:
1. ✅ Build and test locally
2. ✅ Commit your changes with proper message
3. ✅ Push to git repository
4. ✅ Deploy to server (you choose full or quick)
5. ✅ Verify deployment
6. ✅ Generate deployment log

---

## Manual Step-by-Step (If you prefer)

### 1. Commit & Push
```bash
git add .
git commit -m "feat: your changes description"
git push origin main
```

### 2. Deploy
```bash
# Full deployment (recommended for major changes)
./deploy.sh

# OR quick deployment (for minor updates)
./quick-deploy.sh
```

### 3. Verify
```bash
# Check health
curl https://your-domain.com/health

# Check logs
ssh your-server "pm2 logs --lines 20"
```

---

## Files Created for You

1. **`DEPLOYMENT_WORKFLOW.md`** - Complete deployment process documentation
2. **`deploy-current-changes.sh`** - Automated deployment script (USE THIS!)
3. **`DEPLOYMENT_FIXES_SUMMARY.md`** - Summary of recent fixes
4. **`INVOICING_SYSTEM_GUIDE.md`** - Invoicing system documentation
5. **`QUICK_DEPLOYMENT_GUIDE.md`** - Quick reference guide

---

## Most Common Use Case

```bash
# After making any code changes:
./deploy-current-changes.sh

# That's it! Script handles everything else.
```

---

## Troubleshooting

If deployment fails:
1. Check the deployment log file created
2. Review `DEPLOYMENT_WORKFLOW.md` troubleshooting section
3. Check server logs: `ssh server "pm2 logs --err"`
4. Rollback if needed: See DEPLOYMENT_WORKFLOW.md

---

## What Was Fixed Today

✅ **QR auto-initialization** - Now starts immediately on deployment
✅ **Tags display** - Fixed to show existing tags properly  
✅ **Invoicing system** - Complete implementation with 30+ endpoints
✅ **Contacts performance** - Optimized with debouncing and lazy loading

---

**Remember:** Always run `./deploy-current-changes.sh` after making changes!
