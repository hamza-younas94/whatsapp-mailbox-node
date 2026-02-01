/**
 * Utility functions for contact type determination
 */

export type ContactType = 'contact' | 'group' | 'channel' | 'broadcast' | 'unknown';

/**
 * Determine contact type from chatId or phoneNumber
 */
export function getContactType(chatId?: string | null, phoneNumber?: string): ContactType {
  if (!chatId && !phoneNumber) return 'unknown';

  const id = chatId || phoneNumber || '';
  
  if (id.endsWith('@g.us')) return 'group';
  if (id.endsWith('@newsletter')) return 'channel';
  if (id.endsWith('@broadcast')) return 'broadcast';
  if (id.endsWith('@c.us') || !id.includes('@')) return 'contact';
  
  return 'contact'; // Default to contact
}

/**
 * Get display label for contact type
 */
export function getContactTypeLabel(type: ContactType | string): string {
  const typeMap: Record<string, string> = {
    group: 'Group',
    channel: 'Channel',
    broadcast: 'Broadcast',
    contact: 'Contact',
    individual: 'Contact',
    unknown: 'Unknown',
  };

  return typeMap[type?.toLowerCase() || 'contact'] || 'Contact';
}
