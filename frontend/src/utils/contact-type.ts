/**
 * Utility functions to determine and display contact type
 */

export type ContactTypeEnum = 'contact' | 'group' | 'channel' | 'broadcast' | 'unknown';

export interface ContactTypeInfo {
  type: ContactTypeEnum;
  label: string;
  icon: string;
  color: string;
}

/**
 * Determine contact type from chatId or phoneNumber
 * - chatId ending with @c.us = regular contact
 * - chatId ending with @g.us = group
 * - chatId ending with @newsletter = channel
 * - chatId ending with @broadcast = broadcast list
 */
export function getContactTypeFromId(
  chatId?: string | null,
  phoneNumber?: string,
  contactType?: string | null,
): ContactTypeEnum {
  if (contactType) {
    const normalized = contactType.toLowerCase();
    if (normalized === 'group') return 'group';
    if (normalized === 'channel') return 'channel';
    if (normalized === 'broadcast') return 'broadcast';
    if (normalized === 'individual' || normalized === 'business' || normalized === 'contact') return 'contact';
  }

  if (!chatId && !phoneNumber) return 'unknown';

  const id = chatId || phoneNumber || '';

  if (id.endsWith('@g.us')) return 'group';
  if (id.endsWith('@newsletter')) return 'channel';
  if (id.endsWith('@broadcast')) return 'broadcast';
  if (id.endsWith('@c.us') || id.includes('@c.us')) return 'contact';

  // Default to contact if no suffix found
  return 'contact';
}

/**
 * Get display info for a contact type
 */
export function getContactTypeInfo(type: ContactTypeEnum): ContactTypeInfo {
  const typeMap: Record<ContactTypeEnum, ContactTypeInfo> = {
    contact: {
      type: 'contact',
      label: 'Contact',
      icon: '👤',
      color: '#3b82f6', // blue
    },
    group: {
      type: 'group',
      label: 'Group',
      icon: '👥',
      color: '#10b981', // green
    },
    channel: {
      type: 'channel',
      label: 'Channel',
      icon: '📢',
      color: '#f59e0b', // amber
    },
    broadcast: {
      type: 'broadcast',
      label: 'Broadcast',
      icon: '📻',
      color: '#8b5cf6', // purple
    },
    unknown: {
      type: 'unknown',
      label: 'Unknown',
      icon: '❓',
      color: '#6b7280', // gray
    },
  };

  return typeMap[type];
}

/**
 * Format contact type for display
 */
export function formatContactType(type: ContactTypeEnum | string): string {
  if (!type) return 'Contact';
  
  const typeEnum = type.toLowerCase() as ContactTypeEnum;
  const info = getContactTypeInfo(typeEnum);
  return `${info.icon} ${info.label}`;
}

/**
 * Get badge class name for styling
 */
export function getContactTypeBadgeClass(type: ContactTypeEnum): string {
  return `contact-type-badge contact-type-${type}`;
}
