#!/bin/bash

# Quick deploy script - Run this on server for fast deployment

set -e

echo "🚀 Quick Deploy - WhatsApp Mailbox"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Build and restart
echo "📦 Building..."
npm run build > /dev/null 2>&1 && echo "✓ Backend built"

cd frontend
npm run build > /dev/null 2>&1 && echo "✓ Frontend built"
cd ..

echo "🔄 Restarting server..."
pm2 restart whatsapp

echo ""
echo "✅ Deployed!"
pm2 logs whatsapp --lines 10 --nostream
