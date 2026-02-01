#!/bin/bash
# Deploy timeout fix to production server

set -e

echo "📦 Building locally with new timeout..."
npm run build

echo "✅ Verifying dist has protocolTimeout: 600000..."
grep -n "protocolTimeout: 600000" dist/services/whatsapp-web.service.js || {
  echo "❌ ERROR: dist/services/whatsapp-web.service.js still has old timeout!"
  exit 1
}

echo "🚀 On server, run these commands:"
echo ""
echo "cd ~/whatsapp-mailbox-php/whatsapp-mailbox-node"
echo "git pull origin main"
echo "npm run build  # Rebuild with new timeout"
echo "pm2 restart whatsapp"
echo ""
echo "Then verify the running process:"
echo "grep -n 'protocolTimeout' dist/services/whatsapp-web.service.js"
echo ""
echo "Or SSH and run directly:"
echo "ssh root@api-box 'cd ~/whatsapp-mailbox-php/whatsapp-mailbox-node && git pull && npm run build && pm2 restart whatsapp && grep protocolTimeout dist/services/whatsapp-web.service.js | head -1'"
