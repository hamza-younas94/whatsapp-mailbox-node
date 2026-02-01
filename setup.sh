#!/bin/bash
# Quick setup script for WhatsApp Mailbox Node.js

set -e

echo "🚀 Setting up WhatsApp Mailbox (Node.js)"
echo "========================================"
echo ""

# Check Node.js version
echo "Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 18+ required. Current version: $(node -v)"
    exit 1
fi
echo "✅ Node.js version: $(node -v)"
echo ""

# Install dependencies
echo "Installing dependencies..."
npm install
echo "✅ Dependencies installed"
echo ""

# Check for .env file
if [ ! -f .env ]; then
    echo "Creating .env file from example..."
    cp .env.example .env
    echo "⚠️  Please edit .env with your database credentials"
    echo ""
fi

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate
echo "✅ Prisma client generated"
echo ""

# Database setup prompt
echo "Do you want to set up the database now? (y/n)"
read -r SETUP_DB

if [ "$SETUP_DB" = "y" ]; then
    echo "Pushing database schema..."
    npx prisma db push
    echo "✅ Database schema created"
    echo ""
fi

echo ""
echo "✨ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env with your configuration"
echo "2. Run 'npm run dev' for development"
echo "3. Run 'npm run build && npm start' for production"
echo "4. Or use Docker: 'docker-compose up -d'"
echo ""
echo "📚 Documentation:"
echo "- README.md - Getting started"
echo "- FEATURES.md - Complete feature list"
echo "- DEPLOYMENT_GUIDE.md - Deployment instructions"
echo "- docs/ARCHITECTURE.md - Architecture details"
echo ""
