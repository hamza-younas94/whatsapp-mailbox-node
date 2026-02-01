#!/bin/bash
# Server deployment and verification script
# Run this ON THE SERVER (root@api-box)

set -e

echo "🔍 Current status check..."
cd ~/whatsapp-mailbox-php/whatsapp-mailbox-node

# Check current built timeout
echo ""
echo "📦 Currently deployed timeout:"
grep -n "protocolTimeout" dist/services/whatsapp-web.service.js | head -1 || echo "❌ Not found in dist/"

echo ""
echo "🔄 Pulling latest code..."
git pull origin main

echo ""
echo "🏗️  Rebuilding application..."
npm run build

echo ""
echo "✅ New built timeout:"
grep -n "protocolTimeout" dist/services/whatsapp-web.service.js | head -1

echo ""
echo "🔄 Restarting PM2 process..."
pm2 restart whatsapp

echo ""
echo "📊 Checking PM2 status..."
pm2 list

echo ""
echo "📝 Tailing logs (Ctrl+C to stop)..."
echo "Look for next send attempt to verify it waits longer than 3 minutes"
echo ""
pm2 logs whatsapp --lines 50
