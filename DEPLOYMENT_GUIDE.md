# DigitalOcean Deployment Guide

# DigitalOcean Deployment Guide - WITH COMPLETE UI

## 🎉 NEW: Full Web Interface Available!

The application now includes a complete web interface with 11 pages:
- Dashboard, Login/Register, Messages, Contacts, Broadcasts
- Quick Replies, Analytics, Tags, Automation, QR Connect

**First Time Setup:**
1. Navigate to `http://your-domain:3000/register.html`
2. Create your admin account
3. Login at `http://your-domain:3000/login.html`
4. Access dashboard at `http://your-domain:3000/`

See [FRONTEND_UI_COMPLETE.md](./FRONTEND_UI_COMPLETE.md) for full UI documentation.

---

## 📋 Prerequisites

- DigitalOcean account (free $200 credit for new users)
- GitHub account with the repository pushed
- Domain name (optional)

## 🚀 Option 1: App Platform (Easiest)

### Step 1: Create New App

1. Go to DigitalOcean Dashboard
2. Click **Create** → **App**
3. Select **GitHub** and authorize
4. Choose your repository: `whatsapp-mailbox`
5. Leave branch as `main`

### Step 2: Configure Build

1. Click **Edit** on the auto-detected configuration
2. Set:
   - **Source Directory**: `whatsapp-mailbox-node`
   - **Build Command**: `npm ci && npm run build`
   - **Run Command**: `node dist/server.js`

### Step 3: Add Environment Variables

1. Click **Environment** tab
2. Add all from `.env.example`:
   ```
   WHATSAPP_ACCESS_TOKEN=your_token
   WHATSAPP_PHONE_NUMBER_ID=your_id
   JWT_SECRET=your_secret_min_32_chars
   DATABASE_URL=mysql://user:pass@host:3306/db
   ```

### Step 4: Add Database

1. Click **Components** → **Add Component**
2. Choose **Database** → **MySQL**
3. Create new database
4. Copy connection string to `DATABASE_URL` env var

### Step 5: Add Cache (Redis)

1. Click **Components** → **Add Component**
2. Choose **Database** → **Redis**
3. Use connection string for `REDIS_URL`

### Step 6: Deploy

1. Click **Create Resources**
2. Review and confirm
3. Wait for deployment (2-3 minutes)
4. Get your app URL in the deployment dashboard

**Cost**: $12/month base + database costs

---

## 🖥️ Option 2: Ubuntu Droplet (More Control)

### Step 1: Create Droplet

1. DigitalOcean → **Create** → **Droplet**
2. Choose **Ubuntu 22.04 LTS**
3. Select **Basic** plan ($6/month minimum)
4. Add SSH key for access
5. Create droplet

### Step 2: Initial Setup

```bash
# SSH into droplet
ssh root@your_droplet_ip

# Update system
apt update && apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt install -y nodejs

# Install git
apt install -y git

# Install PM2 (process manager)
npm install -g pm2

# Create app user
useradd -m -s /bin/bash appuser
```

### Step 3: Deploy Application

```bash
# Clone repository
cd /home/appuser
git clone https://github.com/yourusername/whatsapp-mailbox.git
cd whatsapp-mailbox/whatsapp-mailbox-node

# Install dependencies
npm ci --omit=dev

# Build
npm run build

# Setup environment
cp .env.example .env
# Edit .env with your values
nano .env
```

### Step 4: Setup Database (MySQL)

```bash
# Install MySQL
apt install -y mysql-server

# Secure installation
mysql_secure_installation

# Create database
mysql -u root -p
CREATE DATABASE whatsapp_mailbox;
CREATE USER 'mailbox'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL ON whatsapp_mailbox.* TO 'mailbox'@'localhost';
FLUSH PRIVILEGES;
EXIT;

# Run migrations
npx prisma migrate deploy
```

### Step 5: Setup Redis (Optional)

