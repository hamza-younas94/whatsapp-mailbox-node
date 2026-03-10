// src/services/auto-reply.service.ts
// Advanced auto-reply service with conversation awareness, fuzzy matching, deduplication, and rate limiting

import { PrismaClient, QuickReply } from '@prisma/client';
import logger from '@utils/logger';

interface AutoReplyContext {
  userId: string;
  contactId: string;
  conversationId: string;
  messageText: string;
  timestamp: number;
}

interface MatchResult {
  reply: QuickReply;
  score: number;
  matchType: 'exact' | 'contains' | 'fuzzy' | 'keyword';
}

// Track recent auto-replies to prevent duplicates
const recentAutoReplies = new Map<string, { timestamp: number; replyId: string }>();
const COOLDOWN_WINDOW_MS = 30 * 60 * 1000; // 30 minutes — don't auto-reply same contact within this window
const RATE_LIMIT_MS = 10000; // Minimum 10 seconds between auto-replies to same contact
const ONGOING_CONVERSATION_MS = 4 * 60 * 60 * 1000; // 4 hours — if you sent a message within this window, it's an ongoing conversation

export class AutoReplyService {
  private cleanupOldEntries(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    recentAutoReplies.forEach((value, key) => {
      if (now - value.timestamp > COOLDOWN_WINDOW_MS) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => recentAutoReplies.delete(key));
  }

  private shouldSkipAutoReply(context: AutoReplyContext, replyId: string): boolean {
    this.cleanupOldEntries();

    const key = `${context.userId}:${context.contactId}`;
    const recent = recentAutoReplies.get(key);

    if (!recent) return false;

    const timeSinceLastReply = context.timestamp - recent.timestamp;

    // Rate limit: minimum gap between auto-replies to same contact
    if (timeSinceLastReply < RATE_LIMIT_MS) {
      logger.debug({ contactId: context.contactId, timeSince: timeSinceLastReply }, 'Skipping auto-reply: rate limit');
      return true;
    }

    // Cooldown: don't send another auto-reply to same contact within window
    if (timeSinceLastReply < COOLDOWN_WINDOW_MS) {
      logger.debug({ contactId: context.contactId, timeSince: timeSinceLastReply }, 'Skipping auto-reply: cooldown window');
      return true;
    }

    return false;
  }

  private markAutoReplySent(context: AutoReplyContext, replyId: string): void {
    const key = `${context.userId}:${context.contactId}`;
    recentAutoReplies.set(key, {
      timestamp: context.timestamp,
      replyId,
    });
  }

  /**
   * Check if this is an ongoing conversation (user sent a message to this contact recently).
   * If the user already replied manually, the contact is responding to them — don't auto-reply.
   */
  async isOngoingConversation(prisma: PrismaClient, userId: string, contactId: string): Promise<boolean> {
    const cutoff = new Date(Date.now() - ONGOING_CONVERSATION_MS);

    const recentOutgoing = await prisma.message.findFirst({
      where: {
        userId,
        contactId,
        direction: 'OUTGOING',
        quickReplyId: null, // Exclude previous auto-replies — only check manual messages
        createdAt: { gte: cutoff },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true },
    });

    if (recentOutgoing) {
      logger.info({ contactId, lastOutgoing: recentOutgoing.createdAt }, 'Skipping auto-reply: ongoing conversation (user sent message recently)');
      return true;
    }

    return false;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix: number[][] = [];

    if (len1 === 0) return len2;
    if (len2 === 0) return len1;

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    return matrix[len1][len2];
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen === 0) return 1.0;

    const distance = this.levenshteinDistance(str1, str2);
    return 1 - (distance / maxLen);
  }

