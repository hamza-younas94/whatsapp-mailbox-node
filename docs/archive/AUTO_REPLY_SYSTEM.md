# Advanced Auto-Reply System

## Overview

The new auto-reply system provides intelligent, context-aware message matching with built-in safeguards against spam and duplicate responses.

## Key Features

### 1. **Multiple Matching Strategies**
The system uses a priority-based approach to find the best matching quick reply:

#### Priority Order:
1. **Exact Match** (Score: 1.0)
   - Full message matches shortcut exactly
   - Example: Message "payment" matches shortcut "payment"

2. **Exact Word Match** (Score: 0.95)
   - Message contains the shortcut as a complete word
   - Example: Message "payment kab tak" matches shortcut "payment"

3. **Contains Match** (Score: 0.85 * similarity)
   - Message or shortcut contains the other
   - Example: Message "payments" partially matches shortcut "payment"

4. **Keyword Overlap** (Score: 0.75 * overlap ratio)
   - Significant keyword overlap between message and shortcut
   - Filters common words (the, is, at, kya, hai, etc.)
   - Requires at least 40% keyword overlap
   - Example: Message "bhai payment kab bhejoge" matches shortcut "payment send"

5. **Fuzzy Match** (Score: 0.65 * similarity)
   - Uses Levenshtein distance algorithm
   - Requires at least 75% similarity
   - Example: Message "paymet" matches shortcut "payment" (typo tolerance)

### 2. **Rate Limiting**
- **Minimum Gap**: 5 seconds between auto-replies to the same contact
- **Purpose**: Prevents spam if user sends multiple messages rapidly
- Tracked per user-contact pair

### 3. **Deduplication**
- **Window**: 1 minute (60 seconds)
- **Purpose**: Prevents sending the same reply multiple times
- If the same quick reply was sent to a contact within 1 minute, it won't be sent again
- Automatically cleans up old entries to prevent memory leaks

### 4. **Confidence Threshold**
- Only sends auto-replies with confidence score ≥ 0.5 (50%)
- Prevents irrelevant or poorly matched responses
- All matches are logged with their scores for debugging

### 5. **Usage Statistics**
Automatically tracks:
- `usageCount`: Total times the quick reply has been used
- `usageTodayCount`: Times used today
- `lastUsedAt`: Last usage timestamp
- Helps identify popular replies and optimize your response library

### 6. **Active Status Filter**
- Only considers quick replies marked as `isActive: true`
- Allows you to disable replies without deleting them

## How It Works

### Incoming Message Flow

```
1. User sends message
   ↓
2. Check if group/channel (skip if yes)
   ↓
3. Check if incoming message has text
   ↓
4. Fetch all active quick replies
   ↓
5. Find best match using multi-strategy approach
   ↓
6. Check rate limit (5 sec gap)
   ↓
7. Check deduplication (1 min window)
   ↓
8. Send auto-reply
   ↓
9. Update usage statistics
   ↓
10. Log match details (shortcut, score, type)
```

## Configuration

### Rate Limiting
Edit in `src/services/auto-reply.service.ts`:
```typescript
const RATE_LIMIT_MS = 5000; // Change to adjust minimum gap
```

### Deduplication Window
Edit in `src/services/auto-reply.service.ts`:
```typescript
const DUPLICATE_WINDOW_MS = 60000; // Change to adjust window
```

### Matching Thresholds
- **Keyword overlap minimum**: 40% (line ~210)
- **Fuzzy match minimum**: 75% similarity (line ~230)
- **Confidence threshold**: 50% (line ~245)

## Example Scenarios

### Scenario 1: Payment Inquiry
**Message**: "bhai payment kab tak send kro ga"

**Process**:
1. Extract keywords: ["bhai", "payment", "send"]
2. Match against shortcuts
3. Find "payment" shortcut
4. Keyword overlap score: 0.75 × (2/3) = 0.5
5. ✅ Pass threshold, send reply

### Scenario 2: Typo Handling
**Message**: "paymet details"

