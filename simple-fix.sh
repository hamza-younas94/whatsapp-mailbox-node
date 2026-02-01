#!/bin/bash
# Simple fix for all route files

cd "$(dirname "$0")"

# Fix contacts.ts
sed -i '' '16s/^/  const prisma = getPrismaClient();\n/' src/routes/contacts.ts

# Fix messages.ts  
sed -i '' '17s/^/  const prisma = getPrismaClient();\n/' src/routes/messages.ts

# Fix broadcasts.ts
sed -i '' '20s/^/  const prisma = getPrismaClient();\n/' src/routes/broadcasts.ts

# Fix automations.ts
sed -i '' '20s/^/  const prisma = getPrismaClient();\n/' src/routes/automations.ts

# Fix crm.ts
sed -i '' '16s/^/  const prisma = getPrismaClient();\n/' src/routes/crm.ts

# Fix notes.ts
sed -i '' '16s/^/  const prisma = getPrismaClient();\n/' src/routes/notes.ts

# Fix quick-replies.ts
sed -i '' '17s/^/  const prisma = getPrismaClient();\n/' src/routes/quick-replies.ts

# Fix segments.ts
sed -i '' '17s/^/  const prisma = getPrismaClient();\n/' src/routes/segments.ts

# Fix tags.ts
sed -i '' '17s/^/  const prisma = getPrismaClient();\n/' src/routes/tags.ts

# Fix axios import in whatsapp.service.ts
sed -i '' '4s|^import|// @ts-ignore\nimport|' src/services/whatsapp.service.ts

echo "✅ All fixes applied!"
npm run build
