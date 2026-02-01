// src/services/auto-reply.service.ts
// Advanced auto-reply service with fuzzy matching, deduplication, and rate limiting

import { QuickReply } from '@prisma/client';
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
const DUPLICATE_WINDOW_MS = 60000; // 1 minute window to prevent duplicate replies
const RATE_LIMIT_MS = 5000; // Minimum 5 seconds between auto-replies to same contact

export class AutoReplyService {
  /**
   * Clean up old entries from the recent auto-replies cache
   */
  private cleanupOldEntries(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    recentAutoReplies.forEach((value, key) => {
      if (now - value.timestamp > DUPLICATE_WINDOW_MS) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => recentAutoReplies.delete(key));
  }

  /**
   * Check if we should skip auto-reply due to rate limiting or recent duplicate
   */
  private shouldSkipAutoReply(context: AutoReplyContext, replyId: string): boolean {
    this.cleanupOldEntries();
    
    const key = `${context.userId}:${context.contactId}`;
    const recent = recentAutoReplies.get(key);
    
    if (!recent) return false;
    
    const timeSinceLastReply = context.timestamp - recent.timestamp;
    
    // Check rate limit
    if (timeSinceLastReply < RATE_LIMIT_MS) {
      logger.debug({ 
        contactId: context.contactId, 
        timeSince: timeSinceLastReply 
      }, 'Skipping auto-reply due to rate limit');
      return true;
    }
    
    // Check if same reply sent recently
    if (recent.replyId === replyId && timeSinceLastReply < DUPLICATE_WINDOW_MS) {
      logger.debug({ 
        contactId: context.contactId, 
        replyId,
        timeSince: timeSinceLastReply 
      }, 'Skipping duplicate auto-reply');
      return true;
    }
    
    return false;
  }

  /**
   * Mark that an auto-reply was sent
   */
  private markAutoReplySent(context: AutoReplyContext, replyId: string): void {
    const key = `${context.userId}:${context.contactId}`;
    recentAutoReplies.set(key, {
      timestamp: context.timestamp,
      replyId,
    });
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix: number[][] = [];

    if (len1 === 0) return len2;
    if (len2 === 0) return len1;

    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    // Calculate distances
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,     // deletion
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j - 1] + cost  // substitution
        );
      }
    }

    return matrix[len1][len2];
  }

  /**
   * Calculate similarity score (0-1) using Levenshtein distance
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen === 0) return 1.0;
    
    const distance = this.levenshteinDistance(str1, str2);
    return 1 - (distance / maxLen);
  }

  /**
   * Extract keywords from text (remove common words)
   */
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
      'se', 'me', 'ne', 'par', 'ke', 'aur', 'ya', 'bhi', 'abhi', 'yeh'
    ]);

    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !commonWords.has(word));
  }

  /**
   * Find best matching quick reply using multiple strategies
   */
  findBestMatch(messageText: string, quickReplies: QuickReply[]): MatchResult | null {
    if (!messageText || messageText.trim().length === 0) {
      return null;
    }

    // Filter only active quick replies with shortcuts
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

      // Strategy 2: Exact word match in message
      if (messageWords.includes(shortcut) || shortcutWords.every(sw => messageWords.includes(sw))) {
        matches.push({ reply, score: 0.95, matchType: 'exact' });
        continue;
      }

      // Strategy 3: Contains match
      if (normalizedMessage.includes(shortcut) || shortcut.includes(normalizedMessage)) {
        const containsScore = Math.min(shortcut.length, normalizedMessage.length) / 
                             Math.max(shortcut.length, normalizedMessage.length);
        matches.push({ reply, score: 0.85 * containsScore, matchType: 'contains' });
        continue;
      }

      // Strategy 4: Keyword overlap
      const shortcutKeywords = this.extractKeywords(shortcut);
      const commonKeywords = messageKeywords.filter(k => shortcutKeywords.includes(k));
      
      if (commonKeywords.length > 0 && shortcutKeywords.length > 0) {
        const keywordScore = commonKeywords.length / Math.max(messageKeywords.length, shortcutKeywords.length);
        if (keywordScore >= 0.4) { // At least 40% keyword overlap
          matches.push({ reply, score: 0.75 * keywordScore, matchType: 'keyword' });
          continue;
        }
      }

      // Strategy 5: Fuzzy matching for each word
      let maxFuzzyScore = 0;
      for (const word of messageWords) {
        if (word.length < 3) continue; // Skip very short words
        
        for (const shortcutWord of shortcutWords) {
          if (shortcutWord.length < 3) continue;
          
          const similarity = this.calculateSimilarity(word, shortcutWord);
          if (similarity > maxFuzzyScore) {
            maxFuzzyScore = similarity;
          }
        }
      }

      // Only consider fuzzy matches above 75% similarity
      if (maxFuzzyScore >= 0.75) {
        matches.push({ reply, score: 0.65 * maxFuzzyScore, matchType: 'fuzzy' });
      }
    }

    // Sort by score (highest first) and return best match
    if (matches.length === 0) {
      return null;
    }

    matches.sort((a, b) => b.score - a.score);
    
    // Only return matches with score above 0.5 (50% confidence)
    const bestMatch = matches[0];
    if (bestMatch.score < 0.5) {
      logger.debug({ 
        message: messageText.substring(0, 50),
        bestScore: bestMatch.score 
      }, 'Best match score too low, skipping auto-reply');
      return null;
    }

    logger.info({ 
      message: messageText.substring(0, 50),
      shortcut: bestMatch.reply.shortcut,
      score: bestMatch.score,
      matchType: bestMatch.matchType
    }, 'Found matching auto-reply');

    return bestMatch;
  }

  /**
   * Process auto-reply for incoming message
   */
  async processAutoReply(
    context: AutoReplyContext,
    quickReplies: QuickReply[]
  ): Promise<{ reply: QuickReply; matchType: string; score: number } | null> {
    try {
      // Find best matching reply
      const match = this.findBestMatch(context.messageText, quickReplies);
      
      if (!match) {
        return null;
      }

      // Check if we should skip due to rate limiting or duplicates
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
