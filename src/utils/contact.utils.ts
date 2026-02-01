// src/utils/contact.utils.ts
// Contact data enrichment and management utilities

/**
 * Extract contact name from various sources with priority order
 * 1. Saved contact name in phone book
 * 2. Business name if available
 * 3. Display name/push name
 * 4. Phone number as fallback
 */
export function extractContactName(
  contactObj: any,
  phoneNumber: string
): { name: string; pushName?: string; businessName?: string } {
  let name: string = phoneNumber; // Default fallback
  let pushName: string | undefined;
  let businessName: string | undefined;

  // Try to get saved contact name
  if (contactObj?.name && typeof contactObj.name === 'string' && contactObj.name.trim()) {
    name = contactObj.name.trim();
  }

  // Get push name (what they display as in WhatsApp)
  if (contactObj?.pushname && typeof contactObj.pushname === 'string' && contactObj.pushname.trim()) {
    pushName = contactObj.pushname.trim();
    // Prefer pushname over generic name if no saved name
    if (!contactObj?.name || !contactObj.name.trim()) {
      name = pushName as string;
    }
  }

  // Check for business profile name
  if (contactObj?.isBusiness && contactObj?.formattedName) {
    businessName = contactObj.formattedName.trim();
  } else if (contactObj?.formattedName) {
    businessName = contactObj.formattedName.trim();
  }

  return { name, pushName, businessName };
}

/**
 * Extract profile picture URL from contact
 */
export function extractProfilePhotoUrl(contactObj: any): string | undefined {
  if (!contactObj) return undefined;

  // Try various possible properties for profile photo
  const photoProps = ['profilePicThumbObj', 'profilePicUrl', 'picture'];

  for (const prop of photoProps) {
    if (contactObj[prop]) {
      if (typeof contactObj[prop] === 'string') {
        return contactObj[prop];
      }
      // Sometimes it's an object with a 'url' property
      if (typeof contactObj[prop] === 'object' && contactObj[prop].url) {
        return contactObj[prop].url;
      }
    }
  }

  return undefined;
}

/**
 * Determine if contact is a business account
 */
export function isBusinessAccount(contactObj: any): boolean {
  return (
    (contactObj?.isBusiness === true) ||
    (contactObj?.verificationLevel && contactObj.verificationLevel !== 'unverified')
  );
}

/**
 * Extract timezone from contact metadata
 */
export function extractTimezone(contactObj: any): string | undefined {
  return contactObj?.timezone;
}

/**
 * Extract phone number in various formats
 */
export function formatPhoneNumber(
  rawPhone: string,
  options?: { format?: 'international' | 'national' | 'raw' }
): string {
  const format = options?.format || 'raw';

  // Remove @ and everything after
  const base = rawPhone.split('@')[0];
  // Keep only digits
  const digits = base.replace(/\D/g, '');

  if (format === 'raw') return digits;

  // Add country code if not present (assume +92 for Pakistan as example)
  if (digits.length === 10 && !digits.startsWith('92')) {
    return '92' + digits;
  }

  return digits;
}

/**
 * Calculate engagement score based on interaction patterns
 */
export function calculateEngagementScore(
  messageCount: number,
  lastActiveDaysAgo: number,
  averageResponseTime: number
): number {
  let score = 0;

  // Message frequency (max 30 points)
  if (messageCount >= 50) score += 30;
  else if (messageCount >= 20) score += 20;
  else if (messageCount >= 10) score += 15;
  else if (messageCount >= 5) score += 10;
  else if (messageCount > 0) score += 5;

  // Recency (max 40 points)
  if (lastActiveDaysAgo === 0) score += 40;
  else if (lastActiveDaysAgo <= 1) score += 35;
  else if (lastActiveDaysAgo <= 7) score += 25;
  else if (lastActiveDaysAgo <= 30) score += 15;
  else if (lastActiveDaysAgo <= 90) score += 5;

  // Response time (max 30 points)
  if (averageResponseTime <= 1) score += 30; // <= 1 hour
  else if (averageResponseTime <= 4) score += 20; // <= 4 hours
  else if (averageResponseTime <= 24) score += 15; // <= 1 day
  else if (averageResponseTime <= 72) score += 10; // <= 3 days
  else score += 5;

  return Math.min(score, 100);
}

/**
 * Classify contact by engagement level
 */
export function classifyEngagementLevel(
  score: number
): 'high' | 'medium' | 'low' | 'inactive' {
  if (score >= 75) return 'high';
  if (score >= 50) return 'medium';
  if (score >= 25) return 'low';
  return 'inactive';
}

/**
 * Detect contact type (individual, business, broadcast list, etc.)
 */
export function detectContactType(
  phoneNumber: string,
  contactObj?: any
): 'individual' | 'business' | 'group' | 'broadcast' {
  // Broadcast lists typically end with specific patterns
  if (phoneNumber.includes('broadcast')) return 'broadcast';

  // Groups end with -g in WhatsApp format
  if (phoneNumber.includes('-g')) return 'group';

  // Check contact object properties
  if (isBusinessAccount(contactObj)) return 'business';

  return 'individual';
}

export default {
  extractContactName,
  extractProfilePhotoUrl,
  isBusinessAccount,
  extractTimezone,
  formatPhoneNumber,
  calculateEngagementScore,
  classifyEngagementLevel,
  detectContactType,
};
