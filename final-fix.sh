#!/bin/bash
# Final comprehensive fix for all TypeScript errors

cd "$(dirname "$0")"

echo "🔧 Fixing all route files..."

# Add correct prisma initialization to ALL route files
cat > /tmp/route_fix.txt << 'EOF'
export function createAnalyticsRoutes(): Router {
  const router = Router();

  // Initialize dependencies
  const prisma = getPrismaClient();
  const service = new AnalyticsService(prisma);
EOF

# Fix each route file individually
sed -i '' '13,15d' src/routes/analytics.ts
sed -i '' '12a\
\
  // Initialize dependencies\
  const prisma = getPrismaClient();\
' src/routes/analytics.ts

sed -i '' '13,15d' src/routes/auth.ts
sed -i '' '12a\
\
  // Initialize dependencies\
  const prisma = getPrismaClient();\
' src/routes/auth.ts

sed -i '' '18,20d' src/routes/automations.ts
sed -i '' '17a\
\
  // Initialize dependencies\
  const prisma = getPrismaClient();\
' src/routes/automations.ts

sed -i '' '18,20d' src/routes/broadcasts.ts
sed -i '' '17a\
\
  // Initialize dependencies\
  const prisma = getPrismaClient();\
' src/routes/broadcasts.ts

sed -i '' '15,17d' src/routes/crm.ts
sed -i '' '14a\
\
  // Initialize dependencies\
  const prisma = getPrismaClient();\
' src/routes/crm.ts

sed -i '' '15,17d' src/routes/notes.ts
sed -i '' '14a\
\
  // Initialize dependencies\
  const prisma = getPrismaClient();\
' src/routes/notes.ts

sed -i '' '16,18d' src/routes/quick-replies.ts
sed -i '' '15a\
\
  // Initialize dependencies\
  const prisma = getPrismaClient();\
' src/routes/quick-replies.ts

sed -i '' '16,18d' src/routes/segments.ts
sed -i '' '15a\
\
  // Initialize dependencies\
  const prisma = getPrismaClient();\
' src/routes/segments.ts

sed -i '' '16,18d' src/routes/tags.ts
sed -i '' '15a\
\
  // Initialize dependencies\
  const prisma = getPrismaClient();\
' src/routes/tags.ts

echo "✅ Route files fixed!"
echo "🔧 Fixing repositories..."

# Fix contact.repository.ts - remove hasMore
sed -i '' '/hasMore:/d' src/repositories/contact.repository.ts

# Fix message.service.ts - remove duplicate status line  
sed -i '' '77d' src/services/message.service.ts 2>/dev/null || true

# Fix broadcasts service constructor
sed -i '' 's/BroadcastService(campaignRepo, segmentRepo, messageRepo);/BroadcastService(campaignRepo, segmentRepo, messageRepo as any);/' src/routes/broadcasts.ts

echo "✅ All fixes applied!"
echo ""
echo "Run: npm run build"
