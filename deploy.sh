#!/bin/bash

# WhatsApp Mailbox - Complete Deployment Script
# This script handles full deployment: dependencies, builds, database, and server restart

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration - Auto-detect current directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"
FRONTEND_DIR="$PROJECT_DIR/frontend"
PM2_APP_NAME="whatsapp"

# Functions
log_info() {
    echo -e "${BLUE}ℹ ${NC}$1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

separator() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Check if script is run from project directory
if [ ! -f "$PROJECT_DIR/package.json" ]; then
    log_error "Project package.json not found at $PROJECT_DIR"
    exit 1
fi

cd "$PROJECT_DIR"

separator
log_info "Starting WhatsApp Mailbox Deployment"
echo "Project: $PROJECT_DIR"
echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"
separator

# Step 1: Git Pull
log_info "Step 1/9: Pulling latest code from Git..."
if git pull origin main 2>&1 | grep -q "Already up to date"; then
    log_success "Already up to date"
elif git pull origin main; then
    log_success "Git pull successful"
else
    log_warning "Git pull had issues, continuing anyway..."
fi

# Step 2: Backend Dependencies
separator
log_info "Step 2/9: Installing backend dependencies..."
if npm install --production=false; then
    log_success "Backend dependencies installed"
else
    log_error "Failed to install backend dependencies"
    exit 1
fi

# Step 3: Frontend Dependencies
separator
log_info "Step 3/9: Installing frontend dependencies..."
cd "$FRONTEND_DIR"
if npm install; then
    log_success "Frontend dependencies installed"
else
    log_error "Failed to install frontend dependencies"
    exit 1
fi
cd "$PROJECT_DIR"

# Step 4: Database Migration
separator
log_info "Step 4/9: Running database migrations..."
if [ -f "safe_fix.sql" ]; then
    log_info "Applying safe_fix.sql..."
    if mysql -h 127.0.0.1 -u root whatsapp_mailbox < safe_fix.sql 2>&1 | grep -v "already exists"; then
        log_success "Database migration completed"
    else
        log_warning "SQL migration had warnings (columns may already exist)"
    fi
else
    log_warning "safe_fix.sql not found, skipping SQL migration"
fi

# Apply chatId migration if exists
if [ -f "migrations/add_chat_id.sql" ]; then
    log_info "Applying add_chat_id.sql..."
    if mysql -h 127.0.0.1 -u root whatsapp_mailbox < migrations/add_chat_id.sql 2>&1; then
        log_success "chatId migration completed"
    else
        log_warning "chatId migration had warnings"
    fi
fi

# Step 5: Prisma Generate
separator
log_info "Step 5/9: Generating Prisma Client..."
if npx prisma generate; then
    log_success "Prisma Client generated"
else
    log_error "Failed to generate Prisma Client"
    exit 1
fi

# Step 6: Build Frontend
separator
log_info "Step 6/9: Building frontend..."
cd "$FRONTEND_DIR"
if npm run build; then
    log_success "Frontend built successfully"
    log_info "Generated assets:"
    ls -lh ../public/assets/ 2>/dev/null | grep "index-" | awk '{print "  " $9 " (" $5 ")"}'|| true
else
    log_error "Frontend build failed"
    exit 1
fi
cd "$PROJECT_DIR"

# Step 7: Build Backend
separator
log_info "Step 7/9: Building backend (TypeScript compilation)..."
if npm run build; then
    log_success "Backend built successfully"
else
    log_error "Backend build failed"
    exit 1
fi

# Step 8: Create Uploads Directory
separator
log_info "Step 8/9: Setting up uploads directory..."
mkdir -p uploads/media
chmod 755 uploads/media
chown -R $(whoami):$(whoami) uploads/ 2>/dev/null || true
log_success "Uploads directory ready"
log_info "Uploads path: $PROJECT_DIR/uploads/media/"

# Step 9: Restart PM2 Application
separator
log_info "Step 9/9: Restarting PM2 application..."

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    log_warning "PM2 not found. Installing PM2 globally..."
    npm install -g pm2
fi

# Check if app is already managed by PM2
if pm2 list | grep -q "$PM2_APP_NAME"; then
    log_info "Restarting existing PM2 process: $PM2_APP_NAME"
    pm2 restart "$PM2_APP_NAME"
else
    log_info "Starting new PM2 process: $PM2_APP_NAME"
    pm2 start dist/server.js --name "$PM2_APP_NAME"
fi

pm2 save > /dev/null 2>&1 || true
log_success "PM2 application restarted"

# Final Status
separator
log_success "🎉 Deployment completed successfully!"
separator

echo ""
log_info "Application Status:"
pm2 status "$PM2_APP_NAME"

echo ""
log_info "Recent Logs (last 15 lines):"
echo ""
pm2 logs "$PM2_APP_NAME" --lines 15 --nostream

echo ""
separator
log_info "Useful PM2 Commands:"
echo "  View logs:        pm2 logs $PM2_APP_NAME"
echo "  Follow logs:      pm2 logs $PM2_APP_NAME -f"
echo "  Monitor:          pm2 monit"
echo "  Restart:          pm2 restart $PM2_APP_NAME"
echo "  Stop:             pm2 stop $PM2_APP_NAME"
echo "  View status:      pm2 status"

separator
echo -e "${GREEN}✨ WhatsApp Mailbox is now running!${NC}"
echo "Server URL: http://localhost:3000"
if command -v hostname &> /dev/null; then
    IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
    echo "Access at:  http://$IP:3000"
fi
separator
