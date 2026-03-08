// Shared date formatting utility for WhatsApp Mailbox
// Auto-detects user's browser timezone for consistent display

const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

function formatDate(date, options = {}) {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', {
        timeZone: userTimezone,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        ...options,
    });
}

function formatDateTime(date, options = {}) {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-US', {
        timeZone: userTimezone,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        ...options,
    });
}

function formatTime(date, options = {}) {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('en-US', {
        timeZone: userTimezone,
        hour: '2-digit',
        minute: '2-digit',
        ...options,
    });
}

function formatRelativeDate(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '—';
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(d);
}
