FROM node:18-bullseye-slim

WORKDIR /app

# Install dependencies for Chromium and WhatsApp Web
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-sandbox \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    wget \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set Chromium path for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Copy package files
COPY package*.json ./

# Harden npm for flaky networks
RUN npm config set fetch-retries 5 \
  && npm config set fetch-retry-mintimeout 10000 \
  && npm config set fetch-retry-maxtimeout 60000 \
  && npm config set registry https://registry.npmjs.org/

# Install ALL dependencies (needed for TypeScript build)
RUN npm ci && npm cache clean --force

# Copy source code
COPY src ./src
COPY tsconfig.json .
COPY prisma ./prisma
COPY public ./public

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Remove devDependencies to reduce image size
RUN npm prune --production

# Create directory for WhatsApp Web sessions
RUN mkdir -p .wwebjs_auth && chmod 777 .wwebjs_auth

# Remove source files (only keep compiled code)
RUN rm -rf src

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start application with schema push and seed (compiled seed in dist)
CMD ["sh", "-c", "npx prisma db push && node dist/scripts/seed.js && node dist/server.js"]
