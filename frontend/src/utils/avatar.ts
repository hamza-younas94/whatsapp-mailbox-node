// Compute local avatar URL from chatId, avoiding expired CDN URLs (403 errors)
export function getAvatarUrl(
  profilePhotoUrl: string | null | undefined,
  chatId: string | null | undefined
): string | null {
  // Local URLs are safe to use directly
  if (profilePhotoUrl && profilePhotoUrl.startsWith('/')) {
    return profilePhotoUrl;
  }

  // Compute local avatar path from chatId (matches backend avatar.ts naming)
  if (chatId) {
    return `/uploads/avatars/${chatId.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`;
  }

  return null;
}

// Get display initial for avatar placeholder
export function getAvatarInitial(name?: string | null): string {
  if (!name) return '?';
  // Skip leading + or digits (phone numbers)
  const cleaned = name.replace(/^[+\d\s()-]+/, '');
  if (cleaned.length > 0) return cleaned.charAt(0).toUpperCase();
  // If name is all digits/phone, show person icon
  return '#';
}