**Process**:
1. No exact match
2. No contains match
3. Fuzzy match: "paymet" vs "payment"
4. Similarity: 85%
5. Score: 0.65 × 0.85 = 0.55
6. ✅ Pass threshold, send reply

### Scenario 3: Rate Limit
**Timeline**:
- 1:00:00 PM - User sends "payment"
- 1:00:02 PM - User sends "payment info"
- Result: ❌ Second message skipped (< 5 sec gap)

### Scenario 4: Deduplication
**Timeline**:
- 1:00:00 PM - User sends "payment" → Reply A sent
- 1:00:30 PM - User sends "payment query" → Reply A matches
- Result: ❌ Skipped (same reply within 1 min)

## Debugging

### Check Logs
All auto-reply attempts are logged:

```bash
# Success
"Auto-reply sent and saved to history"
# Includes: shortcut, matchType, score, savedId

# Rate limit
"Skipping auto-reply due to rate limit"
# Includes: contactId, timeSince

# Duplicate
"Skipping duplicate auto-reply"
# Includes: contactId, replyId, timeSince

# Low confidence
"Best match score too low, skipping auto-reply"
# Includes: message, bestScore
```

### Enable Debug Logging
Set log level in your environment:
```env
LOG_LEVEL=debug
```

## Best Practices

### 1. **Choose Clear Shortcuts**
- ✅ Good: "payment", "pricing", "support"
- ❌ Bad: "p", "info", "help" (too generic)

### 2. **Use Specific Keywords**
- Include distinctive words in shortcuts
- Avoid very common words (the, is, how, what)

### 3. **Test Your Replies**
- Send test messages to verify matching
- Check logs to see match scores
- Adjust shortcuts if scores are too low

### 4. **Organize by Category**
- Group related replies together
- Use descriptive titles
- Mark test/old replies as inactive

### 5. **Monitor Usage Statistics**
- Review `usageCount` to find popular replies
- Optimize shortcuts for frequently used replies
- Archive unused replies

## Limitations

1. **Language Support**: Currently optimized for English and basic Urdu
2. **Context Awareness**: Doesn't understand conversation history
3. **Memory**: Tracks recent replies in-memory (cleared on restart)
4. **Groups**: Auto-replies disabled for groups and channels
5. **Media**: Only works with text messages

## Future Enhancements

- [ ] Conversation context awareness
- [ ] Learning from user corrections
- [ ] Multi-language support expansion
- [ ] Sentiment analysis
- [ ] Time-based rules (business hours)
- [ ] Custom rate limits per quick reply
- [ ] A/B testing for reply effectiveness

## Troubleshooting

### Auto-reply not triggering
1. Check if quick reply is marked as `isActive: true`
2. Verify the message is not from a group/channel
3. Check if rate limit is active (< 5 sec since last reply)
4. Review logs for match score (might be < 0.5 threshold)

### Wrong reply being sent
1. Review the shortcut keywords
2. Check match score in logs
3. Make shortcuts more specific
4. Consider disabling conflicting replies

### Too many auto-replies
1. Rate limiting should prevent this
2. Check if multiple shortcuts match the same message
3. Review and consolidate similar replies

### Auto-replies stopped working
1. Check Node.js server status
2. Verify WhatsApp session is connected
3. Review error logs for exceptions
4. Restart the server if needed

## API Reference

### AutoReplyService Methods

#### `findBestMatch(messageText, quickReplies)`
Finds the best matching quick reply for a message.

**Returns**: `MatchResult | null`
```typescript
{
  reply: QuickReply;
  score: number;        // 0-1
  matchType: 'exact' | 'contains' | 'fuzzy' | 'keyword';
}
```

#### `processAutoReply(context, quickReplies)`
Main entry point for processing auto-replies.

**Returns**: `{ reply, matchType, score } | null`

## Support

For issues or questions:
1. Check logs first
2. Review this documentation
3. Test with simple messages
4. Contact technical support if issue persists