```bash
apt install -y redis-server

# Enable and start
systemctl enable redis-server
systemctl start redis-server
```

### Step 6: Setup PM2

```bash
# Start application
pm2 start dist/server.js --name "whatsapp-mailbox"

# Save configuration
pm2 save

# Enable startup on reboot
pm2 startup
```

### Step 7: Setup Nginx Reverse Proxy

```bash
apt install -y nginx

# Create config
nano /etc/nginx/sites-available/whatsapp-mailbox
```

Add:
```nginx
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
    }
}
```

```bash
# Enable site
ln -s /etc/nginx/sites-available/whatsapp-mailbox /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### Step 8: Setup SSL with Let's Encrypt

```bash
apt install -y certbot python3-certbot-nginx

certbot --nginx -d your-domain.com
```

**Cost**: $6-40/month depending on resources

---

## 📊 Monitoring & Logs

### View Logs

**App Platform**:
- View in dashboard → App → Logs

**Droplet with PM2**:
```bash
pm2 logs whatsapp-mailbox
pm2 monit
```

### Setup Alerts

**App Platform**:
1. Go to Settings → Alerts
2. Configure email/Slack notifications for:
   - Deployment failures
   - High CPU usage
   - High memory usage

**Droplet**:
```bash
# Monitor resources
htop

# Monitor application
pm2 monit
```

---

## 🔄 CI/CD Pipeline

### GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: cd whatsapp-mailbox-node && npm ci

      - name: Run tests
        run: cd whatsapp-mailbox-node && npm test

      - name: Build
        run: cd whatsapp-mailbox-node && npm run build

      - name: Deploy to DigitalOcean
        env:
          DIGITALOCEAN_ACCESS_TOKEN: ${{ secrets.DO_TOKEN }}
        run: |
          # Deploy trigger (webhook)
```

---

## 📈 Scaling

### Horizontal Scaling (App Platform)

1. Go to **Settings** → **Scaling**
2. Increase **Instance Count**
3. App Platform auto-balances traffic

### Vertical Scaling (Droplet)

1. Create snapshot of current droplet
2. Resize to larger plan
3. Update DNS if needed

### Database Optimization

```bash
# Add indexes
npx prisma migrate deploy

# Monitor slow queries
mysql -u root -p
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 2;
```

---

## 🔒 Security Checklist

- [ ] Enable HTTPS (SSL/TLS)
- [ ] Configure firewall rules
- [ ] Rotate JWT secret
- [ ] Enable database backups
- [ ] Setup rate limiting
- [ ] Configure CORS properly
- [ ] Use environment variables
- [ ] Enable audit logging
- [ ] Regular security updates
- [ ] Monitor for suspicious activity

---

## 💰 Cost Estimation

| Service | Minimum | Typical | Scalable |
|---------|---------|---------|----------|
| Compute | $6 | $12 | $24+ |
| Database | $15 | $30 | $100+ |
| Storage | $5 | $10 | $50+ |
| **Monthly Total** | **$26** | **$52** | **$174+** |

---

## 🆘 Troubleshooting

### Application won't start
```bash
# Check logs
pm2 logs whatsapp-mailbox --err

# Verify Node version
node --version  # Should be 18+

# Check port
lsof -i :3000
```

### Database connection error
```bash
# Test connection
mysql -u mailbox -p -h localhost whatsapp_mailbox

# Check env vars
cat .env | grep DATABASE_URL
```

### High memory usage
```bash
# Find memory leaks
pm2 logs

# Restart
pm2 restart whatsapp-mailbox

# Check Node options
echo $NODE_OPTIONS
```

---

## 📚 Additional Resources

- [DigitalOcean Docs](https://docs.digitalocean.com)
- [Node.js Production Checklist](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)
- [Prisma Deployment Guide](https://www.prisma.io/docs/guides/deployment)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/pm2-doc-single-page/)

---

**Ready to deploy?** Start with App Platform for simplicity, or Droplet for full control!