  private extractKeywords(text: string): string[] {
    const commonWords = new Set([
      'the', 'is', 'at', 'which', 'on', 'in', 'a', 'an', 'and', 'or', 'but',
      'to', 'for', 'of', 'with', 'as', 'by', 'from', 'up', 'about', 'into',
      'through', 'during', 'can', 'could', 'will', 'would', 'should', 'may',
      'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us',
      'them', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'this', 'that',
      'these', 'those', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'doing', 'what', 'when',
      'where', 'who', 'why', 'how', 'kya', 'hai', 'ho', 'ka', 'ki', 'ko',
      'se', 'me', 'ne', 'par', 'ke', 'aur', 'ya', 'bhi', 'abhi', 'yeh',
      'please', 'thanks', 'thank', 'okay', 'ok', 'yes', 'no', 'hi', 'hello',
      'hey', 'salaam', 'salam', 'bro', 'bhai', 'brother', 'sir', 'madam',
      'sorry', 'good', 'bad', 'just', 'like', 'very', 'much', 'also', 'too',
      'well', 'now', 'here', 'there', 'then', 'only', 'still', 'already',
    ]);

    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !commonWords.has(word));
  }

  findBestMatch(messageText: string, quickReplies: QuickReply[]): MatchResult | null {
    if (!messageText || messageText.trim().length === 0) {
      return null;
    }

    const activeReplies = quickReplies.filter(qr => qr.isActive && qr.shortcut);

    if (activeReplies.length === 0) {
      return null;
    }

    const normalizedMessage = messageText.toLowerCase().trim();
    const messageWords = normalizedMessage
      .split(/\s+/)
      .map(word => word.replace(/[^\w]/g, ''));
    const messageKeywords = this.extractKeywords(normalizedMessage);

    const matches: MatchResult[] = [];

    for (const reply of activeReplies) {
      if (!reply.shortcut) continue;

      const shortcut = reply.shortcut.toLowerCase().trim();
      const shortcutWords = shortcut.split(/\s+/).map(word => word.replace(/[^\w]/g, ''));

      // Strategy 1: Exact match (highest priority)
      if (normalizedMessage === shortcut) {
        matches.push({ reply, score: 1.0, matchType: 'exact' });
        continue;
      }

      // Strategy 2: All shortcut words appear in message
      if (shortcutWords.length > 0 && shortcutWords.every(sw => messageWords.includes(sw))) {
        // Penalize if message is much longer than shortcut (likely just a coincidence)
        const lengthRatio = shortcutWords.length / messageWords.length;
        const score = lengthRatio >= 0.5 ? 0.95 : 0.85 * lengthRatio;
        if (score >= 0.5) {
          matches.push({ reply, score, matchType: 'exact' });
        }
        continue;
      }

      // Strategy 3: Contains match — only when shortcut is contained in message (not reverse)
      if (normalizedMessage.includes(shortcut) && shortcut.length >= 4) {
        const lengthRatio = shortcut.length / normalizedMessage.length;
        // Only match if shortcut is a significant portion of the message
        if (lengthRatio >= 0.3) {
          matches.push({ reply, score: 0.85 * lengthRatio, matchType: 'contains' });
        }
        continue;
      }

      // Strategy 4: Keyword overlap (require at least 70% overlap)
      const shortcutKeywords = this.extractKeywords(shortcut);
      const commonKeywords = messageKeywords.filter(k => shortcutKeywords.includes(k));

      if (commonKeywords.length >= 2 && shortcutKeywords.length > 0) {
        const keywordScore = commonKeywords.length / Math.max(messageKeywords.length, shortcutKeywords.length);
        if (keywordScore >= 0.7) {
          matches.push({ reply, score: 0.7 * keywordScore, matchType: 'keyword' });
          continue;
        }
      }

      // Strategy 5: Fuzzy matching — only for very close matches (90%+ similarity)
      let maxFuzzyScore = 0;
      for (const word of messageWords) {
        if (word.length < 4) continue;

        for (const shortcutWord of shortcutWords) {
          if (shortcutWord.length < 4) continue;

          const similarity = this.calculateSimilarity(word, shortcutWord);
          if (similarity > maxFuzzyScore) {
            maxFuzzyScore = similarity;
          }
        }
      }

      if (maxFuzzyScore >= 0.9) {
        matches.push({ reply, score: 0.6 * maxFuzzyScore, matchType: 'fuzzy' });
      }
    }

    if (matches.length === 0) {
      return null;
    }

    matches.sort((a, b) => b.score - a.score);

    // Only return matches with score above 0.80 (80% confidence)
    const bestMatch = matches[0];
    if (bestMatch.score < 0.80) {
      logger.debug({
        message: messageText.substring(0, 50),
        bestScore: bestMatch.score.toFixed(2),
        matchType: bestMatch.matchType,
      }, 'Best match score too low, skipping auto-reply');
      return null;
    }

    logger.info({
      message: messageText.substring(0, 50),
      shortcut: bestMatch.reply.shortcut,
      score: bestMatch.score.toFixed(2),
      matchType: bestMatch.matchType
    }, 'Found matching auto-reply');

    return bestMatch;
  }

  async processAutoReply(
    context: AutoReplyContext,
    quickReplies: QuickReply[],
    prisma?: PrismaClient
  ): Promise<{ reply: QuickReply; matchType: string; score: number } | null> {
    try {
      // Check if this is an ongoing conversation — don't interrupt with auto-replies
      if (prisma) {
        const ongoing = await this.isOngoingConversation(prisma, context.userId, context.contactId);
        if (ongoing) {
          return null;
        }
      }

      // Find best matching reply
      const match = this.findBestMatch(context.messageText, quickReplies);

      if (!match) {
        return null;
      }

      // Check if we should skip due to rate limiting or cooldown
      if (this.shouldSkipAutoReply(context, match.reply.id)) {
        return null;
      }

      // Mark that we're sending this auto-reply
      this.markAutoReplySent(context, match.reply.id);

      return {
        reply: match.reply,
        matchType: match.matchType,
        score: match.score,
      };
    } catch (error) {
      logger.error({ error, context }, 'Error processing auto-reply');
      return null;
    }
  }
}

// Export singleton instance
export const autoReplyService = new AutoReplyService();
