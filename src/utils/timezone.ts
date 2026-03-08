// src/utils/timezone.ts
// Timezone-aware date formatting utility

const DEFAULT_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Karachi';
const DEFAULT_LOCALE = process.env.APP_LOCALE || 'en-US';

export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(DEFAULT_LOCALE, {
    timeZone: DEFAULT_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  });
}

export function formatDateTime(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString(DEFAULT_LOCALE, {
    timeZone: DEFAULT_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  });
}

export function formatTime(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString(DEFAULT_LOCALE, {
    timeZone: DEFAULT_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  });
}

export function getTimezone(): string {
  return DEFAULT_TIMEZONE;
}
