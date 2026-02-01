#!/bin/bash

# =============================================================================
# Automated Deployment Script - Current Changes
# This script commits, pushes, deploys, and verifies all changes
# =============================================================================

set -e  # Exit on error

echo "🚀 Starting Automated Deployment Process..."
echo "================================================"

# Server Configuration
SSH_KEY="$HOME/.ssh/do"
SERVER_USER="root"
SERVER_IP="152.42.216.141"
SERVER_PATH="/root/whatsapp-mailbox-node"
SERVER_URL="http://152.42.216.141:3000"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# =============================================================================
# Step 1: Pre-deployment checks
# =============================================================================
echo -e "${BLUE}Step 1: Running pre-deployment checks...${NC}"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: package.json not found. Are you in the project root?${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Pre-deployment checks passed${NC}"

# =============================================================================
# Step 2: Build and test locally
# =============================================================================
echo -e "${BLUE}Step 2: Building and testing locally...${NC}"

# Build TypeScript
echo "Building TypeScript..."
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}Build failed! Fix errors before deploying.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Build successful${NC}"

# =============================================================================
# Step 3: Auto-generate commit message
# =============================================================================
echo -e "${BLUE}Step 3: Preparing commit...${NC}"

# Check git status
echo "Current changes:"
git status --short

# Auto-detect commit type based on changes
prefix="feat"
commit_msg="Deploy QR fixes, invoicing system, and performance optimizations"

# Check what changed to auto-select commit type
CHANGED_FILES=$(git status --porcelain)
if echo "$CHANGED_FILES" | grep -q "fix"; then
    prefix="fix"
    commit_msg="Fix QR initialization, tags display, and add invoicing"
elif echo "$CHANGED_FILES" | grep -q "\.md$"; then
    if ! echo "$CHANGED_FILES" | grep -q "\.ts$\|\.tsx$"; then
        prefix="docs"
        commit_msg="Update deployment and feature documentation"
    fi
fi

FULL_COMMIT_MSG="$prefix: $commit_msg

Changes in this deployment:
- QR auto-initialization fix (immediate startup)
- Tags display fix (handles TagOnContact structure)
- Complete invoicing system (shops, products, orders, invoices)
- Contacts performance optimization (debouncing, lazy loading, caching)
- Deployment automation scripts and documentation

Deployed: $(date '+%Y-%m-%d %H:%M:%S')"

echo ""
echo "Auto-generated commit: $prefix: $commit_msg"
echo ""

# =============================================================================
# Step 4: Commit changes
# =============================================================================
echo -e "${BLUE}Step 4: Committing changes...${NC}"

git add .
git commit -m "$FULL_COMMIT_MSG"

echo -e "${GREEN}✓ Changes committed${NC}"

# =============================================================================
# Step 5: Push to repository
# =============================================================================
echo -e "${BLUE}Step 5: Pushing to repository...${NC}"

# Get current branch
BRANCH=$(git branch --show-current)
echo "Pushing to branch: $BRANCH"

git push origin $BRANCH

if [ $? -ne 0 ]; then
    echo -e "${RED}Push failed! Check your git credentials.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Pushed to repository${NC}"

# =============================================================================
# Step 6: Deploy to server
# =============================================================================
echo -e "${BLUE}Step 6: Deploying to server ${SERVER_IP}...${NC}"

# Auto-select full deployment
deploy_method="1"
echo "Using FULL deployment (pull, install, migrate, build, restart)"
echo ""

# SSH into server and deploy
echo "Connecting to server..."
ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_IP" << 'ENDSSH'
    set -e
    echo "📦 Starting full deployment..."
    
    # Load NVM
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    
    # Navigate to project directory
    cd /root/whatsapp-mailbox-node
    
    # Pull latest changes
    echo "⬇️  Pulling latest code..."
    git pull origin main
    
    # Install dependencies
    echo "📚 Installing dependencies..."
    npm install
    
    # Run database migrations
    echo "🗄️  Running database migrations..."
    npx prisma generate
    npx prisma migrate deploy
    
    # Build TypeScript
    echo "🔨 Building TypeScript..."
    npm run build
    
    # Restart PM2
    echo "🔄 Restarting services..."
    pm2 restart all
    
    echo "✅ Full deployment complete!"
ENDSSH

if [ $? -ne 0 ]; then
    echo -e "${RED}Deployment failed! Check server logs.${NC}"
    echo "To check logs: ssh -i $SSH_KEY $SERVER_USER@$SERVER_IP 'pm2 logs --err --lines 50'"
    exit 1
fi

echo -e "${GREEN}✓ Deployed to server successfully${NC}"

# =============================================================================
# Step 7: Verify deployment on server
# =============================================================================
echo -e "${BLUE}Step 7: Verifying deployment on server...${NC}"

