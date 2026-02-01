#!/bin/bash
set -e

echo "Stopping PM2..."
pm2 stop whatsapp || true

echo "Removing old dependencies..."
rm -rf node_modules package-lock.json

echo "Clearing npm cache..."
npm cache clean --force

echo "Installing v1.34.4 (no cache)..."
npm install --no-cache

echo "Building..."
npm run build

echo "Verifying version..."
npm list whatsapp-web.js

echo "Starting PM2..."
pm2 restart whatsapp

echo "Done! Check logs with: pm2 logs whatsapp"
