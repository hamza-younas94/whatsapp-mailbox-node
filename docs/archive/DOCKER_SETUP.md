# 🐳 Docker Setup Guide

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- 2GB RAM minimum
- 10GB disk space

## Quick Setup (5 Minutes)

### 1. Clone & Navigate
```bash
cd /root/whatsapp-mailbox-php/whatsapp-mailbox-node
```

### 2. Create Environment File
```bash
cp .env.example .env
nano .env
```

**Required Variables:**
```env
# Database
DB_NAME=whatsapp_mailbox
DB_USER=mailbox
DB_PASSWORD=your_strong_password_here
DB_ROOT_PASSWORD=your_root_password_here

# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET=your_jwt_secret_key_here

# WhatsApp Business API (if using official API)
WHATSAPP_ACCESS_TOKEN=your_meta_access_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token

# Application
PORT=3000
NODE_ENV=production
```

### 3. Install Dependencies (First Time Only)
```bash
npm install
```

### 4. Build & Start Containers
```bash
# Build the image
docker compose build

# Start all services
docker compose up -d

# Check status
docker compose ps
```

### 5. Run Database Migrations
```bash
# Generate Prisma client
docker compose exec app npx prisma generate

# Run migrations
docker compose exec app npx prisma migrate deploy

# (Optional) Seed demo data
docker compose exec app npm run db:seed
```

## Verify Installation

### Check Services
```bash
# View logs
docker compose logs -f app

# Check all containers are running
docker compose ps

# Expected output:
# whatsapp-mailbox        running    0.0.0.0:3000->3000/tcp
# whatsapp-mailbox-db     running    0.0.0.0:3306->3306/tcp
# whatsapp-mailbox-redis  running    0.0.0.0:6379->6379/tcp
```

### Test API
```bash
# Health check
curl http://localhost:3000/health

# Expected: {"status":"ok"}
```

### Test WhatsApp Web QR Code
```bash
# Open in browser
http://your-server-ip:3000/qr-test.html

# Or use curl to register a user
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin User",
    "email": "admin@example.com",
    "password": "securepassword123",
    "phone": "+1234567890"
  }'
```

## Common Commands

### Start/Stop Services
```bash
# Start
docker compose up -d

# Stop
docker compose stop

# Restart
docker compose restart

# Stop and remove containers
docker compose down

# Stop and remove with volumes (deletes data!)
docker compose down -v
```

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f app
docker compose logs -f db
docker compose logs -f redis

# Last 100 lines
docker compose logs --tail=100 app
```

### Database Access
```bash
# Connect to MySQL
docker compose exec db mysql -u mailbox -p whatsapp_mailbox

# Backup database
docker compose exec db mysqldump -u root -p whatsapp_mailbox > backup.sql

# Restore database
docker compose exec -T db mysql -u root -p whatsapp_mailbox < backup.sql
```

### Application Shell
```bash
# Access app container
docker compose exec app /bin/bash

# Run Prisma commands
docker compose exec app npx prisma studio
docker compose exec app npx prisma migrate dev
```

### Clean Up
```bash
# Remove stopped containers
docker compose rm

# Remove unused images
docker image prune -a

# Remove all (containers, networks, volumes)
docker compose down -v
docker system prune -a
```

## Production Deployment

### 1. Update Environment
```bash
nano .env
```

Set proper values:
```env
NODE_ENV=production
JWT_SECRET=<strong_random_secret>
DB_PASSWORD=<strong_password>
DB_ROOT_PASSWORD=<strong_root_password>
```

### 2. Secure Database
```bash
# Don't expose MySQL to public
# Edit docker compose.yml, remove:
ports:
  - "3306:3306"  # Remove this line
```

### 3. Add SSL/HTTPS
Use nginx reverse proxy:
```bash
# Install nginx
apt install nginx certbot python3-certbot-nginx

# Configure nginx
nano /etc/nginx/sites-available/whatsapp-mailbox

# Add:
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}

# Enable site
ln -s /etc/nginx/sites-available/whatsapp-mailbox /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx

# Get SSL certificate
certbot --nginx -d your-domain.com
```

### 4. Setup Auto-Start
```bash
# Enable Docker service
systemctl enable docker

# Create systemd service
nano /etc/systemd/system/whatsapp-mailbox.service

# Add:
[Unit]
Description=WhatsApp Mailbox
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/root/whatsapp-mailbox-php/whatsapp-mailbox-node
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target

# Enable and start
systemctl enable whatsapp-mailbox
systemctl start whatsapp-mailbox
```

### 5. Setup Monitoring
```bash
# Install monitoring script
cat > /usr/local/bin/check-mailbox.sh << 'EOF'
#!/bin/bash
if ! curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "App is down, restarting..."
    cd /root/whatsapp-mailbox-php/whatsapp-mailbox-node
    docker compose restart app
    echo "$(date): App restarted" >> /var/log/mailbox-monitor.log
fi
EOF

chmod +x /usr/local/bin/check-mailbox.sh

# Add to crontab (check every 5 minutes)
crontab -e
# Add line:
*/5 * * * * /usr/local/bin/check-mailbox.sh
```

## Troubleshooting

### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000
netstat -tulpn | grep 3000

# Kill process
kill -9 <PID>
```

### Container Won't Start
```bash
# Check logs
docker compose logs app

# Remove and rebuild
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Database Connection Error
```bash
# Check database is running
docker compose ps db

# Check connection
docker compose exec app nc -zv db 3306

# Reset database
docker compose down -v
docker compose up -d
docker compose exec app npx prisma migrate deploy
```

### WhatsApp Web Session Issues
```bash
# Clear sessions
docker compose exec app rm -rf .wwebjs_auth/*

# Restart app
docker compose restart app
```

### Out of Disk Space
```bash
# Check disk usage
df -h

# Clean Docker
docker system prune -a --volumes

# Clean logs
truncate -s 0 /var/lib/docker/containers/*/*-json.log
```

### Permission Issues
```bash
# Fix ownership
chown -R root:root /root/whatsapp-mailbox-php/whatsapp-mailbox-node

# Fix permissions
chmod -R 755 /root/whatsapp-mailbox-php/whatsapp-mailbox-node
```

## Architecture

```
┌─────────────────┐
│   Nginx (80)    │  ← SSL Termination
│   Reverse Proxy │
└────────┬────────┘
         │
┌────────▼────────┐
│  App (3000)     │  ← Node.js + Express
│  whatsapp-      │  ← WhatsApp Web.js
│  mailbox        │  ← Chromium
└────┬───┬────┬───┘
     │   │    │
     │   │    └──────┐
     │   │           │
┌────▼───▼────┐  ┌──▼──────┐
│ MySQL (3306)│  │ Redis   │
│ Database    │  │ (6379)  │
└─────────────┘  └─────────┘
```

## Next Steps

1. **Register first user**: `POST /api/v1/auth/register`
2. **Get JWT token**: `POST /api/v1/auth/login`
3. **Connect WhatsApp**: Visit `/qr-test.html` or use API
4. **Import contacts**: `POST /api/v1/contacts`
5. **Start messaging**: `POST /api/v1/messages`

## Support

- Documentation: `README.md`
- WhatsApp Web Guide: `WHATSAPP_WEB_GUIDE.md`
- API Testing: `API_TESTING.md`
- Features: `FEATURES.md`