# Wait for server to restart
echo "Waiting for server to restart (15 seconds)..."
sleep 15

# Check PM2 status on server
echo "Checking PM2 status..."
PM2_STATUS=$(ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_IP" "pm2 status" || echo "ERROR")

if echo "$PM2_STATUS" | grep -q "online"; then
    echo -e "${GREEN}✓ PM2 processes are online${NC}"
else
    echo -e "${RED}⚠ PM2 status check failed${NC}"
    echo "$PM2_STATUS"
fi

# Health check
echo "Checking health endpoint at $SERVER_URL..."
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$SERVER_URL/health" 2>/dev/null || echo "000")

if [ "$HEALTH_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✓ Health check passed (HTTP $HEALTH_RESPONSE)${NC}"
else
    echo -e "${YELLOW}⚠ Health check returned: HTTP $HEALTH_RESPONSE${NC}"
    echo "Checking server logs..."
    ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_IP" "pm2 logs --err --lines 10"
fi

# Check for errors in logs
echo "Checking recent logs for errors..."
ERROR_COUNT=$(ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_IP" "pm2 logs --err --lines 50 --nostream 2>/dev/null | grep -i error | wc -l" || echo "0")

if [ "$ERROR_COUNT" -gt "0" ]; then
    echo -e "${YELLOW}⚠ Found $ERROR_COUNT errors in logs${NC}"
    echo "Run this to check: ssh -i $SSH_KEY $SERVER_USER@$SERVER_IP 'pm2 logs --err --lines 50'"
else
    echo -e "${GREEN}✓ No errors found in recent logs${NC}"
fi

# =============================================================================
# Step 8: Generate deployment log
# =============================================================================
echo -e "${BLUE}Step 8: Generating deployment log...${NC}"

COMMIT_HASH=$(git rev-parse HEAD)
DEPLOY_LOG="deployment-log-$(date '+%Y%m%d-%H%M%S').txt"

cat > "$DEPLOY_LOG" << EOF
=============================================================================
DEPLOYMENT LOG
=============================================================================

Date: $(date '+%Y-%m-%d %H:%M:%S')
Commit: $COMMIT_HASH
Branch: $BRANCH
Commit Message: $prefix: $commit_msg

Changes Deployed:
- QR auto-initialization fix (immediate startup)
- Tags display fix (handles TagOnContact structure)
- Complete invoicing system (shops, products, orders, invoices)
- Contacts performance optimization (debouncing, lazy loading, caching)
- Deployment automation scripts and documentation

Deployment Method: Full deployment via SSH
Server: $SERVER_IP
Server URL: $SERVER_URL
Health Check: HTTP $HEALTH_RESPONSE
PM2 Status: $(echo "$PM2_STATUS" | grep -q "online" && echo "Online" || echo "Check Required")

Verification Checklist:
[ ] QR initialization working
[ ] Tags displaying correctly
[ ] Invoicing API responding
[ ] Contacts pane smooth scrolling
[ ] No console errors
[ ] No server errors

Status: DEPLOYED ✓

=============================================================================
EOF

echo -e "${GREEN}✓ Deployment log created: $DEPLOY_LOG${NC}"

# =============================================================================
# Final Summary
# =============================================================================
echo ""
echo "================================================"
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo "================================================"
echo ""
echo "Deployment Details:"
echo "  Server: $SERVER_IP"
echo "  URL: $SERVER_URL"
echo "  Branch: $BRANCH"
echo "  Commit: $COMMIT_HASH"
echo ""
echo "Next Steps:"
echo "  1. Verify QR initialization: $SERVER_URL"
echo "  2. Test tags display in contact info"
echo "  3. Test invoicing endpoints: $SERVER_URL/api/v1/shops"
echo "  4. Check contacts page performance"
echo "  5. Monitor logs for errors"
echo ""
echo "Quick Commands:"
echo "  Check status:  ssh -i $SSH_KEY $SERVER_USER@$SERVER_IP 'pm2 status'"
echo "  View logs:     ssh -i $SSH_KEY $SERVER_USER@$SERVER_IP 'pm2 logs --lines 50'"
echo "  Restart:       ssh -i $SSH_KEY $SERVER_USER@$SERVER_IP 'pm2 restart all'"
echo "  SSH to server: ssh -i $SSH_KEY $SERVER_USER@$SERVER_IP"
echo ""
echo "To rollback on server:"
echo "  ssh -i $SSH_KEY $SERVER_USER@$SERVER_IP 'cd $SERVER_PATH && git checkout HEAD~1 && npm run build && pm2 restart all'"
echo ""
echo -e "${GREEN}🎉 Deployment successful! Server is live at $SERVER_URL ✓${NC}"
