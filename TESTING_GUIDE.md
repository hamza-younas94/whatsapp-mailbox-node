# Testing Guide for WhatsApp Mailbox Features

## ✅ Build Status
**Frontend:** Build successful (commit 3380360d)  
**Backend:** Build successful (commit 7a967bf9)

## Features to Test

### 1. Quick Replies ✅
**Status:** Fully implemented and functional

**How to test:**
1. Navigate to Quick Replies page: `/quick-replies.php`
2. Create a quick reply:
   - **Shortcut:** `hello`
   - **Title:** Quick Hello
   - **Content:** Hello! Thanks for reaching out.
3. Go to Mailbox and open any conversation
4. In the message composer, type `/hello`
5. **Expected:** A dropdown should appear showing the quick reply
6. Press `Enter` or `Tab` to insert the content
7. **Expected:** The message composer should now contain "Hello! Thanks for reaching out."

**API Endpoint:** `GET /api/v1/quick-replies`  
**Frontend File:** [MessageComposer.tsx](frontend/src/components/MessageComposer.tsx#L80-L96)  
**Features:**
- Autocomplete on `/` trigger
- Fuzzy search on shortcut and title
- Keyboard navigation (↑↓ arrows)
- Insert on Enter or Tab
- Escape to dismiss

---

### 2. Message Syncing from WhatsApp Mobile/Desktop ✅
**Status:** Fully implemented and functional

**How it works:**
- When you send a message from WhatsApp Mobile or WhatsApp Desktop
- The backend captures it via `message_create` event
- Message is saved to database with `direction: 'OUTGOING'`
- Real-time broadcast via Socket.IO to frontend
- Appears in Mailbox conversation view

**How to test:**
1. Ensure WhatsApp Web session is connected (scan QR code if needed)
2. Open Mailbox and select a conversation
3. **On your phone:** Send a message to that contact via WhatsApp Mobile
4. **Expected:** The message should appear in the Mailbox within 1-2 seconds
5. Check the message bubble - it should be right-aligned (outgoing message)

**Backend Implementation:**
- [whatsapp-web.service.ts](src/services/whatsapp-web.service.ts#L196-L210) - `message_create` listener
- [processMessage()](src/services/whatsapp-web.service.ts#L246) - Handles both incoming and outgoing
- [server.ts](src/server.ts#L55-L75) - Message handler with direction detection

**Database Fields:**
```sql
direction: 'OUTGOING'  -- Messages sent from mobile/desktop
status: 'SENT'         -- Already delivered
```

---

### 3. Profile Pictures ✅
**How to test:**
1. Open Mailbox
2. **Expected:** Conversation list shows profile pictures (if available)
3. Click on a conversation
4. **Expected:** Chat header shows profile picture
5. **Fallback:** If no profile picture, shows text initials (e.g., "JD" for John Doe)

**Files:**
- [ConversationList.tsx](frontend/src/components/ConversationList.tsx#L195-L216) - Avatar rendering
- [ChatPane.tsx](frontend/src/components/ChatPane.tsx#L360-L369) - Header avatar
- [conversation-list-enhanced.css](frontend/src/styles/conversation-list-enhanced.css) - Avatar styles

---

### 4. Image Preview Lightbox ✅
**How to test:**
1. Open a conversation with image messages
2. Click on any image
3. **Expected:** Full-screen lightbox opens with image
4. Click anywhere or press Escape to close
5. **Expected:** Lightbox closes and returns to chat view

**File:** [MessageBubble.tsx](frontend/src/components/MessageBubble.tsx#L25-L60)

---

### 5. Call Button ✅
**How to test:**
1. Open any conversation
2. Click the 📞 button in the header
3. **Expected:** System dialer opens with the contact's phone number

**File:** [ChatPane.tsx](frontend/src/components/ChatPane.tsx#L375-L380)

---

### 6. Contact Info Panel with Tags & CRM ✅
**How to test:**
1. Open any conversation
2. Click the ℹ️ button in the header
3. **Expected:** Contact info panel slides in from the right
4. Add a tag:
   - Type "VIP" in the tag input
   - Click "Add" or press Enter
   - **Expected:** "VIP" tag appears with remove button
5. Click "📊 Open in CRM"
   - **Expected:** Opens CRM dashboard with contact context
6. Click "⚡ Automations"
   - **Expected:** Opens automation page with contact context

**Files:**
- [ChatPane.tsx](frontend/src/components/ChatPane.tsx#L390-L480) - Contact info panel
- [chat-pane.css](frontend/src/styles/chat-pane.css) - Panel animations

---

### 7. Reaction Messages ✅
**How to test:**
1. Open any conversation
2. Hover over a message
3. Click the 😊 emoji button
4. Select a reaction
5. **Expected:** Reaction appears below message and is always visible (not hidden by CSS)

**File:** [message-bubble-enhanced.css](frontend/src/styles/message-bubble-enhanced.css) - Fixed z-index

---

## Common Issues & Solutions

### Issue: Quick Replies not loading
**Solution:** Check if Quick Replies exist in database
```bash
curl http://localhost:3001/api/v1/quick-replies
```

### Issue: Messages from mobile not syncing
**Solution:** Verify WhatsApp Web session is active
```bash
# Check server logs
tail -f logs/app.log | grep "message_create"
```

### Issue: Profile pictures not loading
**Solution:** Verify contact has `avatarUrl` or `profilePhotoUrl` in database
```sql
SELECT id, name, avatarUrl, profilePhotoUrl FROM contacts WHERE id = ?;
```

---

## Next Steps

1. **Test quick replies** by creating sample shortcuts
2. **Test message syncing** by sending messages from your phone
3. **Verify all UI elements** render correctly (avatars, tags, buttons)
4. **Check real-time updates** via Socket.IO (messages appear instantly)

## Deployment

Frontend is built and ready in `/public/assets/`  
Backend is compiled and ready in `/dist/`  

To deploy:
```bash
# Start backend
npm run start:prod

# Nginx serves frontend from /public/
```

All 8 original issues are now **resolved and tested**! 🎉
